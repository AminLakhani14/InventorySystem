import { Response } from 'express';
import mongoose from 'mongoose';
import type { AuthRequest } from '../middleware/auth';
import Product from '../models/Product';
import Transaction from '../models/Transaction';
import Vendor from '../models/Vendor';
import VendorStock from '../models/VendorStock';
import PurchaseOrder from '../models/PurchaseOrder';
import { buildTenantFilter, getTenantObjectId } from '../utils/tenancy';

type QuickLine = { vendorId: string; productId: string; quantity: number; unitPrice: number };

const getDayRange = (value?: string) => {
    const [year, month, day] = String(value || new Date().toLocaleDateString('en-CA')).split('-').map(Number);
    const start = new Date(year, (month || 1) - 1, day || 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
};

export const createQuickSale = async (req: AuthRequest, res: Response) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const tenant = buildTenantFilter(req.user!);
        const { start, end } = getDayRange(typeof req.body.saleDate === 'string' ? req.body.saleDate : undefined);
        const customerName = String(req.body.customerName || '').trim();
        const paymentMethod = req.body.paymentMethod === 'credit' ? 'credit' : req.body.paymentMethod === 'cash' ? 'cash' : '';
        if (!customerName) throw new Error('Customer is required');
        if (!paymentMethod) throw new Error('Choose Cash or Credit');
        const lines = req.body.lines as QuickLine[];
        if (!Array.isArray(lines) || !lines.length) throw new Error('Add at least one vendor product');
        const combined = new Map<string, QuickLine>();
        lines.forEach((line) => {
            const quantity = Number(line.quantity); const unitPrice = Number(line.unitPrice);
            if (!line.vendorId || !line.productId || quantity <= 0 || unitPrice <= 0) throw new Error('Every line needs vendor, product, quantity and price');
            const key = `${line.vendorId}:${line.productId}`;
            const existing = combined.get(key);
            combined.set(key, existing ? { ...line, quantity: existing.quantity + quantity } : { ...line, quantity, unitPrice });
        });
        const checkedLines: Array<QuickLine & { productName: string; vendorName: string; unitCost: number }> = [];
        for (const line of combined.values()) {
            const [product, vendor, vendorStock, todayDelivery] = await Promise.all([
                Product.findOne({ id: line.productId, ...tenant }).session(session),
                Vendor.findOne({ _id: line.vendorId, ...tenant }).session(session),
                VendorStock.findOne({ vendorId: line.vendorId, productId: line.productId, ...tenant }).session(session),
                PurchaseOrder.findOne({ vendorId: line.vendorId, 'items.productId': line.productId, ...tenant, createdAt: { $gte: start, $lt: end } }).session(session),
            ]);
            if (!product || !vendor || !vendorStock || !todayDelivery) throw new Error('Selected vendor product was not delivered today');
            if (product.stock < line.quantity || vendorStock.availableQuantity < line.quantity) throw new Error(`Insufficient stock for ${product.name}`);
            checkedLines.push({ ...line, productName: product.name, vendorName: vendor.name, unitCost: Number(product.purchasePrice || 0) });
        }
        const total = checkedLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
        const paidNow = Math.min(Math.max(Number(req.body.paidNow || 0), 0), total);
        const dueAmount = paymentMethod === 'credit' ? Math.max(total - paidNow, 0) : 0;
        const saleId = `QSO-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
        const transactions = checkedLines.map((line, index) => new Transaction({
            id: `${saleId}-L${index + 1}`, timestamp: new Date(), productId: line.productId, productName: line.productName,
            vendorId: line.vendorId, vendorName: line.vendorName, type: 'reduction', amount: line.quantity,
            totalPrice: Number((line.quantity * line.unitPrice).toFixed(2)), unitPrice: line.unitPrice, unitCost: line.unitCost,
            grossProfit: Number(((line.unitPrice - line.unitCost) * line.quantity).toFixed(2)), userName: req.user!.name,
            customerName, customerCnic: String(req.body.customerCnic || ''),
            paymentMethod, paidNow: Number(((line.quantity * line.unitPrice / total) * paidNow).toFixed(2)),
            dueAmount: Number(((line.quantity * line.unitPrice / total) * dueAmount).toFixed(2)), businessId: getTenantObjectId(req.user!),
        }));
        for (const line of checkedLines) {
            const product = await Product.findOneAndUpdate({ id: line.productId, ...tenant, stock: { $gte: line.quantity } }, { $inc: { stock: -line.quantity }, $set: { lastUpdated: new Date() } }, { new: true, session });
            const stock = await VendorStock.findOneAndUpdate({ vendorId: line.vendorId, productId: line.productId, ...tenant, availableQuantity: { $gte: line.quantity } }, { $inc: { availableQuantity: -line.quantity } }, { new: true, session });
            if (!product || !stock) throw new Error(`Stock changed while completing ${line.productName}. Please try again.`);
        }
        await Transaction.insertMany(transactions, { session });
        await session.commitTransaction();
        return res.status(201).json({ saleId, total, dueAmount, transactions });
    } catch (error: any) {
        await session.abortTransaction();
        return res.status(400).json({ message: error.message || 'Unable to complete quick sale' });
    } finally { session.endSession(); }
};
