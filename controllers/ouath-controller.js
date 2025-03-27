const { validationResult } = require("express-validator");

const NodeCache = require("node-cache");
const { OAuth2Client } = require("google-auth-library");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const HttpError = require("../models/http-error");
const nodemailer = require("../util/nodeMailUtil");
const UserData = require("../models/users_data");
const dbUtils = require("../util/dbUtils");

const ValidationError = require("mongoose/lib/error/validation");
const { checkProps } = require("../util/codeHelperUtils");
const log = require("../util/logger");

const myCache = new NodeCache();

function debugReqConsolePrint(req) {
  console.log("======= DEBUG LOG(BODY CHECK) =======");
  console.log("1. Raw req.body:", req.body);
  console.log(`2. req.body type: ${Object.prototype.toString.call(req.body)}`);
  console.log("3. req.body keys:", Object.keys(req.body));
  console.log("4. stringified body:", JSON.stringify(req.body));
  console.log("5. dbObjectId:", req.body?.dbObjectId);
  console.log("======= DEBUG LOG(BODY CHECK) =======");
}

function debugVariablePrint(someVar) {
  console.log("======= DEBUG LOG(value Check) =======");
  console.log("1. Value:", someVar);
  console.log(`2. Value Type: ${Object.prototype.toString.call(someVar)}`);
  console.log("3. Value Data:", JSON.stringify(someVar, null, 2));
  console.log("======= DEBUG LOG(value Check) =======");
}

const HALF_ONE_MONTH = 60 * 60 * 24 * 15;
const ONE_HOUR = 60 * 60;
const HALF_ONE_HOUR = 60 * 30;

const verifyEmail = async (req, res, next) => {
  const { userEmail } = req.body;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    log.error("사용자 입력값 Validation Error ↓ ");
    debugReqConsolePrint(req);
    res.status(421);
    return next(new HttpError("Mail 형식이 잘못 됨", 421));
  }

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

  const pinCode = nodemailer.generateTempPinCode();

  const cacheKey = userEmail;

  const existingCode = myCache.get(cacheKey);
  if (existingCode) {
    myCache.del(cacheKey);
  }

  // set의 세 번째 매개변수로 TTL(초) 지정
  myCache.set(
    cacheKey,
    {
      pinCode: String(pinCode),
      attempts: 0,
      timestamp: Date.now(),
    },
    300
  ); // 캐시 저장데이터 만료기한 5분분

  nodemailer.sendVerifyEmail(userEmail, pinCode);
  res.status(201).json();
};

const checkEmail = async (req, res, next) => {
  const { userEmail, pinCode } = req.body;
  const cacheKey = userEmail;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    log.error("사용자 입력값 Validation Error ↓ ");
    debugReqConsolePrint(req);
    res.status(423);
    return next(
      new HttpError("userEmail, pinCode 형식이 잘못 되었습니다.", 423)
    );
  }

  const storedData = myCache.get(cacheKey);

  if (!storedData) {
    return next(
      new HttpError("인증 코드가 만료되었거나 존재하지 않습니다.", 423)
    );
  }

  if (storedData.pinCode == pinCode) {
    // 인증 성공 시 캐시에서 삭제
    myCache.del(cacheKey);
    res.status(201).json();
    return;
  }

  // 실패 횟수 증가
  storedData.attempts += 1;

  // 최대 시도 횟수 초과 시
  if (storedData.attempts >= 5) {
    myCache.del(cacheKey);
    return next(new HttpError("최대 시도 횟수를 초과했습니다.", 423));
  }

  myCache.set(cacheKey, storedData);
  return next(new HttpError("잘못된 인증 코드입니다.", 423));
};

const verifySms = async (req, res, next) => {
  // debugReqConsolePrint(req);

  res.status(201).json({});
};

const checkSms = async (req, res, next) => {
  // debugReqConsolePrint(req);

  res.status(201).json({});
};

const passwordReset = async (req, res, next) => {
  const { userEmail } = req.body;

  debugReqConsolePrint(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    log.error("사용자 입력값 Validation Error ↓ ");
    debugReqConsolePrint(req);
    res.status(421);
    return next(new HttpError("Mail 형식이 잘못 됨", 421));
  }

  let hashedPassword;
  let existingUser;
  let tempEmailPassword;
  try {
    existingUser = await dbUtils.findOneByField(
      UserData,
      "user_email",
      userEmail
    );
    /** 일치하는 Email이 없는 경우 */
    if (!existingUser) {
      log.error(`회원가입되지 않은 Email 입니다. : ${userEmail}`);
      return next(new HttpError("회원가입되지 않은 Email", 421));
    }

    tempEmailPassword = nodemailer.generateTempPassword();
    debugVariablePrint(tempEmailPassword);
    try {
      hashedPassword = await bcrypt.hash(tempEmailPassword, 12);
    } catch (err) {
      log.error(`에러 스택: ${err.stack}`);
      return next(new HttpError("비밀번호 암호화 실패", 500));
    }

    let userInfo = {};
    userInfo.password = hashedPassword;
    result = await dbUtils.updateByField(
      UserData,
      "user_email",
      userEmail,
      userInfo
    );
  } catch (err) {
    log.error(`에러 스택: ${err.stack}`);
    return next(new HttpError("DB 조회 실패 [ 서버 에러 : DB query ]", 500));
  }

  nodemailer.sendPasswordReset(userEmail, tempEmailPassword);
  res.status(201).json();
};

const googleLogin = async (req, res, next) => {
  // debugReqConsolePrint(req);
  const { credential } = req.body;
  const client = new OAuth2Client(process.env.OAUTH_CLIENT_ID);

  let payload;
  try {
    // 토큰 검증
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.OAUTH_CLIENT_ID,
    });

    // 검증된 페이로드 가져오기
    payload = ticket.getPayload();
    // const { email, name, sub: googleId } = payload;

    // 이후 로직 처리...
  } catch (error) {
    return next(new HttpError("구글 토큰 검증 실패", 401));
  }

  // 1. 해당 이메일로 가입된 사용자가 있는지 확인
  let existingUser = await UserData.findOne({ user_email: payload.email });

  if (existingUser) {
    // 이미 가입된 사용자인 경우, 로그인 처리
    debugVariablePrint(existingUser);
    if (existingUser.login_type != "Google") {
      return next(
        new HttpError(
          `${existingUser.login_type} < 해당 소셜 로그인으로 이미 가입된 Email 입니다.`,
          421
        )
      );
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

      return res.status(201).json({
        dbObjectId: existingUser.id,
        token: token,
      });
    } catch (err) {
      log.error(`에러 스택: ${err.stack}`);
      return next(
        new HttpError("토큰 생성 에러 [ 서버 에러 : 토큰 에러 ]", 500)
      );
    }
  }

  // 새로운 사용자인 경우, 회원가입처리
  let hashedPassword;
  let tempEmailPassword = nodemailer.generateTempPassword();
  try {
    /** 가입하려는 password 암호화 */
    hashedPassword = await bcrypt.hash(tempEmailPassword, 12);
  } catch (err) {
    log.error(`에러 스택: ${err.stack}`);
    return next(new HttpError("비밀번호 암호화 실패", 500));
  }

  const createdUser = new UserData({
    user_name: payload.name,
    user_email: payload.email,
    login_type: "Google",
    password: hashedPassword,
    home_address: "",
    phone_number: "010-1234-5678",
    device_list: [],
    // google_id: googleId,
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

  res.status(201).json({
    dbObjectId: createdUser.id,
    token: token,
  });
};

const naverLogin = async (req, res, next) => {
  const payload = req.body.payload;
  // email,nickname,profileImage,age,gender,id,name,birthday,idToken

  // 1. 해당 이메일로 가입된 사용자가 있는지 확인
  let existingUser = await UserData.findOne({ user_email: payload.email });

  if (existingUser) {
    // 이미 가입된 사용자인 경우, 로그인 처리
    debugVariablePrint(existingUser);
    if (existingUser.login_type != "Naver") {
      return next(
        new HttpError(
          `${existingUser.login_type} < 해당 소셜 로그인으로 이미 가입된 Email 입니다.`,
          421
        )
      );
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

      return res.status(201).json({
        dbObjectId: existingUser.id,
        token: token,
      });
    } catch (err) {
      log.error(`에러 스택: ${err.stack}`);
      return next(
        new HttpError("토큰 생성 에러 [ 서버 에러 : 토큰 에러 ]", 500)
      );
    }
  }
//-------------------------------------------------------------------------------
  // 새로운 사용자인 경우, 회원가입처리
  let hashedPassword;
  let tempEmailPassword = nodemailer.generateTempPassword();
  try {
    /** 가입하려는 password 암호화 */
    hashedPassword = await bcrypt.hash(tempEmailPassword, 12);
  } catch (err) {
    log.error(`에러 스택: ${err.stack}`);
    return next(new HttpError("비밀번호 암호화 실패", 500));
  }

  const createdUser = new UserData({
    user_name: payload.name,
    user_email: payload.email,
    login_type: "Naver",
    password: hashedPassword,
    home_address: "",
    phone_number: "010-1234-5678",
    device_list: [],
    // google_id: googleId,
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

  res.status(201).json({
    dbObjectId: createdUser.id,
    token: token,
  });
};

const kakaoLogin = async (req, res, next) => {
  const payload = req.body.payload;
  // email,nickname,profileImage,age,gender,id,name,birthday,idToken
  debugReqConsolePrint(req)

  // 1. 해당 이메일로 가입된 사용자가 있는지 확인
  let existingUser = await UserData.findOne({ user_email: payload.email });
  if (existingUser) {
    // 이미 가입된 사용자인 경우, 로그인 처리
    debugVariablePrint(existingUser);
    if (existingUser.login_type != "Kakao") {
      return next(
        new HttpError(
          `${existingUser.login_type} < 해당 소셜 로그인으로 이미 가입된 Email 입니다.`,
          421
        )
      );
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

      return res.status(201).json({
        dbObjectId: existingUser.id,
        token: token,
      });
    } catch (err) {
      log.error(`에러 스택: ${err.stack}`);
      return next(
        new HttpError("토큰 생성 에러 [ 서버 에러 : 토큰 에러 ]", 500)
      );
    }
  }
//-------------------------------------------------------------------------------
  // 새로운 사용자인 경우, 회원가입처리
  let hashedPassword;
  let tempEmailPassword = nodemailer.generateTempPassword();
  try {
    /** 가입하려는 password 암호화 */
    hashedPassword = await bcrypt.hash(tempEmailPassword, 12);
  } catch (err) {
    log.error(`에러 스택: ${err.stack}`);
    return next(new HttpError("비밀번호 암호화 실패", 500));
  }

  const createdUser = new UserData({
    user_name: payload.name,
    user_email: payload.email,
    login_type: "Kakao",
    password: hashedPassword,
    home_address: "",
    phone_number: "010-1234-5678",
    device_list: [],
    // google_id: googleId,
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

  res.status(201).json({
    dbObjectId: createdUser.id,
    token: token,
  });
};

exports.verifyEmail = verifyEmail;
exports.checkEmail = checkEmail;
exports.verifySms = verifySms;
exports.checkSms = checkSms;
exports.passwordReset = passwordReset;
exports.googleLogin = googleLogin;
exports.naverLogin = naverLogin;
exports.kakaoLogin = kakaoLogin;
