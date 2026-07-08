import { Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import type { AuthRequest } from '../middleware/auth';
import { isSuperAdminEmail, normalizeRole, serializeUser } from '../utils/accessControl';
import Business from '../models/Business';
import { ensureLegacyBusiness } from '../utils/tenancy';

const signToken = (id: string, role: string) => jwt.sign(
    { id, role: normalizeRole(role) },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: (process.env.JWT_EXPIRATION as any) || '7d' }
);

export const register = async (req: AuthRequest, res: Response) => {
    try {
        const { name, email, password, role, businessName, businessId: requestedBusinessId } = req.body;
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const requestedRole = normalizeRole(role);

        const [existingUser, totalUsers, currentUser] = await Promise.all([
            User.findOne({ email: normalizedEmail }),
            User.countDocuments(),
            req.user?.id ? User.findById(req.user.id).select('role userCreationLimit isActive businessId') : null,
        ]);

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const superAdminExists = await User.exists({ role: 'super_admin' });
        const bootstrapSuperAdmin = totalUsers === 0 || (!superAdminExists && isSuperAdminEmail(normalizedEmail));

        if (!req.user && !bootstrapSuperAdmin) {
            return res.status(403).json({ message: 'Only admins and super admins can create new accounts' });
        }

        if (req.user && !currentUser?.isActive) {
            return res.status(403).json({ message: 'Your account is not active' });
        }

        let assignedRole = requestedRole;
        let createdBy = null;
        let businessId = currentUser?.businessId || null;

        if (bootstrapSuperAdmin || isSuperAdminEmail(normalizedEmail)) {
            assignedRole = 'super_admin';
            businessId = (await ensureLegacyBusiness())._id;
        } else if (req.user) {
            const actorRole = normalizeRole(req.user.role);
            createdBy = req.user.id;

            if (actorRole === 'admin') {
                if (requestedRole !== 'user') {
                    return res.status(403).json({ message: 'Admins can only create user accounts' });
                }

                const createdUsersCount = await User.countDocuments({ createdBy: req.user.id, role: 'user' });
                if (createdUsersCount >= Number(currentUser?.userCreationLimit || 0)) {
                    return res.status(403).json({ message: 'This admin has reached the assigned user creation limit' });
                }

                assignedRole = 'user';
            }

            if (actorRole === 'super_admin' && requestedBusinessId) {
                const business = await Business.findById(requestedBusinessId);
                if (!business || !business.isActive) {
                    return res.status(400).json({ message: 'Selected business was not found or is inactive' });
                }
                businessId = business._id;
            } else if (actorRole === 'super_admin' && assignedRole === 'admin') {
                const business = await Business.create({
                    name: String(businessName || `${name}'s Store`).trim(),
                    slug: `store-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    createdBy: req.user.id,
                });
                businessId = business._id;
            }
        }

        const user = new User({ name, email: normalizedEmail, password, visiblePassword: password, role: assignedRole, createdBy, businessId });
        await user.save();

        const token = signToken(String(user._id), user.role);

        res.status(201).json({
            token,
            user: serializeUser(user),
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const login = async (req: AuthRequest, res: Response) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = String(email || '').trim().toLowerCase();

        const user = await User.findOne({ email: normalizedEmail }).select('+password');
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const normalizedRole = isSuperAdminEmail(user.email) ? 'super_admin' : normalizeRole(user.role);
        const shouldSaveRole = user.role !== normalizedRole;

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (shouldSaveRole) {
            user.role = normalizedRole;
            await user.save();
        }

        if (!user.isActive) {
            return res.status(403).json({ message: 'Your account has been deactivated. Please contact the super admin.' });
        }

        const token = signToken(String(user._id), normalizedRole);

        res.json({
            token,
            user: serializeUser(user),
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
