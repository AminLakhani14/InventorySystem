import mongoose, { Model } from 'mongoose';
import Product from '../models/Product';
import Transaction from '../models/Transaction';
import InstallmentPlan from '../models/InstallmentPlan';
import CreditPayment from '../models/CreditPayment';
import InventoryRequest from '../models/InventoryRequest';
import StickyNote from '../models/StickyNote';
import User from '../models/User';
import AppSetting from '../models/AppSetting';
import Business from '../models/Business';
import { ensureLegacyBusiness } from './tenancy';

const dropLegacyIndex = async (model: Model<unknown>, indexName: string) => {
    const indexes = await model.collection.indexes().catch((error: { codeName?: string }) => {
        if (error.codeName === 'NamespaceNotFound') return [];
        throw error;
    });
    if (indexes.some((index) => index.name === indexName)) {
        await model.collection.dropIndex(indexName);
    }
};

export const ensureTenantIndexes = async () => {
    if (mongoose.connection.readyState !== 1) return;

    const legacyBusiness = await ensureLegacyBusiness();
    const missingBusiness = { $or: [{ businessId: { $exists: false } }, { businessId: null }] };
    const legacyBusinessUpdate = { $set: { businessId: legacyBusiness._id } };

    await Promise.all([
        Product.updateMany(missingBusiness, legacyBusinessUpdate),
        Transaction.updateMany(missingBusiness, legacyBusinessUpdate),
        CreditPayment.updateMany(missingBusiness, legacyBusinessUpdate),
        InstallmentPlan.updateMany(missingBusiness, legacyBusinessUpdate),
        InventoryRequest.updateMany(missingBusiness, legacyBusinessUpdate),
        StickyNote.updateMany(missingBusiness, legacyBusinessUpdate),
        User.updateMany(missingBusiness, legacyBusinessUpdate),
        AppSetting.updateMany(missingBusiness, legacyBusinessUpdate),
    ]);

    const businesses = await Business.find().select('_id name');
    await Promise.all(
        businesses.map((business) =>
            Product.updateMany(
                {
                    businessId: business._id,
                    $or: [{ businessName: { $exists: false } }, { businessName: '' }, { businessName: null }],
                },
                { $set: { businessName: business.name } }
            )
        )
    );

    await dropLegacyIndex(Product, 'id_1');
    await dropLegacyIndex(Product, 'sku_1');
    await dropLegacyIndex(Transaction, 'id_1');
    await dropLegacyIndex(InstallmentPlan, 'planCode_1');

    await Product.collection.createIndex({ businessId: 1, id: 1 }, { unique: true });
    await Product.collection.createIndex({ businessId: 1, sku: 1 }, { unique: true });
    await Transaction.collection.createIndex({ businessId: 1, id: 1 }, { unique: true });
    await InstallmentPlan.collection.createIndex({ businessId: 1, planCode: 1 }, { unique: true });
};
