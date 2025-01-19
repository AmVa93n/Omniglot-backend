const express = require('express');
const router = express.Router();
const Offer = require('../models/Offer.model');
const Review = require('../models/Review.model');
const User = require('../models/User.model');
const Notification = require('../models/Notification.model');
const Chat = require('../models/Chat.model');
const Message = require('../models/Message.model');
const Deck = require('../models/Deck.model');
const Flashcard = require('../models/Flashcard.model');
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
              code: lang,
              amount: await User.countDocuments({ lang_teach: lang }),
          });
          learn.push({
              code: lang,
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

router.get("/users", async (req, res, next) => {
  const { learn, teach, professional } = req.query;
  // Build the query object dynamically based on the presence of query parameters
  const query = {};
  if (learn) query.lang_learn = learn;
  if (teach) query.lang_teach = teach;
  if (professional) query.professional = professional;

  try {
      const searchResults = await User.find({...query, private: false}).lean();

      if (query.professional) {
        for (let teacher of searchResults) {
          teacher.offers = await Offer.find({ creator: teacher._id });
          const reviews = await Review.find({ subject: teacher._id });
          const avg = reviews.map(r => r.rating).reduce((acc, num) => acc + num, 0) / reviews.length;
          teacher.ratingAvg = avg.toFixed(1);
          teacher.reviewsNr = reviews.length;
        }
      }

      res.status(200).json(searchResults);
    
  } catch (error) {
    next(error);
  }
});

router.get("/users/:userId", async (req, res, next) => {
  const viewedUserId = decodeURIComponent(req.params.userId);

  try {
    // Find the user by ID and populate their offers
    const viewedUser = await User.findById(viewedUserId).lean();
    if (!viewedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Populate offers, reviews and decks for the viewed user
    viewedUser.offers = await Offer.find({ creator: viewedUserId }).lean();
    viewedUser.reviews = await Review.find({ subject: viewedUserId }).populate('author').lean();
    viewedUser.decks = await Deck.find({ creator: viewedUserId }).lean();
    for (let deck of viewedUser.decks) {
      deck.cards = await Flashcard.find({ deck: deck._id });
    }

    res.status(200).json(viewedUser);
  } catch (error) {
    next(err);
  }
});

//================//
// Notifications
//================//

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

router.put("/notification/:notificationId", isAuthenticated, async (req, res, next) => {
  const notifId = req.params.notificationId;
  try {
    await Notification.findByIdAndUpdate(notifId, { read: true });
    res.status(200).send();
  } catch (error) {
    next(err);
  }
});

router.delete("/notification/:notificationId", isAuthenticated, async (req, res, next) => {
  const notifId = req.params.notificationId;
  try {
    await Notification.findByIdAndDelete(notifId);
    res.status(200).send();
  } catch (error) {
    next(err);
  }
});

//================//
// Messaging
//================//

router.get('/inbox', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  try {
    const chats = await Chat.find({ participants: userId }).populate('participants').lean()
    for (let chat of chats) {
      chat.messages = await Message.find({ chat: chat._id }).lean()
    }
    res.status(200).json(chats);
  } catch (error) {
    next(error);
  }
});

router.post('/inbox', isAuthenticated, async (req, res, next) => {
  const { targetUserId } = req.body;
  const userId = req.payload._id
  try {
    // Check if a chat already exists
    const existingChat = await Chat.findOne({
      participants: { $all: [userId, targetUserId] }
    });
    if (existingChat) {
      res.status(200).json(existingChat);
      return
    }
    const newChat = await Chat.create({participants: [userId, targetUserId], messages: []})
    await newChat.populate('participants', 'username profilePic professional')
    res.status(200).json(newChat);
  } catch (error) {
    next(error);
  }
});

router.delete("/inbox/:chatId", isAuthenticated, async (req, res, next) => {
const userId = req.payload._id;
const chatId = req.params.chatId;
try {
  const chat = await Chat.findById(chatId)
  await Message.deleteMany({ _id: { $in: chat.messages }, sender: userId });
  res.status(200).send()
} catch (error) {
  next(error);
}
});

module.exports = router;