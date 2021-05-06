const SerialPort = require('serialport');
const util = require('util');
const events = require('events');

/**
 * 错误代码
 */
const ErrorCode = Object.freeze({
    1: '校验码错误',
    2: '温度过高',
    3: '反射过大',
    4: '其他'
});

/**
 * 发送命令
 * @class
 */
function CommandData() {
    /** @property {Array<Number>} command 发送指令集 */
    this.command = [];
    /** @property {Number} responseCommand 响应指令位 */
    this.responseCommand = 0x00;
    /** @callback responseCallback */
    this.responseCallback = function (data) { };
};

/**
 * 串口驱动
 * @class
 * @external {@link external:EventEmitter}
 * @param {String} path 串口地址
 * @param {Number} baudRate 串口波特率
 */
function Driver(path, baudRate) {
    if (!(this instanceof Driver)) {
        return new Driver();
    }

    /** @private @property {String} 串口地址 */
    this.path = path;
    /** @private @property {Number} 串口波特率 */
    this.baudRate = baudRate;
    /** @private @property {boolean} 串口是否已打开 */
    this.isOpen = false;

    let _this = this;

    /** @private @property {SerialPort} 串口对象 */
    _this.serialPort = new SerialPort(path, {
        baudRate: baudRate
    });

    _this.openListenter = () => {
        _this.isOpen = true;
        _this.emit('open');
    };
    _this.closeListenter = () => {
        _this.isOpen = false;
        _this.emit('close');
    };
    _this.dataListenter = (data) => {
        _this.analysisCommand(data);
    };
    _this.errorListenter = (error) => {
        _this.emit('error', error);
    };

    _this.serialPort.on('open', _this.openListenter);
    _this.serialPort.on('data', _this.dataListenter);
    _this.serialPort.on('close', _this.closeListenter);
    _this.serialPort.on('error', _this.errorListenter);
};

/** 继承自EventEmitter */
util.inherits(Driver, events.EventEmitter);

/** @public @readonly @static @property {String} 事件名称前缀 */
Driver.EVENT = 'Type';

/** @public @readonly @static @property {Number} 帧起始标志 */
Driver.HEAD = 0xBB;
/** @public @readonly @static @property {Number} 帧结束1 */
Driver.ETX1 = 0x0D;
/** @public @readonly @static @property {Number} 帧结束2 */
Driver.ETX2 = 0x0A;
Driver.ERROR = 0xFF;
Driver.WAIT = 0xFE;
/**
 * 发送命令
 * @param {CommandData} data 发送命令信息
 */
Driver.prototype.sendCommand = function (data) {
    if (this.isOpen) {
        let _this = this;
        const TYPE = data.responseCommand;
        const CALLBACK = function (bytes) {
            data.responseCallback(bytes);
            _this.removeListener(Driver.EVENT + TYPE, data.responseCallback);
        };

        // 设定CRC
        let command = data.command;
        let crc = CRC_16(command);
        command[command.length - 3] = crc;

        // 监听数据回调
        this.on(Driver.EVENT + TYPE, CALLBACK);

        // 写入指令
        this.serialPort.write(command);

        // 打印指令集
        console.log(`send:${Buffer.from(command).toString('hex').toUpperCase()}`)
    } else {
        this.emit('error', 'close');
    }
};

/**
 * 获取响应指令是否成功
 * @param {Int32Array} command 指令集
 * @return {boolean} 响应指令成功为true,否则为失败
 */
Driver.prototype.checkCommand = function (command) {
    if (command === undefined) {
        return false;
    } else {
        let crc = command[command.length - 3];
        let _crc = CRC_16(command);
        if (crc === _crc) {
            return true;
        }
    }
    return false;
}

/**
 * 解析响应数据
 * @param {Buffer} data 响应数据
 */
Driver.prototype.analysisCommand = function (data) {
    // console.log(`reviced:${data.toString('hex').toUpperCase()}`);
    let _this = this;

    // 拉取上次未解析完成的指令集
    if (_this.nextData !== null && _this.nextData !== undefined) {
        data = Buffer.concat([_this.nextData, data], _this.nextData.length + data.length);
    }

    let _startBit = -1;
    let _endBit = -1;

    // 记录一段指令集
    let _data = [];
    for (let bit = 0; bit < data.length; bit++) {
        // 记录当前起始位
        if (data[bit] === Driver.HEAD) {
            _data = [];
            _startBit = bit;
        }
        // 记录从起始位到结束位的值
        if (_startBit != -1) {
            let _bit = data[bit];
            _data.push(_bit);
        }
        if (data[bit] === Driver.ETX2 && data[bit - 1] === Driver.ETX1 && _startBit !== -1) {
            // 记录当前结束位
            _endBit = bit;

            // 错误指令
            if (data[1] === Driver.ERROR) {
                _this.emit('error', ErrorCode[data[3]]);
            }

            // 读写器模块未查询到任何标签
            if (data[1] === Driver.WAIT) {
                _this.emit('wait');
            }

            // EPC解析时 CRC无法校验
            if (data[1] === 0x97 || data[1] === 0x96 || data[1] === 0x99) {
                // 判断EPC码数据长度
                if (_data.length >= 23) {
                    // 获取指令的类型
                    let eventName = Driver.EVENT + _data[1];
                    /** 
                     * 截断指令后通知相应的监听器解析指令
                     * @event R2000#Event...
                     * @type {Buffer}
                     */
                    _this.emit(eventName, _data);
                }
            }
            // 检测CRC位
            else if (_this.checkCommand(_data)) {
                // 获取指令的类型
                let eventName = Driver.EVENT + _data[1];
                /** 
                 * 截断指令后通知相应的监听器解析指令
                 * @event R2000#Event...
                 * @type {Buffer}
                 */
                _this.emit(eventName, _data);
            }
        }
    }
    // 如果数据未解析完成则保存到下一个缓存中
    if (_startBit === -1 || _endBit === -1) {
        _this.nextData = data;
    }
    // 如果数据已解析完成则清空缓存
    else {
        _this.nextData = null;
    }
}

/**
 * 关闭串口
 */
Driver.prototype.close = function () {
    this.serialPort.close();
}

/**
 * 获取CRC16校验值
 * @param {Array<Number>} command 指令集 
 * @return {Number} 返回CRC16校验值
 */
function CRC_16(command) {
    let crc = 0;
    for (let i = 1; i < command.length - 3; i++) {
        crc += command[i] & 0xFF;
    }
    return crc;
}

module.exports = Driver;