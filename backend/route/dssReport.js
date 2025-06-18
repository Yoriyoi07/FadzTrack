const express = require('express');
const axios = require('axios');
const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Prompt template for the AI
function makeDssPrompt(logs) {
  return `
You are a Decision Support System AI for construction project management. Given these 7 daily construction logs, analyze and do the following:
1. Predict if the project will finish on schedule. Justify using trends/delays from the logs.
2. Identify the 3 current critical paths/tasks and explain their impact.
3. Give actionable suggestions for the project manager: Should someone be reassigned, is firing needed, is a department underperforming, etc.?
4. Be direct and clear. Base ALL conclusions only on the data below.

Here are the 7 daily logs:
${JSON.stringify(logs, null, 2)}
  `;
}

router.post('/generate-dss-report', async (req, res) => {
  const { logs } = req.body;
  if (!Array.isArray(logs) || logs.length === 0) {
    return res.status(400).json({ error: "Logs are required" });
  }
  const prompt = makeDssPrompt(logs);
  try {
    const geminiResponse = await axios.post(
      'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=' + GEMINI_API_KEY,
      {
        contents: [{ parts: [{ text: prompt }] }]
      }
    );
    const aiReply = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
    res.json({ result: aiReply });
  } catch (error) {
    console.error("Gemini AI request failed:", error.response?.data || error.message || error);
    res.status(500).json({ error: "AI request failed", details: error.response?.data || error.message || error });
  }
});


module.exports = router;
