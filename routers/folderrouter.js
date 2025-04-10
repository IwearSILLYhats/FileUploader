const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// folder GET
router.get("/:id", async (req, res) => {
  const [folders, files] = await Promise.all([
    prisma.folder.findMany({
      where: {
        authorId: req.user.id,
      },
    }),
    prisma.file.findMany({
      where: {
        authorId: req.user.id,
        folderId: parseInt(req.params.id),
      },
    }),
  ]);
  const currentFolder = folders.find(
    (folder) => folder.id === parseInt(req.params.id),
  );
  if (!currentFolder) {
    return res.redirect("/");
  }

  res.render("index", {
    currentFolder: currentFolder,
    folders: folders,
    files: files,
  });
});
// folder POST
router.post("/create", async (req, res) => {
  try {
    const newFolder = {
      name: req.body.name,
      authorId: req.user.id,
      parentId: parseInt(req.body.currentFolder) || null,
    };
    await prisma.folder.create({
      data: newFolder,
    });
    if (newFolder.parentId === null) {
      return res.redirect("/");
    }
    res.redirect(`/folder/${newFolder.parentId}`);
  } catch (error) {
    throw error;
  }
});

// folder UPDATE
router.post("/:id/rename", async (req, res) => {
  try {
    const folder = await prisma.folder.findUnique({
      where: {
        id: parseInt(req.params.id),
      },
    });
    if (folder.authorId !== req.user.id) {
      return res.redirect(`/folder/${req.params.id}`);
    }

    await prisma.folder.update({
      where: {
        id: parseInt(req.params.id),
      },
      data: {
        name: req.body.name,
      },
    });
    if (folder.parentId === null) {
      return res.redirect(`/`);
    }
    res.redirect(`/folder/${folder.parentId}`);
  } catch (error) {
    throw error;
  }
});
router.post("/:id/move", async (req, res) => {
  try {
    const folder = await prisma.folder.findUnique({
      where: {
        id: parseInt(req.params.id),
      },
    });
    let parentFolder = null;
    if (req.body.folderList !== "") {
      parentFolder = await prisma.folder.findUnique({
        where: {
          id: parseInt(req.body.folderList),
        },
      });
    }
    if (
      folder.authorId !== req.user.id ||
      (parentFolder !== null && parentFolder.authorId !== req.user.id)
    ) {
      return res.status(401).send("Not authorized");
    }
    if (folder.id === parseInt(req.body.folderList)) {
      return res.status(409).send("Cannot place a folder into itself");
    }

    await prisma.folder.update({
      where: {
        id: parseInt(req.params.id),
      },
      data: {
        parentId: parentFolder === null ? null : parseInt(req.body.folderList),
      },
    });
    if (parentFolder === null) {
      res.redirect("/");
    }
    res.redirect(`/folder/${req.body.folderList}`);
  } catch (error) {
    throw error;
  }
});
router.post("/:id/share", async (req, res) => {
  try {
    const folder = await prisma.folder.findUnique({
      where: {
        id: parseInt(req.params.id),
      },
    });
    if (folder.authorId !== req.user.id) {
      if (folder.parentId === null) {
        return res.redirect(`/`);
      }
      return res.redirect(`/folder/${folder.parentId}`);
    }
    Promise.all([
      await prisma.folder.update({
        where: {
          id: parseInt(req.params.id),
        },
        data: {
          shared: !folder.shared,
        },
      }),
      await prisma.file.updateMany({
        where: {
          folderId: parseInt(req.params.id),
        },
        data: {
          shared: !folder.shared,
        },
      }),
    ]);
    if (folder.parentId === null) {
      return res.redirect(`/`);
    }
    res.redirect(`/folder/${folder.parentId}`);
  } catch (error) {
    throw error;
  }
});
// folder DELETE
router.post("/:id/delete", async (req, res) => {
  try {
    const folder = await prisma.folder.findUnique({
      where: {
        id: parseInt(req.params.id),
      },
    });
    if (folder.authorId !== req.user.id) {
      if (folder.parentId === null) {
        return res.redirect(`/`);
      }
      return res.redirect(`/folder/${folder.parentId}`);
    }
    // if has children, update their parent to the next folder in line (or home/null)
    await Promise.all([
      prisma.file.updateMany({
        where: {
          folderId: folder.id,
        },
        data: {
          folderId: folder.parentId,
        },
      }),
      prisma.folder.updateMany({
        where: {
          parentId: folder.id,
        },
        data: {
          parentId: folder.parentId,
        },
      }),
    ]);

    await prisma.folder.delete({
      where: {
        id: parseInt(req.params.id),
      },
    });
    if (folder.parentId === null) {
      return res.redirect(`/`);
    }
    res.redirect(`/folder/${folder.parentId}`);
  } catch (error) {
    throw error;
  }
});

module.exports = router;
