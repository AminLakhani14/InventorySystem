import mongoose, { Document, Schema } from 'mongoose';

export interface IVendor extends Document {
    name: string;
    normalizedName: string;
    phoneNumber?: string;
    businessId?: mongoose.Types.ObjectId;
}

const VendorSchema = new Schema<IVendor>({
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true, index: true },
    phoneNumber: { type: String, default: '', trim: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', default: null, index: true },
}, { timestamps: true });

VendorSchema.index({ businessId: 1, normalizedName: 1 }, { unique: true });

export default mongoose.model<IVendor>('Vendor', VendorSchema);
