const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validation');

const Schema = mongoose.Schema;

const dbTableName = "users_data"

const userSchema = new Schema({
  user_name     : { type: String, required: [true, '사용자 이름은 필수입니다.'] },
  user_email    : { type: String, required: [true, '이메일은 필수입니다.'], unique: true },
  password      : { type: String, required: [true, '비밀번호는 필수입니다.'], minlength: 6 },
  home_address  : { type: String, required: [true, '주소는 필수입니다.'] },
  phone_number  : { type: String, required: [true, '전화번호는 필수입니다.'] },
  device_list   : [{ type: mongoose.Types.ObjectId, required: true, ref: 'DeviceInfo' }],  // Place.js 의존성생성 (외래키 개념)
  // device_group_list  : [{ type: mongoose.Types.ObjectId, required: true, default: [mongoose.Types.ObjectId("default_group")] }]
  // device_group_list  : [{ type: mongoose.Types.ObjectId, default: () => [mongoose.Types.ObjectId("default_group")] }],
  device_group_list: { type: [String], default: ['default_group'] },
});

userSchema.plugin(uniqueValidator);

// ( 해당 몽구스 모델 별칭, 지정할 스키마, 생성 or 지정할 dbTable명 )
module.exports = mongoose.model("UserData", userSchema, dbTableName);