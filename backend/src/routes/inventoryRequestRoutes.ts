import { Router } from 'express';
import { createInventoryRequest, getInventoryRequests, reviewInventoryRequest } from '../controllers/inventoryRequestController';
import { protect, authorize } from '../middleware/auth';
import { inventoryRequestDecisionSchema, productSchema, validate } from '../middleware/validate';

const router = Router();

router.get('/', protect, authorize('super_admin', 'admin', 'user'), getInventoryRequests);
router.post('/', protect, authorize('user'), validate(productSchema), createInventoryRequest);
router.patch('/:id/review', protect, authorize('super_admin', 'admin'), validate(inventoryRequestDecisionSchema), reviewInventoryRequest);

export default router;
