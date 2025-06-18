const axios = require('axios');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function listModels() {
  try {
    const res = await axios.get(
      'https://generativelanguage.googleapis.com/v1/models?key=' + GEMINI_API_KEY
    );
    console.log(res.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
  }
}
listModels();
