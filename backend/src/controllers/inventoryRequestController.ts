import { Response } from 'express';
import mongoose from 'mongoose';
import InventoryRequest from '../models/InventoryRequest';
import Product from '../models/Product';
import type { AuthRequest } from '../middleware/auth';
import { normalizeRole } from '../utils/accessControl';
import { buildTenantFilter, getTenantObjectId } from '../utils/tenancy';

const buildProductPayload = (body: Record<string, any>) => ({
    id: String(body.id),
    sku: String(body.sku).toUpperCase(),
    name: String(body.name),
    category: String(body.category),
    purchasePrice: Number(body.purchasePrice),
    salePrice: Number(body.salePrice),
    price: Number(body.salePrice ?? body.price ?? 0),
    stock: Number(body.stock),
    minStock: Number(body.minStock),
    productUnitCode: String(body.productUnitCode || 'piece'),
    productUnit: String(body.productUnit || 'Piece'),
    productUnitUrdu: String(body.productUnitUrdu || 'عدد'),
    description: String(body.description || ''),
    imageUrl: String(body.imageUrl || ''),
    batchNumber: String(body.batchNumber || ''),
    expiryDate: String(body.expiryDate || ''),
    supplier: String(body.supplier || ''),
});

export const getInventoryRequests = async (req: AuthRequest, res: Response) => {
    try {
        const actorRole = normalizeRole(req.user?.role);
        const query = actorRole === 'user'
            ? { requestedBy: req.user?.id, ...buildTenantFilter(req.user!) }
            : buildTenantFilter(req.user!);

        const requests = await InventoryRequest.find(query).sort({ createdAt: -1 });
        return res.json(requests);
    } catch (error: any) {
        return res.status(500).json({ message: error.message || 'Failed to fetch inventory requests' });
    }
};

export const createInventoryRequest = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        const duplicatePending = await InventoryRequest.findOne({
            requestedBy: req.user.id,
            'productData.sku': String(req.body.sku).toUpperCase(),
            status: 'pending',
            ...buildTenantFilter(req.user),
        });

        if (duplicatePending) {
            return res.status(400).json({ message: 'There is already a pending approval request for this SKU' });
        }

        const request = new InventoryRequest({
            requestedBy: req.user.id,
            requestedByName: req.user.name,
            requestedByEmail: req.user.email,
            productData: buildProductPayload(req.body),
            businessId: getTenantObjectId(req.user),
        });

        await request.save();

        return res.status(201).json({
            message: 'Inventory request submitted for admin approval',
            request,
        });
    } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Failed to create inventory request' });
    }
};

export const reviewInventoryRequest = async (req: AuthRequest, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const request = await InventoryRequest.findOne({ _id: req.params.id, ...buildTenantFilter(req.user!) }).session(session);

        if (!request) {
            throw new Error('Inventory request not found');
        }

        if (request.status !== 'pending') {
            throw new Error('This inventory request has already been reviewed');
        }

        request.reviewedBy = new mongoose.Types.ObjectId(req.user?.id);
        request.reviewedByName = req.user?.name || '';
        request.decisionNote = String(req.body.decisionNote || '');
        request.status = req.body.status;

        if (req.body.status === 'approved') {
            const skuExists = await Product.findOne({ sku: request.productData.sku, ...buildTenantFilter(req.user!) }).session(session);
            if (skuExists) {
                throw new Error('A product with this SKU already exists');
            }

            const productIdExists = await Product.findOne({ id: request.productData.id, ...buildTenantFilter(req.user!) }).session(session);
            if (productIdExists) {
                throw new Error('A product with this ID already exists');
            }

            const product = new Product({
                ...request.productData,
                price: request.productData.salePrice ?? request.productData.price,
                businessId: getTenantObjectId(req.user!),
                businessName: req.user?.businessName || '',
            });

            await product.save({ session });
            request.approvedProductId = product.id;
        }

        await request.save({ session });
        await session.commitTransaction();
        session.endSession();

        return res.json({
            message: `Inventory request ${request.status} successfully`,
            request,
        });
    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: error.message || 'Failed to review inventory request' });
    }
};
