const express = require("express");
const router = express.Router();

// Require the models in order to interact with the database
const Offer = require("../models/Offer.model");
const Class = require("../models/Class.model");
const Notification = require("../models/Notification.model");

// Require necessary (isAuthenticated) middleware in order to control access to specific routes
const { isAuthenticated } = require("../middleware/jwt.middleware.js");

//================//
// CHECKOUT
//================//

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

router.get('/:offerId', isAuthenticated, async (req, res, next) => {
  const offerId = req.params.offerId
  try {
    const offer = await Offer.findById(offerId).populate('creator', 'username profilePic')
    offer.timeslots.sort()

    const paymentIntent = await stripe.paymentIntents.create({
      amount: offer.price * 100, // amount is in cents
      currency: 'eur',
      payment_method_types: ['card'],
    });

    res.status(200).json({offer, clientSecret: paymentIntent.client_secret});
  } catch (error) {
    next(error)
  }
});

router.post('/:offerId/', isAuthenticated, async (req, res, next) => {
  const userId = req.payload._id
  const offerId = req.params.offerId
  const { date, timeslot } = req.body

  try {
    const offer = await Offer.findById(offerId)
    const booking = await Class.create({ 
      student: userId,
      teacher: offer.creator,
      date,
      timeslot, 
      language: offer.language,
      level: offer.level,
      classType: offer.classType,
      maxGroupSize: offer.maxGroupSize,
      locationType: offer.locationType,
      location: offer.location,
      duration: offer.duration,
    })
    await Notification.create({ source: userId, target: offer.creator, type: 'booking'})
    res.status(200).json(booking);
  } catch (error) {
    next(error)
  }
});

module.exports = router;