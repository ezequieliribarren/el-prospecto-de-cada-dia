const express = require('express');
const multer = require('multer');
const { handleUpload } = require('../controllers/uploadController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const router = express.Router();

router.post('/', upload.single('file'), handleUpload);

module.exports = router;

