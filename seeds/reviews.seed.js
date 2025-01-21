const mongoose = require('mongoose');
const User = require('../models/User.model');
const Review = require('../models/Review.model');
const Class = require('../models/Class.model');
const Offer = require('../models/Offer.model');
require("dotenv").config();
const MONGO_URI = process.env.MONGODB_URI

// seed database with 1-25 reviews per professional profile
async function seedDatabase() {
    await mongoose.connect(MONGO_URI)
    const teachers = await User.find({professional: true})
    const students = await User.find({professional: false})
    
    for (let teacher of teachers) {
        let reviewCount = getRandomNumber(1,25)

        for (let i = 1; i < reviewCount+1; i++) {
            const offers = await Offer.find({ creator: teacher._id });
            const offer = randomElement(offers)
            const { language, level, locationType, classType, location, maxGroupSize, duration } = offer
            const student = randomElement(students)
            // random date between 1-1-2020 and 31-12-2024
            const date = new Date(getRandomNumber(1577836800000,1735689600000)).toISOString().split('T')[0]
            const timeslot = randomElement(offer.timeslots)
            const mockClass = await Class.create({ 
              teacher, student, date, timeslot, duration, 
              language, level, locationType, classType, location, maxGroupSize
            })

            const review = {
                author: student._id,
                subject: teacher._id,
                date,
                text: generateLoremIpsum(),
                rating: getRandomNumber(1,10),
                class: mockClass._id
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