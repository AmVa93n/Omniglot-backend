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
// PROFILE
//================//

router.get("/profile", isAuthenticated, async (req, res, next) => {
    const userId = req.payload._id
    try {
        const user = await User.findById(userId)
        res.status(200).json(user);
    } catch (error) {
        next(err);
    }
});
  
router.delete("/profile", isAuthenticated, async (req, res, next) => {
    const userId = req.payload._id
    try {
        await User.findByIdAndDelete(userId)
        res.status(200).send()
    } catch (err) {
        next(err);
    }
});
  
router.put('/profile', fileUploader.single('pfp'), isAuthenticated, async (req, res, next) => {
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
    } catch (err) {
        next(err);
    }
});

//================//
// MESSAGING
//================//

router.get("/inbox", isAuthenticated, async (req, res) => {
    const user = req.session.currentUser
    res.render("account/inbox", {user});
});
  
router.get("/inbox/:chatId", isAuthenticated, async (req, res) => {
    const user = req.session.currentUser
    const chatId = req.params.chatId;
    res.render("account/inbox", {user, chatId});
});
  
router.post('/inbox', isAuthenticated, async (req, res) => {
    const { targetUserId } = req.body;
    const user = req.session.currentUser
    const initUser = await User.findById(user._id);
    const targetUser = await User.findById(targetUserId);
  
    // Check if a chat already exists
    const existingChat = await Chat.findOne({
      participants: { $all: [initUser._id, targetUser._id] }
    });
    if (existingChat) {
      res.redirect(`/account/inbox/${existingChat._id}`);
      return
    }
  
    const newChat = new Chat({
      participants: [user._id, targetUser._id],
      messages: []
    });
    await newChat.save();
    initUser.chats.push(newChat._id);
    targetUser.chats.push(newChat._id);
    await initUser.save();
    await targetUser.save();
    res.redirect(`/account/inbox/${newChat._id}`);
});

router.get("/inbox/:chatId/delete", isAuthenticated, async (req, res) => {
  const user = req.session.currentUser
  const chatId = req.params.chatId;
  const chat = await Chat.findById(chatId)
  await Message.deleteMany({ _id: { $in: chat.messages }, sender: user._id });
  res.redirect("/account/inbox");
});

//================//
// OFFERS
//================//

router.get('/offers', isAuthenticated, async (req, res) => {
    const user = req.session.currentUser
    const userDB = await User.findById(user._id).populate('offers')
    const offers = userDB.offers
    res.render('account/offers/offers', {user, offers})
});
  
router.get('/offers/new', isAuthenticated, async (req, res) => {
    const user = req.session.currentUser
    res.render('account/offers/create', {user})
});
  
router.post('/offers/new', isAuthenticated, async (req, res) => {
    const user = req.session.currentUser
    const userDB = await User.findById(user._id);
    const { name, language, level, locationType, location, weekdays, timeslots, 
      duration, classType, maxGroupSize, price} = req.body;
  
    // Check that all fields are provided
    if ([name,language,level,locationType,classType,weekdays,timeslots,duration,price].some(field => !field)) {
      res.status(400).render("account/offers/create", {
        errorMessage:
          "Some mandatory fields are missing. Please try again",
      });
      return;
    }
  
    const offer = await Offer.create({ name, language, level, locationType, location, weekdays, timeslots, 
      duration, classType, maxGroupSize, price});
    userDB.offers.push(offer._id);
    await userDB.save();
    res.redirect('/account/offers')
});
  
router.get('/offers/:offerId/edit', isAuthenticated, async (req, res) => {
    const user = req.session.currentUser
    const offerId = req.params.offerId
    const offer = await Offer.findById(offerId)
    res.render('account/offers/edit', {user, offer})
});

router.post('/offers/:offerId/edit', isAuthenticated, async (req, res) => {
    const { name, language, level, locationType, weekdays, timeslots, duration, classType, price } = req.body;
    let { location, maxGroupSize } = req.body;
    if (!location) location = null
    if (!maxGroupSize) maxGroupSize = null
    const offerId = req.params.offerId
  
    // Check that all fields are provided
    if ([name,language,level,locationType,classType,weekdays,timeslots,duration,price].some(field => !field)) {
        const user = req.session.currentUser
        const offer = await Offer.findById(offerId)
        res.status(400).render("account/offers/edit", {user, offer, errorMessage: "Some mandatory fields are missing. Please try again"});
        return;
    }
  
    try {
      await Offer.findByIdAndUpdate(offerId, {  name, language, level, locationType, location, weekdays, timeslots, 
        duration, classType, maxGroupSize, price });
      res.redirect('/account/offers'); // Redirect to my offers page
    } catch (err) {
      res.status(500).render('account/offers/edit', { errorMessage: 'Failed to update offer. Please try again.'});
    }
});
  
router.get('/offers/:offerId/delete', isAuthenticated, async (req, res) => {
    const offerId = req.params.offerId
    await Offer.findByIdAndDelete(offerId)
    res.redirect('/account/offers')
});

//================//
// CLASSES
//================//

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
      next(err);
    }
});

router.get('/classes/:classId', isAuthenticated, async (req, res, next) => {
    const classId = req.params.classId
    try {
      const classData = await Class.findById(classId).populate('teacher')
      res.status(200).json(classData);
    } catch (error) {
      next(err);
    }
});

router.delete('/classes/:classId', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  const classId = req.params.classId
  try {
    const classFromDB = await Class.findById(classId)
    const { teacher } = classFromDB
    await classFromDB.deleteOne()
    await Notification.create({ source: userId, target: teacher, type: 'cancel-student'})
    res.status(200).send()
  } catch (error) {
    next(err);
  }
});

router.put('/classes/:classId/reschedule', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  const classId = req.params.classId
  try {
    const classFromDB = await Class.findById(classId)
    const { date, timeslot } = req.body
    const [day, month, year] = date.split('-');
    const formattedDate = `${year}-${month}-${day}`;
    classFromDB.reschedule = {new_date: formattedDate, new_timeslot: timeslot, status: 'pending', initiator: userId}
    await classFromDB.save()
    const { teacher } = classFromDB
    await Notification.create({ source: userId, target: teacher, type: 'reschedule-student-pending'})
    res.status(200).send()
  } catch (error) {
    next(err);
  }
});

router.put('/classes/:classId/reschedule/accept', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  const classId = req.params.classId
  try {
    const classFromDB = await Class.findById(classId)
    classFromDB.reschedule.status = "accepted"
    classFromDB.date = classFromDB.reschedule.new_date
    classFromDB.timeslot = classFromDB.reschedule.new_timeslot
    await classFromDB.save()
    const { teacher } = classFromDB
    await Notification.create({ source: userId, target: teacher, type: 'reschedule-student-accept'})
    res.status(200).send()
  } catch (error) {
    next(err);
  }
});

router.put('/classes/:classId/reschedule/decline', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  const classId = req.params.classId
  try {
    const classFromDB = await Class.findById(classId)
    classFromDB.reschedule.status = "declined"
    await classFromDB.save()
    const { teacher } = classFromDB
    await Notification.create({ source: userId, target: teacher, type: 'reschedule-student-decline'})
    res.status(200).send()
  } catch (error) {
    next(err);
  }
});
  
//================//
// CALENDAR
//================//

function convertClassesToEvents(classesFromDB) {
  const events = []
    for (let classDB of classesFromDB) {
        let [year, month, day] = classDB.date.split('-').map(Number);
        let dateObj = new Date(year, month - 1, day);
        const currentDate = new Date();
        classDB.isPast = dateObj < currentDate

        const date = [dateObj.getFullYear(),
        (dateObj.getMonth() + 1).toString().padStart(2, '0'),
        dateObj.getDate().toString().padStart(2, '0')
        ].join('-');

        let [hours, minutes] = classDB.timeslot.split(':').map(Number);
        let totalMinutes = hours * 60 + minutes + Number(classDB.duration);
        let newHours = Math.floor(totalMinutes / 60) % 24;
        let newMinutes = totalMinutes % 60;
        newHours = newHours.toString().padStart(2, '0');
        newMinutes = newMinutes.toString().padStart(2, '0');
        const endTime = `${newHours}:${newMinutes}`;

        const start = `${date}T${classDB.timeslot}:00`;
        const end = `${date}T${endTime}:00`;
        classDB.endTime = endTime

        let event = {
        title: classDB.student.username,
        id: classDB._id,
        start: start,
        end: end,
        display: 'block'
        }
        events.push(event)
    }
    return events
}

router.get('/calendar', isAuthenticated, async (req, res) => {
    const user = req.session.currentUser
    const classes = await Class.find({ teacher: user._id }).populate('student').lean()
    const events = convertClassesToEvents(classes)
    res.render('account/calendar', {user, classes, events: JSON.stringify(events)})
});

router.get('/calendar/:classId', isAuthenticated, async (req, res) => {
  const user = req.session.currentUser
  const classId = req.params.classId
  const classes = await Class.find({ teacher: user._id }).populate('student').lean()
  const events = convertClassesToEvents(classes)
  const managedClass = classes.find(cl => cl._id == classId)
  res.render('account/calendar', {user, classes, events: JSON.stringify(events), managedClass})
});

router.get('/calendar/:classId/cancel', isAuthenticated, async (req, res) => {
  const user = req.session.currentUser
  const classId = req.params.classId
  const classFromDB = await Class.findById(classId)
  const { student } = classFromDB
  await Class.deleteOne({ _id: classId })
  await Notification.create({ source: user._id, target: student, type: 'cancel-teacher'})
  res.redirect('/account/calendar')
});

router.post('/calendar/:classId/reschedule', isAuthenticated, async (req, res) => {
  const user = req.session.currentUser
  const classId = req.params.classId
  const classFromDB = await Class.findById(classId)
  const { date, timeslot } = req.body
  const [day, month, year] = date.split('-');
  const formattedDate = `${year}-${month}-${day}`;
  classFromDB.reschedule = {new_date: formattedDate, new_timeslot: timeslot, status: 'pending', initiator: user._id}
  await classFromDB.save()
  const { student } = classFromDB
  await Notification.create({ source: user._id, target: student, type: 'reschedule-teacher-pending'})
  res.redirect(`/account/calendar/${classId}`)
});

router.get('/calendar/:classId/reschedule/accept', isAuthenticated, async (req, res) => {
  const user = req.session.currentUser
  const classId = req.params.classId
  const classFromDB = await Class.findById(classId)
  classFromDB.reschedule.status = "accepted"
  classFromDB.date = classFromDB.reschedule.new_date
  classFromDB.timeslot = classFromDB.reschedule.new_timeslot
  await classFromDB.save()
  const { student } = classFromDB
  await Notification.create({ source: user._id, target: student, type: 'reschedule-teacher-accept'})
  res.redirect(`/account/calendar/${classId}`)
});

router.get('/calendar/:classId/reschedule/decline', isAuthenticated, async (req, res) => {
  const user = req.session.currentUser
  const classId = req.params.classId
  const classFromDB = await Class.findById(classId)
  classFromDB.reschedule.status = "declined"
  await classFromDB.save()
  const { student } = classFromDB
  await Notification.create({ source: user._id, target: student, type: 'reschedule-teacher-decline'})
  res.redirect(`/account/calendar/${classId}`)
});

//================//
// Reviews
//================//

router.get('/reviews', isAuthenticated, async (req, res) => {
    const user = req.session.currentUser
    const reviews = await Review.find({ subject: user._id }).populate('author')
    res.render('account/reviews', {user, reviews})
});

router.post('/reviews/:classId', isAuthenticated, async (req, res) => {
  const user = req.session.currentUser
  const { rating, text } = req.body
  const classId = req.params.classId
  const classFromDB = await Class.findById(classId)
  const { teacher, date, language, level, classType, locationType } = classFromDB
  await Review.create({ author: user._id, subject: teacher, rating, text, date, language, level, classType, locationType})
  classFromDB.isRated = true
  await classFromDB.save()
  await Notification.create({ source: user._id, target: teacher, type: 'review'})
  res.redirect('/account/classes')
});

//================//
// Decks
//================//

router.get('/decks', isAuthenticated, async (req, res) => {
  const user = req.session.currentUser
  const decks = await Deck.find({ creator: user._id }).populate('cards')
  for (let deck of decks) {
    deck.mastered = deck.cards.filter(card => card.priority == -10)
  }
  res.render('account/decks/decks', {user, decks})
});

router.get('/decks/new', isAuthenticated, async (req, res) => {
  const user = req.session.currentUser
  res.render('account/decks/create', {user})
});

router.post('/decks/new', isAuthenticated, async (req, res) => {
  const user = req.session.currentUser
  const { language, level, topic } = req.body;
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

  // Check that all fields are provided
  if ([language,level,topic].some(field => !field)) {
    res.status(400).render("account/decks/create", {user, errorMessage: "Some mandatory fields are missing. Please try again"});
    return;
  }
  const cardsDB = await Flashcard.create(cards)
  const cardsIds = cardsDB.map(card => card._id)

  await Deck.create({ creator: user._id, language, level, topic, cards: cardsIds });
  res.redirect('/account/decks')
});

router.get('/decks/:deckId/edit', isAuthenticated, async (req, res) => {
  const user = req.session.currentUser
  const deckId = req.params.deckId
  const deck = await Deck.findById(deckId).populate('cards').lean()
  res.render('account/decks/edit', {user, deck, cards: deck.cards})
});

router.post('/decks/:deckId/edit', isAuthenticated, async (req, res) => {
  const user = req.session.currentUser
  const deckId = req.params.deckId
  const { language, level, topic } = req.body;
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

  // Check that all fields are provided
  if ([language,level,topic].some(field => !field)) {
    res.status(400).render("account/decks/edit", {user, errorMessage: "Some mandatory fields are missing. Please try again"});
    return;
  }
  const deck = await Deck.findById(deckId)
  await Flashcard.deleteMany({ _id: { $in: deck.cards } })
  const cardsDB = await Flashcard.create(cards)
  const cardsIds = cardsDB.map(card => card._id)

  await Deck.updateOne(deck, { creator: user._id, language, level, topic, cards: cardsIds });
  res.redirect('/account/decks')
});

router.get('/decks/:deckId/delete', isAuthenticated, async (req, res) => {
  const deckId = req.params.deckId
  const deck = await Deck.findById(deckId)
  await Flashcard.deleteMany({ _id: { $in: deck.cards } })
  await Deck.findByIdAndDelete(deckId)
  res.redirect('/account/decks')
});

router.get('/decks/:deckId/play', isAuthenticated, async (req, res) => {
  const user = req.session.currentUser
  const deckId = req.params.deckId
  const deck = await Deck.findById(deckId).populate('cards')
  res.render('account/decks/play', {user, deck})
});

router.post('/decks/:deckId/play', isAuthenticated, async (req, res) => {
  const { cards } = req.body
  for (let card of cards) {
    await Flashcard.findByIdAndUpdate(card._id, { priority: card.priority })
  }
  res.status(200).send()
});

router.get('/decks/:deckId/clone', isAuthenticated, async (req, res) => {
  const user = req.session.currentUser
  const deckId = req.params.deckId
  const deck = await Deck.findById(deckId).populate('cards')
  const cardsData = []
  deck.cards.forEach(card => {
    cardsData.push({front: card.front, back: card.back, priority: 0})
  })
  const clonedCards = await Flashcard.create(cardsData)
  await Deck.create({ creator: user._id, language: deck.language, level: deck.level, 
    topic: deck.topic + " (cloned)", cards: clonedCards })
  await Notification.create({ source: user._id, target: deck.creator, type: 'clone'})
  res.redirect('/account/decks')
});

//================//
// Wallet
//================//

router.get('/wallet', isAuthenticated, async (req, res) => {
  const user = req.session.currentUser
  const userDB = await User.findById(user._id)
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
  
  res.render('account/wallet', {user, transactions: transactions.data, accountId})
});

module.exports = router;