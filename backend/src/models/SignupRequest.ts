import mongoose, { Schema, Document } from 'mongoose';

export interface ISignupRequest extends Document {
    fullName: string;
    email: string;
    password?: string;
    businessName: string;
    packageId: 'free_trial' | 'starter' | 'pro';
    packageName: string;
    country: 'PK' | 'US' | 'DE' | 'GB' | 'CH' | 'CD' | 'CG' | 'IN' | 'AE';
    currency: 'USD' | 'EUR' | 'GBP' | 'CHF' | 'CDF' | 'XAF' | 'PKR' | 'INR' | 'AED';
    businessType: string;
    phone: string;
    employeeCount: number;
    address: string;
    notes: string;
    status: 'pending' | 'approved' | 'rejected';
    decisionNote: string;
    reviewedBy?: mongoose.Types.ObjectId;
    reviewedByName: string;
    reviewedAt?: Date;
    createdUserId?: mongoose.Types.ObjectId;
    createdBusinessId?: mongoose.Types.ObjectId;
}

const SignupRequestSchema: Schema<ISignupRequest> = new Schema({
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    password: { type: String, required: true, select: false },
    businessName: { type: String, required: true, trim: true, index: true },
    packageId: { type: String, enum: ['free_trial', 'starter', 'pro'], default: 'free_trial' },
    packageName: { type: String, default: 'Free Trial' },
    country: { type: String, enum: ['PK', 'US', 'DE', 'GB', 'CH', 'CD', 'CG', 'IN', 'AE'], default: 'PK' },
    currency: { type: String, enum: ['USD', 'EUR', 'GBP', 'CHF', 'CDF', 'XAF', 'PKR', 'INR', 'AED'], default: 'PKR' },
    businessType: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    employeeCount: { type: Number, default: 1, min: 1 },
    address: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    decisionNote: { type: String, default: '', trim: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedByName: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
    createdUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdBusinessId: { type: Schema.Types.ObjectId, ref: 'Business', default: null },
}, { timestamps: true });

SignupRequestSchema.index({ email: 1, status: 1 });

export default mongoose.model<ISignupRequest>('SignupRequest', SignupRequestSchema);
