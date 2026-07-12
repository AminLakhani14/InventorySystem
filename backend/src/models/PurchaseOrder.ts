import mongoose, { Document, Schema } from 'mongoose';

export interface IPurchaseOrderItem {
    productId: string;
    productName: string;
    quantity: number;
    unitPurchasePrice: number;
    totalPurchase: number;
}

export interface IPurchaseOrder extends Document {
    orderNumber: string;
    vendorName: string;
    vehicleNumber: string;
    vehicleRent: number;
    items: IPurchaseOrderItem[];
    totalProductPurchase: number;
    grandTotal: number;
    receivedBy: mongoose.Types.ObjectId;
    receivedByName: string;
    businessId?: mongoose.Types.ObjectId;
}

const PurchaseOrderItemSchema = new Schema<IPurchaseOrderItem>(
    {
        productId: { type: String, required: true },
        productName: { type: String, required: true },
        quantity: { type: Number, required: true, min: 0.0001 },
        unitPurchasePrice: { type: Number, required: true, min: 0 },
        totalPurchase: { type: Number, required: true, min: 0 },
    },
    { _id: false }
);

const PurchaseOrderSchema = new Schema<IPurchaseOrder>(
    {
        orderNumber: { type: String, required: true, index: true },
        vendorName: { type: String, required: true, trim: true },
        vehicleNumber: { type: String, required: true, trim: true },
        vehicleRent: { type: Number, required: true, min: 0 },
        items: { type: [PurchaseOrderItemSchema], required: true, validate: [(items: IPurchaseOrderItem[]) => items.length > 0, 'At least one product is required'] },
        totalProductPurchase: { type: Number, required: true, min: 0 },
        grandTotal: { type: Number, required: true, min: 0 },
        receivedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        receivedByName: { type: String, required: true },
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', default: null, index: true },
    },
    { timestamps: true }
);

PurchaseOrderSchema.index({ businessId: 1, orderNumber: 1 }, { unique: true });

export default mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
