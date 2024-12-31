const express = require("express");
const router = express.Router();

// Require the models in order to interact with the database
const User = require("../models/User.model");
const Offer = require("../models/Offer.model");
const Class = require("../models/Class.model");
const Notification = require("../models/Notification.model");

// Require necessary (isAuthenticated) middleware in order to control access to specific routes
const { isAuthenticated } = require("../middleware/jwt.middleware.js");

//================//
// CHECKOUT
//================//

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const stripePublicKey = process.env.STRIPE_PUBLIC_KEY;
const domain = process.env.LOCAL || `https://omniglot-znxc.onrender.com`

router.get('/offers/:offerId', isAuthenticated, async (req, res, next) => {
  const offerId = req.params.offerId
  try {
    const offer = await Offer.findById(offerId)
    const teacher = await User.findOne({ offers: offerId })
    offer.timeslots.sort()
    res.status(200).json({ stripePublicKey: process.env.STRIPE_PUBLIC_KEY, offer, teacher });
  } catch (error) {
    next(error)
  }
});

router.post('/offers/:offerId/book', isAuthenticated, async (req, res) => {
  try {
    const offerId = req.params.offerId
    const offer = await Offer.findById(offerId)
    const teacher = await User.findOne({ offers: offerId })
    const accountId = teacher.stripeAccountId
    console.log(accountId)
    const user = req.session.currentUser
    const { date, timeslot } = req.body
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      customer_email: user.email,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: offer.name,
            },
            unit_amount: offer.price * 100,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      return_url: `${domain}/offers/${offerId}/return?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        date,
        timeslot,
      },
      payment_intent_data: {
        transfer_data: {
            destination: accountId,  // Use the test connected account ID
        },
      },
    });
    res.send({clientSecret: session.client_secret});
  } catch (error) {
    console.error('Error creating Stripe Checkout session:', error);
    res.status(500).send({ error: 'Failed to create Stripe Checkout session' });
  }
});

router.get('/offers/:offerId/return', isAuthenticated, async (req, res) => {
  const user = req.session.currentUser
  const offerId = req.params.offerId
  const offer = await Offer.findById(offerId)
  res.render('checkout/return', { offer, user });
});

router.get('/offers/:offerId/session-status', isAuthenticated, async (req, res) => {
  const session = await stripe.checkout.sessions.retrieve(req.query.session_id);
  res.send({
    status: session.status,
    customer_email: session.customer_details.email
  });
});

router.post('/offers/:offerId/return', isAuthenticated, async (req, res) => {
  const { sessionId } = req.body;
  // Retrieve the session to get more details if needed
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const { date, timeslot } = session.metadata;

  const [day, month, year] = date.split('-');
  const formattedDate = `${year}-${month}-${day}`;

  if (session.payment_status === 'paid') {
    const user = req.session.currentUser
    const offerId = req.params.offerId
    const offer = await Offer.findById(offerId)
    const teacher = await User.findOne({ offers: offerId })
    await Class.create({ 
      student: user,
      teacher: teacher._id,
      date: formattedDate,
      timeslot, 
      language: offer.language,
      level: offer.level,
      classType: offer.classType,
      maxGroupSize: offer.maxGroupSize,
      locationType: offer.locationType,
      location: offer.location,
      duration: offer.duration,
    })
    await Notification.create({ source: user._id, target: teacher._id, type: 'booking'})
    res.status(200).send();
  } else {
    res.render('checkout/return', { errorMessage: 'Payment not successful.' });
  }
});

module.exports = router;