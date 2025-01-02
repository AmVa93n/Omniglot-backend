const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const moment = require('moment'); // Import moment for date formatting
const fileUploader = require("../config/cloudinary.config.js");

// Require the models in order to interact with the database
const User = require("../models/User.model");
const Chat = require("../models/Chat.model");
const Message = require("../models/Message.model");
const Offer = require("../models/Offer.model");
const Class = require("../models/Class.model");
const Review = require("../models/Review.model");
const Notification = require("../models/Notification.model");
const Deck = require("../models/Deck.model");
const Flashcard = require("../models/Flashcard.model");

// Require necessary (isAuthenticated) middleware in order to control access to specific routes
const { isAuthenticated } = require("../middleware/jwt.middleware.js");

//================//
// Profile
//================//

router.get("/profile", isAuthenticated, async (req, res, next) => {
    const userId = req.payload._id
    try {
        const user = await User.findById(userId)
        res.status(200).json(user);
    } catch (error) {
        next(error);
    }
});
  
router.delete("/profile", isAuthenticated, async (req, res, next) => {
    const userId = req.payload._id
    try {
        await User.findByIdAndDelete(userId)
        res.status(200).send()
    } catch (error) {
        next(error);
    }
});
  
router.put('/profile', fileUploader.single('profilePic'), isAuthenticated, async (req, res, next) => {
    const userId = req.payload._id
    const { username, email, gender, birthdate, country, lang_teach, lang_learn, professional, private, pfp } = req.body;
    let stripeAccountId = req.body.stripeAccountId || null
    const newProfilePic = req.file ? req.file.path : pfp;
    const isPrivate = !!private
    const isProfessional = !!professional

    if (isProfessional && !stripeAccountId) {
      try {
        const stripeAccount = await stripe.accounts.create({
          country: 'US',
          email: email,
          type: 'standard',
        });
        stripeAccountId = stripeAccount.id
      } catch (error) {
        console.error("An error occurred when calling the Stripe API to create an account", error);
      }
    }
  
    try {
      const updatedUser = await User.findByIdAndUpdate(userId, { username, email, gender, birthdate, country, 
        lang_teach, lang_learn, professional: isProfessional, private: isPrivate, profilePic: newProfilePic,
        stripeAccountId }, { new: true });
      res.status(200).json(updatedUser);
    } catch (error) {
        next(error);
    }
});

//================//
// Messaging
//================//

router.get('/inbox', isAuthenticated, async (req, res, next) => {
    const userId = req.payload._id
    try {
      const chats = await Chat.find({ participants: userId }).populate('participants messages')
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
      const newChat = await Chat.create({participants: [userId, targetUserId], messages: []});
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

//================//
// Offers
//================//

router.get('/offers', isAuthenticated, async (req, res, next) => {
    const userId = req.payload._id
    try {
      const offers = await Offer.find({ creator: userId })
      res.status(200).json(offers);
    } catch (error) {
      next(error);
    }
});
  
router.post('/offers', isAuthenticated, async (req, res, next) => {
    const userId = req.payload._id
    const { name, language, level, locationType, location, weekdays, timeslots, duration, classType, maxGroupSize, price} = req.body;
    
    // Check that all fields are provided
    if ([name,language,level,locationType,classType,weekdays,timeslots,duration,price].some(field => !field)) {
      res.status(400).json({ message: "Some mandatory fields are missing. Please try again" });
      return;
    }

    try {
      const offer = await Offer.create({ creator: userId, name, language, level, locationType, location, weekdays, timeslots, 
        duration, classType, maxGroupSize, price});
      res.status(200).send(offer);
    } catch (error) {
      next(error);
    }
});

router.put('/offers/:offerId', isAuthenticated, async (req, res, next) => {
    const { name, language, level, locationType, weekdays, timeslots, duration, classType, price } = req.body;
    let { location, maxGroupSize } = req.body;
    if (!location) location = null
    if (!maxGroupSize) maxGroupSize = null
    const offerId = req.params.offerId
  
    // Check that all fields are provided
    if ([name,language,level,locationType,classType,weekdays,timeslots,duration,price].some(field => !field)) {
        res.status(400).json({message: "Some mandatory fields are missing. Please try again"});
        return;
    }
  
    try {
      const updatedOffer = await Offer.findByIdAndUpdate(offerId, {  name, language, level, locationType, location, weekdays, timeslots, 
        duration, classType, maxGroupSize, price });
      res.status(200).send(updatedOffer);
    } catch (err) {
      next(err);
    }
});
  
router.delete('/offers/:offerId', isAuthenticated, async (req, res, next) => {
    const offerId = req.params.offerId
    try {
      await Offer.findByIdAndDelete(offerId)
      res.status(200).send()
    } catch (error) {
      next(error);
    }
});

//====================//
// Clasess / Calendar
//====================//

router.get('/classes', isAuthenticated, async (req, res, next) => {
    const userId = req.payload._id
    try {
      const classes = await Class.find({ student: userId }).populate('teacher')
      const upcomingClasses = []
      const pastClasses = []
      for (let cl of classes) {
        const [year, month, day] = cl.date.split('-').map(Number);
        const inputDate = new Date(year, month - 1, day);
        const currentDate = new Date();
        if (inputDate < currentDate) pastClasses.push(cl)
        else upcomingClasses.push(cl)
      }
      res.status(200).json({upcomingClasses, pastClasses});
    } catch (error) {
      next(error);
    }
});

router.get('/calendar', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  try {
    const classes = await Class.find({ teacher: userId }).populate('student').lean()
    
    res.status(200).json(classes);
  } catch (error) {
    next(error);
  }
});

router.get('/classes/:classId', isAuthenticated, async (req, res, next) => {
    const classId = req.params.classId
    try {
      const classData = await Class.findById(classId).populate('teacher')
      res.status(200).json(classData);
    } catch (error) {
      next(error);
    }
});

router.delete('/classes/:classId', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  const classId = req.params.classId
  try {
    const classFromDB = await Class.findById(classId)
    let notifTarget, notifType
    if (classFromDB.student.toString() === userId) {
      notifTarget = classFromDB.teacher
      notifType = 'cancel-student'
    }
    if (classFromDB.teacher.toString() === userId) {
      notifTarget = classFromDB.student
      notifType = 'cancel-teacher'
    }
    
    await classFromDB.deleteOne()
    await Notification.create({ source: userId, target: notifTarget, type: notifType})
    res.status(200).send()
  } catch (error) {
    next(error);
  }
});

router.put('/classes/:classId/reschedule', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  const classId = req.params.classId
  try {
    const updatedClass = await Class.findById(classId)
    const { date, timeslot } = req.body
    updatedClass.reschedule = {new_date: date, new_timeslot: timeslot, status: 'pending', initiator: userId}
    await updatedClass.save()

    let notifTarget, notifType
    if (updatedClass.student.toString() === userId) {
      notifTarget = updatedClass.teacher
      notifType = 'reschedule-student-pending'
    }
    if (updatedClass.teacher.toString() === userId) {
      notifTarget = updatedClass.student
      notifType = 'reschedule-teacher-pending'
    }

    await Notification.create({ source: userId, target: notifTarget, type: notifType})
    res.status(200).json(updatedClass.reschedule)
  } catch (error) {
    next(error);
  }
});

router.put('/classes/:classId/reschedule/accept', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  const classId = req.params.classId
  try {
    const updatedClass = await Class.findById(classId)
    updatedClass.reschedule.status = "accepted"
    updatedClass.date = updatedClass.reschedule.new_date
    updatedClass.timeslot = updatedClass.reschedule.new_timeslot
    await updatedClass.save()
    let notifTarget, notifType
    if (updatedClass.student.toString() === userId) {
      notifTarget = updatedClass.teacher
      notifType = 'reschedule-student-accept'
    }
    if (updatedClass.teacher.toString() === userId) {
      notifTarget = updatedClass.student
      notifType = 'reschedule-teacher-accept'
    }
    
    await Notification.create({ source: userId, target: notifTarget, type: notifType})
    res.status(200).json(updatedClass)
  } catch (error) {
    next(error);
  }
});

router.put('/classes/:classId/reschedule/decline', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  const classId = req.params.classId
  try {
    const updatedClass = await Class.findById(classId)
    updatedClass.reschedule.status = "declined"
    await updatedClass.save()
    let notifTarget, notifType
    if (updatedClass.student.toString() === userId) {
      notifTarget = updatedClass.teacher
      notifType = 'reschedule-student-decline'
    }
    if (updatedClass.teacher.toString() === userId) {
      notifTarget = updatedClass.student
      notifType = 'reschedule-teacher-decline'
    }
    
    await Notification.create({ source: userId, target: notifTarget, type: notifType})
    res.status(200).json(updatedClass)
  } catch (error) {
    next(error);
  }
});

//================//
// Reviews
//================//

router.get('/reviews', isAuthenticated, async (req, res, next) => {
    const userId = req.payload._id
    try {
      const reviews = await Review.find({ subject: userId }).populate('author')
      res.status(200).json(reviews);
    } catch (error) {
      next(error);
    }
});

router.post('/reviews/:classId', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  const { rating, text } = req.body
  const classId = req.params.classId
  try {
    const updatedClass = await Class.findById(classId)
    const { teacher, date, language, level, classType, locationType } = updatedClass
    await Review.create({ author: userId, subject: teacher, rating, text, date, language, level, classType, locationType})
    updatedClass.isRated = true
    await updatedClass.save()
    await Notification.create({ source: userId, target: teacher, type: 'review'})
    res.status(200).json(updatedClass)
  } catch (error) {
    next(error);
  }
});

//================//
// Decks
//================//

router.get('/decks', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  try {
    const decks = await Deck.find({ creator: userId }).populate('cards').lean()
    for (let deck of decks) {
      deck.mastered = deck.cards.filter(card => card.priority === -10)
    }
    res.status(200).json(decks);
  } catch (error) {
    next(error);
  }
});

router.post('/decks', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  const { language, level, topic } = req.body;

  // Check that all fields are provided
  if ([language,level,topic].some(field => !field)) {
    res.status(400).json({ message: "Some mandatory fields are missing. Please try again" });
    return;
  }

  const cardsFront = []
  const cardsBack = []
  
  for (let key of Object.keys(req.body)) {
    if (!key.includes("card")) continue
    if (key.includes("front")) cardsFront.push(req.body[key])
    if (key.includes("back")) cardsBack.push(req.body[key])
  }
  const cards = []
  for (let i=0; i < cardsFront.length; i++) {
    if (!cardsFront[i] || !cardsBack[i]) continue
    cards.push({front: cardsFront[i], back: cardsBack[i]})
  }

  try {
    const cardsDB = await Flashcard.create(cards)
    const cardsIds = cardsDB.map(card => card._id)

    const deck = await Deck.create({ creator: userId, language, level, topic, cards: cardsIds });
    res.status(200).send(deck);
  } catch (error) {
    next(error);
  }
});

router.put('/decks/:deckId', isAuthenticated, async (req, res, next) => {
  const deckId = req.params.deckId
  const { language, level, topic } = req.body;

  // Check that all fields are provided
  if ([language,level,topic].some(field => !field)) {
    res.status(400).render("account/decks/edit", {user, errorMessage: "Some mandatory fields are missing. Please try again"});
    return;
  }

  const cardsFront = []
  const cardsBack = []
  const cardsPriority = []
  
  for (let key of Object.keys(req.body)) {
    if (!key.includes("card")) continue
    if (key.includes("front")) cardsFront.push(req.body[key])
    if (key.includes("back")) cardsBack.push(req.body[key])
    if (key.includes("priority")) cardsPriority.push(req.body[key])
  }
  const cards = []
  for (let i=0; i < cardsFront.length; i++) {
    if (!cardsFront[i] || !cardsBack[i]) continue
    cards.push({front: cardsFront[i], back: cardsBack[i]})
  }

  try {
    const deck = await Deck.findById(deckId)
    await Flashcard.deleteMany({ _id: { $in: deck.cards } })
    const cardsDB = await Flashcard.create(cards)
    const cardsIds = cardsDB.map(card => card._id)

    await Deck.updateOne(deck, { language, level, topic, cards: cardsIds });
    res.redirect('/account/decks')
  } catch (error) {
    next(error);
  }
});

router.delete('/decks/:deckId', isAuthenticated, async (req, res, next) => {
  const deckId = req.params.deckId
  try {
    const deck = await Deck.findById(deckId)
    await Flashcard.deleteMany({ _id: { $in: deck.cards } })
    await Deck.findByIdAndDelete(deckId)
    res.status(200).send()
  } catch (error) {
    next(error);
  }
});

router.put('/decks/:deckId/cards', isAuthenticated, async (req, res, next) => {
  const cards = req.body
  const updatedCards = []
  try {
    for (let card of cards) {
      const updatedCard = await Flashcard.findByIdAndUpdate(card._id, { priority: card.priority })
      updatedCards.push(updatedCard)
    }
    res.status(200).json(updatedCards)
  } catch (error) {
    next(error);
  }
});

router.post('/decks/:deckId/clone', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  const deckId = req.params.deckId
  try {
    const deck = await Deck.findById(deckId).populate('cards')
    const cardsData = []
    deck.cards.forEach(card => {
      cardsData.push({front: card.front, back: card.back, priority: 0})
    })
    const clonedCards = await Flashcard.create(cardsData)
    await Deck.create({ creator: userId, language: deck.language, level: deck.level, 
      topic: deck.topic + " (cloned)", cards: clonedCards })
    await Notification.create({ source: userId, target: deck.creator, type: 'clone'})
    res.status(200).send()
  } catch (error) {
    next(error);
  }
});

//================//
// Wallet
//================//

router.get('/wallet', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  try {
    const userDB = await User.findById(userId)
    const accountId = userDB.stripeAccountId

    const transactions = await stripe.balanceTransactions.list({
      stripeAccount: accountId,
      limit: 100 // Adjust the limit as needed
    });
    transactions.data.reverse()
    for (let i = 0; i < transactions.data.length; i++) {
      const trans = transactions.data[i]
      trans.amount = trans.amount / 100
      trans.currency = '€'
      trans.balance = i > 0 ? Number(transactions.data[i-1].balance) + trans.amount : trans.amount
      trans.balance = trans.balance.toFixed(2)
      trans.date = moment.unix(trans.created).format('DD-MM-YYYY HH:mm:ss') // Format the Unix timestamp
    }
    transactions.data.reverse()
    
    res.status(200).json({ transactions: transactions.data, accountId })
  } catch (error) {
    next(error);
  }
});

module.exports = router;