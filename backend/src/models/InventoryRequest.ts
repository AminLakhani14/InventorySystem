import mongoose, { Schema, Document } from 'mongoose';

export interface IInventoryRequestProductData {
    id: string;
    sku: string;
    name: string;
    category: string;
    purchasePrice: number;
    salePrice: number;
    price: number;
    stock: number;
    minStock: number;
    productUnitCode?: string;
    productUnit?: string;
    productUnitUrdu?: string;
    description?: string;
    imageUrl?: string;
    batchNumber?: string;
    expiryDate?: string;
    supplier?: string;
}

export interface IInventoryRequest extends Document {
    requestedBy: mongoose.Types.ObjectId;
    requestedByName: string;
    requestedByEmail: string;
    status: 'pending' | 'approved' | 'rejected';
    productData: IInventoryRequestProductData;
    decisionNote?: string;
    reviewedBy?: mongoose.Types.ObjectId;
    reviewedByName?: string;
    approvedProductId?: string;
    businessId?: mongoose.Types.ObjectId;
}

const InventoryRequestSchema = new Schema<IInventoryRequest>({
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestedByName: { type: String, required: true },
    requestedByEmail: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    productData: {
        id: { type: String, required: true },
        sku: { type: String, required: true },
        name: { type: String, required: true },
        category: { type: String, required: true },
        purchasePrice: { type: Number, required: true, min: 0 },
        salePrice: { type: Number, required: true, min: 0 },
        price: { type: Number, required: true, min: 0 },
        stock: { type: Number, required: true, min: 0 },
        minStock: { type: Number, required: true, min: 0 },
        productUnitCode: { type: String, default: 'piece' },
        productUnit: { type: String, default: 'Piece' },
        productUnitUrdu: { type: String, default: 'عدد' },
        description: { type: String, default: '' },
        imageUrl: { type: String, default: '' },
        batchNumber: { type: String, default: '' },
        expiryDate: { type: String, default: '' },
        supplier: { type: String, default: '' },
    },
    decisionNote: { type: String, default: '' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedByName: { type: String, default: '' },
    approvedProductId: { type: String, default: '' },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', default: null, index: true },
}, { timestamps: true });

export default mongoose.model<IInventoryRequest>('InventoryRequest', InventoryRequestSchema);
