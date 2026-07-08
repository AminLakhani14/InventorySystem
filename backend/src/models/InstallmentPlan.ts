import mongoose, { Schema, Document } from 'mongoose';

export interface IInstallmentScheduleItem {
    installmentNumber: number;
    dueDate: Date;
    amount: number;
    status: 'pending' | 'paid';
    paidAt?: Date;
    paidVia?: 'cash' | 'card';
    notes?: string;
}

export interface IInstallmentWitness {
    name: string;
    cnic: string;
    address: string;
}

export interface IInstallmentPlan extends Document {
    planCode: string;
    productId: string;
    productName: string;
    customerName: string;
    customerCnic: string;
    customerPhone: string;
    customerAddress: string;
    witnesses: IInstallmentWitness[];
    saleDate: Date;
    installmentMonths: 3 | 6 | 9 | 12;
    unitPrice: number;
    advancePayment: number;
    financedAmount: number;
    monthlyInstallmentAmount: number;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: 'active' | 'cleared';
    createdBy: string;
    schedule: IInstallmentScheduleItem[];
    businessId?: mongoose.Types.ObjectId;
}

const InstallmentWitnessSchema = new Schema<IInstallmentWitness>({
    name: { type: String, required: true, trim: true },
    cnic: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
}, { _id: false });

const InstallmentScheduleSchema = new Schema<IInstallmentScheduleItem>({
    installmentNumber: { type: Number, required: true },
    dueDate: { type: Date, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    paidAt: { type: Date, default: undefined },
    paidVia: { type: String, enum: ['cash', 'card'], default: undefined },
    notes: { type: String, default: '' },
}, { _id: false });

const InstallmentPlanSchema: Schema<IInstallmentPlan> = new Schema({
    planCode: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    productName: { type: String, required: true },
    customerName: { type: String, required: true, trim: true, index: true },
    customerCnic: { type: String, required: true, trim: true, index: true },
    customerPhone: { type: String, required: true, trim: true },
    customerAddress: { type: String, required: true, trim: true },
    witnesses: { type: [InstallmentWitnessSchema], required: true, validate: [(value: IInstallmentWitness[]) => value.length === 2, 'Exactly two witnesses are required'] },
    saleDate: { type: Date, required: true, index: true },
    installmentMonths: { type: Number, enum: [3, 6, 9, 12], required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    advancePayment: { type: Number, required: true, min: 0, default: 0 },
    financedAmount: { type: Number, required: true, min: 0 },
    monthlyInstallmentAmount: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    remainingAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['active', 'cleared'], default: 'active', index: true },
    createdBy: { type: String, required: true },
    schedule: { type: [InstallmentScheduleSchema], required: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', default: null, index: true },
}, { timestamps: true });

InstallmentPlanSchema.index({ businessId: 1, planCode: 1 }, { unique: true });

export default mongoose.model<IInstallmentPlan>('InstallmentPlan', InstallmentPlanSchema);
