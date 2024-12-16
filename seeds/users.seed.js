const mongoose = require('mongoose');
const User = require('../models/User.model');
require("dotenv").config();
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ironhack-project2';

const langList = ['es','it','pt','fr','de','ru','nl','zh','hu','he','ar','kr','jp','ro','pl']

// seed database with 100 users with randomized names and languages
async function seedDatabase() {
  const fakeUsers = await getRandomUsers(100)
  const users = []

  for (let i = 0; i < 100; i++) {
    let lang_teach = getRandomSubset(langList)
    const remainingLangs = langList.filter(l => !lang_teach.includes(l))
    let lang_learn = getRandomSubset(remainingLangs)
    let day = getRandomNumber(1,28).toString().padStart(2, '0')
    let month = getRandomNumber(1,12).toString().padStart(2, '0')
    let year = getRandomNumber(1960,2005)
    let professional = randomChance(20)
    let gender = fakeUsers[i].gender
    let avatarIndex = gender == "male" ? 5 : 4
    //let profilePic = "avatar-"+gender+getRandomNumber(1,avatarIndex)+".jpg"
    let profilePic = fakeUsers[i].picture.large

    let user = {
      username: fakeUsers[i].name.first,
      email: fakeUsers[i].email,
      password: fakeUsers[i].login.password,
      gender,
      birthdate: `${year}-${month}-${day}`,
      country: fakeUsers[i].location.country,
      profilePic,
      lang_teach,
      lang_learn,
      private: randomChance(5),
      professional,
      chats: [],
      offers: []
    }

    users.push(user)
  }

  await mongoose.connect(MONGO_URI)
  await User.create(users);
  await mongoose.connection.close();
}

function getRandomSubset(arr) {
  const result = [];
  const numberOfElements = Math.floor(Math.random() * 3) + 1; // random number from 1 to 3
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

async function getRandomUsers(count) {
  try {
    const response = await fetch(`https://randomuser.me/api/?results=${count}`);
    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('Error fetching random names:', error);
  }
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

// Run the seeding script
seedDatabase();