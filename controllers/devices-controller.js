const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

const HttpError = require("../models/http-error");
const DeviceInfo = require("../models/device_info");
const UserData = require("../models/users_data");

// const { default: mongoose } = require('mongoose');
const error = require("mongoose/lib/error");

const { checkProps, log } = require("../util/codeHelperUtils");
const dbUtils = require("../util/dbUtils");

const getDeviceList = async (req, res, next) => {
  const deviceOwner = req.params.uid; //
  const deviceList = await dbUtils.findAllByField(
    DeviceInfo,
    "device_owner",
    deviceOwner
  );

  if (!deviceList) {
    return next(
      new HttpError("해당 dbObjectId에 등록된 Device가 없습니다.", 204)
    );
  }

  // 배열의 각 요소에 대해 toObject 호출 (Mongoose 문서일 경우)
  const deviceListObjects = deviceList.map((device) =>
    device.toObject({ getters: true })
  );

  // 클라이언트로 JSON 응답
  res.json({ deviceList: deviceListObjects });

  // res.json({ device_list: deviceList.toObject({ getters: true }) });
};

const getDeviceInfo = async (req, res, next) => {
  log.error(JSON.stringify(req.body,2,null))

  const deviceOwner = req.params.uid; //
  const { macAddress } = req.body;
  const deviceInfo = await dbUtils.findOneByField(
    DeviceInfo,
    "mac_address",
    macAddress
  );

  if (!deviceInfo) {
    return next(
      new HttpError("해당 dbObjectId에 등록된 Device가 없습니다.", 204)
    );
  }

  let tmp = {};
  if (deviceInfo.device_group) tmp.deviceGroup = deviceInfo.device_group;
  if (deviceInfo.mac_address) tmp.macAddress = deviceInfo.mac_address;
  if (deviceInfo.device_name) tmp.deviceName = deviceInfo.device_name;
  if (deviceInfo.device_type) tmp.deviceType = deviceInfo.device_type;
  if (deviceInfo.battery) tmp.battery = deviceInfo.battery;

  // 클라이언트로 JSON 응답
  res.json({ deviceInfo: tmp });
};

const createDeviceInfo = async (req, res, next) => {
  const deviceOwner = req.params.uid; // 사용자 ID
  const {
    deviceGroup = req.body.deviceGroup || "default_group", // deviceGroup 있으면 대입 아니면 default_group으로 대입
    macAddress,
    deviceType,
    battery,
  } = req.body;

  // MongoDB 세션 시작
  const session = await mongoose.startSession();
  session.startTransaction();

  try {

    log.notice(`req.body : ${JSON.stringify(req.body,null,2)}`);
    // 0. 추가하려는 Device 의 deviceGroup 이 해당 uid 와 매칭되는 유저의 device_group_list에 존재하는지 확인
    const userData = await dbUtils.findOneByField(
      UserData,
      "_id",
      deviceOwner,
      session
    );

    if (!userData.device_group_list.includes(deviceGroup)) {
      // User의 device_group_list 중, 생성하려는 Device의 deviceGroup이 포함되어 있지 않으면 실패 처리
      return next(
        new HttpError("없는 deviceGroup에 Device를 생성할 수 없습니다.", 408)
      );
    }

    // for ( let tmp of userData.device_group_list ){
    //   if(tmp === deviceGroup){
    //     // User의 device_group_list 중, 만드려는 Device의 deviceGroup이 포함되어 있지 않으면 실패처리
    //     return next(new HttpError("없는 deviceGroup 에 device를 생성 할 수 없습니다.", 404));
    //   }
    // }

    // 2. 동일한 MAC 주소의 디바이스가 이미 존재하는지 확인
    let existingDevice = null;
    existingDevice = await dbUtils.findOneByField(
      DeviceInfo,
      "mac_address",
      macAddress,
      session
    );

    // 3. 기존 디바이스가 있다면 에러처리
    if (existingDevice) {
      return next(
        new HttpError("이미 있는 Device를 등록 할 수 없습니다.", 409))

      // if (!userData) {
      //   return next(new HttpError("사용자를 찾을 수 없습니다.", 404));
      // }

      // // UserData의 device_list에서 삭제된 디바이스의 _id 제거
      // userData.device_list = userData.device_list.filter(
      //   (deviceId) => deviceId.toString() !== existingDevice._id.toString()
      // );

      // // UserData 저장 (트랜잭션 사용)
      // await userData.save({ session });

      // // DeviceInfo에서 디바이스 삭제
      // const result = await dbUtils.deleteByField(
      //   DeviceInfo,
      //   "_id",
      //   existingDevice._id,
      //   session
      // );
      // if (result.deletedCount === 0) {
      //   return next(
      //     new HttpError("기존 디바이스 삭제 중 오류가 발생했습니다.", 500)
      //   );
      // }
    }

    // 4. 새 디바이스 데이터 생성
    const newDeviceData = {
      device_owner: deviceOwner,
      device_group: deviceGroup,
      mac_address: macAddress,
      device_name: deviceType,
      device_type: deviceType,
      battery: battery,
    };

    // 5. device_info 생성 및 저장 (트랜잭션 사용)
    const newDevice = new DeviceInfo(newDeviceData);
    const savedDevice = await newDevice.save({ session });

    // 6. UserData의 device_list에 새 디바이스의 _id 추가
    userData.device_list.push(savedDevice._id);

    // 7. UserData 저장 (트랜잭션 사용)
    await userData.save({ session });

    // 8. 트랜잭션 커밋
    await session.commitTransaction();

    // 9. 클라이언트에 응답
    res.status(201).json({ result: savedDevice });
  } catch (error) {
    // 트랜잭션 롤백
    await session.abortTransaction();

    log.error("디바이스 생성 중 오류 발생:", error);
    return next(new HttpError("디바이스 생성 중 오류가 발생했습니다.", 500));
  } finally {
    session.endSession();
  }
};

const deleteDeviceInfo = async (req, res, next) => {
  const deviceOwner = req.params.uid; // 사용자 ID
  const { macAddress, deviceType } = req.body;

  // MongoDB 세션 시작
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. 디바이스 목록 조회
    let existingDevice = null;
    existingDevice = await dbUtils.findOneByField(
      DeviceInfo,
      "mac_address",
      macAddress,
      session
    );

    // 3. 디바이스가 존재하지 않으면 에러 반환
    if (!existingDevice) {
      return next(new HttpError(`등록된 ${deviceType}가 없습니다.`, 404));
    }

    // 4. 디바이스 삭제 (트랜잭션 사용)
    const result = await dbUtils.deleteByField(
      DeviceInfo,
      "_id",
      existingDevice._id,
      session
    );
    if (result.deletedCount === 0) {
      return next(new HttpError("디바이스 삭제 중 오류가 발생했습니다.", 500));
    }

    // 5. UserData에서 사용자 조회 (트랜잭션 사용)
    const userData = await dbUtils.findOneByField(
      UserData,
      "_id",
      deviceOwner,
      session
    );

    if (!userData) {
      return next(HttpError("사용자를 찾을 수 없습니다.", 404));
    }

    // 6. UserData의 device_list에서 삭제된 디바이스의 _id 제거
    userData.device_list = userData.device_list.filter(
      (deviceId) => deviceId.toString() !== existingDevice._id.toString()
    );

    // 7. UserData 저장 (트랜잭션 사용)
    await userData.save({ session });

    // 8. 트랜잭션 커밋
    await session.commitTransaction();

    // 9. 클라이언트에 응답
    res.status(200).json({ message: "디바이스가 성공적으로 삭제되었습니다." });
  } catch (error) {
    // 트랜잭션 롤백
    await session.abortTransaction();

    log.error("디바이스 삭제 중 오류 발생:", error);
    return next(new HttpError("디바이스 삭제 중 오류가 발생했습니다.", 500));
  } finally {
    session.endSession();
  }
};

const updateDeviceInfo = async (req, res, next) => {
  const deviceOwner = req.params.uid; //
  const { macAddress, deviceName, battery } = req.body;

  let result = false;
  let existingDevice = null;
  existingDevice = await dbUtils.findOneByField(
    DeviceInfo,
    "mac_address",
    macAddress
  );

  if (existingDevice) {
    const updateData = {};
    if (deviceName != null) {  // null과 undefined 둘 다 체크
        updateData.device_name = deviceName;
    }
    if (battery != null) {     // null과 undefined 둘 다 체크
        updateData.battery = battery;
    }
    result = await dbUtils.updateByField(
      DeviceInfo,
      "mac_address",
      macAddress,
      updateData
    );
  } else {
    return next(new HttpError(`등록된 ${deviceName}가 없습니다. `, 404));
  }
  res.json({ result: result });
};

const updateDeviceGroupInfo = async (req, res, next) => {
  const deviceOwner = req.params.uid; //
  const { macAddress, deviceGroup } = req.body;

  // MongoDB 세션 시작
  const session = await mongoose.startSession();
  session.startTransaction();

  let result = false;
  try {
    // device_info Table 에서 MacAddress 기준으로 Data 찾음음
    const deviceInfo = await dbUtils.findAllByField(
      DeviceInfo,
      "mac_address",
      macAddress,
      session
    );

    // device_info Table 에서 해당하는 기기의 device_group 수정
    if (deviceInfo) {
      const updateData = {
        device_group: deviceGroup,
      };
      result = await dbUtils.updateByField(
        DeviceInfo,
        "mac_address",
        macAddress,
        updateData,
        session
      );
    } else {
      return next(new HttpError(`등록된 ${macAddress}가 없습니다. `, 404));
    }

    // users_data Table 에서 해당하는 uid 의 device_group_list 에 deviceGroup 추가
    const userData = await dbUtils.findOneByField(
      UserData,
      "_id",
      deviceOwner,
      session
    );

    // deviceGroup이 이미 존재하는지 확인
    if (!userData.device_group_list.includes(deviceGroup)) {
      userData.device_group_list.push(deviceGroup);

      // UserData 저장 (트랜잭션 사용)
      await userData.save({ session });
    }

    // 트랜잭션 커밋
    await session.commitTransaction();
  } catch (error) {
    // 트랜잭션 롤백
    await session.abortTransaction();

    log.error(
      "디바이스 그룹 생성중 오류 발생:",
      error.stack || error.message || error
    );
    return next(
      new HttpError("디바이스 그룹 생성중 오류가 발생했습니다.", 500)
    );
  } finally {
    session.endSession();
  }

  res.json({ result: result });
};

exports.getDeviceList = getDeviceList;
exports.getDeviceInfo = getDeviceInfo;
exports.createDeviceInfo = createDeviceInfo;
exports.deleteDeviceInfo = deleteDeviceInfo;
exports.updateDeviceInfo = updateDeviceInfo;
exports.updateDeviceGroupInfo = updateDeviceGroupInfo;
