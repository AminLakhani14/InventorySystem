import { Router } from 'express';
import { getTransactions, createTransaction, deleteTransactions } from '../controllers/transactionController';
import { protect, authorize } from '../middleware/auth';

const router = Router();

router.get('/', protect, getTransactions);
router.post('/', protect, authorize('super_admin', 'admin', 'user'), createTransaction);
router.delete('/:id', protect, authorize('super_admin', 'admin'), deleteTransactions);
router.delete('/', protect, authorize('super_admin', 'admin'), deleteTransactions);

export default router;
