const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const moment = require('moment'); // Import moment for date formatting
const fileUploader = require("../config/cloudinary.config.js");

// Require the models in order to interact with the database
const User = require("../models/User.model");
const Offer = require("../models/Offer.model");
const Class = require("../models/Class.model");
const Review = require("../models/Review.model");
const Notification = require("../models/Notification.model");
const Deck = require("../models/Deck.model");
const Flashcard = require("../models/Flashcard.model");
const Transaction = require("../models/Transaction.model");

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
    const { username, email, gender, birthdate, country, lang_teach, lang_learn, professional, private } = req.body;
    const profilePic = req.file ? req.file.path : null;

    const hasStripeAccount = await User.findById(userId).then(user => user.stripeAccountId);

    if (professional && !hasStripeAccount) {
      try {
        const stripeAccount = await stripe.accounts.create({
          country: 'US',
          email: email,
          type: 'standard',
        });
        
      } catch (error) {
        console.error("An error occurred when calling the Stripe API to create an account", error);
      }
    }
  
    try {
      const updatedUser = await User.findByIdAndUpdate(userId, { username, email, gender, birthdate, country, 
        lang_teach, lang_learn, professional, private, profilePic }, { new: true });
      res.status(200).json(updatedUser);
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

    try {
      const offer = await Offer.create({ creator: userId, name, language, level, locationType, location, weekdays, timeslots, 
        duration, classType, maxGroupSize, price});
      res.status(200).send(offer);
    } catch (error) {
      next(error);
    }
});

router.put('/offers/:offerId', isAuthenticated, async (req, res, next) => {
  const { name, language, level, locationType, weekdays, timeslots, duration, classType, price, location, maxGroupSize } = req.body;
  const offerId = req.params.offerId

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
      const classes = await Class.find({ student: userId }).populate('teacher', 'username profilePic').lean()
      classes.sort((a, b) => b.date.localeCompare(a.date))
      for (let cl of classes) {
        const [year, month, day] = cl.date.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        const currentDate = new Date();
        if (date < currentDate) {
          cl.isPast = true
        }
      }
      res.status(200).json(classes);
    } catch (error) {
      next(error);
    }
});

router.get('/calendar', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  try {
    const classes = await Class.find({ teacher: userId }).populate('student', 'username profilePic').lean()
    for (let cl of classes) {
      const [year, month, day] = cl.date.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const currentDate = new Date();
      if (date < currentDate) {
        cl.isPast = true
      }
    }
    
    res.status(200).json(classes);
  } catch (error) {
    next(error);
  }
});

router.delete('/classes/:classId', isAuthenticated, async (req, res, next) => {
  const classId = req.params.classId
  try {
    await Class.findByIdAndDelete(classId)
    res.status(200).send()
  } catch (error) {
    next(error);
  }
});

router.put('/classes/:classId/reschedule', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  const classId = req.params.classId
  try {
    const updatedClass = await Class.findById(classId).populate('teacher student', 'username profilePic')
    const { date, timeslot } = req.body
    updatedClass.reschedule = {new_date: date, new_timeslot: timeslot, status: 'pending', initiator: userId}
    await updatedClass.save()

    res.status(200).json(updatedClass)
  } catch (error) {
    next(error);
  }
});

router.put('/classes/:classId/reschedule/withdraw', isAuthenticated, async (req, res, next) => {
  const classId = req.params.classId
  try {
    const updatedClass = await Class.findById(classId).populate('teacher student', 'username profilePic')
    updatedClass.reschedule = {}
    await updatedClass.save()
    
    res.status(200).json(updatedClass)
  } catch (error) {
    next(error);
  }
});

router.put('/classes/:classId/reschedule/accept', isAuthenticated, async (req, res, next) => {
  const classId = req.params.classId
  try {
    const updatedClass = await Class.findById(classId).populate('teacher student', 'username profilePic')
    updatedClass.reschedule.status = "accepted"
    updatedClass.date = updatedClass.reschedule.new_date
    updatedClass.timeslot = updatedClass.reschedule.new_timeslot
    await updatedClass.save()
    
    res.status(200).json(updatedClass)
  } catch (error) {
    next(error);
  }
});

router.put('/classes/:classId/reschedule/decline', isAuthenticated, async (req, res, next) => {
  const classId = req.params.classId
  try {
    const updatedClass = await Class.findById(classId).populate('teacher student', 'username profilePic')
    updatedClass.reschedule.status = "declined"
    await updatedClass.save()
    
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
    const decks = await Deck.find({ creator: userId }).lean()
    for (let deck of decks) {
      deck.cards = await Flashcard.find({ deck: deck._id }).lean()
    }
    res.status(200).json(decks);
  } catch (error) {
    next(error);
  }
});

router.post('/decks', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  console.log(req.body)
  const { language, level, topic } = req.body;

  try {
    const deck = await Deck.create({ creator: userId, language, level, topic });
    res.status(200).json(deck);
  } catch (error) {
    next(error);
  }
});

router.put('/decks/:deckId', isAuthenticated, async (req, res, next) => {
  const deckId = req.params.deckId
  const { language, level, topic } = req.body;

  try {
    const updatedDeck = await Deck.findByIdAndUpdate(deckId, { language, level, topic }, { new: true }).lean()
    updatedDeck.cards = await Flashcard.find({ deck: deckId }).lean()
    res.status(200).json(updatedDeck);
  } catch (error) {
    next(error);
  }
});

router.delete('/decks/:deckId', isAuthenticated, async (req, res, next) => {
  const deckId = req.params.deckId
  try {
    await Flashcard.deleteMany({ deck: deckId })
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
      const updatedCard = await Flashcard.findByIdAndUpdate(card._id, { priority: card.priority }, { new: true })
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
    const deck = await Deck.findById(deckId)
    const clonedDeck = await Deck.create({ creator: userId, language: deck.language, level: deck.level, topic: deck.topic + " (cloned)" })
    const cards = await Flashcard.find({ deck: deckId }).lean()
    const cardsData = cards.map(card => ({ front: card.front, back: card.back, priority: 0, deck: clonedDeck }))
    await Flashcard.create(cardsData)
    
    await Notification.create({ source: userId, target: deck.creator, type: 'clone'})
    res.status(200).send()
  } catch (error) {
    next(error);
  }
});

router.post('/flashcards/:deckId', isAuthenticated, async (req, res, next) => {
  const deckId = req.params.deckId
  const { front, back } = req.body
  
  try {
    const newCard = await Flashcard.create({ deck: deckId, front, back, priority: 0 })
    res.status(200).json(newCard);
  } catch (error) {
    next(error);
  }
});

router.put('/flashcards/:cardId', isAuthenticated, async (req, res, next) => {
  const cardId = req.params.cardId
  const { front, back } = req.body
  try {
    const updatedCard = await Flashcard.findByIdAndUpdate(cardId, { front, back }, { new: true })
    res.status(200).json(updatedCard);
  } catch (error) {
    next(error);
  }
});

router.delete('/flashcards/:cardId', isAuthenticated, async (req, res, next) => {
  const cardId = req.params.cardId
  try {
    await Flashcard.findByIdAndDelete(cardId)
    res.status(200).send()
  } catch (error) {
    next(error);
  }
});

//================//
// Earnings
//================//

router.get('/earnings', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  try {
    const transactions = await Transaction.find({ teacher: userId })
      .populate('student', 'username').populate('offer', 'name').lean()
    
    res.status(200).json(transactions.reverse());
  } catch (error) {
    next(error);
  }
});

module.exports = router;