const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const dbTableName = "device_info"

const placeSchema = new Schema({
  device_owner  : { type: mongoose.Types.ObjectId, required: true, ref: 'UserData' },   // User.js 의존성생성 (외래키 개념)
  device_group  : { type: String, required: true, default: "default_group"}, // 기본값 설정
  mac_address   : { type: String, required: true },
  device_name   : { type: String, required: true },
  battery       : { type: String, required: true },
});

// ( 해당 몽구스 모델 별칭, 지정할 스키마, 생성 or 지정할 dbTable명 )
module.exports = mongoose.model('DeviceInfo', placeSchema, dbTableName);

// 678df882eacc822d0e490362
// 111111111111111111111111


// 9C:95:6E:40:0F:75
// 11:11:11:11:11:11

