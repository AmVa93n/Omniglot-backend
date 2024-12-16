const mongoose = require('mongoose');
const User = require('../models/User.model');
const Review = require('../models/Review.model');
const Offer = require('../models/Offer.model');
require("dotenv").config();
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ironhack-project2';

// seed database with 1-5 offers per professional profile
async function seedDatabase() {
    await mongoose.connect(MONGO_URI)
    const profUsers = await User.find({professional: true}).populate('offers')
    const nonProfUsers = await User.find({professional: false})
    
    for (let user of profUsers) {
        let reviewCount = getRandomNumber(1,25)

        for (let i = 1; i < reviewCount+1; i++) {
            let author = randomElement(nonProfUsers)._id
            let offer = randomElement(user.offers)
            let day = getRandomNumber(1,28).toString().padStart(2, '0')
            let month = getRandomNumber(1,12).toString().padStart(2, '0')
            let year = getRandomNumber(2020,2023)

            let review = {
                author,
                subject: user._id,
                date: `${year}-${month}-${day}`,
                text: generateLoremIpsum(),
                rating: getRandomNumber(1,10),
                language: offer.language,
                level: offer.level,
                locationType: offer.locationType,
                classType: offer.classType,
            }
            await Review.create(review);
        }
    }

    await mongoose.connection.close();
  }

  const loremIpsumText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";

  function generateLoremIpsum(paragraphs = 1) {
    return Array(paragraphs).fill(loremIpsumText).join("\n\n");
  }
  
  function randomElement(array) {
    let index = getRandomNumber(0,array.length-1)
    return array[index]
  }
  
  function randomChance(percentage) {
    return Math.random() * 100 < percentage
  }
  
  function getRandomNumber(min, max) {
    return (Math.floor(Math.random() * (max - min + 1))) + min
  }

  function getRandomSubset(arr, maxItems) {
    const result = [];
    const numberOfElements = Math.floor(Math.random() * maxItems) + 1; // random number from 1 to maxItems
    const usedIndices = new Set();
  
    while (result.length < numberOfElements) {
      const randomIndex = Math.floor(Math.random() * arr.length);
      if (!usedIndices.has(randomIndex)) {
        result.push(arr[randomIndex]);
        usedIndices.add(randomIndex);
      }
    }
  
    return result;
  }
  
  // Run the seeding script
  seedDatabase();