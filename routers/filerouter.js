const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

// file GET
router.get("/file/:id", async (req, res) => {});
// file POST - WIP
router.post("/file/create", upload.single("upload"), async (req, res) => {
  try {
    console.log(req.file, req.body);
  } catch (error) {
    throw error;
  }
});
// file UPDATE
router.post("/file/:id/update", async (req, res) => {});
// file DELETE
router.post("/file/:id/delete", async (req, res) => {});

module.exports = router;
