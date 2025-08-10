// route/photoSignedUrl.js
const express = require('express');
const router = express.Router();
const supabase = require('../utils/supabaseClient');

// Single
router.get('/', async (req, res) => {
  const { path } = req.query;
  if (!path) return res.status(400).json({ error: 'Path required' });
  try {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 60 * 10);
    if (error || !data) return res.status(500).json({ error: 'Could not generate signed URL', details: error });
    return res.json({ signedUrl: data.signedUrl });
  } catch (e) {
    return res.status(500).json({ error: 'Signed URL failed' });
  }
});

// Batch
router.post('/batch', async (req, res) => {
  const { paths } = req.body;
  if (!Array.isArray(paths) || paths.length === 0) {
    return res.status(400).json({ error: 'paths[] required' });
  }
  try {
    const promises = paths.map(async (p) => {
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(p, 60 * 10);
      return error || !data ? null : data.signedUrl;
    });
    const urls = await Promise.all(promises);
    res.json({ urls });
  } catch (e) {
    res.status(500).json({ error: 'Batch signed URLs failed' });
  }
});

module.exports = router;
