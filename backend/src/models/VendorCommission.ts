import mongoose, { Document, Schema } from 'mongoose';

export interface IVendorCommission extends Document {
    // Local calendar day the sheet row belongs to, kept as YYYY-MM-DD so the row stays
    // pinned to the day it was entered regardless of server timezone shifts.
    sheetDate: string;
    vendorId: mongoose.Types.ObjectId;
    productId: string;
    totalAmount: number;
    commission: number;
    note?: string;
    updatedByName?: string;
    businessId?: mongoose.Types.ObjectId;
}

const VendorCommissionSchema = new Schema<IVendorCommission>({
    sheetDate: { type: String, required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    productId: { type: String, required: true, index: true },
    totalAmount: { type: Number, required: true, default: 0, min: 0 },
    commission: { type: Number, required: true, default: 0, min: 0 },
    note: { type: String, default: '', trim: true },
    updatedByName: { type: String, default: '' },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', default: null, index: true },
}, { timestamps: true });

VendorCommissionSchema.index({ businessId: 1, sheetDate: 1, vendorId: 1, productId: 1 }, { unique: true });

export default mongoose.model<IVendorCommission>('VendorCommission', VendorCommissionSchema);
