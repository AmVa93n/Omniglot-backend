const express = require('express');
const router = express.Router();
const Offer = require('../models/Offer.model');
const Review = require('../models/Review.model');
const User = require('../models/User.model');
const Notification = require('../models/Notification.model');
const Deck = require('../models/Deck.model');
const { formatDistanceToNow } = require('date-fns');

// Middleware to check if the user is logged in
const { isAuthenticated } = require("../middleware/jwt.middleware.js");

router.get("/langStats", async (req, res, next) => {
    const langList = ['es', 'it', 'pt', 'fr', 'de', 'ru', 'nl', 'zh', 'hu', 'he', 'ar', 'kr', 'jp', 'ro', 'pl'];
    
    const teach = []
    const learn = []

    try {
        // Collect statistics for each language
        for (const lang of langList) {
          teach.push({
              name: lang,
              amount: await User.countDocuments({ lang_teach: lang }),
          });
          learn.push({
              name: lang,
              amount: await User.countDocuments({ lang_learn: lang }),
          });
        }

        // Sort and limit the statistics to the top 10
        const top10teach = teach.sort((a, b) => b.amount - a.amount).slice(0, 10);
        const top10learn = learn.sort((a, b) => b.amount - a.amount).slice(0, 10);
        
        // Render the home page with statistics
        res.status(200).json({ teach: top10teach, learn: top10learn });
    } catch (error) {
        next(error); // In this case, we send error handling to the error handling middleware.
    }
});

// GET another user profile
router.get("/users/:userId", async (req, res, next) => {
  const viewedUserId = decodeURIComponent(req.params.userId);

  try {
    // Find the user by ID and populate their offers
    const viewedUser = await User.findById(viewedUserId).lean();
    if (!viewedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Populate offers, reviews and decks for the viewed user
    viewedUser.offers = await Offer.find({ creator: viewedUserId });
    viewedUser.reviews = await Review.find({ subject: viewedUserId }).populate('author');
    viewedUser.decks = await Deck.find({ creator: viewedUserId });

    res.status(200).json(viewedUser);
  } catch (error) {
    next(err);
  }
});

//================//
// NOTIFICATIONS
//================//

// Get existing notifications
router.get("/notifications", isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  try {
    if (userId) {
      const notifications = await Notification.find({ target: userId }).sort({ createdAt: -1 }).populate('source').lean()
      notifications.forEach(notif => {
        notif.timeDiff = formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })
      })
      
      res.status(200).json(notifications);
    }
  } catch (error) {
    next(err);
  }
});

// Mark a notification as read
router.put("/notification/:notificationId", async (req, res, next) => {
  const notifId = req.params.notificationId;
  try {
    await Notification.findByIdAndUpdate(notifId, { read: true });
    res.status(200).send();
  } catch (error) {
    next(err);
  }
});

// Delete a notification
router.delete("/notification/:notificationId", async (req, res, next) => {
  const notifId = req.params.notificationId;
  try {
    await Notification.findByIdAndDelete(notifId);
    res.status(200).send();
  } catch (error) {
    next(err);
  }
});

//================//
// FIND MATCHES
//================//

// Find users who match based on the languages they teach and learn
router.get("/match/partners", isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  const user = await User.findById(userId);
  const user_teach = user.lang_teach;
  const user_learn = user.lang_learn;

  try {
    const matches = await User.find({ lang_teach: { $in: user_learn }, lang_learn: { $in: user_teach }, private: false }).lean();
    for (let match of matches) { // Filter irrelevant languages
      match.lang_teach = match.lang_teach.filter(lang => user_learn.includes(lang));
      match.lang_learn = match.lang_learn.filter(lang => user_teach.includes(lang));
    }
    res.status(200).json(matches);
  } catch (error) {
    next(error);
  }
});

// Find teachers who match based on the languages the user wants to learn
router.get("/match/teachers", isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  const user = await User.findById(userId);
  const user_learn = user.lang_learn;

  try {
    const teachers = await User.find({ lang_teach: { $in: user_learn }, professional: true }).lean();
    for (let teacher of teachers) { // Filter irrelevant languages
      teacher.lang_teach = teacher.lang_teach.filter(lang => user_learn.includes(lang));
      teacher.offers = await Offer.find({ creator: teacher._id });
    }
    // Filter teachers with at least one offer of a language that the user wants to learn
    const matches = teachers.filter(teacher => teacher.offers.some(offer => user_learn.includes(offer.language)));
    // Calculate average review scores for each teacher
    for (let match of matches) {
      let reviews = await Review.find({ subject: match._id });
      let avg = reviews.map(r => r.rating).reduce((acc, num) => acc + num, 0) / reviews.length;
      match.ratingAvg = avg.toFixed(1);
      match.reviewsNr = reviews.length;
    }
    res.status(200).json(matches);
  } catch (error) {
    next(error);
  }
});

//==============================//
// Dynamic routes for languages
//==============================//

// Route to get teachers of a specific language
router.get("/teachers/:langId", async (req, res, next) => {
  const { langId } = req.params;

  try {
    // Find teachers for the specified language
    const teachers = await User.find({ lang_teach: langId});
    res.status(200).json(teachers);
  } catch (error) {
    next(error);
  }
});

// Route to get learners of a specific language
router.get("/learners/:langId", async (req, res, next) => {
  const { langId } = req.params;

  try {
    // Find learners for the specified language
    const learners = await User.find({ lang_learn: langId });
    res.status(200).json(learners);
  } catch (error) {
    next(error);
  }
});

module.exports = router;