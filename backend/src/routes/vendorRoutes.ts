import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import { assignOpeningVendorStock, createVendor, getTodayVendorAvailability, getVendorHistory, listVendors, receiveVendorStock } from '../controllers/vendorController';

const router = Router();
router.get('/', protect, listVendors);
router.post('/', protect, authorize('super_admin', 'admin', 'user'), createVendor);
router.get('/today-availability', protect, getTodayVendorAvailability);
router.get('/:id/history', protect, authorize('super_admin', 'admin'), getVendorHistory);
router.post('/:id/receive', protect, authorize('super_admin', 'admin', 'user'), receiveVendorStock);
router.post('/:id/opening-stock', protect, authorize('super_admin', 'admin'), assignOpeningVendorStock);
export default router;
