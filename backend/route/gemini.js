const express = require('express');
const axios = require('axios');
const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

router.post('/analyze', async (req, res) => {
  const { prompt } = req.body;

  try {
    const geminiResponse = await axios.post(
      'https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro-latest:generateContent?key=' + GEMINI_API_KEY,
      {
        contents: [{ parts: [{ text: prompt }] }]
      }
    );
    const aiReply = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
    res.json({ result: aiReply });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "AI request failed" });
  }
});

module.exports = router;
