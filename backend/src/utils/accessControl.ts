import type { IUser } from '../models/User';

export const USER_ROLES = ['super_admin', 'admin', 'user'] as const;
export type UserRole = typeof USER_ROLES[number];

const LEGACY_ROLE_MAP: Record<string, UserRole> = {
    cashier: 'user',
    user: 'user',
    admin: 'admin',
    super_admin: 'super_admin',
};

export const SUPER_ADMIN_EMAILS = ['admin@itemhive.com', 'admin@itemhive.pro'];

export const normalizeRole = (role?: string | null): UserRole => {
    if (!role) {
        return 'user';
    }

    const normalized = LEGACY_ROLE_MAP[String(role).toLowerCase()];
    return normalized || 'user';
};

export const isSuperAdminEmail = (email?: string | null) =>
    Boolean(email && SUPER_ADMIN_EMAILS.includes(String(email).trim().toLowerCase()));

export const serializeUser = (user: IUser) => ({
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
    preferences: user.preferences,
    photoUrl: user.avatar,
    isActive: user.isActive,
    isVisible: user.isVisible,
    installmentAccess: normalizeRole(user.role) === 'super_admin' || Boolean(user.installmentAccess),
    userCreationLimit: user.userCreationLimit ?? 0,
    businessId: user.businessId ? String(user.businessId) : '',
    createdBy: user.createdBy ? String(user.createdBy) : '',
    visiblePassword: user.visiblePassword || '',
});

export const canManageUsers = (role?: string | null) => {
    const normalizedRole = normalizeRole(role);
    return normalizedRole === 'super_admin' || normalizedRole === 'admin';
};
