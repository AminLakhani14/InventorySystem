import { Router } from 'express';
import { createCreditPayment, getCreditCustomers } from '../controllers/creditController';
import { protect, authorize } from '../middleware/auth';
import { creditPaymentSchema, validate } from '../middleware/validate';

const router = Router();

router.get('/customers', protect, authorize('super_admin', 'admin', 'user'), getCreditCustomers);
router.post('/payments', protect, authorize('super_admin', 'admin', 'user'), validate(creditPaymentSchema), createCreditPayment);

export default router;
