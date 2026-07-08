import { Router } from 'express';
import { deleteUser, getBusinesses, getUsers, updateUserStatus, updateUserCreationLimit, updateUserAccount } from '../controllers/userController';
import { protect, authorize } from '../middleware/auth';
import { updateAdminLimitSchema, updateUserAccountSchema, updateUserStatusSchema, validate } from '../middleware/validate';

const router = Router();

router.get('/', protect, authorize('super_admin', 'admin'), getUsers);
router.get('/businesses', protect, authorize('super_admin'), getBusinesses);
router.patch('/:id/account', protect, authorize('super_admin'), validate(updateUserAccountSchema), updateUserAccount);
router.patch('/:id/status', protect, authorize('super_admin'), validate(updateUserStatusSchema), updateUserStatus);
router.patch('/:id/limit', protect, authorize('super_admin'), validate(updateAdminLimitSchema), updateUserCreationLimit);
router.delete('/:id', protect, authorize('super_admin', 'admin'), deleteUser);

export default router;
