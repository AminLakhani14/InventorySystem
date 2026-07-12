import type { Request, Response } from 'express';
import Transaction from '../models/Transaction';
import Product from '../models/Product';
import CreditPayment from '../models/CreditPayment';
import Customer from '../models/Customer';
import type { AuthRequest } from '../middleware/auth';
import { buildTenantFilter } from '../utils/tenancy';

const startOfDay = (value: Date) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
};

const endOfDay = (value: Date) => {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
};

const resolveReportRange = (query: Request['query']) => {
    const period = String(query.period || '7days');
    const from = typeof query.from === 'string' ? query.from : '';
    const to = typeof query.to === 'string' ? query.to : '';

    if (period === 'custom' && from && to) {
        const fromDate = startOfDay(new Date(from));
        const toDate = endOfDay(new Date(to));

        if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
            throw new Error('Invalid date range');
        }

        if (fromDate > toDate) {
            throw new Error('From date must be before or equal to to date');
        }

        return { period, dateLimit: fromDate, endDate: toDate };
    }

    const daysByPeriod: Record<string, number> = {
        '7days': 7,
        monthly: 30,
        yearly: 365,
    };
    const days = daysByPeriod[period] || 7;
    const dateLimit = startOfDay(new Date());
    dateLimit.setDate(dateLimit.getDate() - (days - 1));
    return { period, dateLimit, endDate: endOfDay(new Date()) };
};

export const getSalesTrend = async (req: AuthRequest, res: Response) => {
    try {
        const { period, dateLimit, endDate } = resolveReportRange(req.query);
        const groupFormat = period === 'yearly' ? '%Y-%m' : '%Y-%m-%d';

        const stats = await Transaction.aggregate([
            {
                $match: {
                    ...buildTenantFilter(req.user!),
                    timestamp: { $gte: dateLimit, $lte: endDate },
                    type: 'reduction'
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: groupFormat, date: '$timestamp' } },
                    revenue: { $sum: '$totalPrice' },
                    sales: { $sum: '$amount' },
                    profit: { $sum: '$grossProfit' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getCategoryValuation = async (req: AuthRequest, res: Response) => {
    try {
        const valuation = await Product.aggregate([
            { $match: buildTenantFilter(req.user!) },
            {
                $group: {
                    _id: '$category',
                    value: { $sum: { $multiply: ['$stock', '$price'] } }
                }
            },
            { $sort: { value: -1 } }
        ]);

        res.json(valuation.map(v => ({ name: v._id, value: v.value })));
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getTopSellingProducts = async (req: AuthRequest, res: Response) => {
    try {
        const { dateLimit, endDate } = resolveReportRange(req.query);
        const topSelling = await Transaction.aggregate([
            {
                $match: {
                    ...buildTenantFilter(req.user!),
                    type: 'reduction',
                    timestamp: { $gte: dateLimit, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$productId',
                    name: { $first: '$productName' },
                    totalReduced: { $sum: '$amount' },
                    revenue: { $sum: '$totalPrice' },
                    profit: { $sum: '$grossProfit' }
                }
            },
            { $sort: { totalReduced: -1 } },
            { $limit: 10 }
        ]);

        res.json(topSelling);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getCustomerPaymentsReport = async (req: AuthRequest, res: Response) => {
    try {
        const { dateLimit, endDate } = resolveReportRange(req.query);
        const rows = await CreditPayment.aggregate([
            {
                $match: {
                    ...buildTenantFilter(req.user!),
                    timestamp: { $gte: dateLimit, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: {
                        customerName: '$customerName',
                        customerCnic: '$customerCnic',
                    },
                    totalReceived: { $sum: { $ifNull: ['$receivedAmount', '$amount'] } },
                    paymentCount: { $sum: 1 },
                    lastPaymentAt: { $max: '$timestamp' },
                },
            },
            { $sort: { totalReceived: -1 } },
        ]);

        res.json(rows.map((row) => ({
            customerName: row._id.customerName,
            customerCnic: row._id.customerCnic,
            totalReceived: row.totalReceived,
            paymentCount: row.paymentCount,
            lastPaymentAt: row.lastPaymentAt,
        })));
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to fetch customer payments report' });
    }
};

export const getCustomerPaymentDetails = async (req: AuthRequest, res: Response) => {
    try {
        const customerName = String(req.query.customerName || '').trim();
        const customerCnic = String(req.query.customerCnic || '').trim();
        if (!customerName) {
            return res.status(400).json({ message: 'Customer name is required' });
        }

        const { dateLimit, endDate } = resolveReportRange(req.query);
        const payments = await CreditPayment.find({
            ...buildTenantFilter(req.user!),
            customerName,
            customerCnic,
            timestamp: { $gte: dateLimit, $lte: endDate },
        })
            .sort({ timestamp: -1 })
            .lean();

        res.json(payments.map((payment) => ({
            id: payment._id,
            amount: payment.receivedAmount ?? payment.amount,
            paidVia: payment.paidVia,
            notes: payment.notes || '',
            timestamp: payment.timestamp,
        })));
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to fetch customer payment details' });
    }
};

export const getCollectionsDashboard = async (req: AuthRequest, res: Response) => {
    try {
        const selectedDate = typeof req.query.date === 'string' ? new Date(req.query.date) : new Date();
        if (Number.isNaN(selectedDate.getTime())) return res.status(400).json({ message: 'Invalid date' });
        const dayStart = startOfDay(selectedDate);
        const dayEnd = endOfDay(selectedDate);
        const tenant = buildTenantFilter(req.user!);

        const sevenDaysStart = startOfDay(new Date(selectedDate));
        sevenDaysStart.setDate(sevenDaysStart.getDate() - 6);
        const sevenMonthsStart = startOfDay(new Date(selectedDate));
        sevenMonthsStart.setMonth(sevenMonthsStart.getMonth() - 6, 1);

        const [sales, recoveries, creditSales, allPayments, customerBalances, sevenDayPayments, sevenDayOrderCreditPayments, sevenMonthPayments, sevenMonthOrderCreditPayments] = await Promise.all([
            Transaction.find({ ...tenant, type: 'reduction', timestamp: { $gte: dayStart, $lte: dayEnd } }).lean(),
            CreditPayment.find({ ...tenant, timestamp: { $gte: dayStart, $lte: dayEnd } }).lean(),
            Transaction.find({ ...tenant, type: 'reduction', paymentMethod: 'credit', dueAmount: { $gt: 0 } })
                .select('customerName customerCnic dueAmount')
                .lean(),
            CreditPayment.find(tenant).select('customerName customerCnic amount').lean(),
            Customer.find({ ...tenant, amount: { $gt: 0 } }).select('fullName cnic amount').lean(),
            CreditPayment.find({ ...tenant, timestamp: { $gte: sevenDaysStart, $lte: dayEnd }, notes: { $ne: 'Adjusted from Order Desk overpayment.' } }).select('timestamp amount receivedAmount').lean(),
            Transaction.find({ ...tenant, type: 'reduction', creditPaid: { $gt: 0 }, timestamp: { $gte: sevenDaysStart, $lte: dayEnd } }).select('timestamp creditPaid').lean(),
            CreditPayment.find({ ...tenant, timestamp: { $gte: sevenMonthsStart, $lte: dayEnd }, notes: { $ne: 'Adjusted from Order Desk overpayment.' } }).select('timestamp amount receivedAmount').lean(),
            Transaction.find({ ...tenant, type: 'reduction', creditPaid: { $gt: 0 }, timestamp: { $gte: sevenMonthsStart, $lte: dayEnd } }).select('timestamp creditPaid').lean(),
        ]);

        const buildRecoverySeries = (payments: any[], orderPayments: any[], format: 'day' | 'month') => {
            const totals = new Map<string, number>();
            const add = (timestamp: Date, amount: number) => {
                const date = new Date(timestamp);
                const key = format === 'day'
                    ? date.toISOString().slice(0, 10)
                    : date.toISOString().slice(0, 7);
                totals.set(key, Number((totals.get(key) || 0) + amount));
            };
            payments.forEach((payment) => add(payment.timestamp, Number(payment.receivedAmount ?? payment.amount ?? 0)));
            orderPayments.forEach((payment) => add(payment.timestamp, Number(payment.creditPaid || 0)));
            return Array.from(totals, ([_id, amount]) => ({ _id, amount })).sort((a, b) => a._id.localeCompare(b._id));
        };
        const sevenDayRecoveries = buildRecoverySeries(sevenDayPayments, sevenDayOrderCreditPayments, 'day');
        const sevenMonthRecoveries = buildRecoverySeries(sevenMonthPayments, sevenMonthOrderCreditPayments, 'month');

        const outstandingByCustomer = new Map<string, number>();
        const addOutstanding = (name: string, cnic: string, amount: number) => {
            const key = `${name.toLowerCase()}::${cnic.toLowerCase()}`;
            outstandingByCustomer.set(key, Number((outstandingByCustomer.get(key) || 0) + amount));
        };
        creditSales.forEach((sale) => addOutstanding(sale.customerName || '', sale.customerCnic || '', Number(sale.dueAmount || 0)));
        customerBalances.forEach((customer) => addOutstanding(customer.fullName, customer.cnic || '', Number(customer.amount || 0)));
        allPayments.forEach((payment) => addOutstanding(payment.customerName, payment.customerCnic || '', -Number(payment.amount || 0)));

        const customerMap = new Map<string, any>();
        sales.forEach((sale) => {
            const name = sale.customerName || 'Walk-in Customer';
            const cnic = sale.customerCnic || '';
            const key = `${name.toLowerCase()}::${cnic.toLowerCase()}`;
            const row = customerMap.get(key) || { customerName: name, customerCnic: cnic, cashCollection: 0, creditCollection: 0, salesAmount: 0, transactions: 0, methods: new Set<string>() };
            row.salesAmount += Number(sale.totalPrice || 0);
            row.transactions += 1;
            if (sale.paymentMethod === 'credit') {
                row.cashCollection += Number(sale.paidNow || 0);
                row.creditCollection += Number(sale.creditPaid || 0);
                row.methods.add('credit');
            } else {
                row.cashCollection += Number(sale.totalPrice || 0);
                row.methods.add('cash');
            }
            customerMap.set(key, row);
        });
        recoveries.forEach((payment) => {
            const key = `${payment.customerName.toLowerCase()}::${(payment.customerCnic || '').toLowerCase()}`;
            const row = customerMap.get(key) || { customerName: payment.customerName, customerCnic: payment.customerCnic || '', cashCollection: 0, creditCollection: 0, salesAmount: 0, transactions: 0, methods: new Set<string>() };
            // An Order Desk overpayment is already recorded on the sale as
            // creditPaid. Do not count its companion payment record twice.
            if (payment.notes !== 'Adjusted from Order Desk overpayment.') {
                row.creditCollection += Number(payment.receivedAmount ?? payment.amount ?? 0);
            }
            row.methods.add('credit');
            customerMap.set(key, row);
        });
        const customers = Array.from(customerMap.values()).map((row) => ({
            ...row,
            remainingAmount: Math.max(outstandingByCustomer.get(`${row.customerName.toLowerCase()}::${row.customerCnic.toLowerCase()}`) || 0, 0),
            customerType: row.methods.size > 1 ? 'cash-and-credit' : row.methods.has('credit') ? 'credit' : 'cash',
            totalCollection: row.cashCollection + row.creditCollection,
            methods: undefined,
        })).sort((a, b) => b.totalCollection - a.totalCollection);

        const cashCollection = customers.reduce((sum, row) => sum + row.cashCollection, 0);
        const creditCollection = customers.reduce((sum, row) => sum + row.creditCollection, 0);
        const salesRevenue = sales.reduce((sum, sale) => sum + Number(sale.totalPrice || 0), 0);
        res.json({
            selectedDate: dayStart,
            summary: {
                todaysCollection: cashCollection + creditCollection,
                cashCollection,
                creditCollection,
                salesRevenue,
                totalOutstanding: Array.from(outstandingByCustomer.values()).reduce((sum, amount) => sum + Math.max(amount, 0), 0),
                customerCount: customers.length,
                transactionCount: sales.length,
            },
            customers,
            last7Days: sevenDayRecoveries,
            last7Months: sevenMonthRecoveries,
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to load collections dashboard' });
    }
};

export const getCollectionCustomerDetails = async (req: AuthRequest, res: Response) => {
    try {
        const selectedDate = typeof req.query.date === 'string' ? new Date(req.query.date) : new Date();
        const customerName = String(req.query.customerName || '').trim();
        const customerCnic = String(req.query.customerCnic || '').trim();
        if (!customerName) return res.status(400).json({ message: 'Customer name is required' });
        const range = { $gte: startOfDay(selectedDate), $lte: endOfDay(selectedDate) };
        const tenant = buildTenantFilter(req.user!);
        const customerFilter = customerName === 'Walk-in Customer'
            ? { customerName: { $in: ['', null] } }
            : { customerName, customerCnic };
        const [sales, payments] = await Promise.all([
            Transaction.find({ ...tenant, ...customerFilter, type: 'reduction', timestamp: range }).sort({ timestamp: -1 }).lean(),
            customerName === 'Walk-in Customer' ? [] : CreditPayment.find({ ...tenant, customerName, customerCnic, timestamp: range }).sort({ timestamp: -1 }).lean(),
        ]);
        res.json([
            ...sales.map((sale) => ({ id: sale._id, timestamp: sale.timestamp, recordType: 'sale', description: sale.productName, paymentMethod: sale.paymentMethod, amount: sale.paymentMethod === 'credit' ? Number(sale.paidNow || 0) : Number(sale.totalPrice || 0), saleAmount: sale.totalPrice })),
            ...sales
                .filter((sale) => Number(sale.creditPaid || 0) > 0)
                .map((sale) => ({ id: `${sale._id}-credit-payment`, timestamp: sale.timestamp, recordType: 'recovery', description: 'Paid toward previous credit', paymentMethod: sale.paidVia || 'cash', amount: Number(sale.creditPaid || 0), saleAmount: 0 })),
            ...payments
                .filter((payment) => payment.notes !== 'Adjusted from Order Desk overpayment.')
                .map((payment) => ({ id: payment._id, timestamp: payment.timestamp, recordType: 'recovery', description: payment.notes || 'Credit payment received', paymentMethod: payment.paidVia, amount: Number(payment.receivedAmount ?? payment.amount ?? 0), saleAmount: 0 })),
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to load customer collection details' });
    }
};
