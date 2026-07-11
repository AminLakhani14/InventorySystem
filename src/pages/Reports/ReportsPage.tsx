import React, { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Alert,
    Button,
    ButtonGroup,
    Stack,
    TextField,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { ArrowLeft, Download, TrendingDown, BarChart as BarChartIcon } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import useAppCurrency from '../../hooks/useAppCurrency';
import api from '../../api/axios';
import { fetchProducts } from '../../features/inventory/inventorySlice';
import { fetchCategoryValuation, fetchSalesTrend, fetchTopSellingProducts, type ReportFilters, type ReportPeriod } from '../../features/reports/reportSlice';

const ReportsPage: React.FC = () => {
    const theme = useTheme();
    const dispatch = useDispatch<AppDispatch>();
    const { products } = useSelector((state: RootState) => state.inventory);
    const { salesTrend, categoryValuation, topSelling, error } = useSelector((state: RootState) => state.reports);
    const { currency, formatCurrency } = useAppCurrency();
    const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('7days');
    const [generatedFilters, setGeneratedFilters] = useState<ReportFilters>({
        period: '7days',
    });
    const [fromDate, setFromDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 6);
        return date.toISOString().split('T')[0];
    });
    const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [customerPayments, setCustomerPayments] = useState<Array<{
        customerName: string;
        customerCnic: string;
        totalReceived: number;
        paymentCount: number;
        lastPaymentAt: string;
    }>>([]);
    const [paymentReportError, setPaymentReportError] = useState('');
    const [selectedPaymentCustomer, setSelectedPaymentCustomer] = useState<(typeof customerPayments)[number] | null>(null);
    const [customerPaymentDetails, setCustomerPaymentDetails] = useState<Array<{
        id: string;
        amount: number;
        paidVia: string;
        notes: string;
        timestamp: string;
    }>>([]);
    const [paymentDetailsLoading, setPaymentDetailsLoading] = useState(false);

    const loadCustomerPayments = async (filters: ReportFilters) => {
        try {
            setPaymentReportError('');
            const response = await api.get('/reports/customer-payments', { params: filters });
            setCustomerPayments(response.data || []);
        } catch (requestError: any) {
            setPaymentReportError(requestError.response?.data?.message || 'Failed to load customer payment report.');
        }
    };

    const openCustomerPaymentDetails = async (customer: (typeof customerPayments)[number]) => {
        setSelectedPaymentCustomer(customer);
        setPaymentDetailsLoading(true);
        setPaymentReportError('');
        try {
            const response = await api.get('/reports/customer-payments/details', {
                params: {
                    ...generatedFilters,
                    customerName: customer.customerName,
                    customerCnic: customer.customerCnic,
                },
            });
            setCustomerPaymentDetails(response.data || []);
        } catch (requestError: any) {
            setPaymentReportError(requestError.response?.data?.message || 'Failed to load payment details.');
            setCustomerPaymentDetails([]);
        } finally {
            setPaymentDetailsLoading(false);
        }
    };

    const closeCustomerPaymentDetails = () => {
        setSelectedPaymentCustomer(null);
        setCustomerPaymentDetails([]);
    };

    const downloadCustomerPaymentsReport = () => {
        const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const rows = selectedPaymentCustomer
            ? [
                ['Date', 'Customer', 'CNIC / ID', 'Amount Received', 'Paid Via', 'Notes'],
                ...customerPaymentDetails.map((payment) => [
                    new Date(payment.timestamp).toLocaleString(),
                    selectedPaymentCustomer.customerName,
                    selectedPaymentCustomer.customerCnic,
                    payment.amount,
                    payment.paidVia,
                    payment.notes,
                ]),
            ]
            : [
                ['Customer', 'CNIC / ID', 'Payment Count', 'Last Payment', 'Total Received'],
                ...customerPayments.map((customer) => [
                    customer.customerName,
                    customer.customerCnic,
                    customer.paymentCount,
                    new Date(customer.lastPaymentAt).toLocaleString(),
                    customer.totalReceived,
                ]),
                ['TOTAL', '', '', '', totalCustomerPayments],
            ];
        const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        link.download = selectedPaymentCustomer
            ? `${selectedPaymentCustomer.customerName}-payment-details.csv`
            : `customer-payment-recovery-${generatedFilters.period}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    useEffect(() => {
        dispatch(fetchProducts());
        dispatch(fetchSalesTrend({ period: '7days' }));
        dispatch(fetchCategoryValuation());
        dispatch(fetchTopSellingProducts({ period: '7days' }));
        loadCustomerPayments({ period: '7days' });
    }, [dispatch]);

    const runReport = (filters: ReportFilters) => {
        dispatch(fetchSalesTrend(filters));
        dispatch(fetchTopSellingProducts(filters));
        loadCustomerPayments(filters);
        setGeneratedFilters(filters);
        closeCustomerPaymentDetails();
    };

    const buildFilters = (): ReportFilters => (selectedPeriod === 'custom' ? { period: 'custom', from: fromDate, to: toDate } : { period: selectedPeriod });

    const handlePeriodChange = (period: ReportPeriod) => {
        setSelectedPeriod(period);
        if (period !== 'custom') {
            runReport({ period });
        }
    };

    const handleGenerateReport = () => {
        const filters = buildFilters();
        if (filters.period === 'custom' && (!filters.from || !filters.to)) {
            return;
        }
        runReport(filters);
    };

    const reportHeading = useMemo(() => {
        if (generatedFilters.period === 'monthly') return 'Monthly (Last 30 Days)';
        if (generatedFilters.period === 'yearly') return 'Yearly (Last 12 Months)';
        if (generatedFilters.period === 'custom') {
            return `${generatedFilters.from || fromDate} to ${generatedFilters.to || toDate}`;
        }
        return 'Last 7 Days';
    }, [fromDate, generatedFilters, toDate]);

    const reportPalette = useMemo(
        () => [theme.palette.primary.main, theme.palette.secondary.main, theme.palette.success.main, theme.palette.warning.main, '#0ea5e9', '#a855f7'],
        [theme.palette],
    );

    const trendData = useMemo(() => {
        if (generatedFilters.period === 'yearly') {
            return [...Array(12)].map((_, i) => {
                const d = new Date();
                d.setMonth(d.getMonth() - (11 - i), 1);
                const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const monthLabel = d.toLocaleDateString('en-US', {
                    month: 'short',
                    year: '2-digit',
                });
                const point = salesTrend.find((entry) => entry._id === monthKey);
                return {
                    name: monthLabel,
                    revenue: point?.revenue || 0,
                    sales: point?.sales || 0,
                };
            });
        }

        const start = generatedFilters.period === 'custom' ? new Date(generatedFilters.from || fromDate) : null;
        const end = generatedFilters.period === 'custom' ? new Date(generatedFilters.to || toDate) : null;

        if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
            const rows: Array<{ name: string; revenue: number; sales: number }> = [];
            const cursor = new Date(start);
            while (cursor <= end) {
                const dateStr = cursor.toISOString().split('T')[0];
                const point = salesTrend.find((entry) => entry._id === dateStr);
                rows.push({
                    name: cursor.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                    }),
                    revenue: point?.revenue || 0,
                    sales: point?.sales || 0,
                });
                cursor.setDate(cursor.getDate() + 1);
            }
            return rows;
        }

        const totalDays = generatedFilters.period === 'monthly' ? 30 : 7;
        return [...Array(totalDays)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (totalDays - 1 - i));
            const dateStr = d.toISOString().split('T')[0];
            const point = salesTrend.find((entry) => entry._id === dateStr);
            const label =
                generatedFilters.period === 'monthly'
                    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            return {
                name: label,
                revenue: point?.revenue || 0,
                sales: point?.sales || 0,
            };
        });
    }, [fromDate, generatedFilters, salesTrend, toDate]);

    const pieData = useMemo(() => categoryValuation, [categoryValuation]);

    const stockLevelData = useMemo(
        () =>
            [...products]
                .map((p) => ({
                    name: p.name.length > 13 ? `${p.name.substring(0, 13)}...` : p.name,
                    stock: p.stock,
                    min: p.minStock,
                    gap: p.stock - p.minStock,
                }))
                .sort((a, b) => a.gap - b.gap)
                .slice(0, 10),
        [products],
    );

    const topSellingRows = useMemo(
        () =>
            topSelling.map((row) => ({
                ...row,
                product: products.find((product) => product.id === row._id),
            })),
        [topSelling, products],
    );

    const totalProfit = useMemo(() => salesTrend.reduce((sum, point) => sum + (point.profit || 0), 0), [salesTrend]);
    const totalCustomerPayments = useMemo(
        () => customerPayments.reduce((sum, row) => sum + Number(row.totalReceived || 0), 0),
        [customerPayments],
    );

    return (
        <Box>
            <Box
                sx={{
                    mb: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: 1.5,
                    '@media print': { display: 'none' },
                }}
            >
                <Box>
                    <Typography variant="h4" fontWeight={800}>
                        Inventory Analytics & Reports
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Generate 7-day, monthly, yearly, or custom date range reports from the controls below.
                    </Typography>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                    <ButtonGroup variant="outlined" sx={{ flexWrap: 'wrap' }}>
                        <Button variant={selectedPeriod === '7days' ? 'contained' : 'outlined'} onClick={() => handlePeriodChange('7days')}>
                            7 Days
                        </Button>
                        <Button variant={selectedPeriod === 'monthly' ? 'contained' : 'outlined'} onClick={() => handlePeriodChange('monthly')}>
                            Monthly
                        </Button>
                        <Button variant={selectedPeriod === 'yearly' ? 'contained' : 'outlined'} onClick={() => handlePeriodChange('yearly')}>
                            Yearly
                        </Button>
                        <Button variant={selectedPeriod === 'custom' ? 'contained' : 'outlined'} onClick={() => handlePeriodChange('custom')}>
                            Custom Range
                        </Button>
                    </ButtonGroup>
                    {selectedPeriod === 'custom' && (
                        <>
                            <TextField
                                type="date"
                                size="small"
                                label="From"
                                InputLabelProps={{ shrink: true }}
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                            />
                            <TextField
                                type="date"
                                size="small"
                                label="To"
                                InputLabelProps={{ shrink: true }}
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                            />
                        </>
                    )}
                    <Button variant="contained" onClick={handleGenerateReport}>
                        Generate Report
                    </Button>
                </Stack>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}
            {paymentReportError && <Alert severity="error" sx={{ mb: 3 }}>{paymentReportError}</Alert>}

            <Alert severity={totalProfit >= 0 ? 'success' : 'warning'} sx={{ mb: 3 }}>
                Total profit/loss for {reportHeading.toLowerCase()}:{' '}
                {formatCurrency(totalProfit, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                })}
            </Alert>

            <Grid container spacing={3}>
                {/* Revenue Trend Line Chart */}
                <Grid size={{ xs: 12, md: 8 }}>
                    <Card sx={{ borderRadius: 4 }}>
                        <CardContent>
                            <Typography variant="h6" fontWeight={700} gutterBottom>{`Revenue Trend (${reportHeading})`}</Typography>
                            <Box sx={{ height: { xs: 240, sm: 280, md: 300 }, mt: 2.5 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trendData}>
                                        <defs>
                                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.22} />
                                                <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.text.primary, 0.1)} />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            interval="preserveStartEnd"
                                            minTickGap={generatedFilters.period === 'monthly' || generatedFilters.period === 'custom' ? 24 : 8}
                                        />
                                        <YAxis axisLine={false} tickLine={false} />
                                        <Tooltip
                                            formatter={(value: number | string | undefined) => [formatCurrency(Number(value || 0)), `Revenue (${currency})`]}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="revenue"
                                            stroke={theme.palette.primary.main}
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorRevenue)"
                                            name={`Revenue (${currency})`}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Sales Volume Bar Chart */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ borderRadius: 4 }}>
                        <CardContent>
                            <Typography variant="h6" fontWeight={700} gutterBottom>{`Sales Volume (${reportHeading})`}</Typography>
                            <Box sx={{ height: { xs: 240, sm: 280, md: 300 }, mt: 2.5 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={trendData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.text.primary, 0.1)} />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            interval="preserveStartEnd"
                                            minTickGap={generatedFilters.period === 'monthly' || generatedFilters.period === 'custom' ? 24 : 8}
                                        />
                                        <YAxis axisLine={false} tickLine={false} />
                                        <Tooltip formatter={(value: number | string | undefined) => [Number(value || 0), 'Units Sold']} />
                                        <Bar dataKey="sales" fill={theme.palette.success.main} radius={[4, 4, 0, 0]} name="Units Sold" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                    <Card sx={{ borderRadius: 4 }}>
                        <CardContent>
                            <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <BarChartIcon size={20} /> Stock Level (Top 10 Critical)
                            </Typography>
                            <Box sx={{ height: { xs: 240, sm: 280, md: 300 }, mt: 2.5 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stockLevelData} layout="vertical" margin={{ left: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.text.primary, 0.1)} />
                                        <XAxis type="number" axisLine={false} tickLine={false} />
                                        <YAxis type="category" dataKey="name" width={90} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            formatter={(value: number | string | undefined, name) => [
                                                Number(value || 0),
                                                name === 'stock' ? 'Current Stock' : 'Min Threshold',
                                            ]}
                                        />
                                        <Legend />
                                        <Bar dataKey="stock" fill={theme.palette.primary.main} radius={[0, 4, 4, 0]} name="Current Stock" />
                                        <Bar dataKey="min" fill={theme.palette.error.main} radius={[0, 4, 4, 0]} name="Min Threshold" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                    <Card sx={{ borderRadius: 4 }}>
                        <CardContent>
                            <Typography variant="h6" fontWeight={700} gutterBottom>
                                Inventory Value by Category
                            </Typography>
                            <Box sx={{ height: { xs: 240, sm: 280, md: 300 }, mt: 2.5 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                                            {pieData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={reportPalette[index % reportPalette.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value: number | string | undefined) => [
                                                formatCurrency(Number(value || 0), {
                                                    minimumFractionDigits: 0,
                                                    maximumFractionDigits: 0,
                                                }),
                                                `Value (${currency})`,
                                            ]}
                                        />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={12}>
                    <Card sx={{ borderRadius: 4 }}>
                        <CardContent>
                            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
                                <Box>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        {selectedPaymentCustomer && (
                                            <Button size="small" variant="outlined" startIcon={<ArrowLeft size={16} />} onClick={closeCustomerPaymentDetails}>
                                                Go Back
                                            </Button>
                                        )}
                                        <Typography variant="h6" fontWeight={800}>
                                            {selectedPaymentCustomer ? `${selectedPaymentCustomer.customerName} - Payment Details` : 'Customer Payment Recovery'}
                                        </Typography>
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary">
                                        {selectedPaymentCustomer
                                            ? `Every payment received from this customer for ${reportHeading.toLowerCase()}.`
                                            : `Customer-wise payments received for ${reportHeading.toLowerCase()}. Click a record to see details.`}
                                    </Typography>
                                </Box>
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <Button variant="contained" startIcon={<Download size={17} />} onClick={downloadCustomerPaymentsReport}>
                                        Download Report
                                    </Button>
                                <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                                    <Typography variant="caption" color="text.secondary">TOTAL PAYMENT RECEIVED</Typography>
                                    <Typography variant="h5" fontWeight={900} color="success.main">
                                        {formatCurrency(selectedPaymentCustomer?.totalReceived ?? totalCustomerPayments, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {selectedPaymentCustomer
                                            ? `${selectedPaymentCustomer.paymentCount} payment${selectedPaymentCustomer.paymentCount === 1 ? '' : 's'}`
                                            : `From ${customerPayments.length} customer${customerPayments.length === 1 ? '' : 's'}`}
                                    </Typography>
                                </Box>
                                </Stack>
                            </Stack>
                            <TableContainer sx={{ overflowX: 'auto' }}>
                                <Table sx={{ minWidth: 720 }}>
                                    {selectedPaymentCustomer ? (
                                        <>
                                            <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}><TableRow>
                                                <TableCell sx={{ fontWeight: 700 }}>DATE</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>PAID VIA</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>NOTES</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 700 }}>AMOUNT RECEIVED</TableCell>
                                            </TableRow></TableHead>
                                            <TableBody>
                                                {paymentDetailsLoading ? (
                                                    <TableRow><TableCell colSpan={4} align="center" sx={{ py: 6 }}>Loading payment details...</TableCell></TableRow>
                                                ) : customerPaymentDetails.map((payment) => (
                                                    <TableRow key={payment.id} hover>
                                                        <TableCell>{new Date(payment.timestamp).toLocaleString()}</TableCell>
                                                        <TableCell sx={{ textTransform: 'capitalize' }}>{payment.paidVia}</TableCell>
                                                        <TableCell>{payment.notes || '-'}</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 900, color: 'success.main' }}>
                                                            {formatCurrency(payment.amount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </>
                                    ) : (
                                    <>
                                    <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 700 }}>CUSTOMER</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>CNIC / ID</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>PAYMENTS</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>LAST PAYMENT</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700 }}>TOTAL RECEIVED</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {customerPayments.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                                                <Typography color="text.secondary">No customer payments received in this period.</Typography>
                                            </TableCell></TableRow>
                                        ) : customerPayments.map((row) => (
                                            <TableRow key={`${row.customerName}-${row.customerCnic}`} hover onClick={() => openCustomerPaymentDetails(row)} sx={{ cursor: 'pointer' }}>
                                                <TableCell sx={{ fontWeight: 800 }}>{row.customerName}</TableCell>
                                                <TableCell>{row.customerCnic || '-'}</TableCell>
                                                <TableCell>{row.paymentCount}</TableCell>
                                                <TableCell>{new Date(row.lastPaymentAt).toLocaleString()}</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900, color: 'success.main' }}>
                                                    {formatCurrency(row.totalReceived, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    </>
                                    )}
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={12}>
                    <Card sx={{ borderRadius: 4 }}>
                        <CardContent>
                            <Typography variant="h6" fontWeight={700} gutterBottom>
                                Top Selling Products (Performance)
                            </Typography>
                            <TableContainer sx={{ overflowX: 'auto' }}>
                                <Table sx={{ minWidth: 640 }}>
                                    <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 700 }}>PRODUCT</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>TOTAL REDUCED</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>REVENUE GENERATED</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>PROFIT / LOSS</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>CURRENT STOCK</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {topSellingRows.map(({ product, _id, name, totalReduced, revenue, profit }) => (
                                            <TableRow key={_id}>
                                                <TableCell sx={{ fontWeight: 600 }}>{name}</TableCell>
                                                <TableCell>
                                                    <Box
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 1,
                                                        }}
                                                    >
                                                        <TrendingDown size={14} color={theme.palette.error.main} />
                                                        {totalReduced} Units
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>
                                                    {formatCurrency(revenue, {
                                                        minimumFractionDigits: 0,
                                                        maximumFractionDigits: 0,
                                                    })}
                                                </TableCell>
                                                <TableCell
                                                    sx={{
                                                        fontWeight: 700,
                                                        color: (profit || 0) >= 0 ? 'success.main' : 'error.main',
                                                    }}
                                                >
                                                    {formatCurrency(profit || 0, {
                                                        minimumFractionDigits: 0,
                                                        maximumFractionDigits: 0,
                                                    })}
                                                </TableCell>
                                                <TableCell>{product?.stock ?? 0} Units</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default ReportsPage;
