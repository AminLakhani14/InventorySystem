import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
    fullName: string;
    cnic?: string;
    phoneNumber: string;
    amount: number;
    email?: string;
    address?: string;
    province?: string;
    city?: string;
    customerType: 'regular' | 'credit' | 'installment' | 'wholesale';
    status: 'active' | 'inactive';
    notes?: string;
    createdBy?: mongoose.Types.ObjectId;
    businessId?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const CustomerSchema: Schema<ICustomer> = new Schema(
    {
        fullName: { type: String, required: true, trim: true, index: true },
        cnic: { type: String, default: '', trim: true, index: true },
        phoneNumber: { type: String, required: true, trim: true },
        amount: { type: Number, required: true, min: 0, default: 0 },
        email: { type: String, default: '', trim: true, lowercase: true },
        address: { type: String, default: '', trim: true },
        province: { type: String, default: '', trim: true, index: true },
        city: { type: String, default: '', trim: true },
        customerType: {
            type: String,
            enum: ['regular', 'credit', 'installment', 'wholesale'],
            default: 'regular',
            index: true,
        },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active',
            index: true,
        },
        notes: { type: String, default: '', trim: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        businessId: {
            type: Schema.Types.ObjectId,
            ref: 'Business',
            default: null,
            index: true,
        },
    },
    { timestamps: true },
);

CustomerSchema.index({ businessId: 1, phoneNumber: 1 });

export default mongoose.model<ICustomer>('Customer', CustomerSchema);
