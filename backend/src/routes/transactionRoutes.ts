import { Router } from 'express';
import { getTransactions, createTransaction } from '../controllers/transactionController';
import { protect, authorize } from '../middleware/auth';

const router = Router();

router.get('/', protect, getTransactions);
router.post('/', protect, authorize('super_admin', 'admin', 'user'), createTransaction);

export default router;
