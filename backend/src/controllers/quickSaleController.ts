import { Response } from 'express';
import mongoose from 'mongoose';
import type { AuthRequest } from '../middleware/auth';
import Product from '../models/Product';
import Transaction from '../models/Transaction';
import Vendor from '../models/Vendor';
import VendorStock from '../models/VendorStock';
import { buildTenantFilter, getTenantObjectId } from '../utils/tenancy';

type QuickLine = { vendorId: string; productId: string; quantity: number; unitPrice: number };

export const createQuickSale = async (req: AuthRequest, res: Response) => {
    const tenant = buildTenantFilter(req.user!);
    const customerName = String(req.body.customerName || '').trim();
    // This grid is intentionally credit-only. Never accept a cash method from the client.
    const paymentMethod = 'credit';
    const lines = req.body.lines as QuickLine[];
    const combined = new Map<string, QuickLine>();

    try {
        if (!customerName) throw new Error('Customer is required');
        if (!Array.isArray(lines) || !lines.length) throw new Error('Add at least one vendor product');
        lines.forEach((line) => {
            const quantity = Number(line.quantity); const unitPrice = Number(line.unitPrice);
            if (!line.vendorId || !line.productId || quantity <= 0 || unitPrice <= 0) throw new Error('Every line needs vendor, product, quantity and price');
            const key = `${line.vendorId}:${line.productId}`;
            const existing = combined.get(key);
            combined.set(key, existing ? { ...line, quantity: existing.quantity + quantity } : { ...line, quantity, unitPrice });
        });
    } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Unable to complete quick sale' });
    }

    const session = await mongoose.startSession();
    try {
        let result: {
            sales: Array<{ saleId: string; vendorName: string; total: number; dueAmount: number }>;
            total: number;
            dueAmount: number;
            transactions: unknown[];
        } | null = null;
        // withTransaction owns commit/abort and retries transient conflicts. Every read and
        // write below must stay sequential — concurrent commands on one session make the
        // server reject the txn number ("does not match any in-progress transactions").
        await session.withTransaction(async () => {
            const checkedLines: Array<QuickLine & { productName: string; vendorName: string; unitCost: number }> = [];
            for (const line of combined.values()) {
                const product = await Product.findOne({ id: line.productId, ...tenant }).session(session);
                const vendor = await Vendor.findOne({ _id: line.vendorId, ...tenant }).session(session);
                const vendorStock = await VendorStock.findOne({ vendorId: line.vendorId, productId: line.productId, ...tenant }).session(session);
                if (!product || !vendor || !vendorStock) throw new Error('Selected vendor product is unavailable');
                if (product.stock < line.quantity || vendorStock.availableQuantity < line.quantity) throw new Error(`Insufficient stock for ${product.name}`);
                checkedLines.push({ ...line, productName: product.name, vendorName: vendor.name, unitCost: Number(product.purchasePrice || 0) });
            }
            const total = checkedLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
            const timestamp = new Date();
            // One sale per vendor: lines bought from the same vendor belong to a single
            // order, while a second vendor becomes its own separate order/transaction group.
            const byVendor = new Map<string, typeof checkedLines>();
            checkedLines.forEach((line) => {
                byVendor.set(line.vendorId, [...(byVendor.get(line.vendorId) || []), line]);
            });
            const sales = Array.from(byVendor.values()).map((vendorLines) => ({
                saleId: `QSO-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
                vendorName: vendorLines[0].vendorName,
                lines: vendorLines,
                total: Number(vendorLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0).toFixed(2)),
            }));
            const transactions = sales.flatMap((sale) => sale.lines.map((line, index) => new Transaction({
                id: `${sale.saleId}-L${index + 1}`, timestamp, productId: line.productId, productName: line.productName,
                vendorId: line.vendorId, vendorName: line.vendorName, type: 'reduction', amount: line.quantity,
                totalPrice: Number((line.quantity * line.unitPrice).toFixed(2)), unitPrice: line.unitPrice, unitCost: line.unitCost,
                grossProfit: Number(((line.unitPrice - line.unitCost) * line.quantity).toFixed(2)), userName: req.user!.name,
                customerName, customerCnic: String(req.body.customerCnic || ''),
                // Credit-only grid: nothing is paid at sale time, so the whole line is due.
                paymentMethod, paidNow: 0,
                dueAmount: Number((line.quantity * line.unitPrice).toFixed(2)), businessId: getTenantObjectId(req.user!),
            })));
            for (const line of checkedLines) {
                const product = await Product.findOneAndUpdate({ id: line.productId, ...tenant, stock: { $gte: line.quantity } }, { $inc: { stock: -line.quantity }, $set: { lastUpdated: new Date() } }, { new: true, session });
                const stock = await VendorStock.findOneAndUpdate({ vendorId: line.vendorId, productId: line.productId, ...tenant, availableQuantity: { $gte: line.quantity } }, { $inc: { availableQuantity: -line.quantity } }, { new: true, session });
                if (!product || !stock) throw new Error(`Stock changed while completing ${line.productName}. Please try again.`);
            }
            await Transaction.insertMany(transactions, { session });
            result = {
                sales: sales.map((sale) => ({ saleId: sale.saleId, vendorName: sale.vendorName, total: sale.total, dueAmount: sale.total })),
                total,
                dueAmount: total,
                transactions,
            };
        });
        return res.status(201).json(result);
    } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Unable to complete quick sale' });
    } finally { await session.endSession(); }
};
