import { Request, Response } from 'express';
import Transaction from '../models/Transaction';
import Product from '../models/Product';
import CreditPayment from '../models/CreditPayment';
import mongoose from 'mongoose';
import type { AuthRequest } from '../middleware/auth';
import { buildTenantFilter, getTenantObjectId } from '../utils/tenancy';

export const getTransactions = async (req: AuthRequest, res: Response) => {
    try {
        const transactions = await Transaction.find(buildTenantFilter(req.user!)).sort({ timestamp: -1 });
        res.json(transactions);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createTransaction = async (req: AuthRequest, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            id,
            productId,
            type,
            amount,
            totalPrice,
            userName,
            productName,
            paymentMethod,
            paidVia,
            paidNow,
            dueAmount,
            customerName,
            customerCnic,
            unitPrice,
        } = req.body;

        const product = await Product.findOne({ id: productId, ...buildTenantFilter(req.user!) }).session(session);
        if (!product) {
            throw new Error('Product not found');
        }

        const resolvedUnitCost = product.purchasePrice ?? 0;
        const defaultUnitPrice = Number(product.salePrice ?? product.price ?? 0);
        const requestedUnitPrice = unitPrice != null ? Number(unitPrice) : defaultUnitPrice;

        const resolvedUnitPrice = requestedUnitPrice;
        const resolvedTotalPrice = Number(totalPrice ?? (resolvedUnitPrice * amount));
        const resolvedGrossProfit = type === 'reduction'
            ? (resolvedUnitPrice - resolvedUnitCost) * amount
            : 0;

        // 1. Record the transaction
        const transaction = new Transaction({
            id,
            productId,
            type,
            amount,
            totalPrice: resolvedTotalPrice,
            userName: req.user?.name || userName || 'Staff',
            productName,
            paymentMethod: paymentMethod || 'cash',
            paidVia,
            paidNow: paidNow || 0,
            dueAmount: dueAmount || 0,
            customerName,
            customerCnic,
            unitCost: resolvedUnitCost,
            unitPrice: resolvedUnitPrice,
            grossProfit: resolvedGrossProfit,
            businessId: getTenantObjectId(req.user!),
        });
        await transaction.save({ session });

        if (type === 'reduction') {
            if (product.stock < amount) {
                throw new Error('Insufficient stock');
            }
            product.stock -= amount;
        } else {
            product.stock += amount;
        }

        await product.save({ session });

        await session.commitTransaction();
        session.endSession();

        res.status(201).json(transaction);
    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ message: error.message });
    }
};

export const deleteTransactions = async (req: AuthRequest, res: Response) => {
    const ids: string[] = Array.isArray(req.body.ids)
        ? req.body.ids
        : req.params.id
            ? [req.params.id]
            : [];

    if (ids.length === 0) {
        return res.status(400).json({ message: 'No transaction ids provided' });
    }

    const restoreStock = req.body.restoreStock !== false;
    const tenantFilter = buildTenantFilter(req.user!);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const transactions = await Transaction.find({ id: { $in: ids }, ...tenantFilter }).session(session);

        if (transactions.length === 0) {
            throw new Error('No matching transactions found');
        }

        if (restoreStock) {
            for (const tx of transactions) {
                if (tx.type === 'reduction') {
                    await Product.findOneAndUpdate(
                        { id: tx.productId, ...tenantFilter },
                        { $inc: { stock: Number(tx.amount || 0) } },
                        { session }
                    );
                }
            }
        }

        await Transaction.deleteMany({ _id: { $in: transactions.map((tx) => tx._id) } }).session(session);

        const creditCustomers = new Map<string, { customerName: string; customerCnic: string }>();
        transactions.forEach((tx) => {
            if (tx.paymentMethod === 'credit' && tx.customerName && tx.customerCnic) {
                creditCustomers.set(`${tx.customerName}::${tx.customerCnic}`, {
                    customerName: tx.customerName,
                    customerCnic: tx.customerCnic,
                });
            }
        });

        for (const { customerName, customerCnic } of creditCustomers.values()) {
            const remaining = await Transaction.countDocuments({
                ...tenantFilter,
                type: 'reduction',
                paymentMethod: 'credit',
                customerName,
                customerCnic,
            }).session(session);

            if (remaining === 0) {
                await CreditPayment.deleteMany({ ...tenantFilter, customerName, customerCnic }).session(session);
            }
        }

        await session.commitTransaction();
        session.endSession();

        res.json({ message: `${transactions.length} transaction(s) deleted`, deletedCount: transactions.length });
    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ message: error.message || 'Failed to delete transactions' });
    }
};
