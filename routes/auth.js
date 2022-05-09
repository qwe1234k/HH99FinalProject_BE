var express = require("express");
var router = express.Router();
var passport = require("../passport/passport.js");

//Google 로그인
router.get("/google", passport.authenticate("google", { scope: ["profile"] }));

const googleCallback = (req, res, next) => {
  passport.authenticate(
    "google",
    { failureRedirect: "/" },
    (err, user, info) => {
      if (err) return next(err);
      console.log("콜백~~~");
      const { userId, userName } = user;
      // const token = jwt.sign({ userId: userId }, "velog-secret-key");
      // result = {
      //   token,
      //   userId: userId,
      //   userName: userName,
      // };
      // console.log(result);
      res.json({ userId, userName });
    }
  )(req, res, next);
};
router.get("/google/callback", googleCallback);

//Kakao 로그인
router.get("/kakao", passport.authenticate("kakao"));

const kakaoCallback = (req, res, next) => {
  passport.authenticate(
    "kakao",
    { failureRedirect: "/" },
    (err, user, info) => {
      if (err) return next(err);
      console.log("콜백~~~");
      const { userId, userName } = user;
      // const token = jwt.sign({ userId: userId }, "velog-secret-key");
      // result = {
      //   token,
      //   userId: userId,
      //   userName: userName,
      // };
      res.json({ userId, userName });
    }
  )(req, res, next);
};
router.get("/kakao/callback", kakaoCallback);

module.exports = router;
