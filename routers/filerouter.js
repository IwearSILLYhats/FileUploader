const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const { v4: uuidv4 } = require("uuid");
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

// file GET
router.get("/:id", async (req, res) => {
  const fileData = await prisma.file.findUnique({
    where: {
      id: parseInt(req.params.id),
    },
  });
  if (!fileData) {
    return res.status(404).send("File not found");
  }
  const { data, error } = await supabase.storage
    .from("upload")
    .createSignedUrl(fileData.url, 60, {
      download: true,
    });
  if (error) {
    return res.status(500).send("Error generating signed URL");
  }
  res.json({
    name: fileData.name,
    url: data.signedUrl,
  });
  return;
});
// file POST
router.post("/create", upload.single("upload"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }
    if (!req.user) {
      return res.status(401).send("Unauthorized");
    }
    const uploadName = uuidv4();
    const { data, error } = await supabase.storage
      .from("upload")
      .upload(`${uploadName}`, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    const sizeSuffix = req.file.size > 1024 * 1024 ? "MB" : "KB";
    const size =
      req.file.size > 1024 * 1024
        ? req.file.size / 1024 / 1024
        : req.file.size / 1024;
    const fileSize = size.toFixed(2) + sizeSuffix;
    const fileName = uuidv4();
    const newFile = {
      name: req.body.name,
      folderId: req.body.folderId,
      authorId: req.user.id,
      size: fileSize,
      url: data.path,
    };
    await prisma.file.create({
      data: newFile,
    });
    res.redirect(`/folder/${req.body.folderId}`);
  } catch (error) {
    throw error;
  }
});
// file UPDATE
//rename
router.post("/:id/rename", async (req, res) => {
  const fileData = await prisma.file.findUnique({
    where: {
      id: parseInt(req.params.id),
    },
  });
  if (!fileData) {
    return res.status(404).send("File not found");
  }
  if (fileData.authorId !== req.user.id) {
    return res.status(401).send("Unauthorized");
  }
  const newName = req.body.name;
  await prisma.file.update({
    where: {
      id: parseInt(req.params.id),
    },
    data: {
      name: newName,
    },
  });
  res.redirect(`/folder/${fileData.folderId}`);
});
//move
router.post("/:id/move", async (req, res) => {
  try {
    const file = await prisma.file.findUnique({
      where: {
        id: parseInt(req.params.id),
      },
    });
    let folder = null;
    if (req.body.folderList !== "") {
      folder = await prisma.folder.findUnique({
        where: {
          id: parseInt(req.body.folderList),
        },
      });
    }
    if (
      file.authorId !== req.user.id ||
      (folder !== null && folder.authorId !== req.user.id)
    ) {
      console.error("Not authorized");
      return res.status(401).send("Not Authorized");
    }
    await prisma.file.update({
      where: {
        id: parseInt(req.params.id),
      },
      data: {
        folderId: folder === null ? null : parseInt(folder.id),
      },
    });
    if (folder === null) {
      return res.redirect("/");
    }
    res.redirect(`/folder/${folder.id}`);
  } catch (error) {
    throw error;
  }
});
//share
router.post("/:id/share", async (req, res) => {
  const file = await prisma.file.findUnique({
    where: {
      id: parseInt(req.params.id),
    },
  });
  if (req.user.id !== file.authorId) {
    return res.status(401).send("Not Authorized");
  }
  await prisma.file.update({
    where: {
      id: parseInt(req.params.id),
    },
    data: {
      shared: !file.shared,
    },
  });
  res.redirect(`/folder/${file.folderId}`);
});
// file DELETE
router.post("/:id/delete", async (req, res) => {
  const file = await prisma.file.findUnique({
    where: {
      id: parseInt(req.params.id),
    },
  });
  if (file.authorId !== req.user.id) {
    res.status(401).send("Not Authorized");
  }
  const { data, error } = await supabase.storage
    .from("upload")
    .remove([file.url]);
  if (file.folderId === null) {
    res.redirect("/");
  }
  res.redirect(`/folder/${file.folderId}`);
});

module.exports = router;
