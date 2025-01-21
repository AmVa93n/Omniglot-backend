const { Schema, model } = require("mongoose");

const classSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  teacher: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: {type: String},
  timeslot: {type: String},
  language: {type: String},
  level: {type: String},
  classType: {type: String},
  maxGroupSize: {type: Number},
  locationType: {type: String},
  location: {type: String},
  duration: {type: Number},
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