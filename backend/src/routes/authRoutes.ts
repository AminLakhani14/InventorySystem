import { Router } from 'express';
import { login, register } from '../controllers/authController';
import { validate, loginSchema, registerSchema } from '../middleware/validate';
import { optionalProtect } from '../middleware/auth';

const router = Router();

router.post('/login', validate(loginSchema), login);
router.post('/register', optionalProtect, validate(registerSchema), register);

export default router;
