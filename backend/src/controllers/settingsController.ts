import { Response } from 'express';
import User from '../models/User';
import type { AuthRequest } from '../middleware/auth';
import { normalizeRole } from '../utils/accessControl';
import type { IUser } from '../models/User';
import { getAppSettingsForTenant } from '../utils/tenancy';

const serializePreferences = (preferences: IUser['preferences']) => ({
    country: preferences.country,
    currency: preferences.currency,
    notifications: {
        orderUpdates: preferences.notifications.orderUpdates,
        lowStockAlerts: preferences.notifications.lowStockAlerts,
    },
});

export const getSettings = async (req: AuthRequest, res: Response) => {
    try {
        const [user, appSettings] = await Promise.all([
            User.findById(req.user?.id).select('preferences'),
            getAppSettingsForTenant(req.user!),
        ]);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.json({
            ...serializePreferences(user.preferences),
            app: {
                salesTaxRate: appSettings.salesTaxRate,
                shopName: appSettings.shopName,
                shopPhone: appSettings.shopPhone,
                shopAddress: appSettings.shopAddress,
                installmentsEnabled: appSettings.installmentsEnabled,
            },
        });
    } catch (error: any) {
        return res.status(500).json({ message: error.message || 'Failed to fetch settings' });
    }
};

export const updateSettings = async (req: AuthRequest, res: Response) => {
    try {
        const user = await User.findById(req.user?.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.preferences = {
            country: req.body.country,
            currency: req.body.currency,
            notifications: {
                orderUpdates: req.body.notifications.orderUpdates,
                lowStockAlerts: req.body.notifications.lowStockAlerts,
            },
        };

        await user.save();

        const appSettings = await getAppSettingsForTenant(req.user!);
        if (normalizeRole(req.user?.role) === 'super_admin' && req.body.app) {
            appSettings.salesTaxRate = req.body.app.salesTaxRate;
            appSettings.shopName = req.body.app.shopName;
            appSettings.shopPhone = req.body.app.shopPhone;
            appSettings.shopAddress = req.body.app.shopAddress;
            appSettings.installmentsEnabled = req.body.app.installmentsEnabled;
            await appSettings.save();
        }

        return res.json({
            ...serializePreferences(user.preferences),
            app: {
                salesTaxRate: appSettings.salesTaxRate,
                shopName: appSettings.shopName,
                shopPhone: appSettings.shopPhone,
                shopAddress: appSettings.shopAddress,
                installmentsEnabled: appSettings.installmentsEnabled,
            },
        });
    } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Failed to update settings' });
    }
};
