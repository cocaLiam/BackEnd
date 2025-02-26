const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const HttpError = require("../models/http-error");
const UserData = require("../models/users_data");
const DeviceInfo = require("../models/device_info");
const dbUtils = require("../util/dbUtils");
const nodemailer = require("../util/nodeMailUtil")

const ValidationError = require("mongoose/lib/error/validation");
const { checkProps } = require("../util/codeHelperUtils");
const log = require("../util/logger");

function debugReqConsolePrint(req) {
  console.log("======= DEBUG LOG =======");
  console.log("1. Raw req.body:", req.body);
  console.log(`2. req.body type: ${Object.prototype.toString.call(req.body)}`);
  console.log("3. req.body keys:", Object.keys(req.body));
  console.log("4. stringified body:", JSON.stringify(req.body));
  console.log("5. dbObjectId:", req.body?.dbObjectId);
  console.log("======= DEBUG LOG =======");
}
const googleLogin = async (req, res, next) => {
  /** users-routes.js 에서 검사한 Name email password 의 밸리데이션 체크*/
  // debugReqConsolePrint(req);

  /** Client Response */
  // res.status(201).json({ user: createdUser.toObject({ getters: true }) });
  res.status(201).json({});
};

const reqEmailCode = async (req, res, next) => {
  /** users-routes.js 에서 검사한 Name email password 의 밸리데이션 체크*/
  // debugReqConsolePrint(req);
  const deviceOwner = req.params.uid; //
  const { userEmail } = req.body;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    log.error("사용자 입력값 Validation Error ↓ ");
    debugReqConsolePrint(req)
    res.status(421);
    return next(
      new HttpError("userEmail 틀림", 421)
    );
  }

  nodemailer.sendEmail(userEmail, 1893)

  log.notice(`userEmail : ${userEmail}`)

  /** Client Response */
  // res.status(201).json({ user: createdUser.toObject({ getters: true }) });
  res.status(201).json();
};

const checkValCode = async (req, res, next) => {
  /** users-routes.js 에서 검사한 Name email password 의 밸리데이션 체크*/
  // debugReqConsolePrint(req);
  const deviceOwner = req.params.uid; //
  const { pinCode } = req.body;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    log.error("사용자 입력값 Validation Error ↓ ");
    debugReqConsolePrint(req)
    res.status(423);
    return next(
      new HttpError("PinCode 틀림", 423)
    );
  }

  log.notice(`pinCode : ${pinCode}`)

  /** Client Response */
  // res.status(201).json({ user: createdUser.toObject({ getters: true }) });
  res.status(201).json();
};

exports.googleLogin = googleLogin;
exports.reqEmailCode = reqEmailCode;
exports.checkValCode = checkValCode;
