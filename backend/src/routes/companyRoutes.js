const express = require('express');
const router = express.Router();
const CompanyController = require('../controllers/CompanyController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', CompanyController.getAllCompanies);
router.get('/stats', CompanyController.getCompanyStats);
router.post('/', CompanyController.createCompany);
router.get('/my-company', CompanyController.getMyCompany);
router.patch('/:id', CompanyController.updateCompany);
router.delete('/:id', CompanyController.deleteCompany);

module.exports = router;
