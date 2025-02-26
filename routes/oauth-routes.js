const express = require("express");
const { check } = require("express-validator");

const ouathController = require('../controllers/ouath-controller');
const checkAuth = require("../middleware/check-auth");

const { log, checkProps} = require("../util/codeHelperUtils")

const router = express.Router();

// // app.use('/api/places', placesRoutes);  // /api/places/...   인 경우만 Routing 하도록 지정
// router.get(process.env.API_USERS_ROOT, usersControllers.getUsers);

// 인증이 필요 없는 라우트
router.post(
  process.env.API_OUATH_GOOGLE_LOGIN,
  [
    check('userName').not().isEmpty(),
    check('userEmail')
      .normalizeEmail()   // Test@test.com => test@test.com
      .isEmail(),         //  @xxx.xxx 유무
    check('password').isLength({ min: 6 }),
    check('homeAddress'),
    check('phoneNumber'),
  ],
  ouathController.googleLogin);

router.post(
  process.env.API_OUATH_REQUEST_EMAIL,
  [
  check('userEmail')
  .not().isEmpty()
  .isEmail()         //  @xxx.xxx 유무
  .normalizeEmail()   // Test@test.com => test@test.com
  ],
  ouathController.reqEmailCode);

router.post(
  process.env.API_OUATH_CHECK_PINCODE,
  [
  check('pinCode')
  .not().isEmpty()
  .isLength({ min: 4, max: 4 })  // 4자리 PIN 코드 검증
  .isNumeric()  // 숫자만 허용
  ],
  ouathController.checkValCode);

// 인증 미들웨어를 적용
router.use(checkAuth);
// ↓↓↓↓↓↓↓↓ 인증이 필요한 라우트 ↓↓↓↓↓↓↓↓


module.exports = router;

