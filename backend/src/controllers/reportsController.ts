import type { Request, Response } from 'express';
import Transaction from '../models/Transaction';
import Product from '../models/Product';
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
