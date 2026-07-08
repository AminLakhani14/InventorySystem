import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController';
import { protect, authorize } from '../middleware/auth';
import { settingsSchema, validate } from '../middleware/validate';

const router = Router();

router.get('/', protect, authorize('super_admin', 'admin', 'user'), getSettings);
router.put('/', protect, authorize('super_admin', 'admin', 'user'), validate(settingsSchema), updateSettings);

export default router;
