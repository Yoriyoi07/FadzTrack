const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPA_BUCKET = 'material-request-photos';
const supaAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function guessMime(filename = '') {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (['jpg','jpeg'].includes(ext)) return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'bmp') return 'image/bmp';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  return 'application/octet-stream';
}

// POST /uploads/material-requests
router.post('/material-requests', upload.array('files', 10), async (req, res) => {
  try {
    const userId = String(req.user?.id || req.body?.userId || 'anon');
    if (!req.files?.length) return res.status(400).json({ message: 'No files.' });

    const results = [];
    for (const f of req.files) {
      const ext = (f.originalname.split('.').pop() || 'jpg').toLowerCase();
      const safeName = `${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
      const path = `material-requests/${userId}/${safeName}`;
      const contentType = f.mimetype || guessMime(f.originalname);
      const { error } = await supaAdmin.storage.from(SUPA_BUCKET).upload(path, f.buffer, { contentType, upsert:false });
      if (error) throw error;
      const { data: pub } = supaAdmin.storage.from(SUPA_BUCKET).getPublicUrl(path);
      if (pub?.publicUrl) results.push(pub.publicUrl); else {
        const { data: signed, error: signErr } = await supaAdmin.storage.from(SUPA_BUCKET).createSignedUrl(path, 60*60*24*365*5);
        if (signErr) throw signErr;
        results.push(signed.signedUrl);
      }
    }
    res.json({ ok:true, urls:results });
  } catch(e){
    console.error('upload error:', e);
    res.status(500).json({ message:e.message || 'Upload failed' });
  }
});

module.exports = router;
