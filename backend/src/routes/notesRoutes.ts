import { Router } from 'express';
import { protect, authorize } from '../middleware/auth';
import { createNote, deleteNote, getNotes, updateNote } from '../controllers/notesController';
import { noteCreateSchema, noteUpdateSchema, validate } from '../middleware/validate';

const router = Router();

router.get('/', protect, authorize('super_admin', 'admin', 'user'), getNotes);
router.post('/', protect, authorize('super_admin', 'admin', 'user'), validate(noteCreateSchema), createNote);
router.patch('/:id', protect, authorize('super_admin', 'admin', 'user'), validate(noteUpdateSchema), updateNote);
router.delete('/:id', protect, authorize('super_admin', 'admin', 'user'), deleteNote);

export default router;
