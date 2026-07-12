import { Response } from 'express';
import mongoose from 'mongoose';
import PurchaseOrder from '../models/PurchaseOrder';
import Product from '../models/Product';
import type { AuthRequest } from '../middleware/auth';
import { buildTenantFilter, getTenantObjectId } from '../utils/tenancy';

const buildOrderNumber = () => `PO-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

interface ReceivedItem {
    productId: string;
    productName: string;
    quantity: number;
    unitPurchasePrice: number;
    totalPurchase: number;
}

export const getPurchaseOrders = async (req: AuthRequest, res: Response) => {
    try {
        const orders = await PurchaseOrder.find(buildTenantFilter(req.user!)).sort({ createdAt: -1 });
        return res.json(orders);
    } catch (error: any) {
        return res.status(500).json({ message: error.message || 'Failed to fetch purchase orders' });
    }
};

export const createPurchaseOrder = async (req: AuthRequest, res: Response) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();
        const tenantFilter = buildTenantFilter(req.user!);
        const items = req.body.items.map((item: { productId: string; quantity: number; unitPurchasePrice: number }) => ({
            ...item,
            quantity: Number(item.quantity),
            unitPurchasePrice: Number(item.unitPurchasePrice),
        }));
        const productIds = items.map((item: { productId: string }) => item.productId);

        if (new Set(productIds).size !== productIds.length) {
            throw new Error('Each product can only be added once to a purchase order');
        }

        const products = await Product.find({ id: { $in: productIds }, ...tenantFilter }).session(session);
        if (products.length !== items.length) {
            throw new Error('One or more selected products no longer exist');
        }

        const productsById = new Map(products.map((product) => [product.id, product]));
        const receivedItems: ReceivedItem[] = items.map((item: { productId: string; quantity: number; unitPurchasePrice: number }) => {
            const product = productsById.get(item.productId)!;
            return {
                productId: product.id,
                productName: product.name,
                quantity: item.quantity,
                unitPurchasePrice: item.unitPurchasePrice,
                totalPurchase: item.quantity * item.unitPurchasePrice,
            };
        });
        const totalProductPurchase = receivedItems.reduce((total: number, item: ReceivedItem) => total + item.totalPurchase, 0);
        const vehicleRent = Number(req.body.vehicleRent);

        const order = new PurchaseOrder({
            orderNumber: buildOrderNumber(),
            vendorName: req.body.vendorName,
            vehicleNumber: req.body.vehicleNumber,
            vehicleRent,
            items: receivedItems,
            totalProductPurchase,
            grandTotal: totalProductPurchase + vehicleRent,
            receivedBy: req.user!.id,
            receivedByName: req.user!.name,
            businessId: getTenantObjectId(req.user!),
        });

        for (const item of receivedItems) {
            await Product.updateOne(
                { id: item.productId, ...tenantFilter },
                { $inc: { stock: item.quantity }, $set: { lastUpdated: new Date() } },
                { session }
            );
        }

        await order.save({ session });
        await session.commitTransaction();
        return res.status(201).json(order);
    } catch (error: any) {
        await session.abortTransaction();
        return res.status(400).json({ message: error.message || 'Failed to save purchase order' });
    } finally {
        session.endSession();
    }
};
