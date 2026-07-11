import { Request, Response } from 'express';
import Transaction from '../models/Transaction';
import CreditPayment from '../models/CreditPayment';
import Customer from '../models/Customer';
import type { AuthRequest } from '../middleware/auth';
import { buildTenantFilter, getTenantObjectId, type TenantContext } from '../utils/tenancy';

const buildCustomerKey = (customerName: string, customerCnic: string) =>
    `${customerName.trim().toLowerCase()}::${customerCnic.trim().toLowerCase()}`;

interface OutstandingCreditCustomer {
    customerName: string;
    customerCnic: string;
    totalInvoices: number;
    totalSoldAmount: number;
    totalPaidAtSale: number;
    totalCreditIssued: number;
    totalRecovered: number;
    closingBalance: number;
    outstandingAmount: number;
    lastSaleAt: Date | null;
    lastPaymentAt: Date | null;
    nextDueDate: Date | null;
}

const getOutstandingCreditCustomers = async (tenant: TenantContext): Promise<OutstandingCreditCustomer[]> => {
    const tenantFilter = buildTenantFilter(tenant);
    const [creditSales, payments, closingBalanceCustomers] = await Promise.all([
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
            { $sort: { timestamp: -1 } },
            {
                $group: {
                    _id: {
                        customerName: '$customerName',
                        customerCnic: '$customerCnic',
                    },
                    totalRecovered: { $sum: '$amount' },
                    lastPaymentAt: { $max: '$timestamp' },
                    latestNextDueDate: { $first: '$nextDueDate' },
                }
            }
        ]),
        // "Closing Amount" on a customer profile is a manually-tracked balance owed
        // (e.g. carried over from a paper ledger) and applies regardless of customerType.
        Customer.find({ ...tenantFilter, amount: { $gt: 0 } })
            .select('fullName cnic amount')
            .lean(),
    ]);

    const paymentMap = new Map(
        payments.map((entry) => [
            buildCustomerKey(entry._id.customerName, entry._id.customerCnic),
            entry,
        ])
    );

    const closingBalanceMap = new Map(
        closingBalanceCustomers.map((customer) => [
            buildCustomerKey(customer.fullName, customer.cnic || ''),
            customer,
        ])
    );

    const combined = new Map<string, OutstandingCreditCustomer>();

    creditSales.forEach((sale) => {
        const key = buildCustomerKey(sale._id.customerName, sale._id.customerCnic);
        const payment = paymentMap.get(key);
        const totalRecovered = Number(payment?.totalRecovered || 0);
        const closingBalance = Number(closingBalanceMap.get(key)?.amount || 0);
        const totalCreditIssued = Number(sale.totalCreditIssued || 0) + closingBalance;

        combined.set(key, {
            customerName: sale._id.customerName,
            customerCnic: sale._id.customerCnic,
            totalInvoices: Number(sale.totalInvoices || 0),
            totalSoldAmount: Number(sale.totalSoldAmount || 0),
            totalPaidAtSale: Number(sale.totalPaidAtSale || 0),
            totalCreditIssued,
            totalRecovered,
            closingBalance,
            outstandingAmount: Math.max(totalCreditIssued - totalRecovered, 0),
            lastSaleAt: sale.lastSaleAt,
            lastPaymentAt: payment?.lastPaymentAt || null,
            nextDueDate: payment?.latestNextDueDate || null,
        });
    });

    closingBalanceCustomers.forEach((customer) => {
        const key = buildCustomerKey(customer.fullName, customer.cnic || '');
        if (combined.has(key)) return;

        const payment = paymentMap.get(key);
        const totalRecovered = Number(payment?.totalRecovered || 0);
        const closingBalance = Number(customer.amount || 0);

        combined.set(key, {
            customerName: customer.fullName,
            customerCnic: customer.cnic || '',
            totalInvoices: 0,
            totalSoldAmount: 0,
            totalPaidAtSale: 0,
            totalCreditIssued: closingBalance,
            totalRecovered,
            closingBalance,
            outstandingAmount: Math.max(closingBalance - totalRecovered, 0),
            lastSaleAt: null,
            lastPaymentAt: payment?.lastPaymentAt || null,
            nextDueDate: payment?.latestNextDueDate || null,
        });
    });

    return Array.from(combined.values())
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

        const timestamp = req.body.paymentDate ? new Date(req.body.paymentDate) : new Date();
        if (Number.isNaN(timestamp.getTime())) {
            return res.status(400).json({ message: 'Invalid payment date' });
        }

        let nextDueDate: Date | null = null;
        if (req.body.nextDueDate) {
            nextDueDate = new Date(req.body.nextDueDate);
            if (Number.isNaN(nextDueDate.getTime())) {
                return res.status(400).json({ message: 'Invalid due date for the remaining balance' });
            }
        }

        // Pay down the customer's Closing Amount first (so that visible balance
        // actually decreases), then record whatever is left as a credit payment
        // against their unpaid credit-sale transactions.
        const tenantFilter = buildTenantFilter(req.user!);
        const customerDocs = await Customer.find(tenantFilter).select('fullName cnic amount').lean();
        const customerDoc = customerDocs.find(
            (doc) => buildCustomerKey(doc.fullName, doc.cnic || '') === buildCustomerKey(customerName, customerCnic)
        );

        const closingAmount = Number(customerDoc?.amount || 0);
        const closingPayoff = Math.min(amount, closingAmount);
        const remainingAmount = Number((amount - closingPayoff).toFixed(2));

        if (closingPayoff > 0 && customerDoc) {
            await Customer.updateOne(
                { _id: customerDoc._id },
                { $set: { amount: Math.max(closingAmount - closingPayoff, 0) } }
            );
        }

        const payment = await CreditPayment.create({
            customerName,
            customerCnic,
            amount: remainingAmount,
            paidVia,
            receivedBy: req.user?.id || 'unknown',
            notes,
            timestamp,
            nextDueDate,
            businessId: getTenantObjectId(req.user!),
        });

        res.status(201).json(payment);
    } catch (error: any) {
        res.status(400).json({ message: error.message || 'Failed to record payment' });
    }
};
