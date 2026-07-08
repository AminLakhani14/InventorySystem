import { Response } from 'express';
import StickyNote from '../models/StickyNote';
import type { AuthRequest } from '../middleware/auth';
import { buildTenantFilter, getTenantObjectId } from '../utils/tenancy';

const sanitizeText = (value: unknown) => String(value ?? '').trim();

export const getNotes = async (req: AuthRequest, res: Response) => {
    try {
        const notes = await StickyNote.find({ user: req.user?.id, ...buildTenantFilter(req.user!) }).sort({ pinned: -1, updatedAt: -1 });
        return res.json(notes);
    } catch (error: any) {
        return res.status(500).json({ message: error.message || 'Failed to fetch notes' });
    }
};

export const createNote = async (req: AuthRequest, res: Response) => {
    try {
        const title = sanitizeText(req.body.title);
        const body = sanitizeText(req.body.body);
        const color = sanitizeText(req.body.color) || '#FDE68A';

        if (!title && !body) {
            return res.status(400).json({ message: 'Provide a title or note body' });
        }

        const note = await StickyNote.create({
            user: req.user?.id,
            title: title || 'Untitled',
            body,
            color,
            pinned: Boolean(req.body.pinned),
            businessId: getTenantObjectId(req.user!),
        });

        return res.status(201).json(note);
    } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Failed to create note' });
    }
};

export const updateNote = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const updates: Record<string, any> = {};

        if (req.body.title !== undefined) {
            updates.title = sanitizeText(req.body.title) || 'Untitled';
        }
        if (req.body.body !== undefined) {
            updates.body = sanitizeText(req.body.body);
        }
        if (req.body.color !== undefined) {
            updates.color = sanitizeText(req.body.color) || '#FDE68A';
        }
        if (req.body.pinned !== undefined) {
            updates.pinned = Boolean(req.body.pinned);
        }

        if (req.body.title !== undefined && req.body.body !== undefined) {
            const nextTitle = sanitizeText(req.body.title);
            const nextBody = sanitizeText(req.body.body);
            if (!nextTitle && !nextBody) {
                return res.status(400).json({ message: 'Provide a title or note body' });
            }
        }

        const note = await StickyNote.findOneAndUpdate(
            { _id: id, user: req.user?.id, ...buildTenantFilter(req.user!) },
            { $set: updates },
            { new: true }
        );

        if (!note) {
            return res.status(404).json({ message: 'Note not found' });
        }

        return res.json(note);
    } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Failed to update note' });
    }
};

export const deleteNote = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const note = await StickyNote.findOneAndDelete({ _id: id, user: req.user?.id, ...buildTenantFilter(req.user!) });
        if (!note) {
            return res.status(404).json({ message: 'Note not found' });
        }
        return res.json({ message: 'Note deleted' });
    } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Failed to delete note' });
    }
};
