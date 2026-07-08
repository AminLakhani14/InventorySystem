import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import Business from '../models/Business';
import { normalizeRole } from '../utils/accessControl';
import { ensureUserBusiness, getAppSettingsForTenant } from '../utils/tenancy';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        role: string;
        email: string;
        name: string;
        isActive: boolean;
        isVisible: boolean;
        installmentAccess: boolean;
        userCreationLimit: number;
        businessId: string;
        businessName: string;
        businessIsLegacy: boolean;
    };
}

const resolveToken = (req: AuthRequest) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    return token;
};

const resolveSuperAdminWorkspace = async (req: AuthRequest, fallbackBusiness: any, role: string) => {
    if (normalizeRole(role) !== 'super_admin') {
        return fallbackBusiness;
    }

    const workspaceId = String(req.headers['x-itemhive-workspace-id'] || '').trim();
    if (!workspaceId) {
        return fallbackBusiness;
    }

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
        return fallbackBusiness;
    }

    const selectedBusiness = await Business.findById(workspaceId);
    if (!selectedBusiness || !selectedBusiness.isActive) {
        return fallbackBusiness;
    }

    return selectedBusiness;
};

const attachUserFromToken = async (req: AuthRequest) => {
    const token = resolveToken(req);

    if (!token) {
        return false;
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await User.findById(decoded.id).select('name email role isActive isVisible installmentAccess userCreationLimit businessId');

    if (!user) {
        throw new Error('Not authorized, user not found');
    }

    const normalizedRole = normalizeRole(user.role);
    const defaultBusiness = await ensureUserBusiness(user);
    const business = await resolveSuperAdminWorkspace(req, defaultBusiness, normalizedRole);
    if (!business.isActive) {
        throw new Error('Business workspace is inactive');
    }

    req.user = {
        id: String(user._id),
        role: normalizedRole,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        isVisible: user.isVisible,
        installmentAccess: normalizedRole === 'super_admin' || Boolean(user.installmentAccess),
        userCreationLimit: user.userCreationLimit ?? 0,
        businessId: String(business._id),
        businessName: business.name,
        businessIsLegacy: business.isLegacy,
    };

    return true;
};

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = resolveToken(req);

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        await attachUserFromToken(req);

        if (!req.user?.isActive) {
            return res.status(403).json({ message: 'Your account has been deactivated. Please contact the super admin.' });
        }

        next();
    } catch (error) {
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

export const optionalProtect = async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
        await attachUserFromToken(req);
    } catch {
        req.user = undefined;
    }

    next();
};

export const authorize = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: `Role ${req.user?.role} is not authorized` });
        }
        next();
    };
};

export const requireInstallmentAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role === 'super_admin') {
        next();
        return;
    }

    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const appSettings = await getAppSettingsForTenant(req.user);
    if (!appSettings?.installmentsEnabled || !req.user?.installmentAccess) {
        return res.status(403).json({ message: 'Installment access has not been enabled for this account' });
    }

    next();
};
