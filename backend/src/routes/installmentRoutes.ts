import { Router } from 'express';
import { createInstallmentPlan, getInstallmentPaymentHistory, getInstallmentPlans, payInstallment } from '../controllers/installmentController';
import { protect, authorize, requireInstallmentAccess } from '../middleware/auth';
import { installmentPaymentSchema, installmentPlanSchema, validate } from '../middleware/validate';

const router = Router();

router.get('/', protect, authorize('super_admin', 'admin', 'user'), requireInstallmentAccess, getInstallmentPlans);
router.get('/payments', protect, authorize('super_admin', 'admin', 'user'), requireInstallmentAccess, getInstallmentPaymentHistory);
router.post('/', protect, authorize('super_admin', 'admin', 'user'), requireInstallmentAccess, validate(installmentPlanSchema), createInstallmentPlan);
router.post('/:id/payments', protect, authorize('super_admin', 'admin', 'user'), requireInstallmentAccess, validate(installmentPaymentSchema), payInstallment);

export default router;
