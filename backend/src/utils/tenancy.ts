import mongoose from 'mongoose';
import Business from '../models/Business';
import AppSetting from '../models/AppSetting';
import type { IUser } from '../models/User';

export interface TenantContext {
    businessId: string;
    businessIsLegacy: boolean;
}

export const ensureLegacyBusiness = () => Business.findOneAndUpdate(
    { slug: 'legacy-itemhive' },
    {
        $setOnInsert: {
            name: 'ItemHive Legacy Workspace',
            slug: 'legacy-itemhive',
            isActive: true,
            isLegacy: true,
        },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
).orFail();

export const ensureUserBusiness = async (user: IUser) => {
    if (user.businessId) {
        const business = await Business.findById(user.businessId);
        if (business) return business;
    }

    const legacyBusiness = await ensureLegacyBusiness();
    user.businessId = legacyBusiness._id;
    await user.save();
    return legacyBusiness;
};

export const buildTenantFilter = (tenant: TenantContext) => {
    const businessId = new mongoose.Types.ObjectId(tenant.businessId);
    return tenant.businessIsLegacy
        ? { $or: [{ businessId }, { businessId: { $exists: false } }] }
        : { businessId };
};

export const getTenantObjectId = (tenant: TenantContext) =>
    new mongoose.Types.ObjectId(tenant.businessId);

export const getAppSettingsForTenant = async (tenant: TenantContext) => {
    const tenantKey = `business:${tenant.businessId}`;
    let settings = await AppSetting.findOne({ key: tenantKey });

    if (!settings && tenant.businessIsLegacy) {
        settings = await AppSetting.findOneAndUpdate(
            { key: 'global' },
            { $set: { key: tenantKey, businessId: getTenantObjectId(tenant) } },
            { new: true }
        );
    }

    if (!settings) {
        settings = await AppSetting.findOneAndUpdate(
            { key: tenantKey },
            { $setOnInsert: { key: tenantKey, businessId: getTenantObjectId(tenant) } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).orFail();
    }

    return settings;
};
