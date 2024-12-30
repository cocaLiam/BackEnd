## 구성
![구성](구성도.png)

___

#### 
# BackEnd 구성 overview
#### 
- NodeJS -- Express -- JS
- MVC 패턴 (model–view–controller, MVC)
- mongoose (mongoDB), (cloud Server DB : Atlas)
  - [MongoDB Atlas](https://cloud.mongodb.com/v2#/org/66fcba7d069a4d43c73cf7af/projects)
- 구글 MAP_API 사용
  - [Google Cloud Console](https://console.cloud.google.com/apis/credentials?hl=ko&project=effective-brook-437306-h0)
- FrontEnd 서버
  - ***AWS s3***
    - [awsS3] https://eu-north-1.console.aws.amazon.com/console/home?region=eu-north-1#
- BackEnd 서버
  - ***heroku***
    - [heroku] https://dashboard.heroku.com/

___

#### 
# BackEnd( JavaScript, NodeJS, ExpressJS ) 배포
#### 

### 환경변수 설명
  - `nodemon.json` [개발전용]
  - `heroku 로그인 -> Settings -> Config Vars -> Reveal Config Vars` [배포전용]

### Library 설치
```bash
$ npm i
```

### BackEnd code 배포판 빌드
```bash
X 필요 없음
```

### Local Test
```bash
```

### Local Test ( with local backend )
```bash
$ nodemon app.js  # localhost:5000 으로 서버구성해서 app.js 실행
```

### 실행 에러 정리
```bash
# nodemon 없으면 설치 필요
$ npm install -g nodemon
$ nodemon -v
```

___

#### 
# BackEnd server 업로드
#### 

### heroku 업로드
  - Automatic deploys from ***본인 깃 Branch*** are enabled  설정 후, 
  - git push 하면 자동(CI/CD) 업로딩 진행

### heroku install
```bash
$ curl https://cli-assets.heroku.com/install-ubuntu.sh | sh
```

### heroku 사용 Command
```bash
# 뭐든 로그인 후 CLI 이용
$ heroku login
# Dyno 끄기
$ heroku ps:scale web=0 --app heroku-app-name
# Dyno 켜기
$ heroku ps:scale web=1 --app heroku-app-name
# 재시작
$ heroku restart --app heroku-app-name
# 애플리케이션 상태 확인
$ heroku ps --app heroku-app-name
# 각종 정보 확인
$ heroku info -a heroku-app-name
# 서버 로그 확인
$ heroku logs --tail --app heroku-app-name
# 환경 변수 설정
$ heroku config:set KEY=VALUE --app heroku-app-name
```

___