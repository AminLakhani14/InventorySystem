import { Router } from 'express';
import { createPurchaseOrder, getPurchaseOrders } from '../controllers/purchaseOrderController';
import { protect, authorize } from '../middleware/auth';
import { purchaseOrderSchema, validate } from '../middleware/validate';

const router = Router();

router.get('/', protect, authorize('super_admin', 'admin'), getPurchaseOrders);
router.post('/', protect, authorize('super_admin', 'admin'), validate(purchaseOrderSchema), createPurchaseOrder);

export default router;
