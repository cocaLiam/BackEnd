const express = require("express");
const { check } = require("express-validator");

const oauthController = require("../controllers/ouath-controller");
const checkAuth = require("../middleware/check-auth");

const { log, checkProps } = require("../util/codeHelperUtils");

const router = express.Router();

// // app.use('/api/places', placesRoutes);  // /api/places/...   인 경우만 Routing 하도록 지정
// router.get(process.env.API_USERS_ROOT, usersControllers.getUsers);

// 인증이 필요 없는 라우트
router.post(
  process.env.API_OUATH_VERIFY_EMAIL,
  [
    check("userEmail")
      .not()
      .isEmpty()
      .isEmail() //  @xxx.xxx 유무
      .normalizeEmail(), // Test@test.com => test@test.com
  ],
  oauthController.verifyEmail
);

router.post(
  process.env.API_OUATH_CHECK_EMAIL,
  [
    check("userEmail")
      .not()
      .isEmpty()
      .isEmail() //  @xxx.xxx 유무
      .normalizeEmail(), // Test@test.com => test@test.com
    check("pinCode")
      .not()
      .isEmpty()
      .isLength({ min: 4, max: 4 }) // 4자리 PIN 코드 검증
      .isNumeric(), // 숫자만 허용
  ],
  oauthController.checkEmail
);

router.post(process.env.API_OUATH_VERIFY_SMS, oauthController.verifySms);

router.post(process.env.API_OUATH_CHECK_SMS, oauthController.checkSms);

router.post(
  process.env.API_OUATH_PASSWORD_RESET,
  [
    check("userEmail")
      .not()
      .isEmpty()
      .isEmail() //  @xxx.xxx 유무
      .normalizeEmail(), // Test@test.com => test@test.com
  ],
  oauthController.passwordReset
);

router.post(process.env.API_OUATH_GOOGLE_LOGIN, oauthController.googleLogin);

router.post(process.env.API_OUATH_NAVER_LOGIN, oauthController.naverLogin);

router.post(process.env.API_OUATH_KAKAO_LOGIN, oauthController.kakaoLogin);
// 인증 미들웨어를 적용
router.use(checkAuth);
// ↓↓↓↓↓↓↓↓ 인증이 필요한 라우트 ↓↓↓↓↓↓↓↓

module.exports = router;
