import { Router } from 'express';
import { createPurchaseOrder, deletePurchaseOrder, getPurchaseOrders, updatePurchaseOrder } from '../controllers/purchaseOrderController';
import { protect, authorize } from '../middleware/auth';
import { purchaseOrderSchema, validate } from '../middleware/validate';

const router = Router();

router.get('/', protect, authorize('super_admin', 'admin'), getPurchaseOrders);
router.post('/', protect, authorize('super_admin', 'admin'), validate(purchaseOrderSchema), createPurchaseOrder);
router.put('/:id', protect, authorize('super_admin', 'admin'), validate(purchaseOrderSchema), updatePurchaseOrder);
router.delete('/:id', protect, authorize('super_admin', 'admin'), deletePurchaseOrder);

export default router;
