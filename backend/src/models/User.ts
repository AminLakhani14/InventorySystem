import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { normalizeRole, USER_ROLES, type UserRole } from '../utils/accessControl';

export interface IUser extends Document {
    name: string;
    email: string;
    password?: string;
    visiblePassword?: string;
    role: UserRole;
    avatar?: string;
    isActive: boolean;
    isVisible: boolean;
    installmentAccess: boolean;
    userCreationLimit: number;
    createdBy?: mongoose.Types.ObjectId;
    businessId?: mongoose.Types.ObjectId;
    preferences: {
        country: 'PK' | 'US' | 'DE' | 'GB' | 'CH' | 'CD' | 'CG' | 'IN' | 'AE';
        currency: 'USD' | 'EUR' | 'GBP' | 'CHF' | 'CDF' | 'XAF' | 'PKR' | 'INR' | 'AED';
        notifications: {
            orderUpdates: boolean;
            lowStockAlerts: boolean;
        };
    };
    comparePassword: (password: string) => Promise<boolean>;
}

const UserSchema: Schema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, select: false },
    visiblePassword: { type: String, select: false },
    role: { type: String, enum: USER_ROLES, default: 'user' },
    avatar: { type: String },
    isActive: { type: Boolean, default: true, index: true },
    isVisible: { type: Boolean, default: true, index: true },
    installmentAccess: { type: Boolean, default: false },
    userCreationLimit: { type: Number, default: 0, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', default: null, index: true },
    preferences: {
        country: { type: String, enum: ['PK', 'US', 'DE', 'GB', 'CH', 'CD', 'CG', 'IN', 'AE'], default: 'PK' },
        currency: { type: String, enum: ['USD', 'EUR', 'GBP', 'CHF', 'CDF', 'XAF', 'PKR', 'INR', 'AED'], default: 'PKR' },
        notifications: {
            orderUpdates: { type: Boolean, default: true },
            lowStockAlerts: { type: Boolean, default: true },
        },
    },
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function (this: any) {
    this.role = normalizeRole(this.role);
    this.email = String(this.email || '').trim().toLowerCase();

    if (!this.isModified('password') || !this.password) return;
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (err: any) {
        throw err;
    }
});

UserSchema.methods.comparePassword = async function (canditatePassword: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(canditatePassword, this.password);
};

export default mongoose.model<IUser>('User', UserSchema);
