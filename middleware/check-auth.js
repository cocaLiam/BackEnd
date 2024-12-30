const jwt = require('jsonwebtoken')
const HttpError = require("../models/http-error");
const { checkProps, log } = require("../util/codeHelperUtils");
const dbUtils = require('../util/dbUtils');


module.exports = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  try {

    // 1. authorization 헤더 존재 여부 먼저 확인
    if (!req.headers.authorization) {
      return next(new HttpError(
        "Authentication failed! [인증 헤더 없음]", 401
      ));
    }

    // 2. Bearer 토큰 형식 확인 및 추출
    const token = req.headers.authorization.split(' ')[1];
    // Authorization: 'Bearer TOKEN' <- [0] = Bearer , [1] = TOKEN
    if (!token) {
      return next(new HttpError(
        "Authentication filed! [ TOKEN 정보 없음 ]", 401)
      );
    }

    // 3. 토큰 검증
    const decodedToken = jwt.verify(token, process.env.JWT_PRIVATE_KEY);
    log.debug(`Token 유효 시간 : ${((decodedToken.exp) - (decodedToken.iat))} 초`);
    log.debug(`Token 종료 시간 : ${new Date(decodedToken.exp * 1000).toLocaleString()}`);
    if (!decodedToken) {
      return next(new HttpError(
        "Authentication failed! [유효하지 않은 토큰]", 401
      ));
    }

    // 4. 검증된 사용자 정보 저장
    req.tokenData = {
      dbObjectId: decodedToken.dbObjectId,
      userEmail: decodedToken.userEmail
    };
    next();

  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      log.warn(`토큰 유효 시간 종료`);
      return next(new HttpError("토큰 유효 시간 종료", 401));
    }
    log.warn(`Token 인증 실패 ${err}`);
    return next(new HttpError("Authentication failed!", 401));
  }
}