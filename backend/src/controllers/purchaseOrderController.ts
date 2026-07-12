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

const buildReceivedItems = async (
    rawItems: { productId: string; quantity: number; unitPurchasePrice: number }[],
    tenantFilter: Record<string, unknown>,
    session: mongoose.ClientSession
) => {
    const items = rawItems.map((item) => ({ ...item, quantity: Number(item.quantity), unitPurchasePrice: Number(item.unitPurchasePrice) }));
    const productIds = items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) throw new Error('Each product can only be added once to a purchase order');

    const products = await Product.find({ id: { $in: productIds }, ...tenantFilter }).session(session);
    if (products.length !== items.length) throw new Error('One or more selected products no longer exist');

    const productsById = new Map(products.map((product) => [product.id, product]));
    return items.map((item) => {
        const product = productsById.get(item.productId)!;
        return { productId: product.id, productName: product.name, quantity: item.quantity, unitPurchasePrice: item.unitPurchasePrice, totalPurchase: item.quantity * item.unitPurchasePrice };
    }) as ReceivedItem[];
};

const applyStockChanges = async (items: ReceivedItem[], multiplier: number, tenantFilter: Record<string, unknown>, session: mongoose.ClientSession) => {
    for (const item of items) {
        await Product.updateOne({ id: item.productId, ...tenantFilter }, { $inc: { stock: item.quantity * multiplier }, $set: { lastUpdated: new Date() } }, { session });
    }
};

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
        const receivedItems = await buildReceivedItems(req.body.items, tenantFilter, session);
        const totalProductPurchase = receivedItems.reduce((total: number, item: ReceivedItem) => total + item.totalPurchase, 0);
        const vehicleRent = Number(req.body.vehicleRent);
        const labourCost = Number(req.body.labourCost);

        const order = new PurchaseOrder({
            orderNumber: buildOrderNumber(),
            vendorName: req.body.vendorName,
            vehicleNumber: req.body.vehicleNumber,
            vehicleRent,
            labourCost,
            paymentStatus: req.body.paymentStatus,
            items: receivedItems,
            totalProductPurchase,
            grandTotal: totalProductPurchase + vehicleRent + labourCost,
            receivedBy: req.user!.id,
            receivedByName: req.user!.name,
            businessId: getTenantObjectId(req.user!),
        });

        await applyStockChanges(receivedItems, 1, tenantFilter, session);

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

export const updatePurchaseOrder = async (req: AuthRequest, res: Response) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const tenantFilter = buildTenantFilter(req.user!);
        const order = await PurchaseOrder.findOne({ _id: req.params.id, ...tenantFilter }).session(session);
        if (!order) throw new Error('Purchase order not found');

        const receivedItems = await buildReceivedItems(req.body.items, tenantFilter, session);
        const totalProductPurchase = receivedItems.reduce((total, item) => total + item.totalPurchase, 0);
        await applyStockChanges(order.items, -1, tenantFilter, session);
        await applyStockChanges(receivedItems, 1, tenantFilter, session);

        order.vendorName = req.body.vendorName;
        order.vehicleNumber = req.body.vehicleNumber;
        order.vehicleRent = Number(req.body.vehicleRent);
        order.labourCost = Number(req.body.labourCost);
        order.paymentStatus = req.body.paymentStatus;
        order.items = receivedItems;
        order.totalProductPurchase = totalProductPurchase;
        order.grandTotal = totalProductPurchase + order.vehicleRent + order.labourCost;
        await order.save({ session });
        await session.commitTransaction();
        return res.json(order);
    } catch (error: any) {
        await session.abortTransaction();
        return res.status(error.message === 'Purchase order not found' ? 404 : 400).json({ message: error.message || 'Failed to update purchase order' });
    } finally {
        session.endSession();
    }
};

export const deletePurchaseOrder = async (req: AuthRequest, res: Response) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const tenantFilter = buildTenantFilter(req.user!);
        const order = await PurchaseOrder.findOne({ _id: req.params.id, ...tenantFilter }).session(session);
        if (!order) throw new Error('Purchase order not found');
        await applyStockChanges(order.items, -1, tenantFilter, session);
        await order.deleteOne({ session });
        await session.commitTransaction();
        return res.status(204).send();
    } catch (error: any) {
        await session.abortTransaction();
        return res.status(error.message === 'Purchase order not found' ? 404 : 400).json({ message: error.message || 'Failed to delete purchase order' });
    } finally {
        session.endSession();
    }
};
