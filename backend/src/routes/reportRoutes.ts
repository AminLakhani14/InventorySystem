import { Router } from 'express';
import { getSalesTrend, getCategoryValuation, getTopSellingProducts, getCustomerPaymentsReport, getCustomerPaymentDetails, getCollectionsDashboard } from '../controllers/reportsController';
import { protect, authorize } from '../middleware/auth';

const router = Router();

// Reports are largely for Admins
router.get('/sales-trend', protect, authorize('super_admin', 'admin'), getSalesTrend);
router.get('/category-valuation', protect, authorize('super_admin', 'admin'), getCategoryValuation);
router.get('/top-selling', protect, authorize('super_admin', 'admin'), getTopSellingProducts);
router.get('/customer-payments', protect, authorize('super_admin', 'admin'), getCustomerPaymentsReport);
router.get('/customer-payments/details', protect, authorize('super_admin', 'admin'), getCustomerPaymentDetails);
router.get('/collections-dashboard', protect, authorize('super_admin', 'admin'), getCollectionsDashboard);

export default router;
