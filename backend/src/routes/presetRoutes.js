const express = require('express');
const router = express.Router();
const PresetController = require('../controllers/PresetController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', PresetController.getPresets);
router.post('/', PresetController.createPreset);
router.patch('/:id', PresetController.updatePreset);
router.delete('/:id', PresetController.deletePreset);
router.post('/:id/apply', PresetController.applyPreset);

module.exports = router;
