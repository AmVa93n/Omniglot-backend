const mongoose = require('mongoose');
const { Schema } = mongoose;

const deckSchema = new mongoose.Schema({
    creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cards: [{ type: Schema.Types.ObjectId, ref: 'Flashcard' }],
    language: {type: String, required: true},
    level: {type: String, required: true},
    topic: {type: String, required: true},
});

const Deck = mongoose.model('Deck', deckSchema);

module.exports = Deck;