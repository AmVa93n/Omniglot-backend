const mongoose = require('mongoose');
const { Schema } = mongoose;

const flashcardSchema = new mongoose.Schema({
    deck: {type: Schema.Types.ObjectId, ref: 'Deck', required: true},
    front: {type: String, required: true},
    back: {type: String, required: true},
    priority: {type: Number, default: 0},
});

const Flashcard = mongoose.model('Flashcard', flashcardSchema);

module.exports = Flashcard;