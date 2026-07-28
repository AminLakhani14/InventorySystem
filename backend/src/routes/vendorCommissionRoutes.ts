import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import { getVendorCommissionSheet, saveVendorCommissionEntry } from '../controllers/vendorCommissionController';

const router = Router();
router.get('/', protect, authorize('super_admin', 'admin'), getVendorCommissionSheet);
router.post('/', protect, authorize('super_admin', 'admin'), saveVendorCommissionEntry);
export default router;
