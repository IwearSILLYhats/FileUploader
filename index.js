const path = require("node:path");
const express = require("express");
const session = require("express-session");
const { PrismaClient } = require("@prisma/client");
const { PrismaSessionStore } = require("@quixo3/prisma-session-store");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
require("dotenv").config();
const folderRouter = require("./routers/folderrouter");
const fileRouter = require("./routers/filerouter");
const prisma = new PrismaClient();

const app = express();
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(
  session({
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, //ms
    },
    secret: process.env.secret,
    resave: false,
    saveUninitialized: false,
    store: new PrismaSessionStore(new PrismaClient(), {
      checkPeriod: 2 * 60 * 1000,
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  }),
);

app.use(passport.session());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "/public")));

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  next();
});

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
    },
    async (email, password, done) => {
      try {
        const user = await prisma.user.findUnique({
          where: {
            email: email,
          },
        });
        if (!user) {
          return done(null, false, { message: "Incorrect username" });
        }
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
          return done(null, false, { message: "Incorrect password" });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: id,
      },
    });
    done(null, user);
  } catch (err) {
    console.log(err);
    done(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(err);
});

// folder router
app.use("/folder", folderRouter);

// file router
app.use("/file", fileRouter);

app.get("/login", (req, res) => {
  res.render("loginPage", { error: req.session.messages });
});
app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureMessage: "Incorrect username or password",
  }),
);

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/signup", (req, res) => {
  res.render("signupPage");
});

app.post("/signup", async (req, res) => {
  try {
    const newUser = {
      username: req.body.username,
      email: req.body.email,
    };
    const existingUser = await prisma.user.findUnique({
      where: {
        email: newUser.email,
      },
    });
    if (existingUser) {
      return res.render("signupPage", {
        error: "An account with this email already exists",
        newUser: newUser,
      });
    }
    if (req.body.password !== req.body.confirm) {
      return res.render("signup", {
        error: "Passwords do not match",
        newUser: newUser,
      });
    }

    bcrypt.hash(req.body.password, 10, async (err, hashedPassword) => {
      newUser.password = hashedPassword;

      await prisma.user.create({
        data: newUser,
      });
    });
    res.redirect("/");
  } catch (error) {
    throw error;
  }
});

app.get("/", async (req, res) => {
  let folders = null;
  let files = null;
  if (req.user) {
    folders = await prisma.folder.findMany({
      where: {
        authorId: req.user.id,
      },
    });
    files = await prisma.file.findMany({
      where: {
        authorId: req.user.id,
        folderId: null,
      },
    });
  }
  res.render("index", { currentFolder: null, folders: folders, files: files });
});

app.listen(process.env.port, () =>
  console.log(`app listening on port ${process.env.port}`),
);
