const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

const HttpError = require('../models/http-error');
const DeviceInfo = require('../models/device_info')
const UserData = require('../models/users_data');

// const { default: mongoose } = require('mongoose');
const error = require('mongoose/lib/error');

const { checkProps, log } = require("../util/codeHelperUtils");
const dbUtils = require('../util/dbUtils');

const getDeviceList = async (req, res, next) => {
  const deviceOwner = req.params.uid;  // 
  const deviceList = await dbUtils.findAllByField(DeviceInfo, "device_owner", deviceOwner);
  log.notice(`Device List: ${JSON.stringify(deviceList)}`);

  // 배열의 각 요소에 대해 toObject 호출 (Mongoose 문서일 경우)
  const deviceListObjects = deviceList.map(device => device.toObject({ getters: true }));

  // 클라이언트로 JSON 응답
  res.json({ device_list: deviceListObjects });

  // res.json({ device_list: deviceList.toObject({ getters: true }) });
};

const createDeviceInfo = async (req, res, next) => {
  const deviceOwner = req.params.uid; // 사용자 ID
  const { macAddress, deviceName, deviceType, battery } = req.body;

  // MongoDB 세션 시작
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. 기존 디바이스 목록 조회
    const deviceList = await dbUtils.findAllByField(DeviceInfo, "device_owner", deviceOwner);
    log.notice(deviceList);

    // 2. 동일한 MAC 주소의 디바이스가 이미 존재하는지 확인
    let existingDevice = null;
    for (let deviceInfo of deviceList) {
      if (deviceInfo.mac_address === macAddress) {
        existingDevice = deviceInfo;
        break;
      }
    }

    // 3. 기존 디바이스가 있다면 삭제
    if (existingDevice) {
      // UserData에서 사용자 조회 (트랜잭션 사용)
      const user = await UserData.findById(deviceOwner).session(session);
      if (!user) {
        throw new HttpError("사용자를 찾을 수 없습니다.", 404);
      }

      // UserData의 device_list에서 삭제된 디바이스의 _id 제거
      user.device_list = user.device_list.filter(
        (deviceId) => deviceId.toString() !== existingDevice._id.toString()
      );

      // UserData 저장 (트랜잭션 사용)
      await user.save({ session });

      // DeviceInfo에서 디바이스 삭제
      const result = await DeviceInfo.deleteOne({ _id: existingDevice._id }).session(session);
      if (result.deletedCount === 0) {
        throw new HttpError("기존 디바이스 삭제 중 오류가 발생했습니다.", 500);
      }
    }

    // 4. 새 디바이스 데이터 생성
    const newDeviceData = {
      device_owner: deviceOwner,
      mac_address: macAddress,
      device_name: deviceName,
      device_type: deviceType,
      battery: battery,
    };

    // 5. device_info 생성 및 저장 (트랜잭션 사용)
    const newDevice = new DeviceInfo(newDeviceData);
    const savedDevice = await newDevice.save({ session });

    // 6. UserData에서 사용자 조회 (트랜잭션 사용)
    const user = await UserData.findById(deviceOwner).session(session);
    if (!user) {
      throw new HttpError("사용자를 찾을 수 없습니다.", 404);
    }

    // 7. UserData의 device_list에 새 디바이스의 _id 추가
    user.device_list.push(savedDevice._id);

    // 8. UserData 저장 (트랜잭션 사용)
    await user.save({ session });

    // 9. 트랜잭션 커밋
    await session.commitTransaction();
    session.endSession();

    // 10. 클라이언트에 응답
    res.status(201).json({ result: savedDevice });
  } catch (error) {
    // 트랜잭션 롤백
    await session.abortTransaction();
    session.endSession();

    log.error("디바이스 생성 중 오류 발생:", error);
    return next(new HttpError("디바이스 생성 중 오류가 발생했습니다.", 500));
  }
};


const deleteDeviceInfo = async (req, res, next) => {
  const deviceOwner = req.params.uid; // 사용자 ID
  const { macAddress, deviceName } = req.body;

  // MongoDB 세션 시작
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. 디바이스 목록 조회
    const deviceList = await dbUtils.findAllByField(DeviceInfo, "device_owner", deviceOwner);
    let existingDevice = null;

    // 2. 삭제할 디바이스 찾기
    for (let deviceInfo of deviceList) {
      if (deviceInfo.mac_address === macAddress) {
        existingDevice = deviceInfo;
        break;
      }
    }

    // 3. 디바이스가 존재하지 않으면 에러 반환
    if (!existingDevice) {
      return next(new HttpError(`등록된 ${deviceName}가 없습니다.`, 404));
    }

    // 4. 디바이스 삭제 (트랜잭션 사용)
    const result = await DeviceInfo.deleteOne({ _id: existingDevice._id }).session(session);
    if (result.deletedCount === 0) {
      return next(new HttpError("디바이스 삭제 중 오류가 발생했습니다.", 500));
    }

    // 5. UserData에서 사용자 조회 (트랜잭션 사용)
    const user = await UserData.findById(deviceOwner).session(session);
    if (!user) {
      return next(HttpError("사용자를 찾을 수 없습니다.", 404));
    }

    // 6. UserData의 device_list에서 삭제된 디바이스의 _id 제거
    user.device_list = user.device_list.filter(
      (deviceId) => deviceId.toString() !== existingDevice._id.toString()
    );

    // 7. UserData 저장 (트랜잭션 사용)
    await user.save({ session });

    // 8. 트랜잭션 커밋
    await session.commitTransaction();
    session.endSession();

    // 9. 클라이언트에 응답
    res.status(200).json({ message: "디바이스가 성공적으로 삭제되었습니다." });
  } catch (error) {
    // 트랜잭션 롤백
    await session.abortTransaction();
    session.endSession();

    log.error("디바이스 삭제 중 오류 발생:", error);
    return next(new HttpError("디바이스 삭제 중 오류가 발생했습니다.", 500));
  }
};

const updateDeviceInfo = async (req, res, next) => {
  const deviceOwner = req.params.uid;  // 
  const { macAddress, deviceName, battery } = req.body;
  const deviceList = await dbUtils.findAllByField(DeviceInfo, "device_owner", deviceOwner)

  let result = false
  let existingDevice = false
  for (let deviceInfo of deviceList) {
    if (deviceInfo.mac_address == macAddress) existingDevice = true
  }
  if (existingDevice) {
    const updateData = {
      device_name: deviceName,
      battery: battery
    };
    result = await dbUtils.updateByField(DeviceInfo, "mac_address", macAddress, updateData);
  } else {
    return next(new HttpError(
      `등록된 ${deviceName}가 없습니다. `, 404
    ));
  }
  res.json({ result: result });
}

exports.getDeviceList = getDeviceList;
exports.createDeviceInfo = createDeviceInfo;
exports.deleteDeviceInfo = deleteDeviceInfo;
exports.updateDeviceInfo = updateDeviceInfo;