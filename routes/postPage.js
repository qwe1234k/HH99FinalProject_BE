const express = require("express");
const router = express.Router();
const authMiddleWare = require("../middleware/authMiddleWare");
const { Post, Comment, User, Ip } = require("../models");
const { Op } = require("sequelize");
const fs = require("fs");
const path = require("path");
const AWS = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");
AWS.config.loadFromPath(path.join(__dirname, "../config/s3.json")); // 인증
let s3 = new AWS.S3();
let upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: "a-fo-bucket2",
    key: function (req, file, cb) {
      let extension = path.extname(file.originalname);
      cb(null, Date.now().toString() + extension);
    },
    acl: "public-read-write",
  }),
});

// 게시글 등록 ##
router.post(
  "/create",
  upload.single("image"),
  authMiddleWare,
  async (req, res) => {
    try {
      const { title, subTitle, content, continent, target } = req.body;
      const { userInfo } = res.locals;
      const { userId, userName } = userInfo;

      // 이미지를 업로드 해준경우
      if (req.file) {
        var postImageUrl = req.file.location;
      }
      // 이미지를 업로드 안해준경우
      else {
        var postImageUrl = null;
      }

      // penalty(INT)값 찾기
      const penaltyInfo = await User.findOne({
        logging: false,
        attributes: ["penalty", "penaltedAt"],
        where: {
          userId,
        },
      });
      let { penalty } = penaltyInfo.dataValues;
      let { penaltedAt } = penaltyInfo.dataValues;

      // penalty 기간정의
      let penaltyDifference = new Date() - penaltedAt;
      // 벤 기간이 3일 이하이면 에러 발생시키기
      if (penaltyDifference <= 259200000) {
        return res
          .status(401)
          .json({ msg: "임시정지 기간인 3일이 경과하지 않았습니다." });
      }
      // 벤 기간이 3일 초과라면 penalty 값 0으로 초기화해주기
      else {
        await User.update(
          {
            penalty: 0,
          },
          { where: { userId } }
        );
      }

      // penalty(INT)값이 10이상이면 3일 벤처리
      if (penalty >= 10) {
        await User.update(
          {
            penaltedAt: new Date(),
          },
          {
            where: { userId },
          }
        );
        return res
          .status(401)
          .json({ msg: "3일간 게시글 등록 및 댓글 작성이 제한됩니다." });
      }

      // 게시글 도배감지 알고리즘
      let timeObject = await Post.findOne({
        logging: false,
        attributes: ["createdAt"],
        where: {
          userId,
        },
        order: [["createdAt", "DESC"]],
      });

      if (timeObject) {
        // 게시글 등록 간격시간 계산
        nowTime = new Date();
        createTime = timeObject.dataValues.createdAt;
        const difference = nowTime - createTime;

        // 60000ms = 60s = 1min
        if (difference < 60000) {
          await User.update(
            {
              penalty: penalty + 1,
            },
            {
              where: { userId },
            }
          );
          return res.status(401).json({ msg: "도배하지마세요" });
        } else {
          // 게시글 등록
          const viewCount = 0;
          const commentCount = 0;
          await Post.create({
            title,
            subTitle,
            content,
            continent,
            target,
            userId,
            userName,
            postImageUrl,
            viewCount,
            commentCount,
          });
          return res.status(200).json({ msg: "post create complete" });
        }
      } else {
        // 게시글 등록
        const viewCount = 0;
        const commentCount = 0;
        await Post.create({
          title,
          subTitle,
          content,
          continent,
          target,
          userId,
          userName,
          postImageUrl,
          viewCount,
          commentCount,
        });
        return res.status(200).json({ msg: "post create complete" });
      }
    } catch (error) {
      console.log(error);
      console.log("postPage.js --> 게시글 등록에서 에러남");

      res.status(400).json({ msg: "알 수 없는 에러 발생" });
    }
  }
);

// 게시글 조회 ##
// 게시글 검색용 라우터
router.get("/postSearch", async (req, res) => {
  var { continent, target, searchWord, pageNum } = req.query;

  if (continent == "undefined") {
    continent = undefined;
  }
  if (target == "undefined") {
    target = undefined;
  }
  if (searchWord == "undefined") {
    searchWord = undefined;
  }
  if (searchWord == "") {
    searchWord = undefined;
  }

  // 모든대륙, 모든목적으로 왔을때 || 조건을 각 if문마다 추가해줘야함
  // 필터링 기능구현 로직(검색어가 없는 경우)
  if (
    continent &&
    continent !== "모든대륙" &&
    target &&
    target !== "모든목적" &&
    !searchWord
  ) {
    condition = { continent, target };
  }

  if (
    (!continent && target && target !== "모든목적" && !searchWord) ||
    (continent == "모든대륙" && target && target !== "모든목적" && !searchWord)
  ) {
    condition = { target };
  }

  if (
    (continent && continent !== "모든대륙" && !target && !searchWord) ||
    (continent &&
      continent !== "모든대륙" &&
      target == "모든목적" &&
      !searchWord)
  ) {
    condition = { continent };
  }

  if (
    (!continent && !target && !searchWord) ||
    (!continent && target == "모든목적" && !searchWord) ||
    (continent == "모든대륙" && !target && !searchWord) ||
    (continent == "모든대륙" && target == "모든목적" && !searchWord)
  ) {
    condition = {
      viewCount: { [Op.gte]: 0 },
    };
  }

  // 필터링 기능구현 로직(검색어가 있는 경우)
  if (
    continent !== "모든대륙" &&
    target !== "모든목적" &&
    continent &&
    target &&
    searchWord
  ) {
    condition = {
      continent,
      target,
      [Op.or]: [
        {
          title: {
            [Op.like]: "%" + searchWord + "%",
          },
        },
        {
          subTitle: {
            [Op.like]: "%" + searchWord + "%",
          },
        },
        {
          content: {
            [Op.like]: "%" + searchWord + "%",
          },
        },
      ],
    };
  }
  if (continent == "모든대륙" && target && searchWord) {
    condition = {
      target,
      [Op.or]: [
        {
          title: {
            [Op.like]: "%" + searchWord + "%",
          },
        },
        {
          subTitle: {
            [Op.like]: "%" + searchWord + "%",
          },
        },
        {
          content: {
            [Op.like]: "%" + searchWord + "%",
          },
        },
      ],
    };
  }
  if (continent && target == "모든목적" && searchWord) {
    condition = {
      continent,
      [Op.or]: [
        {
          title: {
            [Op.like]: "%" + searchWord + "%",
          },
        },
        {
          subTitle: {
            [Op.like]: "%" + searchWord + "%",
          },
        },
        {
          content: {
            [Op.like]: "%" + searchWord + "%",
          },
        },
      ],
    };
  }
  if (continent == "모든대륙" && target == "모든목적" && searchWord) {
    condition = {
      [Op.or]: [
        {
          title: {
            [Op.like]: "%" + searchWord + "%",
          },
        },
        {
          subTitle: {
            [Op.like]: "%" + searchWord + "%",
          },
        },
        {
          content: {
            [Op.like]: "%" + searchWord + "%",
          },
        },
      ],
    };
  }

  try {
    // 게시글 내용 내려주기
    let postList = await Post.findAll({
      // logging: false,
      attributes: [
        "postId",
        "title",
        "content",
        "continent",
        "subTitle",
        "target",
        "userId",
        "postImageUrl",
        "viewCount",
        "commentCount",
        "createdAt",
      ],
      where: condition,
      include: [
        {
          attributes: ["userName", "userImageUrl"],
          model: User,
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: 10,
      offset: (Number(pageNum) - 1) * 10,
    });

    // 길이 뽑기
    let postLength = await Post.findAll({
      // logging: false,
      attributes: ["postId"],
      where: condition,
    });
    postLength = postLength.length;

    // 게시물이 있는 경우
    if (postList) {
      res.status(200).json({ postList, postLength });
    }
    // 게시물이 없는 경우
    else {
      res.status(404).json({ msg: "해당 게시물이 존재하지 않습니다." });
    }
  } catch (error) {
    console.log(error);
    console.log("postPage.js --> 게시글 조회에서 에러남");

    res.status(400).json({ msg: "알 수 없는 에러 발생" });
  }
});

// 게시글 전체조회용 라우터
router.get("/totalRead", async (req, res) => {
  var { continent, target, searchWord, pageNum } = req.query;

  // 필터링 기능구현 로직(검색어가 없는 경우)
  if (
    (continent == "모든대륙" && target == "모든목적" && !searchWord) ||
    (!continent && !target && !searchWord)
  ) {
    condition = {
      viewCount: { [Op.gte]: 0 },
    };
  }

  try {
    // 전체 게시글 내용 참조하기
    let postTotalList = await Post.findAll({
      logging: false,
      attributes: ["postId"],
      where: condition,
    });
    /// 전체 게시글 길이 내려주기
    const postLength = postTotalList.length;

    // 게시글 5개씩 내려주기
    let postList = await Post.findAll({
      logging: false,
      attributes: [
        "postId",
        "title",
        "content",
        "continent",
        "subTitle",
        "target",
        "userId",
        "postImageUrl",
        "viewCount",
        "commentCount",
        "createdAt",
      ],
      where: condition,
      include: [
        {
          attributes: ["userName", "userImageUrl"],
          model: User,
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: 10,
      offset: (Number(pageNum) - 1) * 10,
    });

    // 게시물이 있는 경우
    if (postList) {
      res.status(200).json({ postList, postLength });
    }
    // 게시물이 없는 경우
    else {
      res.status(404).json({ msg: "해당 게시물이 존재하지 않습니다." });
    }
  } catch (error) {
    console.log(error);
    console.log("postPage.js --> 게시글 조회에서 에러남");

    res.status(400).json({ msg: "알 수 없는 에러 발생" });
  }
});

// 게시글 세부조회 ##
router.get("/detailRead", async (req, res) => {
  const { postId } = req.query;
  const { ip } = req;

  try {
    // 조회수 불러오기
    let postInfo = await Post.findOne({
      logging: false,
      attributes: ["viewCount"],
      where: { postId },
    });
    let viewCount = postInfo.dataValues.viewCount;

    // DB에서 현재 ip와 일치하는 ip 조회하기
    let ipInfo = await Ip.findOne({
      logging: false,
      attributes: ["ip"],
      where: { ip, postId: Number(postId) },
    });

    if (ipInfo) {
      var ipDB = ipInfo.dataValues.ip;
    } else {
      await Ip.create({
        ip,
        postId: Number(postId),
      });
    }

    // 해당 게시물이 있는경우
    if (ipDB !== ip) {
      // 조회수 올리기
      await Post.update(
        {
          viewCount: viewCount + 1,
        },
        { where: { postId } }
      );
    }

    // 게시글 내용 내려주기
    postList = await Post.findOne({
      logging: false,
      attributes: [
        "postId",
        "title",
        "content",
        "continent",
        "subTitle",
        "target",
        "userId",
        "postImageUrl",
        "viewCount",
        "createdAt",
        "commentCount",
      ],
      where: { postId },
      include: [
        {
          attributes: ["userName", "userImageUrl"],
          model: User,
        },
      ],
    });

    res.status(200).json({ postList });
  } catch (error) {
    console.log(error);
    console.log("postPage.js --> 게시글 세부조회에서 에러남");

    res.status(400).json({ msg: "알 수 없는 에러 발생" });
  }
});

// 게시글 업데이트 - 원본데이터 내려주기 ##
router.get("/updateRawData", async (req, res) => {
  const { postId } = req.query;

  try {
    // postId에 해당하는 userId 찾기
    const verifyUser = await Post.findOne({
      logging: false,
      attributes: ["userId"],
      where: { postId },
    });

    // 해당 게시물이 있는 경우
    if (verifyUser) {
      const postList = await Post.findOne({
        logging: false,
        where: { postId },
        include: [
          {
            attributes: ["userName"],
            model: User,
          },
        ],
      });
      res.status(200).json({ postList });
    }
    // 해당 게시물이 없는 경우
    else {
      res.status(404).json({ msg: "해당 게시물이 존재하지 않습니다." });
    }
  } catch (error) {
    console.log(error);
    console.log(
      "postPage.js --> 게시글 업데이트-원본데이터 내려주기에서 에러남"
    );

    res.status(400).json({ msg: "알 수 없는 에러 발생" });
  }
});

// 게시글 업데이트 ##
router.post("/update", upload.single("image"), async (req, res) => {
  try {
    const { title, subTitle, content, continent, target, postId } = req.body;

    // postId에 해당하는 userId 찾기
    let verifyUser = await Post.findOne({
      logging: false,
      attributes: ["userId", "postImageUrl"],
      where: { postId },
    });

    // 이미지를 업로드 해준경우
    if (req.file) {
      var postImageUrl = req.file.location;
      const exist = verifyUser.dataValues.postImageUrl; // 현재 URL에 전달된 id값을 받아서 db찾음

      // exist가 null이 아닐 때 로직
      if (exist) {
        const url = exist.split("/"); // exist 저장된 fileUrl을 가져옴
        const delFileName = url[url.length - 1];
        if (delFileName !== "A-fo_default.jpg") {
          s3.deleteObject(
            {
              Bucket: "a-fo-bucket2",
              Key: delFileName,
            },
            (err, data) => {
              if (err) {
                throw err;
              }
            }
          );
        }
      }
      // exist가 null일때 로직
      else {
        console.log("exist가 null이지만 아무것도 안할래!!");
      }
    }

    // 이미지를 업로드 안해준경우
    else {
      var { postImageUrl } = verifyUser.dataValues;
    }

    // 해당게시물이 있는경우
    if (verifyUser) {
      await Post.update(
        {
          title,
          subTitle,
          content,
          continent,
          target,
          // userId,
          // userName,
          postImageUrl,
          createdAt: new Date(),
        },
        {
          where: {
            postId,
          },
        }
      );
      res.status(200).json({ msg: "posting update complete." });
    }
    // 해당게시물이 없는경우
    else {
      res.status(404).json({ msg: "해당 게시물이 존재하지 않습니다." });
    }
  } catch (error) {
    console.log(error);
    console.log("postPage.js --> 게시글 업데이트에서 에러남");

    res.status(400).json({ msg: "알 수 없는 에러 발생" });
  }
});

// 게시글 삭제 ##
router.delete("/delete", async (req, res) => {
  try {
    let { postId } = req.query;

    let verifyUser = await Post.findOne({
      logging: false,
      attributes: ["userId", "postImageUrl"],
      where: { postId: Number(postId) },
    });

    const exist = verifyUser.dataValues.postImageUrl; // 현재 URL에 전달된 id값을 받아서 db찾음

    if (exist) {
      const url = exist.split("/"); // exist 저장된 fileUrl을 가져옴
      const delFileName = url[url.length - 1];
      if (delFileName !== "A-fo_default.jpg") {
        s3.deleteObject(
          {
            Bucket: "a-fo-bucket2",
            Key: delFileName,
          },
          (err, data) => {
            if (err) {
              throw err;
            }
          }
        );
      }
    } else {
      console.log("이미지 없어서 패스~");
    }

    // 게시물이 있는 경우
    if (verifyUser) {
      // 카카오, 구글에서 제공한 userId와 postId로 DB에서 꺼내온 userId가 같은지 비교
      await Post.destroy({
        where: { postId },
      });
      res.status(200).json({ msg: "posting delete complete." });
    }
    // 게시물이 없는 경우
    else {
      res.status(404).json({ msg: "해당 게시물이 존재하지 않습니다." });
    }
  } catch (error) {
    console.log(error);
    console.log("postPage.js --> 게시글 삭제에서 에러남");

    res.status(400).json({ msg: "알 수 없는 에러 발생" });
  }
});

module.exports = router;
