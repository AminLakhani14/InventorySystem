import { Router } from 'express';
import { createCreditPayment, getCreditCustomers, getCreditPayments } from '../controllers/creditController';
import { protect, authorize } from '../middleware/auth';
import { creditPaymentSchema, validate } from '../middleware/validate';

const router = Router();

router.get('/customers', protect, authorize('super_admin', 'admin', 'user'), getCreditCustomers);
router.get('/payments', protect, authorize('super_admin', 'admin', 'user'), getCreditPayments);
router.post('/payments', protect, authorize('super_admin', 'admin', 'user'), validate(creditPaymentSchema), createCreditPayment);

export default router;
