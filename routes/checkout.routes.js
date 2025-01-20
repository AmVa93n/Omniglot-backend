const express = require("express");
const router = express.Router();

// Require the models in order to interact with the database
const Offer = require("../models/Offer.model");
const Class = require("../models/Class.model");
const Transaction = require("../models/Transaction.model");

// Require necessary (isAuthenticated) middleware in order to control access to specific routes
const { isAuthenticated } = require("../middleware/jwt.middleware.js");

//================//
// CHECKOUT
//================//

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

router.get('/:offerId', isAuthenticated, async (req, res, next) => {
  const offerId = req.params.offerId
  try {
    const offer = await Offer.findById(offerId).populate('creator', 'username profilePic stripeAccountId').lean()
    offer.timeslots.sort()

    const paymentIntent = await stripe.paymentIntents.create({
      amount: offer.price * 100, // amount is in cents
      currency: 'eur',
      payment_method_types: ['card'],
      metadata: {
        offerId: offerId,
        studentId: req.payload._id
      },
      receipt_email: req.payload.email,
      on_behalf_of: offer.creator.stripeAccountId,
      transfer_data: {
        destination: offer.creator.stripeAccountId,
      },
    },
  );

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

    const now = new Date(Date.now()).toISOString()

    await Transaction.create({ 
      student: userId,
      teacher: offer.creator,
      date: now.split('T')[0],
      time: now.split('T')[1].split('.')[0],
      offer: offerId,
      class: booking._id,
      amount: offer.price,
    })

    res.status(200).json(booking);
  } catch (error) {
    next(error)
  }
});

module.exports = router;