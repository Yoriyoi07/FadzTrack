const multer = require('multer');

const storage = multer.memoryStorage(); // <-- This is key!
const upload = multer({ storage });

module.exports = upload;
