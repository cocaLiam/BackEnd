const express = require("express");
const { check } = require("express-validator");

const usersControllers = require('../controllers/users-controllers');
const checkAuth = require("../middleware/check-auth");

const { log, checkProps} = require("../util/codeHelperUtils")

const router = express.Router();

// // app.use('/api/places', placesRoutes);  // /api/places/...   인 경우만 Routing 하도록 지정
// router.get(process.env.API_USERS_ROOT, usersControllers.getUsers);

// 인증이 필요 없는 라우트
router.post(
  process.env.API_USER_SIGNUP,
  [
    check('userName').not().isEmpty(),
    check('userEmail')
      .normalizeEmail()   // Test@test.com => test@test.com
      .isEmail(),         //  @xxx.xxx 유무
    check('password').isLength({ min: 6 }),
    check('homeAddress'),
    check('phoneNumber'),
  ],
  usersControllers.signup
);

router.post(process.env.API_USER_LOGIN, 
  [
    check('userEmail').not().isEmpty(),
    check('password').not().isEmpty(),
  ],
  usersControllers.login);

// 인증 미들웨어를 적용
router.use(checkAuth);
// ↓↓↓↓↓↓↓↓ 인증이 필요한 라우트 ↓↓↓↓↓↓↓↓

router.get(process.env.API_USER_INFO, 
  usersControllers.getUserInfo);
// router.get(process.env.API_USER_INFO, 
//   [
//     check('userEmail').not().isEmpty(),
//   ],
//   usersControllers.getUserInfo);

router.post(process.env.API_USER_REFRESH_TOKEN,
  [
    check('dbObjectId').not().isEmpty(),
  ],
  usersControllers.refreshToken);

router.post(process.env.API_USER_GROUP_CREATE,
  [
    check('dbObjectId').not().isEmpty(),
    check('createTargetGroupName').not().isEmpty(),
  ],
  usersControllers.createGroup);

router.patch(process.env.API_USER_GROUP_UPDATE, 
  [
    check('dbObjectId').not().isEmpty(),
    check('currentGroup').not().isEmpty(), // 업데이트 당할 그룹명
    check('updateTargetGroupName').not().isEmpty(),  // 업데이트 할 그룹명
  ]
  ,usersControllers.updateGroup);

router.patch(process.env.API_USER_UPDATE, 
  [
    check('dbObjectId').not().isEmpty(),
    check('userName').optional(),
    check('userEmail')
      .normalizeEmail()   // Test@test.com => test@test.com
      .isEmail()         //  @xxx.xxx 유무
      .optional(),
    check('password').isLength({ min: 6 }).not().isEmpty(),
    check('homeAddress').not().optional(),
    check('phoneNumber').not().optional(),
  ]
  ,usersControllers.updateUserInfo);


/** 
 * get 이고 post 고 patch, delete 고 기능이 있거나 한 건 아님.
 * 해당 Callback 함수에 구현된 Code 가 전부임
 * 예를들어 .get 써놓고 delete 해도 문법상 무관함
GET: 데이터를 조회할 때 사용
POST: 데이터를 생성할 때 사용
PATCH: 데이터를 부분적으로 수정할 때 사용
DELETE: 데이터를 삭제할 때 사용
*/
module.exports = router;

