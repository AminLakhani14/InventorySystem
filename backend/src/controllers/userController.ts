import { Response } from 'express';
import User from '../models/User';
import Business from '../models/Business';
import type { AuthRequest } from '../middleware/auth';
import { normalizeRole, serializeUser } from '../utils/accessControl';

const ensureManageableTarget = (role: string) => {
    const normalizedRole = normalizeRole(role);

    if (normalizedRole === 'super_admin') {
        throw new Error('Super admin accounts cannot be changed from this endpoint');
    }
};

const ensureDeleteAllowed = (actor: AuthRequest['user'], target: any) => {
    ensureManageableTarget(target.role);

    if (String(target._id) === actor?.id) {
        throw new Error('You cannot delete your own account');
    }

    if (normalizeRole(actor?.role) === 'super_admin') {
        return;
    }

    if (normalizeRole(actor?.role) === 'admin') {
        const isOwnUser = normalizeRole(target.role) === 'user' && String(target.createdBy || '') === actor?.id;
        if (isOwnUser) {
            return;
        }
    }

    throw new Error('You are not allowed to delete this account');
};

const serializeUsersWithBusinessNames = async (users: any[]) => {
    const businessIds = [...new Set(users.map((user) => String(user.businessId || '')).filter(Boolean))];
    const businesses = await Business.find({ _id: { $in: businessIds } }).select('name');
    const businessNameById = new Map(businesses.map((business) => [String(business._id), business.name]));

    return users.map((user) => ({
        ...serializeUser(user),
        businessName: businessNameById.get(String(user.businessId || '')) || '',
    }));
};

export const getUsers = async (req: AuthRequest, res: Response) => {
    try {
        const actorRole = normalizeRole(req.user?.role);
        const baseQuery = actorRole === 'super_admin'
            ? {}
            : { createdBy: req.user?.id, role: 'user' };
        const search = String(req.query.search || '').trim();
        const requestedPage = Number(req.query.page || 1);
        const requestedLimit = Number(req.query.limit || 20);
        const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
        const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, Math.floor(requestedLimit))) : 20;
        const paginated = Boolean(req.query.page || req.query.limit || search);
        const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const query = search
            ? {
                ...baseQuery,
                $or: [
                    { name: { $regex: escapedSearch, $options: 'i' } },
                    { email: { $regex: escapedSearch, $options: 'i' } },
                    { role: { $regex: escapedSearch, $options: 'i' } },
                ],
            }
            : baseQuery;

        const usersQuery = User.find(query)
            .select('name email role isActive isVisible installmentAccess userCreationLimit createdBy businessId preferences avatar +visiblePassword')
            .sort({ createdAt: -1 });

        if (!paginated) {
            const users = await usersQuery;
            return res.json(await serializeUsersWithBusinessNames(users));
        }

        const [users, total] = await Promise.all([
            usersQuery.skip((page - 1) * limit).limit(limit),
            User.countDocuments(query),
        ]);

        return res.json({
            users: await serializeUsersWithBusinessNames(users),
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        });
    } catch (error: any) {
        return res.status(500).json({ message: error.message || 'Failed to fetch users' });
    }
};

export const updateUserStatus = async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        ensureManageableTarget(user.role);

        if (typeof req.body.isActive === 'boolean') {
            user.isActive = req.body.isActive;
        }

        if (typeof req.body.isVisible === 'boolean') {
            user.isVisible = req.body.isVisible;
        }

        if (typeof req.body.installmentAccess === 'boolean') {
            if (!['admin', 'user'].includes(normalizeRole(user.role))) {
                return res.status(400).json({ message: 'Installment access can only be assigned to admin or user accounts' });
            }
            user.installmentAccess = req.body.installmentAccess;
        }

        await user.save();

        return res.json({
            message: 'User status updated successfully',
            user: serializeUser(user),
        });
    } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Failed to update user status' });
    }
};

export const getBusinesses = async (_req: AuthRequest, res: Response) => {
    try {
        const businesses = await Business.find({ isActive: true })
            .select('name slug isLegacy createdAt')
            .sort({ isLegacy: -1, name: 1 });

        return res.json(businesses.map((business) => ({
            id: String(business._id),
            name: business.name,
            slug: business.slug,
            isLegacy: business.isLegacy,
        })));
    } catch (error: any) {
        return res.status(500).json({ message: error.message || 'Failed to fetch businesses' });
    }
};

export const updateUserAccount = async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findById(req.params.id).select('+password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        ensureManageableTarget(user.role);

        const normalizedEmail = String(req.body.email || '').trim().toLowerCase();
        const duplicateEmail = await User.exists({ email: normalizedEmail, _id: { $ne: user._id } });
        if (duplicateEmail) {
            return res.status(400).json({ message: 'Email address is already assigned to another account' });
        }

        user.name = String(req.body.name || '').trim();
        user.email = normalizedEmail;
        if (typeof req.body.businessId === 'string') {
            const businessId = String(req.body.businessId || '').trim();
            if (businessId) {
                const business = await Business.findById(businessId);
                if (!business || !business.isActive) {
                    return res.status(400).json({ message: 'Selected business was not found or is inactive' });
                }
                user.businessId = business._id;
            }
        }
        if (req.body.role) {
            user.role = normalizeRole(req.body.role);
        }
        if (req.body.password) {
            user.password = String(req.body.password);
            user.visiblePassword = String(req.body.password);
        }
        await user.save();

        return res.json({
            message: 'Account details updated successfully',
            user: serializeUser(user),
        });
    } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Failed to update account details' });
    }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        ensureDeleteAllowed(req.user, user);

        await user.deleteOne();

        return res.json({ message: 'User deleted successfully' });
    } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Failed to delete user' });
    }
};

export const updateUserCreationLimit = async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        ensureManageableTarget(user.role);

        if (normalizeRole(user.role) !== 'admin') {
            return res.status(400).json({ message: 'User creation limits can only be assigned to admin accounts' });
        }

        user.userCreationLimit = Math.max(0, Number(req.body.userCreationLimit || 0));
        await user.save();

        return res.json({
            message: 'Admin user limit updated successfully',
            user: serializeUser(user),
        });
    } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Failed to update admin limit' });
    }
};
