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

export const getOrCreateVendor = async (name: string, req: AuthRequest, session?: mongoose.ClientSession, phoneNumber?: string) => {
    const cleanName = name.trim().replace(/\s+/g, ' ');
    if (!cleanName) throw new Error('Vendor name is required');
    const cleanPhone = String(phoneNumber ?? '').trim();
    const query = { normalizedName: normalizeVendorName(cleanName), ...buildTenantFilter(req.user!) };
    // Only overwrite the saved phone when a new one is supplied, so blank inputs never wipe it.
    const update = {
        $setOnInsert: { name: cleanName, normalizedName: query.normalizedName, businessId: getTenantObjectId(req.user!) },
        ...(cleanPhone ? { $set: { phoneNumber: cleanPhone } } : {}),
    };
    const vendor = await Vendor.findOneAndUpdate(query, update, { new: true, upsert: true, session, setDefaultsOnInsert: true });
    return vendor;
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
        const vendor = await getOrCreateVendor(String(req.body.name || ''), req, undefined, String(req.body.phoneNumber || ''));
        return res.status(201).json(vendor);
    } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Unable to create vendor' });
    }
};

export const getAvailableVendorStock = async (req: AuthRequest, res: Response) => {
    try {
        const tenant = buildTenantFilter(req.user!);
        const stocks = await VendorStock.find({ ...tenant, availableQuantity: { $gt: 0 } })
            .sort({ productName: 1 })
            .lean();
        const vendorIds = [...new Set(stocks.map((stock) => stock.vendorId.toString()))];
        const vendors = await Vendor.find({ ...tenant, _id: { $in: vendorIds } })
            .select('name phoneNumber')
            .lean();
        const vendorsById = new Map(vendors.map((vendor) => [vendor._id.toString(), vendor]));
        const groups = new Map<string, { vendorId: string; vendorName: string; vendorPhone: string; products: Array<{ productId: string; productName: string; availableQuantity: number }> }>();

        stocks.forEach((stock) => {
            const vendorId = stock.vendorId.toString();
            const vendor = vendorsById.get(vendorId);
            if (!vendor) return;
            const group = groups.get(vendorId) || { vendorId, vendorName: vendor.name, vendorPhone: vendor.phoneNumber || '', products: [] };
            group.products.push({ productId: stock.productId, productName: stock.productName, availableQuantity: Number(stock.availableQuantity) });
            groups.set(vendorId, group);
        });
        return res.json(Array.from(groups.values()).sort((a, b) => a.vendorName.localeCompare(b.vendorName)));
    } catch (error: any) {
        return res.status(500).json({ message: error.message || 'Unable to load available vendor stock' });
    }
};

// Accepts either a single { productId, quantity } or a multi-line { items: [...] } body.
const readReceiveLines = (body: { productId?: string; quantity?: unknown; items?: Array<{ productId?: string; quantity?: unknown }> }) => {
    const raw = Array.isArray(body.items) && body.items.length
        ? body.items
        : [{ productId: body.productId, quantity: body.quantity }];
    const merged = new Map<string, number>();
    raw.forEach((line) => {
        const productId = String(line.productId || '');
        const quantity = Number(line.quantity);
        if (!productId) throw new Error('Select a vegetable for every line');
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantity must be greater than zero');
        merged.set(productId, (merged.get(productId) || 0) + quantity);
    });
    if (!merged.size) throw new Error('Add at least one vegetable');
    return Array.from(merged.entries()).map(([productId, quantity]) => ({ productId, quantity }));
};

export const receiveVendorStock = async (req: AuthRequest, res: Response) => {
    const tenant = buildTenantFilter(req.user!);
    let lines: Array<{ productId: string; quantity: number }>;
    try {
        lines = readReceiveLines(req.body || {});
    } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Unable to receive vendor stock' });
    }

    const session = await mongoose.startSession();
    try {
        let saved: unknown = null;
        // Sequential awaits only: parallel commands on one session break the transaction.
        await session.withTransaction(async () => {
            const vendor = await Vendor.findOne({ _id: req.params.id, ...tenant }).session(session);
            if (!vendor) throw new Error('Vendor not found');

            const items: Array<{ productId: string; productName: string; quantity: number }> = [];
            for (const line of lines) {
                const product = await Product.findOne({ id: line.productId, ...tenant }).session(session);
                if (!product) throw new Error('Product not found');
                product.stock += line.quantity;
                await product.save({ session });
                await VendorStock.findOneAndUpdate(
                    { vendorId: vendor._id, productId: product.id, ...tenant },
                    { $inc: { availableQuantity: line.quantity }, $set: { productName: product.name }, $setOnInsert: { businessId: getTenantObjectId(req.user!) } },
                    { new: true, upsert: true, session, setDefaultsOnInsert: true },
                );
                items.push({ productId: product.id, productName: product.name, quantity: line.quantity });
            }

            const order = new PurchaseOrder({
                orderNumber: `PO-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
                vendorId: vendor._id,
                vendorName: vendor.name,
                vendorPhone: vendor.phoneNumber || '',
                vehicleNumber: 'Quick Grid', vehicleRent: 0, labourCost: 0, paymentStatus: 'unpaid',
                items,
                grandTotal: 0,
                receivedBy: req.user!.id, receivedByName: req.user!.name, businessId: getTenantObjectId(req.user!),
            });
            await order.save({ session });
            saved = order;
        });
        return res.status(201).json(saved);
    } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Unable to receive vendor stock' });
    } finally { await session.endSession(); }
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
