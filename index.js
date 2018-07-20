// const AlarmLink = require('./modules/alarm-link');
const R2000 = require('./r2000');

// let alarmLink = new AlarmLink();
let r2000 = new R2000('COM3', 115200);

// 读写器等待读写标签
r2000.on('wait', () => {
    console.log('waitting...');
});

r2000.on('run', () => {
    console.log('running...')
});

r2000.on('open', () => {
    console.log('open...');

    // 设置天线
    // r2000.setAnts([true, true, false, false, false, false, false, false]).then(_result => console.log(_result)).catch(error => console.error(error));

    // 设置开机自动读取
    // r2000.setAutoRead(false).then(_result => console.log(_result)).catch(error => console.error(error));

    // 设置波特率
    // r2000.setBaute(R2000.BauteEnum.B115200).then(_result => console.log(_result)).catch(error => console.error(error));

    // 设置GPIO
    // r2000.setGPIO([true,true,true,true,true,true,true,true]).then(_result => console.log(_result)).catch(error => console.error(error));
    // 默认全关
    // r2000.setGPIO().then(_result => console.log(_result)).catch(error => console.error(error));

    // 设置心跳包参数
    // r2000.setHeartbeat(10).then(_result => console.log(_result)).catch(error => console.error(error));

    // 设置功率
    // r2000.setPower(30,30).then(_result => console.log(_result)).catch(error => console.error(error));

    // 写入标签信息
    // let _data = R2000.toHex('0011223344556677');
    // r2000.setTag(
    //     R2000.toHex('00000000'),
    //     R2000.FilterTypeEnum.EPC,
    //     null,
    //     1,
    //     2,
    //     _data).then(_result => console.log(`${_result.isSuccess ? '写入成功'+'ANT:'+_result.ant:'写入失败'}`)).catch(error => console.error(error));

    // 获取天线
    // r2000.getAnts().then(_result => console.log(_result)).catch(error => console.error(error));

    // 获取固件版本号
    // r2000.getFirmwareVersion().then(_result => console.log(_result)).catch(error => console.error(error));

    // 获取读写器硬件版本
    // r2000.getHardwareVersion().then(_result => console.log(_result)).catch(error => console.error(error));

    // 查看GPIO状态
    // r2000.getGPIO().then(_result => console.log(_result)).catch(error => console.error(error));

    // 获取心跳包参数
    // r2000.getHeartbeat().then(_result => console.log(_result)).catch(error => console.error(error));

    // 获取读写器功率
    // r2000.getPower().then(_result => console.log(_result)).catch(error => console.error(error));

    // 单次查询标签
    // r2000.getTag().then(_result => console.log(_result)).catch(error => console.error(error));

    // 过滤标签数据
    // let _data = R2000.toHex('0011223344');
    // r2000.getTagInfo(
    //     R2000.toHex('00000000'), 
    //     R2000.FilterTypeEnum.EPC, 
    //     _data, 
    //     1, 
    //     2, 
    //     _data.length).then(_result => console.log(_result)).catch(error => console.error(error));

    r2000.start();
    // r2000.stop().then(_result => console.log(_result)).catch(error => console.error(error));
})

r2000.on('close', () => {
    console.log('closed...')
});

r2000.on('error', (error) => {
    if (error) {
        if (error === 'close') {
            console.log('closed...')
        } else {
            console.log(`error:${error}`);
        }
    }
});

r2000.on('EPC', (data) => {
    console.log(`DATA: EPC--${data.epc}-- RSSI:${data.rssi} ANT:${data.ant} PC:${data.pc}`)
});