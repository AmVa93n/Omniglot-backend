const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fileUploader = require("../config/cloudinary.config.js");

// Require the User model in order to interact with the database
const User = require("../models/User.model");

// Require necessary (isAuthenticated) middleware in order to control access to specific routes
const { isAuthenticated } = require("../middleware/jwt.middleware.js");

// How many rounds should bcrypt run the salt (default - 10 rounds)
const saltRounds = 10;

// POST /auth/signup  - Creates a new user in the database
router.post("/signup", fileUploader.single("profilePic"), async (req, res, next) => {
  const { email, password, username, gender, birthdate, country, lang_teach, lang_learn, professional, private } = req.body;
  const profilePic = req.file ? req.file.path : null
  const isPrivate = !!private
  const isProfessional = !!professional

  // This regular expression check that the email is of a valid format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ message: "Provide a valid email address." });
    return;
  }

  // This regular expression checks password for special characters and minimum length
  const passwordRegex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/;
  if (!passwordRegex.test(password)) {
    res.status(400).json({
      message:
        "Password must have at least 8 characters and contain at least one number, one lowercase and one uppercase letter.",
    });
    return;
  }

  // Check the users collection if a user with the same email already exists
  const foundUser = await User.findOne({ email })
    
  // If the user with the same email already exists, send an error response
  if (foundUser) {
    res.status(400).json({ message: "User already exists." });
    return;
  }

  // If email is unique, proceed to hash the password
  const salt = bcrypt.genSaltSync(saltRounds);
  const hashedPassword = bcrypt.hashSync(password, salt);

  try {
    // Create the new user in the database
    // We return a pending promise, which allows us to chain another `then`
    const createdUser = await User.create({ email, password: hashedPassword, username, gender, birthdate, country, profilePic, 
      lang_teach, lang_learn, private: isPrivate, professional: isProfessional, chats: [], offers: [] });
    
    // Create a new object that doesn't expose the password
    const user = { email, username, profilePic, _id: createdUser._id };

    // Send a json response containing the user object
    res.status(201).json({ user: user });
  } catch (err) {
    next(err); // In this case, we send error handling to the error handling middleware.
  }
});

// POST  /auth/login - Verifies email and password and returns a JWT
router.post("/login", async (req, res, next) => {
  const { email, password } = req.body;

  // Check if email or password are provided as empty string
  if (email === "" || password === "") {
    res.status(400).json({ message: "Provide email and password." });
    return;
  }

  try {
    // Check the users collection if a user with the same email exists
    const foundUser = await User.findOne({ email })
        
    if (!foundUser) {
      // If the user is not found, send an error response
      res.status(401).json({ message: "User not found." });
      return;
    }

    // Compare the provided password with the one saved in the database
    const passwordCorrect = bcrypt.compareSync(password, foundUser.password);

    if (passwordCorrect) {
      // Deconstruct the user object to omit the password
      const { _id, email, username, profilePic, professional } = foundUser;

      // Create an object that will be set as the token payload
      const payload = { _id, email, username, profilePic, professional };

      // Create a JSON Web Token and sign it
      const authToken = jwt.sign(payload, process.env.TOKEN_SECRET, {
        algorithm: "HS256",
        expiresIn: "7d",
      });

      // Send the token as the response
      res.status(200).json({ authToken: authToken });
    } else {
      res.status(401).json({ message: "Unable to authenticate the user" });
    }
  } catch (err) {
    next(err); // In this case, we send error handling to the error handling middleware.
  }
});

// GET  /auth/verify  -  Used to verify JWT stored on the client
router.get("/verify", isAuthenticated, (req, res, next) => {
  // If JWT token is valid the payload gets decoded by the
  // isAuthenticated middleware and is made available on `req.payload`
  // console.log(`req.payload`, req.payload);

  // Send back the token payload object containing the user data
  res.status(200).json(req.payload);
});

module.exports = router;