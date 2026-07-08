import mongoose, { Schema, Document } from 'mongoose';

export interface IStickyNote extends Document {
    user: mongoose.Types.ObjectId;
    title: string;
    body: string;
    color: string;
    pinned: boolean;
    createdAt: Date;
    updatedAt: Date;
    businessId?: mongoose.Types.ObjectId;
}

const StickyNoteSchema: Schema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        title: { type: String, default: 'Untitled' },
        body: { type: String, default: '' },
        color: { type: String, default: '#FDE68A' },
        pinned: { type: Boolean, default: false },
        businessId: { type: Schema.Types.ObjectId, ref: 'Business', default: null, index: true },
    },
    { timestamps: true }
);

export default mongoose.model<IStickyNote>('StickyNote', StickyNoteSchema);
