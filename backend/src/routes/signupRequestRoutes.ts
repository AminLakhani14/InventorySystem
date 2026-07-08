import { Router } from 'express';
import { createSignupRequest, decideSignupRequest, getSignupRequests } from '../controllers/signupRequestController';
import { protect, authorize } from '../middleware/auth';
import { signupRequestDecisionSchema, signupRequestSchema, validate } from '../middleware/validate';

const router = Router();

router.post('/', validate(signupRequestSchema), createSignupRequest);
router.get('/', protect, authorize('super_admin'), getSignupRequests);
router.patch('/:id/decision', protect, authorize('super_admin'), validate(signupRequestDecisionSchema), decideSignupRequest);

export default router;
