import mongoose, { Document, Schema } from 'mongoose';

export interface IVendorStock extends Document {
    vendorId: mongoose.Types.ObjectId;
    productId: string;
    productName: string;
    availableQuantity: number;
    businessId?: mongoose.Types.ObjectId;
}

const VendorStockSchema = new Schema<IVendorStock>({
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    productId: { type: String, required: true, index: true },
    productName: { type: String, required: true },
    availableQuantity: { type: Number, required: true, default: 0, min: 0 },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', default: null, index: true },
}, { timestamps: true });

VendorStockSchema.index({ businessId: 1, vendorId: 1, productId: 1 }, { unique: true });

export default mongoose.model<IVendorStock>('VendorStock', VendorStockSchema);
