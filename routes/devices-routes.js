const express = require("express");
const { check } = require('express-validator');

// const placesControllers = require('../controllers/places-controllers');
const deviceControllers = require("../controllers/devices-controller");

const fileUpload = require("../middleware/file-upload");
const checkAuth = require("../middleware/check-auth");

const router = express.Router();

router.use(checkAuth);

router.get(process.env.API_DEVICE_LIST, deviceControllers.getDeviceList);

router.get(process.env.API_DEVICE_INFO, 
  [
    check('macAddress').not().isEmpty()
  ],
  deviceControllers.getDeviceInfo);

// app.use('/api/device', deviceRoute);  // /api/places/...   인 경우만 Routing 하도록 지정
/** 유효한 Token 인지 확인하는 Middle Ware 단계
 *  유효한 토큰이 아닐 시, 밑에 라우팅들을 제한함
 */

router.post(
  process.env.API_DEVICE_CREATE,
  [  // 각각의 함수를 호출하며 next를 호출한다
    check('deviceGroup').optional(), // deviceGroup이 비어 있어도 허용
    check('macAddress').not().isEmpty(),
    check('deviceName').not().isEmpty(),
    check('battery').not().isEmpty(),
  ],
  deviceControllers.createDeviceInfo /* API 핸들러 << 
  일반적으로 미들웨어 체인의 마지막에 위치하며, 
  res.send(), res.json(), res.render() 등을 사용하여 응답을 보냄 */
);

router.delete(
  process.env.API_DEVICE_DELETE, 
  [  // 각각의 함수를 호출하며 next를 호출한다
    check('macAddress').not().isEmpty(),
    check('deviceName').not().isEmpty(),
  ],
  deviceControllers.deleteDeviceInfo
);

router.patch(
  process.env.API_DEVICE_UPDATE,
  [  // 각각의 함수를 호출하며 next를 호출한다
    check('macAddress').not().isEmpty(),
    check('deviceName').not().isEmpty(),
    check('battery').not().isEmpty(),
  ],
  deviceControllers.updateDeviceInfo
);

router.patch(
  process.env.API_DEVICE_GROUP_UPADTE,
  [  // 각각의 함수를 호출하며 next를 호출한다
    check('macAddress').not().isEmpty(),
    check('deviceGroup').not().isEmpty(),
  ],
  deviceControllers.updateDeviceGroupInfo
);

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
