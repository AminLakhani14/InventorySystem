import { Request, Response } from 'express';
import Transaction from '../models/Transaction';
import CreditPayment from '../models/CreditPayment';
import type { AuthRequest } from '../middleware/auth';
import { buildTenantFilter, getTenantObjectId, type TenantContext } from '../utils/tenancy';

const buildCustomerKey = (customerName: string, customerCnic: string) =>
    `${customerName.trim().toLowerCase()}::${customerCnic.trim().toLowerCase()}`;

const getOutstandingCreditCustomers = async (tenant: TenantContext) => {
    const tenantFilter = buildTenantFilter(tenant);
    const [creditSales, payments] = await Promise.all([
        Transaction.aggregate([
            {
                $match: {
                    ...tenantFilter,
                    paymentMethod: 'credit',
                    type: 'reduction',
                    dueAmount: { $gt: 0 },
                    customerName: { $nin: ['', null] },
                    customerCnic: { $nin: ['', null] },
                }
            },
            {
                $group: {
                    _id: {
                        customerName: '$customerName',
                        customerCnic: '$customerCnic',
                    },
                    totalInvoices: { $sum: 1 },
                    totalCreditIssued: { $sum: '$dueAmount' },
                    totalSoldAmount: { $sum: '$totalPrice' },
                    totalPaidAtSale: { $sum: '$paidNow' },
                    lastSaleAt: { $max: '$timestamp' },
                }
            }
        ]),
        CreditPayment.aggregate([
            { $match: tenantFilter },
            {
                $group: {
                    _id: {
                        customerName: '$customerName',
                        customerCnic: '$customerCnic',
                    },
                    totalRecovered: { $sum: '$amount' },
                    lastPaymentAt: { $max: '$timestamp' },
                }
            }
        ])
    ]);

    const paymentMap = new Map(
        payments.map((entry) => [
            buildCustomerKey(entry._id.customerName, entry._id.customerCnic),
            entry,
        ])
    );

    return creditSales
        .map((sale) => {
            const payment = paymentMap.get(buildCustomerKey(sale._id.customerName, sale._id.customerCnic));
            const totalRecovered = Number(payment?.totalRecovered || 0);
            const outstandingAmount = Math.max(Number(sale.totalCreditIssued || 0) - totalRecovered, 0);

            return {
                customerName: sale._id.customerName,
                customerCnic: sale._id.customerCnic,
                totalInvoices: Number(sale.totalInvoices || 0),
                totalSoldAmount: Number(sale.totalSoldAmount || 0),
                totalPaidAtSale: Number(sale.totalPaidAtSale || 0),
                totalCreditIssued: Number(sale.totalCreditIssued || 0),
                totalRecovered,
                outstandingAmount,
                lastSaleAt: sale.lastSaleAt,
                lastPaymentAt: payment?.lastPaymentAt || null,
            };
        })
        .filter((customer) => customer.outstandingAmount > 0)
        .sort((a, b) => b.outstandingAmount - a.outstandingAmount);
};

export const getCreditCustomers = async (req: AuthRequest, res: Response) => {
    try {
        const customers = await getOutstandingCreditCustomers(req.user!);
        res.json(customers);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to fetch credit customers' });
    }
};

export const createCreditPayment = async (req: AuthRequest, res: Response) => {
    try {
        const customerName = String(req.body.customerName || '').trim();
        const customerCnic = String(req.body.customerCnic || '').trim();
        const amount = Number(req.body.amount || 0);
        const paidVia = req.body.paidVia;
        const notes = String(req.body.notes || '').trim();

        const customers = await getOutstandingCreditCustomers(req.user!);
        const customer = customers.find((entry) =>
            buildCustomerKey(entry.customerName, entry.customerCnic) === buildCustomerKey(customerName, customerCnic)
        );

        if (!customer) {
            return res.status(404).json({ message: 'Credit customer not found or already cleared' });
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ message: 'Payment amount must be greater than zero' });
        }

        if (amount > customer.outstandingAmount) {
            return res.status(400).json({
                message: `Payment cannot exceed outstanding amount of ${customer.outstandingAmount}`,
            });
        }

        const payment = await CreditPayment.create({
            customerName,
            customerCnic,
            amount,
            paidVia,
            receivedBy: req.user?.id || 'unknown',
            notes,
            businessId: getTenantObjectId(req.user!),
        });

        res.status(201).json(payment);
    } catch (error: any) {
        res.status(400).json({ message: error.message || 'Failed to record payment' });
    }
};
