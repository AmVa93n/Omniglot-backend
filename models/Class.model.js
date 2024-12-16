const { Schema, model } = require("mongoose");

const classSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  teacher: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: {type: String, required: true},
  timeslot: {type: String, required: true},
  language: {type: String, required: true},
  level: {type: String, required: true},
  classType: {type: String, required: true},
  maxGroupSize: {type: Number},
  locationType: {type: String, required: true},
  location: {type: String},
  duration: {type: Number, required: true},
  isRated: {type: Boolean, default: false},
  reschedule: {
    new_date: {type: String},
    new_timeslot: {type: String},
    status: {type: String},
    initiator: {type: String},
  }
});

const Class = model('Class', classSchema);
module.exports = Class;