const nodemailer = require('nodemailer');
const { google } = require('googleapis');

// --- OUATH 관련 선언들 ---
const OAuth2 = google.auth.OAuth2;
const OAUTH_EMAIL = process.env.OAUTH_EMAIL;
const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID;
const OAUTH_CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;
const OAUTH_REFRESH_TOKEN = process.env.OAUTH_REFRESH_TOKEN;

// create OAuth2 client
const oauth2Client = new OAuth2(
  OAUTH_CLIENT_ID,
  OAUTH_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

// set refresh token
oauth2Client.setCredentials({
  refresh_token: OAUTH_REFRESH_TOKEN
});

// get access token using promise
const accessToken = oauth2Client.getAccessToken()

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
      type: 'OAuth2',
      user: OAUTH_EMAIL,
      clientId: OAUTH_CLIENT_ID,
      clientSecret: OAUTH_CLIENT_SECRET,
      refreshToken: OAUTH_REFRESH_TOKEN,
      accessToken: accessToken.toString()
  }
});

// --- OUATH 관련 선언들 ---


const sendVerifyEmail = (userEmail, pinCode) => {
  
  // create mail options
  const mailOptions = {
    from: OAUTH_EMAIL,
    to: userEmail,
    subject: 'Cocabot 인증 번호 요청 ✔',
    text: `Validation Code : ${pinCode}\n
    이 메일은 수신이 불가합니다.`,
  };

  // send mail
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        return console.log(error);
    }
    /**
     * 메세지 전송 성공 후 로그 부분
     */
    console.log('Message sent: %s', info.messageId);
  });
}

const sendPasswordReset = (userEmail, tempPassword) => {
  
  // create mail options
  const mailOptions = {
    from: OAUTH_EMAIL,
    to: userEmail,
    subject: 'Cocabot 임시 비밀번호 ✔',
    text: `임시 비밀번호 : ${tempPassword}\n
    이 메일은 수신이 불가합니다.`,
  };

  // send mail
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        return console.log(error);
    }
    /**
     * 메세지 전송 성공 후 로그 부분
     */
    console.log('Message sent: %s', info.messageId);
  });
}

const generateTempPassword = (length = 8) => {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#";
  
  // 각 문자 유형이 최소 1개 이상 포함되도록 함
  let password = 
      lowercase[Math.floor(Math.random() * lowercase.length)] +
      numbers[Math.floor(Math.random() * numbers.length)] +
      symbols[Math.floor(Math.random() * symbols.length)];
  
  // 나머지 길이만큼 랜덤하게 추가
  const allChars = lowercase + numbers + symbols;
  for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // 문자열을 랜덤하게 섞음
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

const generateTempPinCode = () => {
  return Math.floor(1000 + Math.random() * 9000);
}
exports.sendVerifyEmail = sendVerifyEmail;
exports.sendPasswordReset = sendPasswordReset;
exports.generateTempPassword = generateTempPassword;
exports.generateTempPinCode = generateTempPinCode;

