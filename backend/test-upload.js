// test-upload.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Replace with your real values:
const supabaseUrl = 'https://hlysjlbvkblbfslzhfsb.supabase.co'; // from Supabase dashboard
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhseXNqbGJ2a2JsYmZzbHpoZnNiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY0NjcxMCwiZXhwIjoyMDY4MjIyNzEwfQ.tTEq3d7U6Ybi-JkljH4eZoVdIj2z0Qrdbx6mMhsSXeA'; 

const supabase = createClient(supabaseUrl, supabaseKey);

// Read image into a buffer
const buffer = fs.readFileSync('./test.jpg'); // must be in the same folder as this script

(async () => {
  const { data, error } = await supabase.storage
    .from('photos') // your bucket name
    .upload('test-upload/test.jpg', buffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) {
    console.error('Upload Error:', error);
  } else {
    console.log('Upload Success:', data);
  }
})();
