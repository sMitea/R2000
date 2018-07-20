const Driver = require('./driver');
const util = require('util');
const events = require('events');

/**
 * 过滤类型枚举
 * @readonly
 * @enum {Number}
 */
R2000.FilterTypeEnum = Object.freeze({
    /** @type {Number} EPC过滤方式*/
    EPC: 0x00,
    /** @type {Number} TID过滤方式*/
    TID: 0x01
});

/**
 * 串口波特率枚举
 */
R2000.BauteEnum = Object.freeze({
    B9600: 0,
    B19200: 1,
    B38400: 2,
    B57600: 3,
    B115200: 4
});


/**
 * 读写器功率信息
 * @class
 */
function PowerOption() {
    /** @property {Number} readPower 读功率 */
    this.readPower = 30;
    /** @property {Number} writePower 写功率 */
    this.writePower = 30;
    /** @property {boolean} isLoop 是否开环 */
    this.isLoop = true;
};

/**
 * 标签信息
 * @class
 */
function Tag() {
    /** @property {String} epc EPC码 */
    this.epc = null;
    /** @property {Number} rssi 场强值 */
    this.rssi = 0;
    /** @property {Number} PC PC地址 */
    this.pc = 0;
    /** @property {Number} ant 天线编号 */
    this.ant = 0;
};

/**
 * 标签数据
 */
function TagInfo() {
    /** @property {String} epc EPC码 */
    this.epc = null;
    /** @property {Number} ant 天线编号 */
    this.ant = 0;
};

/**
 * 标签写入结果
 */
function WriteTagResult() {
    /** @property {Number} ant 写入的天线号*/
    this.ant = 0;
    /** @property {boolean} isSuccess 写入成功为true,否则为false */
    this.isSuccess = false;
}

/**
 * R2000读写器驱动
 * @class
 * @param {String} path 串口地址
 * @param {Number} baudRate 串口波特率
 * 
 * @event R2000#wait 读写器模块等待读取标签
 * @event R2000#run 读写器模块开始查询标签
 * 
 * @event R2000#open 读写器模块链接
 * @event R2000#close 读写器模块关闭
 * @event R2000#error 读写器出现错误
 * 
 * @event R2000#EPC 读写器EPC数据
 */
function R2000(path, baudRate) {
    if (!(this instanceof R2000)) {
        return new R2000(path, baudRate);
    }
    /** 临时引用当前对象 */
    let _this = this;

    /**  @private @property {Driver} 通信驱动 */
    _this.driver = new Driver(path, baudRate);
    /**  @public @property {boolean} 模块是否在读取中 */
    _this.isRead = false;
    /**  @public @property {boolean} 是否已连接模块 */
    _this.isOpen = false;

    _this.openListenter = () => {
        _this.isOpen = true;

        _this.emit('open');
    };
    _this.closeListenter = () => {
        _this.isOpen = false;
        _this.isRead = false;

        _this.emit('close');

        // 移除事件
        _this.driver.removeListener('open', _this.openListenter);
        _this.driver.removeListener('close', _this.closeListenter);
        _this.driver.removeListener('error', _this.errorListenter);
    };
    _this.errorListenter = (error) => {
        _this.emit('error', error);
    };
    _this.waitListenter = () => {
        _this.emit('wait');
    };

    _this.driver.on('open', _this.openListenter);
    _this.driver.on('close', _this.closeListenter);
    _this.driver.on('error', _this.errorListenter);
    _this.driver.on('wait', _this.waitListenter);
};

/** 继承自EventEmitter */
util.inherits(R2000, events.EventEmitter);

/**
 * 设置天线信息
 * @param {Array<boolean>} ants 天线信息(在数组对应下标中填写天线的开关状态)  @example 开启天线1和天线4:[true,false,false,true]
 * @return {Promise<boolean>} 返回设置状态(设置成功返回true,否则返回false)
 */
R2000.prototype.setAnts = function (ants) {
    /** 临时引用当前对象 */
    let _this = this;

    return new Promise((resolve, reject) => {
        const TYPE = 0x08;

        let data0 = 0;
        for (let bit = 0; bit < 8; bit++) {
            if (ants[bit]) {
                data0 += (1 << bit);
            }
        }

        // 指令集
        let command = [Driver.HEAD, TYPE, 0x01, data0, 0x00, Driver.ETX1, Driver.ETX2];

        let _data = {
            command: command,
            responseCommand: 0x88,
            responseCallback: (data) => {
                try {
                    resolve(data[3] === 1);
                } catch (error) {
                    reject(error);
                } finally {
                    _this.driver.removeListener(Driver.EVENT + _data.responseCommand, _data.responseCallback);
                }
            }
        };

        // 发送参数
        _this.driver.sendCommand(_data);
    });
}
/**
 * 获取天线信息
 * @return {Promise<Array<boolean>>} 返回天线信息  @example 天线1和天线4为打开状态时返回:[true,false,false,true]
 */
R2000.prototype.getAnts = function () {
    /** 临时引用当前对象 */
    let _this = this;

    return new Promise((resolve, reject) => {
        const TYPE = 0x10;

        // 指令集
        let command = [Driver.HEAD, TYPE, 0x00, 0x00, Driver.ETX1, Driver.ETX2];

        let _data = {
            command: command,
            responseCommand: 0x90,
            responseCallback: (data) => {
                try {
                    let ants = [false, false, false, false, false, false, false, false];

                    // 解析天线数据
                    let _data = data[3];
                    if (_data === 0) {
                        reject("the reponse 'getAnts()' response command is not a zero");
                    } else {
                        for (let bit = 1; bit < 9; bit++) {
                            let _bit = ((_data & bit) === bit);
                            if (_bit) {
                                ants[bit - 1] = true;
                            }
                        }
                        resolve(ants);
                    }

                } catch (error) {
                    reject(error);
                } finally {
                    _this.driver.removeListener(Driver.EVENT + _data.responseCommand, _data.responseCallback);
                }
            }
        };
        // 发送参数
        _this.driver.sendCommand(_data);
    });
}

/**
 * 设置读写器功率
 * @param {boolean} isLoop 是否开环
 * @param {Number} writePower 写功率(默认为30dbi)
 * @param {Number} readPower 读功率(默认为30dbi)
 * @return {Promise<boolean>} 返回设置状态(设置成功返回true,否则返回false)
 */
R2000.prototype.setPower = function (writePower = 30, readPower = 30, isLoop = true) {
    /** 临时引用当前对象 */
    let _this = this;

    return new Promise((resolve, reject) => {
        const TYPE = 0x00;

        // 指令集
        let command = [Driver.HEAD, TYPE, 0x03, isLoop ? 0x00 : 0x01, readPower, writePower, 0x00, Driver.ETX1, Driver.ETX2];

        let _data = {
            command: command,
            responseCommand: 0x80,
            responseCallback: (data) => {
                try {
                    resolve(data[3] === 1);
                } catch (error) {
                    reject(error);
                } finally {
                    _this.driver.removeListener(Driver.EVENT + _data.responseCommand, _data.responseCallback);
                }
            }
        };

        // 发送参数
        _this.driver.sendCommand(_data);
    });
}
/**
 * 获取读写器功率
 * @return {Promise<PowerOption>} 返回读写器功率信息
 */
R2000.prototype.getPower = function () {
    /** 临时引用当前对象 */
    let _this = this;

    return new Promise((resolve, reject) => {
        // 指令类型
        const TYPE = 0x0C;

        // 指令集
        let command = [Driver.HEAD, TYPE, 0x00, 0x00, Driver.ETX1, Driver.ETX2];

        let _data = {
            command: command,
            responseCommand: 0x8C,
            responseCallback: (data) => {
                try {
                    resolve({
                        isLoop: (data[3] === 0x00),
                        readPower: data[4],
                        writePower: data[5]
                    });
                } catch (error) {
                    reject(error);
                } finally {
                    _this.driver.removeListener(Driver.EVENT + _data.responseCommand, _data.responseCallback);
                }
            }
        };
        // 发送参数
        _this.driver.sendCommand(_data);
    });
}

/**
 * 设置GPIO
 * @deprecated 不支持R2000
 * @param {Array<boolean>} gpios GPIO信息
 * @return {Promise<boolean>} 返回设置状态(设置成功返回true,否则返回false)
 */
R2000.prototype.setGPIO = function (gpios = [false, false, false, false, false, false, false, false]) {
    /** 临时引用当前对象 */
    let _this = this;

    return new Promise((resolve, reject) => {
        // 指令类型
        const TYPE = 0x01;

        let data0 = 0;
        let data1 = 0;
        for (let bit = 0; bit < gpios.length; bit++) {
            data0 |= (bit + 1);
            if (gpios[bit]) {
                data1 |= (bit + 1);
            }
        }

        // 指令集
        let command = [Driver.HEAD, TYPE, 0x02, data0, data1, 0x00, Driver.ETX1, Driver.ETX2];

        let _data = {
            command: command,
            responseCommand: 0x81,
            responseCallback: (data) => {
                try {
                    resolve(data[3] === 1);
                } catch (error) {
                    reject(error);
                } finally {
                    _this.driver.removeListener(Driver.EVENT + _data.responseCommand, _data.responseCallback);
                }
            }
        };

        // 发送参数
        _this.driver.sendCommand(_data);
    });
}
/**
 * 获取GPIO 
 * @deprecated 不支持R2000
 * @return {Promise<Array<boolean>>} 返回GPIO状态
 */
R2000.prototype.getGPIO = function () {
    /** 临时引用当前对象 */
    let _this = this;

    return new Promise((resolve, reject) => {
        // 指令类型
        const TYPE = 0x33;

        let data0 = 0;
        for (let bit = 0; bit < 4; bit++) {
            data0 |= (1 << bit);
        }

        // 指令集
        let command = [Driver.HEAD, TYPE, 0x01, data0, 0x00, Driver.ETX1, Driver.ETX2];

        let _data = {
            command: command,
            responseCommand: 0xB3,
            responseCallback: (data) => {
                try {
                    if (data[3] === 1) {
                        let gpios = [false, false, false, false, false, false, false, false];
                        for (let bit = 0; bit < 8; bit++) {
                            if (data[5] & bit) {
                                gpios[bit] = true;
                            }
                        }
                        resolve(gpios);
                    }
                } catch (error) {
                    reject(error);
                } finally {
                    _this.driver.removeListener(Driver.EVENT + _data.responseCommand, _data.responseCallback);
                }
            }
        };
        // 发送参数
        _this.driver.sendCommand(_data);
    });
}

/**
 * 获取读卡器硬件版本
 * @return {Promise<String>} 返回读卡器硬件版本
 */
R2000.prototype.getHardwareVersion = function () {
    /** 临时引用当前对象 */
    let _this = this;

    return new Promise((resolve, reject) => {
        // 指令类型
        const TYPE = 0x0A;

        // 指令集
        let command = [Driver.HEAD, TYPE, 0x00, 0x00, Driver.ETX1, Driver.ETX2];

        let _data = {
            command: command,
            responseCommand: 0x8A,
            responseCallback: (data) => {
                try {
                    let version = 'V' + data[3] + '.' + data[4] + '.' + data[5];
                    resolve(version);
                } catch (error) {
                    reject(error);
                } finally {
                    _this.driver.removeListener(Driver.EVENT + _data.responseCommand, _data.responseCallback);
                }
            }
        };

        // 发送参数
        _this.driver.sendCommand(_data);
    });
}
/**
 * 获取固件版本号
 * @return {Promise<String>} 返回固件版本号
 */
R2000.prototype.getFirmwareVersion = function () {
    /** 临时引用当前对象 */
    let _this = this;

    return new Promise((resolve, reject) => {
        // 指令类型
        const TYPE = 0x0B;

        // 指令集
        let command = [Driver.HEAD, TYPE, 0x00, 0x00, Driver.ETX1, Driver.ETX2];

        let _data = {
            command: command,
            responseCommand: 0x8B,
            responseCallback: (data) => {
                try {
                    let version = 'V' + data[3] + '.' + data[4] + '.' + data[5];
                    resolve(version);
                } catch (error) {
                    reject(error);
                } finally {
                    _this.driver.removeListener(Driver.EVENT + _data.responseCommand, _data.responseCallback);
                }
            }
        };

        // 发送参数
        _this.driver.sendCommand(_data);
    });
}

/**
 * 单次查询标签
 * @return {Promise<Tag>} 返回标签信息
 */
R2000.prototype.getTag = function () {
    /** 临时引用当前对象 */
    let _this = this;

    return new Promise((resolve, reject) => {
        // 指令类型
        const TYPE = 0x16;

        // 指令集
        let command = [Driver.HEAD, TYPE, 0x00, 0x00, Driver.ETX1, Driver.ETX2];

        let _data = {
            command: command,
            responseCommand: 0x96,
            responseCallback: (data) => {
                try {
                    let epc = analysisTag(data);
                    resolve(epc);
                } catch (error) {
                    reject(error);
                } finally {
                    _this.driver.removeListener(Driver.EVENT + _data.responseCommand, _data.responseCallback);
                }
            }
        };
        // 发送参数
        _this.driver.sendCommand(_data);
    });
}

/**
 * 获取标签信息
 * @param  {Array<Number>} password 标签访问密码(4位)
 * @param  {FilterTypeEnum} filterType 过滤类型 0-表示EPC过滤
 * @param  {Array<Number>} filterData 过滤数据
 * @param  {Number} bankNo 用户需要查询的数据的bank号
 * @param  {Number} startPtr 查询的数据的起始地址
 * @param  {Number} length 查询的数据长度
 * @return {Promise<TagInfo>} 返回标签数据
 */
R2000.prototype.getTagInfo = function (password, filterType, filterData, bankNo, startPtr, length = filterData.length) {
    /** 临时引用当前对象 */
    let _this = this;

    return new Promise((resolve, reject) => {
        // 指令类型
        const TYPE = 0x19;

        let _startCommand = [Driver.HEAD, TYPE, 0x00];
        let _endCommand = [0x00, Driver.ETX1, Driver.ETX2];
        let _command = [];

        // 标签的访问密码
        let _AP = password;
        // 过滤数据类型
        let _FMB = filterType;
        // 过滤数据长度,若不过滤,则必须置零
        let _FL = [0x00, 0x00];
        // 过滤数据
        let _MD = [];
        // 查询的数据的bank号
        let _MB = bankNo;
        // 查询的数据的起始地址
        let _SA = [0x00, startPtr];
        // 需查询的数据长度
        let _DL = [0x00, length];

        if (util.isArray(filterData)) {
            if (filterData.length > 0) {
                _FL = [0x00, filterData.length];
                _MD = filterData;
            }
        }
        _command = _command.concat(_AP, _FMB, _FL, _MD, _MB, _SA, _DL);
        _startCommand[2] = _command.length;
        _command = _startCommand.concat(_command, _endCommand);

        let _data = {
            command: _command,
            responseCommand: 0x99,
            responseCallback: (data) => {
                try {
                    if (data[3]) {
                        let _data = [];
                        for (let bit = 4; bit < data.length - 4; bit++) {
                            _data.push(data[bit]);
                        }

                        resolve({
                            epc: new Buffer(_data).toString('hex').toUpperCase(),
                            ant: data[data.length - 4]
                        });
                    } else {
                        reject("the 'getTagInfo()' response is faild");
                    }
                } catch (error) {
                    reject(error);
                } finally {
                    _this.driver.removeListener(Driver.EVENT + _data.responseCommand, _data.responseCallback);
                }
            }
        };

        // 发送参数
        _this.driver.sendCommand(_data);
    });
}

/**
 * 写入标签信息
 * @param  {Array<Number>} password 标签访问密码(4位长度)
 * @param  {R2000.FilterTypeEnum} filterType 过滤类型 0-表示EPC过滤
 * @param  {Array<Number>} filterData 过滤数据
 * @param  {Number} bankNo 用户需要写入的数据的bank号
 * @param  {Number} startPtr 写入的数据的起始地址
 * @param  {Array<Number>} data 写入的数据
 * @param  {Number} length 写入数据的长度
 * @return {Promise<WriteTagResult>} 返回数据写入状态和天线号
 */
R2000.prototype.setTag = function (password, filterType, filterData, bankNo, startPtr, data, length = data.length) {
    /** 临时引用当前对象 */
    let _this = this;

    return new Promise((resolve, reject) => {
        if (!util.isArray(password) || password.length !== 4) {
            reject(`the password is not a Array of Number : ${password} or length must be a 4 index`);
        }

        // 指令类型
        const TYPE = 0x1A;

        let _startCommand = [Driver.HEAD, TYPE, 0x00];
        let _endCommand = [0x00, Driver.ETX1, Driver.ETX2];
        let _command = [];

        // 标签的访问密码
        let _AP = password;
        // 过滤数据类型
        let _FMB = filterType;
        // 过滤数据长度,若不过滤,则必须置零
        let _FL = [0x00, 0x00];
        // 过滤数据
        let _MD = [];
        // 查询的数据的bank号
        let _MB = bankNo;
        // 查询的数据的起始地址
        let _SA = [0x00, startPtr];
        // 需查询的数据长度
        let _DL = [0x00, length];

        // 写入的数据
        let _DATA = data;

        if (util.isArray(filterData)) {
            if (filterData.length > 0) {
                _FL = [0x00, filterData.length];
                _MD = filterData;
            }
        }
        _command = _command.concat(_AP, _FMB, _FL, _MD, _MB, _SA, _DL, _DATA);
        _startCommand[2] = _command.length;
        _command = _startCommand.concat(_command, _endCommand);

        let _data = {
            command: _command,
            responseCommand: 0x9A,
            responseCallback: (dataTemp) => {
                try {
                    if (dataTemp[3]) {
                        resolve({
                            ant: dataTemp[4],
                            isSuccess: dataTemp[3] === 1
                        });
                    } else {
                        reject("the 'getTagInfo()' response is faild");
                    }
                } catch (error) {
                    reject(error);
                } finally {
                    _this.driver.removeListener(Driver.EVENT + _data.responseCommand, _data.responseCallback);
                }
            }
        };

        // 发送参数
        _this.driver.sendCommand(_data);
    });
}

/**
 * 设置波特率
 * @param {R2000.BauteEnum} baute 波特率编号
 * @return {Promise<boolean>} 返回设置状态(设置成功返回true,否则返回false)
 */
R2000.prototype.setBaute = function (baute) {
    /** 临时引用当前对象 */
    let _this = this;

    return new Promise((resolve, reject) => {
        // 指令类型
        const TYPE = 0x23;

        // 指令集
        let command = [Driver.HEAD, TYPE, 0x01, baute, 0x00, Driver.ETX1, Driver.ETX2];

        let _data = {
            command: command,
            responseCommand: 0xA3,
            responseCallback: (data) => {
                try {
                    resolve(data[3] === 1);
                } catch (error) {
                    reject(error);
                } finally {
                    _this.driver.removeListener(Driver.EVENT + _data.responseCommand, _data.responseCallback);
                }
            }
        };

        // 发送参数
        _this.driver.sendCommand(_data);
    });
}

/**
 * 设置开机自动读取标志
 * @param {boolean} isAuto 是否自动读取 true为自动读取|false为无
 * @return {Promise<boolean>} 返回设置状态(是否自动读取 true为自动读取|false为无)
 */
R2000.prototype.setAutoRead = function (isAuto) {
    /** 临时引用当前对象 */
    let _this = this;

    return new Promise((resolve, reject) => {
        // 指令类型
        const TYPE = 0x24;

        // 指令集
        let command = [Driver.HEAD, TYPE, 0x01, isAuto ? 0x01 : 0x00, 0x00, Driver.ETX1, Driver.ETX2];

        let _data = {
            command: command,
            responseCommand: 0xA4,
            responseCallback: (data) => {
                try {
                    resolve(data[3] === 1);
                } catch (error) {
                    reject(error);
                } finally {
                    _this.driver.removeListener(Driver.EVENT + _data.responseCommand, _data.responseCallback);
                }
            }
        };

        // 发送参数
        _this.driver.sendCommand(_data);
    });
}

/**
 * 设置心跳包参数
 * @deprecated 不支持R2000
 * @param {Number} heartBeat 读写器上传心跳包的时间间隔(单位30秒,取值范围 0~255)
 * @return {Promise<boolean>} 返回设置状态(设置成功返回true,否则返回false)
 */
R2000.prototype.setHeartbeat = function (heartBeat = 10) {
    /** 临时引用当前对象 */
    let _this = this;

    return new Promise((resolve, reject) => {
        // 指令类型
        const TYPE = 0x30;

        // 指令集
        let command = [Driver.HEAD, TYPE, 0x01, heartBeat, 0x00, Driver.ETX1, Driver.ETX2];

        let _data = {
            command: command,
            responseCommand: 0xB0,
            responseCallback: (data) => {
                try {
                    resolve(data[3] === 1);
                } catch (error) {
                    reject(error);
                } finally {
                    _this.driver.removeListener(Driver.EVENT + _data.responseCommand, _data.responseCallback);
                }
            }
        };

        // 发送参数
        _this.driver.sendCommand(_data);
    });
}

/**
 * 获取心跳包参数
 * @deprecated 不支持R2000
 * @return {Promise<Number>} 返回心跳包参数
 */
R2000.prototype.getHeartbeat = function () {
    /** 临时引用当前对象 */
    let _this = this;

    return new Promise((resolve, reject) => {
        // 指令类型
        const TYPE = 0x31;

        // 指令集
        let command = [Driver.HEAD, TYPE, 0x00, 0x00, Driver.ETX1, Driver.ETX2];

        let _data = {
            command: command,
            responseCommand: 0xB1,
            responseCallback: (data) => {
                try {
                    if (data[3] === 1) {
                        resolve(data[4]);
                    } else {
                        reject("the 'getHeartbeat()' response is faild");
                    }
                } catch (error) {
                    reject(error);
                } finally {
                    _this.driver.removeListener(Driver.EVENT + _data.responseCommand, _data.responseCallback);
                }
            }
        };

        // 发送参数
        _this.driver.sendCommand(_data);
    });
}

/**
 * 开始询读
 */
R2000.prototype.start = function () {
    /** 临时引用当前对象 */
    let _this = this;

    // 指令类型
    const TYPE = 0x17;

    // 指令集
    let command = [Driver.HEAD, TYPE, 0x02, 0x00, 0x00, 0x00, Driver.ETX1, Driver.ETX2];

    // 发送参数
    _this.driver.sendCommand({
        command: command,
        responseCommand: 0x97,
        responseCallback: (data) => {
            try {
                _this.emit('EPC', analysisTag(data));
            } catch (error) {
                reject(error);
            }
        }
    });
    if (_this.isOpen) {
        _this.emit('run');
        _this.isRead = true;
    }
}

/**
 * 停止询读
 */
R2000.prototype.stop = function () {
    /** 临时引用当前对象 */
    let _this = this;

    return new Promise((resolve, reject) => {
        // 指令类型
        const TYPE = 0x18;

        // 指令集
        let command = [Driver.HEAD, TYPE, 0x00, 0x00, Driver.ETX1, Driver.ETX2];

        // 发送参数
        _this.driver.sendCommand({
            command: command,
            responseCommand: 0x98,
            responseCallback: (data) => {
                try {
                    if (data[3]) {
                        _this.emit('wait');
                        _this.isRead = false;
                    }
                    resolve(data[3] === 1);
                } catch (error) {
                    reject(error);
                }
            }
        });
    });
}

/**
 * 关闭链接
 */
R2000.prototype.close = function () {
    if (this.isOpen && this.isRead) {
        this.stop();
        this.driver.close();
    }
}

/**
 * 解析EPC数据
 * @param {Buffer} datas EPC原始数据
 * @return {Object}
 * @property {Number} pc PC
 * @property {Number} epc EPC数据
 * @property {Number} ant 天线编号
 * @property {Number} rssi 场强值
 */
function analysisTag(datas) {
    let _pc = datas[3];
    let _ant = datas[datas.length - 4];
    let _rssi = [datas[datas.length - 6], datas[datas.length - 5]];

    // 获取场强值(取原码后/10)
    let rssi = (((~(((_rssi[0] << 8) + _rssi[1]) & 0xFFFF)) | 1) & 0xFFFF) / 10.00;

    // 获取EPC码
    let _epc = [];
    for (let bit = 5; bit < datas.length - 6; bit++) {
        _epc.push(datas[bit]);
    }

    return {
        pc: _pc,
        ant: _ant,
        rssi: rssi,
        epc: Buffer.from(_epc).toString('hex').toUpperCase()
    };
}

/**
 * 字符串转换为Bit数组
 * @param {String} data 字符串数据
 * @return {Array<Number>} 转换后的数据 
 */
R2000.toHex = function (data) {
    let value = [];
    for (let bit = 0; bit < data.length - 1; bit++) {
        let _bitStr = data[bit] + data[bit + 1];
        let _temp = parseInt(_bitStr, 16);
        value.push(_temp);
        bit++;
    }
    return value;
}

module.exports = R2000;