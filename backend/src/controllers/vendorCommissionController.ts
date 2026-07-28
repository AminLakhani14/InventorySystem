import { Response } from 'express';
import mongoose from 'mongoose';
import type { AuthRequest } from '../middleware/auth';
import Vendor from '../models/Vendor';
import VendorStock from '../models/VendorStock';
import VendorCommission from '../models/VendorCommission';
import PurchaseOrder from '../models/PurchaseOrder';
import Product from '../models/Product';
import Transaction from '../models/Transaction';
import { buildTenantFilter, getTenantObjectId } from '../utils/tenancy';

const toSheetDate = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// The sheet key is a plain YYYY-MM-DD, so the day window is resolved in server-local time
// exactly like the reports screens do.
const resolveSheetDay = (value: unknown) => {
    const raw = String(value || '').trim();
    const parsed = raw ? new Date(`${raw}T00:00:00`) : new Date();
    if (Number.isNaN(parsed.getTime())) throw new Error('Invalid date');
    const start = new Date(parsed);
    start.setHours(0, 0, 0, 0);
    const end = new Date(parsed);
    end.setHours(23, 59, 59, 999);
    return { sheetDate: toSheetDate(start), start, end };
};

interface SheetRow {
    vendorId: string;
    vendorName: string;
    vendorPhone: string;
    productId: string;
    productName: string;
    broughtQuantity: number;
    soldQuantity: number;
    salesValue: number;
    availableQuantity: number;
    totalAmount: number;
    commission: number;
    note: string;
    updatedByName: string;
    isSaved: boolean;
}

const rowKey = (vendorId: string, productId: string) => `${vendorId}::${productId}`;

export const getVendorCommissionSheet = async (req: AuthRequest, res: Response) => {
    try {
        const tenant = buildTenantFilter(req.user!);
        const { sheetDate, start, end } = resolveSheetDay(req.query.date);
        const dayRange = { $gte: start, $lte: end };

        const [orders, sales, saved, vendors, stocks] = await Promise.all([
            PurchaseOrder.find({ ...tenant, vendorId: { $ne: null }, createdAt: dayRange }).lean(),
            Transaction.find({ ...tenant, type: 'reduction', vendorId: { $ne: null }, timestamp: dayRange }).lean(),
            VendorCommission.find({ ...tenant, sheetDate }).lean(),
            Vendor.find(tenant).select('name phoneNumber').lean(),
            VendorStock.find(tenant).lean(),
        ]);

        const vendorsById = new Map(vendors.map((vendor) => [vendor._id.toString(), vendor]));
        const rows = new Map<string, SheetRow>();

        const ensureRow = (vendorId: string, productId: string, productName: string) => {
            const key = rowKey(vendorId, productId);
            const existing = rows.get(key);
            if (existing) return existing;
            const vendor = vendorsById.get(vendorId);
            const row: SheetRow = {
                vendorId,
                vendorName: vendor?.name || 'Unknown vendor',
                vendorPhone: vendor?.phoneNumber || '',
                productId,
                productName,
                broughtQuantity: 0,
                soldQuantity: 0,
                salesValue: 0,
                availableQuantity: 0,
                totalAmount: 0,
                commission: 0,
                note: '',
                updatedByName: '',
                isSaved: false,
            };
            rows.set(key, row);
            return row;
        };

        orders.forEach((order) => {
            const vendorId = order.vendorId?.toString();
            if (!vendorId || !vendorsById.has(vendorId)) return;
            order.items.forEach((item) => {
                ensureRow(vendorId, item.productId, item.productName).broughtQuantity += Number(item.quantity) || 0;
            });
        });

        sales.forEach((sale) => {
            const vendorId = sale.vendorId?.toString();
            if (!vendorId || !vendorsById.has(vendorId)) return;
            const row = ensureRow(vendorId, sale.productId, sale.productName);
            row.soldQuantity += Number(sale.amount) || 0;
            row.salesValue += Number(sale.totalPrice) || 0;
        });

        // A saved commission must survive even if the underlying order was later edited away,
        // otherwise the amount the user typed silently disappears from the sheet.
        saved.forEach((entry) => {
            const vendorId = entry.vendorId.toString();
            if (!vendorsById.has(vendorId)) return;
            const row = ensureRow(vendorId, entry.productId, entry.productId);
            row.totalAmount = Number(entry.totalAmount) || 0;
            row.commission = Number(entry.commission) || 0;
            row.note = entry.note || '';
            row.updatedByName = entry.updatedByName || '';
            row.isSaved = true;
        });

        stocks.forEach((stock) => {
            const row = rows.get(rowKey(stock.vendorId.toString(), stock.productId));
            if (row) {
                row.availableQuantity = Number(stock.availableQuantity) || 0;
                if (row.productName === row.productId) row.productName = stock.productName;
            }
        });

        // Rows recovered from a saved entry alone still carry the id as their label.
        const unnamedIds = Array.from(rows.values()).filter((row) => row.productName === row.productId).map((row) => row.productId);
        if (unnamedIds.length) {
            const products = await Product.find({ ...tenant, id: { $in: unnamedIds } }).select('id name').lean();
            const namesById = new Map(products.map((product) => [product.id, product.name]));
            rows.forEach((row) => {
                const name = namesById.get(row.productId);
                if (name && row.productName === row.productId) row.productName = name;
            });
        }

        const sheet = Array.from(rows.values()).sort((a, b) =>
            a.vendorName.localeCompare(b.vendorName) || a.productName.localeCompare(b.productName));

        const totals = sheet.reduce((acc, row) => ({
            broughtQuantity: acc.broughtQuantity + row.broughtQuantity,
            soldQuantity: acc.soldQuantity + row.soldQuantity,
            salesValue: acc.salesValue + row.salesValue,
            totalAmount: acc.totalAmount + row.totalAmount,
            commission: acc.commission + row.commission,
        }), { broughtQuantity: 0, soldQuantity: 0, salesValue: 0, totalAmount: 0, commission: 0 });

        return res.json({
            date: sheetDate,
            rows: sheet,
            totals: { ...totals, vendors: new Set(sheet.map((row) => row.vendorId)).size },
        });
    } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Unable to load vendor commission sheet' });
    }
};

export const saveVendorCommissionEntry = async (req: AuthRequest, res: Response) => {
    try {
        const tenant = buildTenantFilter(req.user!);
        const { sheetDate } = resolveSheetDay(req.body?.date);
        const vendorId = String(req.body?.vendorId || '');
        const productId = String(req.body?.productId || '');
        const totalAmount = Number(req.body?.totalAmount);
        const commission = Number(req.body?.commission);

        if (!mongoose.Types.ObjectId.isValid(vendorId)) throw new Error('Select a vendor');
        if (!productId) throw new Error('Select a vegetable');
        if (!Number.isFinite(totalAmount) || totalAmount < 0) throw new Error('Total amount must be zero or more');
        if (!Number.isFinite(commission) || commission < 0) throw new Error('Commission must be zero or more');

        const vendor = await Vendor.findOne({ _id: vendorId, ...tenant }).lean();
        if (!vendor) throw new Error('Vendor not found');

        const entry = await VendorCommission.findOneAndUpdate(
            { sheetDate, vendorId: vendor._id, productId, ...tenant },
            {
                $set: {
                    totalAmount,
                    commission,
                    note: String(req.body?.note || '').trim(),
                    updatedByName: req.user!.name,
                },
                $setOnInsert: { sheetDate, vendorId: vendor._id, productId, businessId: getTenantObjectId(req.user!) },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true },
        );
        return res.json(entry);
    } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Unable to save vendor commission' });
    }
};
