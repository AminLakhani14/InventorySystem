import mongoose, { Document, Schema } from 'mongoose';

export interface IPurchaseOrderItem {
    productId: string;
    productName: string;
    quantity: number;
}

export interface IPurchaseOrder extends Document {
    orderNumber: string;
    vendorId?: mongoose.Types.ObjectId;
    vendorName: string;
    vendorPhone?: string;
    vehicleNumber: string;
    vehicleRent: number;
    labourCost: number;
    paymentStatus: 'paid' | 'unpaid';
    items: IPurchaseOrderItem[];
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
    },
    { _id: false }
);

const PurchaseOrderSchema = new Schema<IPurchaseOrder>(
    {
        orderNumber: { type: String, required: true, index: true },
        vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', default: null, index: true },
        vendorName: { type: String, required: true, trim: true },
        vendorPhone: { type: String, default: '', trim: true },
        vehicleNumber: { type: String, default: '', trim: true },
        vehicleRent: { type: Number, required: true, min: 0 },
        labourCost: { type: Number, required: true, min: 0, default: 0 },
        paymentStatus: { type: String, enum: ['paid', 'unpaid'], required: true, default: 'unpaid' },
        items: { type: [PurchaseOrderItemSchema], required: true, validate: [(items: IPurchaseOrderItem[]) => items.length > 0, 'At least one product is required'] },
        grandTotal: { type: Number, required: true, min: 0 },
        receivedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        receivedByName: { type: String, required: true },
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', default: null, index: true },
    },
    { timestamps: true }
);

PurchaseOrderSchema.index({ businessId: 1, orderNumber: 1 }, { unique: true });
PurchaseOrderSchema.index({ businessId: 1, createdAt: -1 });
PurchaseOrderSchema.index({ businessId: 1, vendorId: 1 });

export default mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
