const express = require("express");
const app = express();
const moment = require("moment");
require("moment-timezone");
moment.tz.setDefault("Asia/seoul");
const cors = require("cors");
const passport = require("passport");
const session = require("express-session");
const { sequelize } = require("./models");
const fs = require("fs");

// Passport setting
app.use(
  session({ secret: "MySecret", resave: false, saveUninitialized: true })
);
app.use(passport.initialize());
app.use(passport.session());

//라우터 불러오기
const mainPage = require("./routes/mainPage");
const subMainPage1 = require("./routes/subMainPage1");
const subMainPage2 = require("./routes/subMainPage2");
const auth = require("./routes/auth");
// sequelize 연결
sequelize
  .sync({ force: false })
  .then(() => {
    console.log("데이터베이스 연결 성공");
  })
  .catch((err) => {
    console.error(err);
  });

// 접속 로그 남기기
const requestMiddleware = (req, res, next) => {
  console.log(
    "[Ip address]:",
    req.ip,
    "[method]:",
    req.method,
    "[Request URL]:",
    req.originalUrl,
    " - ",
    moment().format("YYYY-MM-DD HH:mm")
  );
  next();
};

// 각종 미들웨어 추가
app.use(cors({ credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(requestMiddleware);

// FE 테스트용 html응답 API입니다.
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/bank.html");
});

// 라우터 연결하기
app.use("/main", [mainPage]);
app.use("/sub1", [subMainPage1]);
app.use("/sub2", [subMainPage2]);
app.use("/oauth", [auth]);

// DB에 데이터를 넣기위한 API
app.post("/dataInput", async (req, res) => {
  // 1번 은행, 2번 휴대전화, 3번 표준시, 4번 통용어, 5번 교통법, 6번 비자
  const caseNumber = 5;
  const bank = ["은행"];
  const phone = ["휴대전화"];
  const time = ["표준시"];
  const language = ["통용어"];
  const traffic = ["교통법"];
  const visa = ["비자"];
  const country = [
    "뉴질랜드",
    "독일",
    "미국북동부",
    "미국서부",
    "베트남",
    "싱가포르",
    "영국",
    "일본",
    "중국",
    "캐나다동부",
    "캐나다북부",
    "캐나다서부",
    "호주",
  ];
  switch (caseNumber) {
    case 1:
      for (i = 0; i < country.length; i++) {
        for (j = 0; j < bank.length; j++) {
          const countryName = country[i] + "_" + bank[j] + ".json";
          const file = fs.readFileSync(
            __dirname + `/project/은행/${countryName}`,
            "utf-8"
          );
          const jsonFile = JSON.parse(file);
          const {
            bankRequirePaper,
            mainBank,
            bankStep,
            bankCaution,
            accountType,
            name,
          } = jsonFile;

          await Bank.create({
            bankRequirePaper,
            mainBank,
            bankStep,
            bankCaution,
            accountType,
            name,
          });
        }
      }
      break;
    case 2:
      for (i = 0; i < country.length; i++) {
        for (j = 0; j < phone.length; j++) {
          const countryName = country[i] + "_" + phone[j] + ".json";
          const file = fs.readFileSync(
            __dirname + `/project/휴대전화/${countryName}`,
            "utf-8"
          );
          const jsonFile = JSON.parse(file);
          const { phoneOpeningMethod, mainTelecom, recommendPlan, name } =
            jsonFile;

          await Phone.create({
            phoneOpeningMethod,
            mainTelecom,
            recommendPlan,
            name,
          });
        }
      }
      break;
    case 3:
      for (i = 0; i < country.length; i++) {
        for (j = 0; j < time.length; j++) {
          const countryName = country[i] + "_" + time[j] + ".json";
          const file = fs.readFileSync(
            __dirname + `/project/표준시/${countryName}`,
            "utf-8"
          );
          const jsonFile = JSON.parse(file);
          const { standardTime, name } = jsonFile;

          await Time.create({
            standardTime,
            name,
          });
        }
      }
      break;
    case 4:
      for (i = 0; i < country.length; i++) {
        for (j = 0; j < language.length; j++) {
          const countryName = country[i] + "_" + language[j] + ".json";
          const file = fs.readFileSync(
            __dirname + `/project/통용어/${countryName}`,
            "utf-8"
          );
          const jsonFile = JSON.parse(file);
          const { standardLanguage, name } = jsonFile;

          await Language.create({
            standardLanguage,
            name,
          });
        }
      }
      break;
    case 5:
      for (i = 0; i < country.length; i++) {
        for (j = 0; j < traffic.length; j++) {
          const countryName = country[i] + "_" + traffic[j] + ".json";
          const file = fs.readFileSync(
            __dirname + `/project/교통법/${countryName}`,
            "utf-8"
          );
          const jsonFile = JSON.parse(file);
          const { trafficLaw, name } = jsonFile;

          await TrafficLaw.create({
            trafficLaw,
            name,
          });
        }
      }
      break;
    case 6:
      for (i = 0; i < country.length; i++) {
        for (j = 0; j < visa.length; j++) {
          const countryName = country[i] + "_" + visa[j] + ".json";
          const file = fs.readFileSync(
            __dirname + `/project/비자/${countryName}`,
            "utf-8"
          );
          const jsonFile = JSON.parse(file);
          const {
            workVisa,
            immigrationVisa,
            workingHolidayVisa,
            studyVisa,
            name,
          } = jsonFile;
          // console.log(workVisa);

          // await Visa.create({
          //   workVisa,
          //   immigrationVisa,
          //   workingHolidayVisa,
          //   studyVisa,
          //   name,
          // });
        }
      }
      break;
  }

  return res.status(200).json({
    success: "등록 완료",
  });
});

app.listen(3000, () => console.log("start.."));
