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


const sendEmail = (userEmail, pinCode) => {
  
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
    console.log('Message sent: %s', info.messageId);
  });

}

exports.sendEmail = sendEmail;
