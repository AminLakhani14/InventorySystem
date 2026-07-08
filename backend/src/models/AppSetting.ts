import mongoose, { Schema, Document } from 'mongoose';

export interface IAppSetting extends Document {
    key: string;
    businessId?: mongoose.Types.ObjectId;
    salesTaxRate: number;
    shopName: string;
    shopPhone: string;
    shopAddress: string;
    installmentsEnabled: boolean;
}

const AppSettingSchema: Schema<IAppSetting> = new Schema({
    key: { type: String, required: true, unique: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', default: null, index: true },
    salesTaxRate: { type: Number, default: 0, min: 0, max: 100 },
    shopName: { type: String, default: 'ItemHive POS', trim: true },
    shopPhone: { type: String, default: '', trim: true },
    shopAddress: { type: String, default: '', trim: true },
    installmentsEnabled: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model<IAppSetting>('AppSetting', AppSettingSchema);
