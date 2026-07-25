import { Response } from 'express';
import mongoose from 'mongoose';
import type { AuthRequest } from '../middleware/auth';
import Vendor from '../models/Vendor';
import VendorStock from '../models/VendorStock';
import PurchaseOrder from '../models/PurchaseOrder';
import Product from '../models/Product';
import Transaction from '../models/Transaction';
import { buildTenantFilter, getTenantObjectId } from '../utils/tenancy';

export const normalizeVendorName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

export const getOrCreateVendor = async (name: string, req: AuthRequest, session?: mongoose.ClientSession) => {
    const cleanName = name.trim().replace(/\s+/g, ' ');
    if (!cleanName) throw new Error('Vendor name is required');
    const query = { normalizedName: normalizeVendorName(cleanName), ...buildTenantFilter(req.user!) };
    const update = { $setOnInsert: { name: cleanName, normalizedName: query.normalizedName, businessId: getTenantObjectId(req.user!) } };
    const vendor = await Vendor.findOneAndUpdate(query, update, { new: true, upsert: true, session, setDefaultsOnInsert: true });
    return vendor;
};

const getDayRange = (value?: string) => {
    const [year, month, day] = String(value || new Date().toLocaleDateString('en-CA')).split('-').map(Number);
    const start = new Date(year, (month || 1) - 1, day || 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
};

export const listVendors = async (req: AuthRequest, res: Response) => {
    try {
        const vendors = await Vendor.find(buildTenantFilter(req.user!)).sort({ name: 1 }).lean();
        return res.json(vendors);
    } catch (error: any) {
        return res.status(500).json({ message: error.message || 'Unable to load vendors' });
    }
};

export const createVendor = async (req: AuthRequest, res: Response) => {
    try {
        const vendor = await getOrCreateVendor(String(req.body.name || ''), req);
        return res.status(201).json(vendor);
    } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Unable to create vendor' });
    }
};

export const getTodayVendorAvailability = async (req: AuthRequest, res: Response) => {
    try {
        const { start, end } = getDayRange(typeof req.query.date === 'string' ? req.query.date : undefined);
        const tenant = buildTenantFilter(req.user!);
        const orders = await PurchaseOrder.find({ ...tenant, createdAt: { $gte: start, $lt: end } }).lean();
        const vendorIds = orders.map((order) => order.vendorId).filter(Boolean) as mongoose.Types.ObjectId[];
        const stocks = await VendorStock.find({ ...tenant, vendorId: { $in: vendorIds } }).lean();
        const stockByKey = new Map(stocks.map((stock) => [`${stock.vendorId.toString()}:${stock.productId}`, stock]));
        const groups = new Map<string, { vendorId: string; vendorName: string; products: Array<{ productId: string; productName: string; availableQuantity: number }> }>();

        orders.forEach((order) => {
            if (!order.vendorId) return;
            const vendorId = order.vendorId.toString();
            const group = groups.get(vendorId) || { vendorId, vendorName: order.vendorName, products: [] };
            order.items.forEach((item) => {
                if (group.products.some((product) => product.productId === item.productId)) return;
                const stock = stockByKey.get(`${vendorId}:${item.productId}`);
                group.products.push({ productId: item.productId, productName: item.productName, availableQuantity: Number(stock?.availableQuantity || 0) });
            });
            groups.set(vendorId, group);
        });
        return res.json(Array.from(groups.values()).sort((a, b) => a.vendorName.localeCompare(b.vendorName)));
    } catch (error: any) {
        return res.status(500).json({ message: error.message || 'Unable to load today\'s vendor stock' });
    }
};

export const receiveVendorStock = async (req: AuthRequest, res: Response) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const vendor = await Vendor.findOne({ _id: req.params.id, ...buildTenantFilter(req.user!) }).session(session);
        if (!vendor) throw new Error('Vendor not found');
        const product = await Product.findOne({ id: req.body.productId, ...buildTenantFilter(req.user!) }).session(session);
        if (!product) throw new Error('Product not found');
        const quantity = Number(req.body.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantity must be greater than zero');
        product.stock += quantity;
        await product.save({ session });
        await VendorStock.findOneAndUpdate(
            { vendorId: vendor._id, productId: product.id, ...buildTenantFilter(req.user!) },
            { $inc: { availableQuantity: quantity }, $set: { productName: product.name }, $setOnInsert: { businessId: getTenantObjectId(req.user!) } },
            { new: true, upsert: true, session, setDefaultsOnInsert: true },
        );
        const order = new PurchaseOrder({
            orderNumber: `PO-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
            vendorId: vendor._id,
            vendorName: vendor.name,
            vehicleNumber: 'Quick Grid', vehicleRent: 0, labourCost: 0, paymentStatus: 'unpaid',
            items: [{ productId: product.id, productName: product.name, quantity }],
            grandTotal: 0,
            receivedBy: req.user!.id, receivedByName: req.user!.name, businessId: getTenantObjectId(req.user!),
        });
        await order.save({ session });
        await session.commitTransaction();
        return res.status(201).json(order);
    } catch (error: any) {
        await session.abortTransaction();
        return res.status(400).json({ message: error.message || 'Unable to receive vendor stock' });
    } finally { session.endSession(); }
};

export const assignOpeningVendorStock = async (req: AuthRequest, res: Response) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const tenant = buildTenantFilter(req.user!);
        const vendor = await Vendor.findOne({ _id: req.params.id, ...tenant }).session(session);
        const product = await Product.findOne({ id: req.body.productId, ...tenant }).session(session);
        const quantity = Number(req.body.quantity);
        if (!vendor || !product) throw new Error('Vendor or product not found');
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantity must be greater than zero');
        const assigned = await VendorStock.aggregate([{ $match: { ...tenant, productId: product.id } }, { $group: { _id: null, quantity: { $sum: '$availableQuantity' } } }]).session(session);
        const unassigned = Number(product.stock || 0) - Number(assigned[0]?.quantity || 0);
        if (quantity > unassigned) throw new Error(`Only ${Math.max(unassigned, 0)} units are unassigned in inventory`);
        const stock = await VendorStock.findOneAndUpdate(
            { vendorId: vendor._id, productId: product.id, ...tenant },
            { $inc: { availableQuantity: quantity }, $set: { productName: product.name }, $setOnInsert: { businessId: getTenantObjectId(req.user!) } },
            { new: true, upsert: true, session, setDefaultsOnInsert: true },
        );
        await session.commitTransaction();
        return res.json(stock);
    } catch (error: any) {
        await session.abortTransaction();
        return res.status(400).json({ message: error.message || 'Unable to assign opening vendor stock' });
    } finally { session.endSession(); }
};

export const getVendorHistory = async (req: AuthRequest, res: Response) => {
    try {
        const tenant = buildTenantFilter(req.user!);
        const vendor = await Vendor.findOne({ _id: req.params.id, ...tenant }).lean();
        if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
        const [orders, sales, stocks] = await Promise.all([
            PurchaseOrder.find({ vendorId: vendor._id, ...tenant }).lean(),
            Transaction.find({ vendorId: vendor._id, ...tenant, type: 'reduction' }).sort({ timestamp: -1 }).lean(),
            VendorStock.find({ vendorId: vendor._id, ...tenant }).lean(),
        ]);
        const productRows = new Map<string, { productId: string; productName: string; receivedQuantity: number; soldQuantity: number; availableQuantity: number }>();
        orders.forEach((order) => order.items.forEach((item) => {
            const row = productRows.get(item.productId) || { productId: item.productId, productName: item.productName, receivedQuantity: 0, soldQuantity: 0, availableQuantity: 0 };
            row.receivedQuantity += Number(item.quantity || 0); productRows.set(item.productId, row);
        }));
        sales.forEach((sale) => {
            const row = productRows.get(sale.productId) || { productId: sale.productId, productName: sale.productName, receivedQuantity: 0, soldQuantity: 0, availableQuantity: 0 };
            row.soldQuantity += Number(sale.amount || 0); productRows.set(sale.productId, row);
        });
        stocks.forEach((stock) => {
            const row = productRows.get(stock.productId) || { productId: stock.productId, productName: stock.productName, receivedQuantity: 0, soldQuantity: 0, availableQuantity: 0 };
            row.availableQuantity = Number(stock.availableQuantity || 0); productRows.set(stock.productId, row);
        });
        return res.json({ vendor, products: Array.from(productRows.values()).sort((a, b) => a.productName.localeCompare(b.productName)), sales });
    } catch (error: any) {
        return res.status(500).json({ message: error.message || 'Unable to load vendor history' });
    }
};
