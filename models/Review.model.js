const { Schema, model } = require("mongoose");

const reviewSchema = new Schema({
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  rating: {type: Number, required: true},
  text: {type: String, required: true},
  date: {type: String, required: true},
  language: {type: String, required: true},
  level: {type: String, required: true},
  classType: {type: String, required: true},
  locationType: {type: String, required: true},
});

const Review = model('Review', reviewSchema);
module.exports = Review;