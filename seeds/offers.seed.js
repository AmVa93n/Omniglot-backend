const mongoose = require('mongoose');
const User = require('../models/User.model');
const Offer = require('../models/Offer.model');
require("dotenv").config();
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ironhack-project2';

const locTypes = ['online','at-student','at-teacher']
const classTypes = ['private','group']
const levels = ['beginner','intermediate','advanced']
const durations = [45,60,90,120,150,180]
const week = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

// seed database with 1-5 offers per professional profile
async function seedDatabase() {
    await mongoose.connect(MONGO_URI)
    const profUsers = await User.find({professional: true})
    
    for (let user of profUsers) {
        let offerCount = getRandomNumber(1,5)

        for (let i = 1; i < offerCount+1; i++) {
            let locationType = randomElement(locTypes)
            let classType = randomElement(classTypes)
            if (locationType != "online") classType = "private"
            let maxGroupSize = classType == 'group' ? getRandomNumber(2,15) : null
            let weekdays = getRandomSubset(week, 5)
            let timeslotsAmount = getRandomNumber(1,6)
            let timeslots = []
            for (let i = 0; i < timeslotsAmount; i++) {
              let hour = getRandomNumber(7, 20).toString().padStart(2, '0')
              let minute = randomElement([0,15,30,45]).toString().padStart(2, '0')
              timeslots.push(`${hour}:${minute}`)
            }

            let offer = {
                name: "my amazing offer "+i,
                language: randomElement(user.lang_teach),
                level: randomElement(levels),
                locationType,
                classType,
                maxGroupSize,
                weekdays,
                timeslots,
                duration: randomElement(durations),
                price: getRandomNumber(10,100),
            }
            let offerDB = await Offer.create(offer);
            user.offers.push(offerDB._id)
            await user.save()
        }
    }

    await mongoose.connection.close();
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