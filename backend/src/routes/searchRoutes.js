const express = require('express');
const router = express.Router();
const SearchController = require('../controllers/SearchController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', SearchController.globalSearch);

module.exports = router;
