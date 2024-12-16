const mongoose = require('mongoose');
const { Schema } = mongoose;

const chatSchema = new mongoose.Schema({
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    messages: [{ type: Schema.Types.ObjectId, ref: 'Message' }],
    lastMessageTimestamp: { type: Date, default: null }
});
  
const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;