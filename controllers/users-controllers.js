const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const HttpError = require("../models/http-error");
const UserData = require("../models/users_data");
const DeviceInfo = require("../models/device_info");

const log = require("../util/logger");
const dbUtils = require("../util/dbUtils");
const ValidationError = require("mongoose/lib/error/validation");
const { checkProps } = require("../util/codeHelperUtils");

// const getUsers = async (req, res, next) => {
//   let users;
//   try {
//     users = await UserData.find({}, "-password");
//     // log.debug(users);
//   } catch (err) {
//     return next(new HttpError(
//       'DB 조회 실패 [ find({}, "-password") ]', 500
//     ));
//   }
//   res.json({ users: users.map(user => user.toObject({ getters: true })) });
// };

const HALF_ONE_MONTH = 60 * 60 * 24 * 15;
const ONE_HOUR = 60 * 60;
const HALF_ONE_HOUR = 60 * 30;

function debugReqConsolePrint(req) {
  console.log("======= DEBUG LOG =======");
  console.log("1. Raw req.body:", req.body);
  console.log(`2. req.body type: ${Object.prototype.toString.call(req.body)}`);
  console.log("3. req.body keys:", Object.keys(req.body));
  console.log("4. stringified body:", JSON.stringify(req.body));
  console.log("5. dbObjectId:", req.body?.dbObjectId);
  console.log("======= DEBUG LOG =======");
}
const signup = async (req, res, next) => {
  /** users-routes.js 에서 검사한 Name email password 의 밸리데이션 체크*/
  // debugReqConsolePrint(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    log.error("사용자 입력값 Validation Error ↓ ");
    debugReqConsolePrint(req)
    res.status(422);
    return next(
      new HttpError("사용자 입력값 유효하지 않음\n 비밀번호 6글자 이상", 422)
    );
  }

  const { userName, userEmail, password, homeAddress, phoneNumber } = req.body;
  let hashedPassword=""

  /** 이미 존재 하는 Email 인지 체크 */
  let existingUser;
  try {
    existingUser = await dbUtils.findOneByField(
      UserData,
      "user_email",
      userEmail
    );
    //# DB 상에 해당 user_email 이 없으면 existingUser 이 null 값

    /** 일치하는 Email이 없는 경우 */
    if (existingUser) {
      log.error(`ID 중복 에러 : ${existingUser}`);
      return next(new HttpError("이미 있는 ID 에 중복가입 에러", 409));
    }
  } catch (err) {
    log.error(`에러 스택: ${err.stack}`);
    return next(new HttpError("DB 조회 실패 [ 서버 에러 : DB query ]", 500));
  }

  /** 가입하려는 password 암호화 */
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (err) {
    log.error(`에러 스택: ${err.stack}`);
    return next(
      new HttpError("비밀번호 생성 에러 [ 서버 에러 : 암호화 에러 ]", 500)
    );
  }

  const createdUser = new UserData({
    user_name   : userName,
    user_email  : userEmail,
    login_type: "Email",
    password    : hashedPassword,
    home_address: homeAddress,
    phone_number: phoneNumber,
    device_list: [],
  });

  /** 회원 정보 DB Create*/
  try {
    await createdUser.save();
  } catch (err) {
    log.error(`에러 스택: ${err.stack}`);
    return next(
      new HttpError(`Sighing Up failed, please try again ${err}`, 500)
    );
  }

  /** JWT 토큰 발행 */
  let token;
  try {
    token = jwt.sign(
      {
        dbObjectId: createdUser.id,
        userEmail: createdUser.user_email,
      },
      process.env.JWT_PRIVATE_KEY,
      { expiresIn: HALF_ONE_MONTH }
    );
  } catch (err) {
    log.error(`에러 스택: ${err.stack}`);
    return next(new HttpError("토큰 생성 에러 [ 서버 에러 : 토큰 에러 ]", 500));
  }

  /** Client Response */
  // res.status(201).json({ user: createdUser.toObject({ getters: true }) });
  res.status(201).json({
    dbObjectId: createdUser.id,
    token: token,
  });
};

const login = async (req, res, next) => {
  log.info("LOGIN 시도 ... ")
  const { userEmail, password } = req.body;

  let existingUser;
  /** DB 찾기 에러 */
  try {
    existingUser = await dbUtils.findOneByField(
      UserData,
      "user_email",
      userEmail
    );
    //# DB 상에 해당 Email 이 없으면 existingUser 이 null 값

    /** 일치하는 Email이 없는 경우 */
    if (!existingUser) {
      return next(new HttpError("Email 이 존재하지 않습니다.", 404));
    }
  } catch (err) {
    log.error(`에러 스택: ${err.stack}`);
    return next(
      new HttpError("로그인 할 수 없습니다. [ 서버 에러 : DB query ] ", 500)
    );
  }

  try {
    /** DB에 있는 암호화된 Password를 비교 */
    const isValidPassword = await bcrypt.compare(
      password.toString().trim(),
      existingUser.password
    );

    if (!isValidPassword) {
      return next(new HttpError("비밀번호가 틀립니다.", 403));
    }
  } catch (bcryptError) {
    log.error(`에러 스택: ${err.stack}`);
    log.error("bcrypt 에러:", bcryptError);
    return next(new HttpError("비밀번호 검증 중 오류가 발생했습니다.", 500));
  }

  /** JWT 토큰 발행 */
  let token;
  try {
    token = jwt.sign(
      {
        dbObjectId: existingUser.id,
        userEmail: existingUser.user_email,
      },
      process.env.JWT_PRIVATE_KEY,
      { expiresIn: HALF_ONE_MONTH }
    );
  } catch (err) {
    log.error(`에러 스택: ${err.stack}`);
    log.error(err);
    return next(new HttpError("토큰 생성 에러 [ 서버 에러 : 토큰 에러 ]", 500));
  }

  /** Client Response */
  // res.json({
  //   message: 'Logged in',
  //   user: existingUser.toObject({ getters: true })
  // });
  res.json({
    dbObjectId: existingUser.id,
    token: token,
  });
};

const getUserInfo = async (req, res, next) => {
  /* 원래는 req.headers.authorization에 담겨있으나, 
  checkAuth 에서 req.tokenData 에 dbObjectId, userEmail 를 넣어서 보내줌*/

  const dbObjectId = req.tokenData.dbObjectId;
  const userEmail = req.tokenData.userEmail;

  let existingUser;
  /** DB 찾기 에러 */
  try {
    existingUser = await dbUtils.findOneByFieldWithoutPassword(
      UserData,
      "user_email",
      userEmail
    );
    //# DB 상에 해당 Email 이 없으면 existingUser 이 null 값

    /** 일치하는 Email이 없는 경우 */
    if (!existingUser) {
      return next(new HttpError("Email 이 존재하지 않습니다.", 404));
    }
  } catch (err) {
    log.error(`에러 스택: ${err.stack}`);
    return next(
      new HttpError("로그인 할 수 없습니다. [ 서버 에러 : DB query ] ", 500)
    );
  }

  // 클라이언트에 password 제외한 정보 반환
  let userInfo = {};
  if (existingUser.user_name) userInfo.userName = existingUser.user_name;
  if (existingUser.user_email) userInfo.userEmail = existingUser.user_email;
  if (existingUser.home_address)
    userInfo.homeAddress = existingUser.home_address;
  if (existingUser.phone_number)
    userInfo.phoneNumber = existingUser.phone_number;
  if (existingUser.device_list) userInfo.deviceList = existingUser.device_list;
  if (existingUser.device_group_list)
    userInfo.deviceGroupList = existingUser.device_group_list;

  res.status(201).json({ userInfo: userInfo }); // userInfo 변수를 반환
};

const refreshToken = async (req, res, next) => {
  try {
    /* 원래는 req.headers.authorization에 담겨있으나, 
    checkAuth 에서 req.tokenData 에 dbObjectId, userEmail 를 넣어서 보내줌*/
    const dbObjectId = req.tokenData.dbObjectId;
    const userEmail = req.tokenData.userEmail;

    // debugReqConsolePrint(req);
    if (dbObjectId != req.body.dbObjectId) {
      log.error(`uid 와 Token의 uid 가 다름`);
      log.error("", req.body);
      log.error("req.body.dbObjectId : ", req.body.dbObjectId);
      log.error("req.tokenData.dbObjectId : ", req.tokenData.dbObjectId);
      throw ValidationError;
    }

    // 새로운 액세스 토큰 발급
    const newToken = jwt.sign(
      {
        dbObjectId,
        userEmail,
      },
      process.env.JWT_PRIVATE_KEY,
      { expiresIn: HALF_ONE_MONTH }
    );

    res.json({
      message: "토큰이 갱신되었습니다.",
      newToken: newToken,
    });
  } catch (err) {
    log.error(`에러 스택: ${err.stack}`);
    return next(new HttpError("토큰 갱신 중 오류가 발생했습니다.", 500));
  }
};

const createGroup = async (req, res, next) => {
  const { dbObjectId, createTargetGroupName } = req.body;

  let existingUser;

  // MongoDB 세션 시작
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 0. 추가하려는 Device 의 deviceGroup 이 해당 uid 와 매칭되는 유저의 device_group_list에 존재하는지 확인
    existingUser = await dbUtils.findOneByFieldWithoutPassword(
      UserData,
      "_id",
      dbObjectId,
      session
    );

    if (existingUser.device_group_list.includes(createTargetGroupName)) {
      return next(new HttpError(`${createTargetGroupName}은 이미 존재하는 Group 명입니다.`, 409));
    }

    existingUser.device_group_list.push(createTargetGroupName);
    await existingUser.save({ session });

    // 8. 트랜잭션 커밋
    await session.commitTransaction();
  } catch (error) {
    log.error(`에러 스택: ${err.stack}`);
    // 트랜잭션 롤백
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    return next(new HttpError("그룹 생성중 오류", 500));
  } finally {
    session.endSession();
  }

  let userInfo = {};
  if (existingUser.user_name) userInfo.userName = existingUser.user_name;
  if (existingUser.user_email) userInfo.userEmail = existingUser.user_email;
  if (existingUser.home_address)
    userInfo.homeAddress = existingUser.home_address;
  if (existingUser.phone_number)
    userInfo.phoneNumber = existingUser.phone_number;
  if (existingUser.device_list) userInfo.deviceList = existingUser.device_list;
  if (existingUser.device_group_list)
    userInfo.deviceGroupList = existingUser.device_group_list;

  res.status(201).json({ userInfo: userInfo }); // userInfo 변수를 반환
};

const updateGroup = async (req, res, next) => {
  const { dbObjectId, currentGroup, updateTargetGroupName } = req.body;


  let existingUser;
  // MongoDB 세션 시작
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 0. 추가하려는 Device 의 deviceGroup 이 해당 uid 와 매칭되는 유저의 device_group_list에 존재하는지 확인
    existingUser = await dbUtils.findOneByFieldWithoutPassword(
      UserData,
      "_id",
      dbObjectId
    );

    if (existingUser.device_group_list.includes(updateTargetGroupName)) {
      return next(new HttpError(`${updateTargetGroupName}은 이미 존재하는 Group 명입니다.`, 409));
    }

    if (!existingUser.device_group_list.includes(currentGroup)) {
      return next(new HttpError(`${currentGroup}이라는 그룹이 없습니다.`, 409));
    }

    // currentGroup 를 제외한 요소만 남김
    existingUser.device_group_list = existingUser.device_group_list.filter(
      (item) => item !== currentGroup
    );

    // updateTargetGroupName 삽입입
    existingUser.device_group_list.push(updateTargetGroupName);

    await existingUser.save({ session });

    // 8. 트랜잭션 커밋
    await session.commitTransaction();
  } catch (error) {
    log.error(`에러 스택: ${err.stack}`);
    // 트랜잭션 롤백
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    return next(new HttpError("그룹 생성중 오류", 500));
  } finally {
    session.endSession();
  }

  let userInfo = {};
  if (existingUser.user_name) userInfo.userName = existingUser.user_name;
  if (existingUser.user_email) userInfo.userEmail = existingUser.user_email;
  if (existingUser.home_address)
    userInfo.homeAddress = existingUser.home_address;
  if (existingUser.phone_number)
    userInfo.phoneNumber = existingUser.phone_number;
  if (existingUser.device_list) userInfo.deviceList = existingUser.device_list;
  if (existingUser.device_group_list)
    userInfo.deviceGroupList = existingUser.device_group_list;

  res.status(201).json({ userInfo: userInfo }); // userInfo 변수를 반환
};

const updateUserInfo = async (req, res, next) => {
  const {
    dbObjectId,
    userName,
    userEmail,
    newPassword,
    password,
    homeAddress,
    phoneNumber,
  } = req.body;

  let hashedPassword;
  let existingUser;

  if (
    !(
      checkProps(req.body, ["dbObjectId"]) && checkProps(req.body, ["password"])
    )
  ) {
    return next(
      new HttpError("dbObjectId, password Props data 누락 문제", 400)
    );
  }

  /** DB 찾기 에러 */
  try {
    existingUser = await dbUtils.findOneByField(UserData, "_id", dbObjectId);
    //# DB 상에 해당 Email 이 없으면 existingUser 이 null 값

    /** 일치하는 Email이 없는 경우 */
    if (!existingUser) {
      return next(
        new HttpError("DB에 해당 Email의 Object Id가 없습니다.", 404)
      );
    }

    try {
      /** DB에 있는 암호화된 Password를 비교 */
      const isValidPassword = await bcrypt.compare(
        password.toString().trim(),
        existingUser.password
      );

      if (isValidPassword) {
        // 비밀번호가 동일한 경우 PASS
        if(newPassword){
          // newPssword 가 있으면 비밀번호 변경경
          try {
            hashedPassword = await bcrypt.hash(newPassword, 12);
          } catch (err) {
            log.error(`에러 스택: ${err.stack}`);
            return next(new HttpError("비밀번호 암호화 실패", 500));
          }
        }
      } else {
        return next(new HttpError("비밀번호가 틀립니다.", 403));
      }
    } catch (bcryptError) {
      log.error(`에러 스택: ${err.stack}`);
      log.error("bcrypt 에러:", bcryptError);
      return next(new HttpError("비밀번호 검증 중 오류가 발생했습니다.", 500));
    }

    let userInfo = {};
    // 값이 있는 필드만 userInfo 추가
    if (userName) userInfo.user_name = userName;
    if (userEmail) userInfo.user_email = userEmail;
    if (hashedPassword) userInfo.password = hashedPassword;
    if (homeAddress) userInfo.home_address = homeAddress;
    if (phoneNumber) userInfo.phone_number = phoneNumber;

    result = await dbUtils.updateByField(UserData, "_id", dbObjectId, userInfo);
  } catch (err) {
    log.error(`에러 스택: ${err.stack}`);
    return next(
      new HttpError("업데이트 할 수 없습니다. [ 서버 에러 : DB query ] ", 500)
    );
  }

  hashedPassword
    ? (result.password = "비밀번호 변경 성공")
    : (result.password = "비밀번호를 변경하지 않음음");
  res.json({ result: result });
};

const deleteGroupInfo = async (req, res, next) => {
  const { deleteTargetGroupName, dbObjectId } = req.body;

  // MongoDB 세션 시작
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. 그룹에 속한 Device 조회
    const deviceList = await dbUtils.findAllByField(
      DeviceInfo,
      "device_group",
      deleteTargetGroupName,
      session
    );

    // 2. 그룹에 속한 Device 가 있을 시 에러 처리
    if (deviceList.length > 0) {
      log.warn(
        `${deleteTargetGroupName}그룹에 등록된 디바이스 리스트 : ${deviceList}`
      );

      // 트랜잭션 롤백 및 세션 종료
      await session.abortTransaction();

      return next(
        new HttpError(
          `${deleteTargetGroupName}그룹에 등록된 디바이스를 제거해 주세요.`,
          405
        )
      );
    }

    // 3. 삭제할 디바이스 찾아서 제거
    existingUser = await dbUtils.findOneByField(
      UserData,
      "_id",
      dbObjectId,
      session
    );
    existingUser.device_group_list = existingUser.device_group_list.filter(
      // device_group_list 순회한 값이 tmp 에 적용
      // tmp !== deleteTargetGroupName 조건에 맞으면 포함 ( === 값이 다르면 포함 )
      (tmp) => tmp !== deleteTargetGroupName
    );

    // 4. UserData 저장 (트랜잭션 사용)
    await existingUser.save({ session });

    // 5. 트랜잭션 커밋
    await session.commitTransaction();
  } catch (error) {
    log.error(`에러 스택: ${err.stack}`);
    // 트랜잭션 롤백
    await session.abortTransaction();

    log.error(`그룹 ${deleteTargetGroupName} 삭제 중 오류 발생:`, error);
    return next(
      new HttpError(
        `그룹 ${deleteTargetGroupName} 삭제 중 오류가 발생했습니다.`,
        500
      )
    );
  } finally {
    session.endSession();
  }

  let userInfo = {};
  if (existingUser.user_name) userInfo.userName = existingUser.user_name;
  if (existingUser.user_email) userInfo.userEmail = existingUser.user_email;
  if (existingUser.home_address)
    userInfo.homeAddress = existingUser.home_address;
  if (existingUser.phone_number)
    userInfo.phoneNumber = existingUser.phone_number;
  if (existingUser.device_list) userInfo.deviceList = existingUser.device_list;
  if (existingUser.device_group_list)
    userInfo.deviceGroupList = existingUser.device_group_list;

  res.status(201).json({ userInfo: userInfo }); // userInfo 변수를 반환
};

exports.signup = signup;
exports.login = login;
exports.getUserInfo = getUserInfo;
exports.refreshToken = refreshToken;
exports.createGroup = createGroup;
exports.updateGroup = updateGroup;
exports.updateUserInfo = updateUserInfo;
exports.deleteGroupInfo = deleteGroupInfo;
