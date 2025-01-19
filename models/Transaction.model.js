const { Schema, model } = require("mongoose");

const transactionSchema = new Schema({
    teacher: { type: Schema.Types.ObjectId, ref: 'User' },
    student: { type: Schema.Types.ObjectId, ref: 'User' },
    date: { type: String },
    time: { type: String },
    offer: { type: Schema.Types.ObjectId, ref: 'Offer' },
    class: { type: Schema.Types.ObjectId, ref: 'Class' },
    amount: { type: Number },
});

const Transaction = model('Transaction', transactionSchema);
module.exports = Transaction;