import { Router } from 'express';
import { getSalesTrend, getCategoryValuation, getTopSellingProducts } from '../controllers/reportsController';
import { protect, authorize } from '../middleware/auth';

const router = Router();

// Reports are largely for Admins
router.get('/sales-trend', protect, authorize('super_admin', 'admin'), getSalesTrend);
router.get('/category-valuation', protect, authorize('super_admin', 'admin'), getCategoryValuation);
router.get('/top-selling', protect, authorize('super_admin', 'admin'), getTopSellingProducts);

export default router;
