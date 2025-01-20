const { Schema, model } = require("mongoose");

const notificationSchema = new Schema({
  source: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  target: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: String,
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Notification = model('Notification', notificationSchema);
module.exports = Notification;