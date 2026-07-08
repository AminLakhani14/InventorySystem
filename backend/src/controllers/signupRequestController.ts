import { Response } from 'express';
import SignupRequest from '../models/SignupRequest';
import User from '../models/User';
import Business from '../models/Business';
import type { AuthRequest } from '../middleware/auth';

const sendSignupDecisionEmail = async (to: string, payload: Record<string, unknown>) => {
    const endpoint = process.env.SIGNUP_EMAIL_FUNCTION_URL || process.env.EMAIL_FUNCTION_URL;
    if (!endpoint) return;

    try {
        await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, ...payload }),
        });
    } catch (error) {
        console.error('Signup decision email failed:', error);
    }
};

export const createSignupRequest = async (req: AuthRequest, res: Response) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const [existingUser, pendingRequest] = await Promise.all([
            User.exists({ email }),
            SignupRequest.exists({ email, status: 'pending' }),
        ]);

        if (existingUser) {
            return res.status(400).json({ message: 'An account already exists for this email' });
        }

        if (pendingRequest) {
            return res.status(400).json({ message: 'A signup request is already pending for this email' });
        }

        const request = await SignupRequest.create({
            fullName: String(req.body.fullName || '').trim(),
            email,
            password: String(req.body.password || ''),
            businessName: String(req.body.businessName || '').trim(),
            packageId: req.body.packageId,
            packageName: req.body.packageName,
            country: req.body.country,
            currency: req.body.currency,
            businessType: String(req.body.businessType || '').trim(),
            phone: String(req.body.phone || '').trim(),
            employeeCount: Number(req.body.employeeCount || 1),
            address: String(req.body.address || '').trim(),
            notes: String(req.body.notes || '').trim(),
        });

        return res.status(201).json({
            message: 'Signup request submitted successfully',
            requestId: request._id,
        });
    } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Failed to submit signup request' });
    }
};

export const getSignupRequests = async (_req: AuthRequest, res: Response) => {
    try {
        const requests = await SignupRequest.find()
            .select('-password')
            .sort({ status: 1, createdAt: -1 });

        return res.json(requests);
    } catch (error: any) {
        return res.status(500).json({ message: error.message || 'Failed to fetch signup requests' });
    }
};

export const decideSignupRequest = async (req: AuthRequest, res: Response) => {
    try {
        const request = await SignupRequest.findById(req.params.id).select('+password');

        if (!request) {
            return res.status(404).json({ message: 'Signup request not found' });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'This signup request has already been reviewed' });
        }

        const status = req.body.status;
        const decisionNote = String(req.body.decisionNote || '').trim();

        request.status = status;
        request.decisionNote = decisionNote;
        request.reviewedBy = req.user?.id as any;
        request.reviewedByName = req.user?.name || '';
        request.reviewedAt = new Date();

        if (status === 'approved') {
            const existingUser = await User.exists({ email: request.email });
            if (existingUser) {
                return res.status(400).json({ message: 'An account already exists for this email' });
            }

            const business = await Business.create({
                name: request.businessName,
                slug: `store-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                createdBy: req.user?.id,
            });

            const user = await User.create({
                name: request.fullName,
                email: request.email,
                password: request.password,
                visiblePassword: request.password,
                role: 'admin',
                createdBy: req.user?.id,
                businessId: business._id,
                preferences: {
                    country: request.country,
                    currency: request.currency,
                    notifications: {
                        orderUpdates: true,
                        lowStockAlerts: true,
                    },
                },
            });

            request.createdUserId = user._id as any;
            request.createdBusinessId = business._id as any;

            await sendSignupDecisionEmail(request.email, {
                subject: 'Your ItemHive account is approved',
                status: 'approved',
                name: request.fullName,
                businessName: request.businessName,
                packageName: request.packageName,
                country: request.country,
                currency: request.currency,
                loginEmail: request.email,
                password: request.password,
                note: decisionNote,
            });
        } else {
            await sendSignupDecisionEmail(request.email, {
                subject: 'Your ItemHive signup request update',
                status: 'rejected',
                name: request.fullName,
                businessName: request.businessName,
                note: decisionNote,
            });
        }

        await request.save();

        return res.json({
            message: `Signup request ${request.status} successfully`,
            request,
        });
    } catch (error: any) {
        return res.status(400).json({ message: error.message || 'Failed to review signup request' });
    }
};
