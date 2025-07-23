// route/photoSignedUrl.js
const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabaseClient'); // Your configured supabase client

router.get('/', async (req, res) => {
  const { path } = req.query;
  if (!path) return res.status(400).json({ error: 'Path required' });

  console.log('[SignedUrl] Attempting path:', path);

  const { data, error } = await supabase
    .storage
    .from('documents') // Make sure this is your bucket name!
    .createSignedUrl(path, 60 * 5);

  console.log('[SignedUrl] Supabase data:', data);
  console.log('[SignedUrl] Supabase error:', error);

  if (error || !data) {
    return res.status(500).json({ error: 'Could not generate signed URL', details: error });
  }
  return res.json({ signedUrl: data.signedUrl });
});

module.exports = router;