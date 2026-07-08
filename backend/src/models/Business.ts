import mongoose, { Schema, Document } from 'mongoose';

export interface IBusiness extends Document {
    name: string;
    slug: string;
    isActive: boolean;
    isLegacy: boolean;
    createdBy?: mongoose.Types.ObjectId;
}

const BusinessSchema: Schema<IBusiness> = new Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    isLegacy: { type: Boolean, default: false, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export default mongoose.model<IBusiness>('Business', BusinessSchema);
