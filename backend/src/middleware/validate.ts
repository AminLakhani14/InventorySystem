import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { USER_ROLES } from '../utils/accessControl';

/**
 * Express middleware factory for validating request body against a Joi schema.
 */
export const validate = (schema: Joi.ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
        });
        if (error) {
            const details = error.details.map((d) => d.message).join(', ');
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed',
                details,
                code: 'VALIDATION_ERROR',
            });
        }
        req.body = value;
        next();
    };
};

// --- Schemas ---

export const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
});

export const registerSchema = Joi.object({
    name: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string()
        .valid(...USER_ROLES)
        .optional(),
    businessName: Joi.string().min(2).max(120).optional(),
    businessId: Joi.string().allow('').optional(),
});

export const signupRequestSchema = Joi.object({
    fullName: Joi.string().min(2).max(120).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    businessName: Joi.string().min(2).max(120).required(),
    packageId: Joi.string().valid('free_trial', 'starter', 'pro').required(),
    packageName: Joi.string().min(2).max(80).required(),
    country: Joi.string().valid('PK', 'US', 'DE', 'GB', 'CH', 'CD', 'CG', 'IN', 'AE').required(),
    currency: Joi.string().valid('USD', 'EUR', 'GBP', 'CHF', 'CDF', 'XAF', 'PKR', 'INR', 'AED').required(),
    businessType: Joi.string().allow('').max(120).optional(),
    phone: Joi.string().allow('').max(60).optional(),
    employeeCount: Joi.number().integer().min(1).max(100000).required(),
    address: Joi.string().allow('').max(240).optional(),
    notes: Joi.string().allow('').max(600).optional(),
});

export const signupRequestDecisionSchema = Joi.object({
    status: Joi.string().valid('approved', 'rejected').required(),
    decisionNote: Joi.string().allow('').max(600).optional(),
});

export const productSchema = Joi.object({
    id: Joi.string().required(),
    sku: Joi.string().required(),
    name: Joi.string().min(2).required(),
    category: Joi.string().required(),
    purchasePrice: Joi.number().min(0).required(),
    salePrice: Joi.number().min(0).required(),
    price: Joi.number().min(0).optional(),
    stock: Joi.number().min(0).required(),
    minStock: Joi.number().min(0).optional(),
    productUnitCode: Joi.string().allow('').max(40).optional(),
    productUnit: Joi.string().allow('').max(80).optional(),
    productUnitUrdu: Joi.string().allow('').max(80).optional(),
    description: Joi.string().allow('').optional(),
    imageUrl: Joi.string().allow('').optional(),
    batchNumber: Joi.string().allow('').optional(),
    expiryDate: Joi.string().allow('').optional(),
    supplier: Joi.string().allow('').optional(),
});

export const creditPaymentSchema = Joi.object({
    customerName: Joi.string().min(2).required(),
    customerCnic: Joi.string().allow('').max(80).optional().default(''),
    amount: Joi.number().positive().required(),
    paidVia: Joi.string().valid('cash', 'card').required(),
    notes: Joi.string().allow('').optional(),
    paymentDate: Joi.date().optional(),
    nextDueDate: Joi.date().allow(null).optional(),
});

export const customerSchema = Joi.object({
    fullName: Joi.string().min(2).max(120).required(),
    cnic: Joi.string().allow('').max(40).optional(),
    phoneNumber: Joi.string().min(5).max(60).required(),
    amount: Joi.number().min(0).required(),
    email: Joi.string().email().allow('').max(120).optional(),
    address: Joi.string().allow('').max(240).optional(),
    province: Joi.string().allow('').max(80).optional(),
    city: Joi.string().allow('').max(80).optional(),
    customerType: Joi.string().valid('regular', 'credit', 'installment', 'wholesale').required(),
    status: Joi.string().valid('active', 'inactive').required(),
    notes: Joi.string().allow('').max(600).optional(),
});

export const installmentPlanSchema = Joi.object({
    planCode: Joi.string().required(),
    productId: Joi.string().required(),
    productName: Joi.string().min(2).required(),
    amount: Joi.number().integer().positive().required(),
    totalAmount: Joi.number().positive().required(),
    unitPrice: Joi.number().positive().required(),
    advancePayment: Joi.number().min(0).required(),
    customerName: Joi.string().min(2).required(),
    customerCnic: Joi.string().min(5).required(),
    customerPhone: Joi.string().min(5).required(),
    customerAddress: Joi.string().min(5).required(),
    saleDate: Joi.date().required(),
    installmentMonths: Joi.number().valid(3, 6, 9, 12).required(),
    userName: Joi.string().min(2).required(),
    witnesses: Joi.array()
        .length(2)
        .items(
            Joi.object({
                name: Joi.string().min(2).required(),
                cnic: Joi.string().min(5).required(),
                address: Joi.string().min(5).required(),
            }),
        )
        .required(),
});

export const installmentPaymentSchema = Joi.object({
    installmentNumber: Joi.number().integer().positive().required(),
    paidVia: Joi.string().valid('cash', 'card').required(),
    notes: Joi.string().allow('').optional(),
});

export const settingsSchema = Joi.object({
    country: Joi.string().valid('PK', 'US', 'DE', 'GB', 'CH', 'CD', 'CG', 'IN', 'AE').required(),
    currency: Joi.string().valid('USD', 'EUR', 'GBP', 'CHF', 'CDF', 'XAF', 'PKR', 'INR', 'AED').required(),
    notifications: Joi.object({
        orderUpdates: Joi.boolean().required(),
        lowStockAlerts: Joi.boolean().required(),
    }).required(),
    app: Joi.object({
        salesTaxRate: Joi.number().min(0).max(100).required(),
        shopName: Joi.string().allow('').max(120).required(),
        shopPhone: Joi.string().allow('').max(60).required(),
        shopAddress: Joi.string().allow('').max(240).required(),
        installmentsEnabled: Joi.boolean().required(),
    }).optional(),
});

export const updateUserStatusSchema = Joi.object({
    isActive: Joi.boolean().optional(),
    isVisible: Joi.boolean().optional(),
    installmentAccess: Joi.boolean().optional(),
}).or('isActive', 'isVisible', 'installmentAccess');

export const updateAdminLimitSchema = Joi.object({
    userCreationLimit: Joi.number().integer().min(0).required(),
});

export const updateUserAccountSchema = Joi.object({
    name: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).allow('').optional(),
    role: Joi.string()
        .valid(...USER_ROLES)
        .optional(),
    businessId: Joi.string().allow('').optional(),
});

export const inventoryRequestDecisionSchema = Joi.object({
    status: Joi.string().valid('approved', 'rejected').required(),
    decisionNote: Joi.string().allow('').optional(),
});

export const noteCreateSchema = Joi.object({
    title: Joi.string().allow('').optional(),
    body: Joi.string().allow('').optional(),
    color: Joi.string().allow('').optional(),
    pinned: Joi.boolean().optional(),
});

export const noteUpdateSchema = Joi.object({
    title: Joi.string().allow('').optional(),
    body: Joi.string().allow('').optional(),
    color: Joi.string().allow('').optional(),
    pinned: Joi.boolean().optional(),
});
