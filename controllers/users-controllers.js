const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const HttpError = require('../models/http-error');
const UserData = require('../models/users_data');

const log = require('../util/logger');
const dbUtils = require('../util/dbUtils');

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

const signup = async (req, res, next) => {
  /** users-routes.js 에서 검사한 Name email password 의 밸리데이션 체크*/
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    log.error(errors);
    res.status(422);
    return next(
      new HttpError('사용자 입력값 유효하지 않음\n 비밀번호 6글자 이상', 422)
    );
  }

  const { userName, userEmail, password, homeAddress, phoneNumber } = req.body;

  /** 이미 존재 하는 Email 인지 체크 */
  let existingUser;
  try {
    existingUser = await dbUtils.findOneByField(UserData, "user_email", userEmail)
    //# DB 상에 해당 user_email 이 없으면 existingUser 이 null 값

    /** 일치하는 Email이 없는 경우 */
    if (existingUser) {
      log.error(existingUser);
      return next(new HttpError(
        "이미 있는 ID 에 중복가입 에러", 409
      ));
    }
  } catch (err) {
    return next(new HttpError(
      'DB 조회 실패 [ 서버 에러 : DB query ]', 500
    ));
  }

  /** 가입하려는 password 암호화 */
  let hashedPassword
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (err) {
    return next(new HttpError(
      '비밀번호 생성 에러 [ 서버 에러 : 암호화 에러 ]', 500
    ));
  }

  const createdUser = new UserData({
    user_name: userName,
    user_email: userEmail,
    password: hashedPassword,
    home_address: homeAddress,
    phone_number: phoneNumber,
    places: [],
  });

  /** 회원 정보 DB Create*/
  try {
    await createdUser.save();
    log.debug(`signup 회원가입 완료 >>\n ${createdUser}`)
  } catch (err) {
    return next(new HttpError(
      `Sighing Up failed, please try again ${err}`, 500
    ))
  }

  /** JWT 토큰 발행 */
  let token;
  try {
    const oneHour = 1000 * 60 * 60;
    token = jwt.sign(
      {
        dbObjectId: createdUser.id,
        userEmail: createdUser.user_email,
        expireTime: oneHour
      },
      process.env.JWT_PRIVATE_KEY,
      { expiresIn: oneHour }
    );
  } catch (err) {
    return next(new HttpError(
      '토큰 생성 에러 [ 서버 에러 : 토큰 에러 ]', 500
    ));
  }

  /** Client Response */
  // res.status(201).json({ user: createdUser.toObject({ getters: true }) });
  res
    .status(201)
    .json({
      dbObjectId: createdUser.id,
      userEmail: createdUser.user_email,
      token: token
    });
};

const login = async (req, res, next) => {
  const { userEmail, password } = req.body;

  let existingUser;
  /** DB 찾기 에러 */
  try {
    existingUser = await dbUtils.findOneByField(UserData, "user_email", userEmail)
    //# DB 상에 해당 Email 이 없으면 existingUser 이 null 값

    /** 일치하는 Email이 없는 경우 */
    if (!existingUser) {
      return next(new HttpError(
        "Email 이 존재하지 않습니다.", 404
      ));
    }
  } catch (err) {
    return next(new HttpError(
      '로그인 할 수 없습니다. [ 서버 에러 : DB query ] ', 500
    ));
  }

  /** DB에 있는 암호화된 Password를 복호화 하지 못함 */
  let isValidPassword
  try {
    const isValidPassword = await bcrypt.compare(
      password.toString().trim(),
      existingUser.password
    );

    if (!isValidPassword) {
      return next(new HttpError("비밀번호가 틀립니다.", 403));
    }

  } catch (bcryptError) {
    log.error('bcrypt 에러:', bcryptError);
    return next(new HttpError(
      "비밀번호 검증 중 오류가 발생했습니다.", 500
    ));
  }

  /** JWT 토큰 발행 */
  let token;
  try {
    const oneHour = 1000 * 60 * 60;
    token = jwt.sign(
      {
        dbObjectId: existingUser.id,
        user_email: existingUser.user_email,
        expireTime: oneHour
      },
      process.env.JWT_PRIVATE_KEY,
      { expiresIn: oneHour }
    );
  } catch (err) {
    log.error(err);
    return next(new HttpError(
      '토큰 생성 에러 [ 서버 에러 : 토큰 에러 ]', 500
    ));
  }

  /** Client Response */
  // res.json({
  //   message: 'Logged in',
  //   user: existingUser.toObject({ getters: true })
  // });
  res.json({
    dbObjectId: existingUser.id,
    userEmail: existingUser.user_email,
    token: token
  });
};

const getUserInfo = async (req, res, next) => {
  const { userEmail } = req.body;

  let existingUser;
  /** DB 찾기 에러 */
  try {
    existingUser = await dbUtils.findOneByField(UserData, "user_email", userEmail)
    //# DB 상에 해당 Email 이 없으면 existingUser 이 null 값

    /** 일치하는 Email이 없는 경우 */
    if (!existingUser) {
      return next(new HttpError(
        "Email 이 존재하지 않습니다.", 404
      ));
    }
  } catch (err) {
    return next(new HttpError(
      '로그인 할 수 없습니다. [ 서버 에러 : DB query ] ', 500
    ));
  }

  res.json({ userInfo: existingUser });
}


const updateUserInfo = async (req, res, next) => {
  const { userName, userEmail, password, homeAddress, phoneNumber } = req.body;

  let existingUser;
  /** DB 찾기 에러 */
  try {
    existingUser = await dbUtils.findOneByField(UserData, "user_email", userEmail)
    //# DB 상에 해당 Email 이 없으면 existingUser 이 null 값

    /** 일치하는 Email이 없는 경우 */
    if (!existingUser) {
      return next(new HttpError("Email 이 존재하지 않습니다.", 404));
    }

    // 비밀번호가 제공된 경우 암호화 처리
    if (password) {
      let hashedPassword
      try {
        hashedPassword = await bcrypt.hash(password, 12);
      } catch (err) {
        return next(new HttpError('비밀번호 생성 에러 [ 서버 에러 : 암호화 에러 ]', 500));
      }
      const updateData = {
        user_name: userName,
        password: hashedPassword,
        home_address: homeAddress,
        phone_number: phoneNumber
      };
    }
    const updateData = {
      user_name: userName,
      home_address: homeAddress,
      phone_number: phoneNumber
    };
    result = await dbUtils.updateByField(UserData, "user_email", userEmail, updateData);
  } catch (err) {
    return next(new HttpError(
      '업데이트 할 수 없습니다. [ 서버 에러 : DB query ] ', 500
    ));
  }

  res.json({ result: result });
}


exports.signup = signup;
exports.login = login;
exports.getUserInfo = getUserInfo;
exports.updateUserInfo = updateUserInfo;