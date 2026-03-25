const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const ProjectMarkupFieldController = require("../controllers/ProjectMarkupFieldController");

router.use(authMiddleware);

// Get all fields for a project
router.get("/:projectId", ProjectMarkupFieldController.getFields);

// Create a new field for a project
router.post("/:projectId", ProjectMarkupFieldController.createField);

// Update a field
router.patch("/:id", ProjectMarkupFieldController.updateField);

// Delete a field
router.delete("/:id", ProjectMarkupFieldController.deleteField);

module.exports = router;
