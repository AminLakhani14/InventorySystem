import { Router } from 'express';
import { createCustomer, deleteCustomer, getCustomers, updateCustomer } from '../controllers/customerController';
import { protect, authorize } from '../middleware/auth';
import { customerSchema, validate } from '../middleware/validate';

const router = Router();

router.get('/', protect, authorize('super_admin', 'admin', 'user'), getCustomers);
router.post('/', protect, authorize('super_admin', 'admin', 'user'), validate(customerSchema), createCustomer);
router.patch('/:id', protect, authorize('super_admin', 'admin', 'user'), validate(customerSchema), updateCustomer);
router.delete('/:id', protect, authorize('super_admin', 'admin', 'user'), deleteCustomer);

export default router;
