const axios = require('axios');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const prompt = "Hello! Are you working?";

async function testGemini() {
  try {
    const res = await axios.post(
      'https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro-latest:generateContent?key=' + GEMINI_API_KEY,
      { contents: [{ parts: [{ text: prompt }] }] }
    );
    console.log(res.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
  }
}

testGemini();
