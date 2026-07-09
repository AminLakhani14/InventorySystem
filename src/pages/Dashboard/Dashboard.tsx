import React from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Avatar,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Grid,
    Chip
} from '@mui/material';
import {
    Package,
    TrendingUp,
    AlertTriangle,
    ArrowRight,
    DollarSign,
    Monitor,
    Trophy,
    UserRound,
    CalendarDays,
    BadgeDollarSign
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import { fetchProducts } from '../../features/inventory/inventorySlice';
import { fetchTransactions } from '../../features/transactions/transactionSlice';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell
} from 'recharts';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import heroGraphic from '../../assets/Modern retail POS system setup.webp';
import useAppCurrency from '../../hooks/useAppCurrency';

type StatColor = 'primary' | 'success' | 'error' | 'warning';

const Dashboard: React.FC = () => {
    const theme = useTheme();
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const { products } = useSelector((state: RootState) => state.inventory);
    const { transactions = [] } = useSelector((state: RootState) => state.transactions || { transactions: [] });
    const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
    const { currency, formatCurrency } = useAppCurrency();

    React.useEffect(() => {
        if (!isAuthenticated || !user) {
            return;
        }

        dispatch(fetchProducts());
        dispatch(fetchTransactions());
    }, [dispatch, isAuthenticated, user]);

    const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
    const lowStockItems = products.filter(p => p.stock <= p.minStock);
    const recentTransactions = transactions.slice(0, 5);
    const salesTransactions = transactions.filter((tx) => tx.type === 'reduction');
    const totalRevenue = salesTransactions.reduce((acc, tx) => acc + Number(tx.totalPrice || 0), 0);
    const formatActivityDate = (timestamp: string) => new Date(timestamp).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
    const topSoldProduct = Object.values(salesTransactions.reduce<Record<string, {
        productName: string;
        quantity: number;
        amount: number;
        latestCustomer: string;
        latestAmount: number;
        latestDate: string;
    }>>((acc, tx) => {
        const key = tx.productId || tx.productName;
        const current = acc[key] || {
            productName: tx.productName,
            quantity: 0,
            amount: 0,
            latestCustomer: tx.customerName || 'Walk-in Customer',
            latestAmount: tx.totalPrice || 0,
            latestDate: tx.timestamp,
        };
        const txDate = new Date(tx.timestamp).getTime();
        const currentDate = new Date(current.latestDate).getTime();

        current.quantity += Number(tx.amount || 0);
        current.amount += Number(tx.totalPrice || 0);
        if (txDate >= currentDate) {
            current.latestCustomer = tx.customerName || 'Walk-in Customer';
            current.latestAmount = tx.totalPrice || 0;
            current.latestDate = tx.timestamp;
        }
        acc[key] = current;
        return acc;
    }, {})).sort((a, b) => b.quantity - a.quantity || b.amount - a.amount)[0];

    // Dynamic Chart Data: Last 7 days movement
    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toISOString().split('T')[0];
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

        const daySales = transactions
            .filter(t => t.timestamp.startsWith(dateStr) && t.type === 'reduction')
            .reduce((sum, t) => sum + (t.totalPrice || 0), 0);

        return { name: dayName, sales: daySales };
    });

    // Dynamic Category Data: Top 4 categories by value
    const catMap = products.reduce<Record<string, number>>((acc, p) => {
        acc[p.category] = (acc[p.category] || 0) + (p.stock * p.price);
        return acc;
    }, {});

    const COLORS = [
        theme.palette.primary.main,
        theme.palette.secondary.main,
        theme.palette.success.main,
        theme.palette.warning.main
    ];
    const dynamicCategoryData = Object.keys(catMap)
        .map((cat, i) => ({
            name: cat,
            value: catMap[cat],
            color: COLORS[i % COLORS.length]
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 4);

    const stats: Array<{
        title: string;
        value: React.ReactNode;
        icon: React.ReactNode;
        color: StatColor;
        trend: string;
    }> = [
        {
            title: 'Total Products',
            value: products.length,
            icon: <Package size={24} />,
            color: 'primary',
            trend: 'Live Database'
        },
        {
            title: 'Total Stock',
            value: totalStock,
            icon: <TrendingUp size={24} />,
            color: 'success',
            trend: 'Across all items'
        },
        {
            title: 'Low Stock Alerts',
            value: lowStockItems.length,
            icon: <AlertTriangle size={24} />,
            color: 'error',
            trend: `${lowStockItems.length} items need attention`
        },
        {
            title: 'Revenue',
            value: formatCurrency(totalRevenue, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
            icon: <DollarSign size={24} />,
            color: 'warning',
            trend: 'Total sales revenue'
        },
    ];

    return (
        <Box>
            <Card
                className="section-rise"
                sx={{
                    borderRadius: 4,
                    mb: 4,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: alpha(theme.palette.primary.main, 0.18),
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 45%, ${alpha(theme.palette.background.paper, 1)} 100%)`,
                }}
            >
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                    <Grid container spacing={3} alignItems="center">
                        <Grid size={{ xs: 12, md: 7 }}>
                            <Chip
                                label="Live Inventory Intelligence"
                                size="small"
                                sx={{
                                    mb: 2,
                                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                                    color: theme.palette.primary.dark,
                                    fontWeight: 700,
                                }}
                            />
                            <Typography variant="h4" fontWeight={800} gutterBottom>
                                Welcome back, {user?.name?.split(' ')[0] || 'User'}!
                            </Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                                Here's what's happening with your POS system today.
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                                <Button
                                    variant="contained"
                                    startIcon={<Monitor size={20} />}
                                    sx={{ py: 1.3, px: 3, fontWeight: 800 }}
                                    onClick={() => navigate('/pos')}
                                >
                                    Open POS Terminal
                                </Button>
                                <Button
                                    variant="outlined"
                                    startIcon={<Package size={18} />}
                                    onClick={() => navigate('/inventory')}
                                >
                                    View Inventory
                                </Button>
                            </Box>
                        </Grid>
                        <Grid size={{ xs: 12, md: 5 }}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    position: 'relative',
                                    px: { xs: 0.5, md: 1 },
                                    py: { xs: 1, md: 0 },
                                }}
                            >
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        inset: { xs: 14, md: 18 },
                                        borderRadius: 4,
                                        background: `radial-gradient(circle at 20% 20%, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.26 : 0.2)} 0%, ${alpha(theme.palette.secondary.main, theme.palette.mode === 'dark' ? 0.18 : 0.12)} 35%, transparent 75%)`,
                                        filter: 'blur(20px)',
                                        zIndex: 0,
                                        pointerEvents: 'none',
                                    }}
                                />
                                <Box
                                    component="img"
                                    src={heroGraphic}
                                    alt="Inventory overview"
                                    sx={{
                                        position: 'relative',
                                        zIndex: 1,
                                        width: '100%',
                                        maxWidth: { xs: 460, md: 420 },
                                        borderRadius: 3,
                                        border: '1px solid',
                                        borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.35 : 0.2),
                                        bgcolor: alpha(theme.palette.background.paper, 0.95),
                                        boxShadow: theme.palette.mode === 'dark'
                                            ? `0 18px 36px -22px ${alpha('#000', 0.92)}`
                                            : `0 20px 34px -18px ${alpha(theme.palette.primary.dark, 0.36)}`,
                                        transform: { xs: 'none', md: 'perspective(1000px) rotateY(-4deg) rotateX(1.2deg)' },
                                        transition: 'transform 280ms ease, box-shadow 240ms ease',
                                        '&:hover': {
                                            transform: { xs: 'none', md: 'perspective(1000px) rotateY(-1.5deg) rotateX(0.4deg) translateY(-4px)' },
                                            boxShadow: theme.palette.mode === 'dark'
                                                ? `0 24px 44px -24px ${alpha('#000', 0.96)}`
                                                : `0 26px 42px -20px ${alpha(theme.palette.primary.dark, 0.42)}`,
                                        }
                                    }}
                                />
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        top: { xs: 14, md: 18 },
                                        left: { xs: 10, md: 16 },
                                        zIndex: 2,
                                        px: 1.2,
                                        py: 0.55,
                                        borderRadius: 999,
                                        bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.7 : 0.85),
                                        backdropFilter: 'blur(8px)',
                                        border: '1px solid',
                                        borderColor: alpha(theme.palette.primary.main, 0.24),
                                        boxShadow: `0 8px 18px -12px ${alpha(theme.palette.primary.dark, 0.5)}`,
                                    }}
                                >
                                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: 0.3 }}>
                                        REALTIME SYNC
                                    </Typography>
                                </Box>
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        bottom: { xs: 16, md: 18 },
                                        right: { xs: 8, md: 12 },
                                        zIndex: 2,
                                        px: 1.5,
                                        py: 1.05,
                                        borderRadius: 2,
                                        bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.78 : 0.9),
                                        backdropFilter: 'blur(10px)',
                                        border: '1px solid',
                                        borderColor: alpha(theme.palette.success.main, 0.3),
                                        boxShadow: `0 10px 22px -14px ${alpha(theme.palette.success.dark, 0.55)}`,
                                    }}
                                >
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.1 }}>
                                        Stock Health
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 900, color: 'success.main', lineHeight: 1.1 }}>
                                        98.4% Stable
                                    </Typography>
                                </Box>
                            </Box>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            <Grid container spacing={3} className="section-rise-delay">
                {stats.map((stat, index) => (
                    <Grid size={{ xs: 12, sm: 6, md: 3 }} key={stat.title}>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Card sx={{ height: '100%', borderRadius: 4 }}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                        <Avatar
                                            sx={{
                                                bgcolor: alpha(theme.palette[stat.color].main, 0.12),
                                                color: theme.palette[stat.color].main,
                                                width: 48,
                                                height: 48,
                                                borderRadius: 2,
                                                boxShadow: `0 6px 14px -10px ${alpha(theme.palette[stat.color].main, 0.7)}`
                                            }}
                                        >
                                            {stat.icon}
                                        </Avatar>
                                    </Box>
                                    <Typography variant="h4" fontWeight={800}>{stat.value}</Typography>
                                    <Typography variant="body2" color="text.secondary" fontWeight={600} gutterBottom>
                                        {stat.title}
                                    </Typography>
                                    <Typography variant="caption" color={stat.title === 'Low Stock Alerts' && lowStockItems.length > 0 ? 'error' : 'success.main'} fontWeight={700}>
                                        {stat.trend}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </Grid>
                ))}

                <Grid size={12} className="section-rise-delay">
                    <Card
                        sx={{
                            borderRadius: '8px',
                            border: '1px solid',
                            borderColor: alpha(theme.palette.primary.main, 0.18),
                            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.11)}, ${alpha(theme.palette.warning.main, 0.08)} 42%, ${alpha(theme.palette.background.paper, 0.96)})`,
                            boxShadow: `0 18px 45px ${alpha(theme.palette.common.black, 0.08)}`,
                        }}
                    >
                        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.16), color: 'warning.main', borderRadius: '8px' }}>
                                        <Trophy size={22} />
                                    </Avatar>
                                    <Box>
                                        <Typography variant="h6" fontWeight={900}>Best Seller Snapshot</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Product with the highest sold quantity from stock-out transactions.
                                        </Typography>
                                    </Box>
                                </Box>
                                <Button size="small" endIcon={<ArrowRight size={16} />} onClick={() => navigate('/transactions')}>
                                    View Sales
                                </Button>
                            </Box>

                            {!topSoldProduct ? (
                                <Box sx={{ textAlign: 'center', py: 3 }}>
                                    <Typography color="text.secondary">No product sales yet.</Typography>
                                </Box>
                            ) : (
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 12, md: 4 }}>
                                        <Box sx={{ p: 2, borderRadius: '8px', bgcolor: alpha(theme.palette.background.paper, 0.72), border: '1px solid', borderColor: 'divider', height: '100%' }}>
                                            <Typography variant="caption" color="text.secondary" fontWeight={800}>MOST SOLD PRODUCT</Typography>
                                            <Typography variant="h5" fontWeight={900} sx={{ mt: 0.75 }}>{topSoldProduct.productName}</Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                Total sold quantity: <Box component="span" sx={{ fontWeight: 900, color: 'primary.main' }}>{topSoldProduct.quantity}</Box>
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                                Total sales amount: <Box component="span" sx={{ fontWeight: 900, color: 'warning.main' }}>{formatCurrency(topSoldProduct.amount, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Box>
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                                        <Box sx={{ p: 2, borderRadius: '8px', bgcolor: alpha(theme.palette.background.paper, 0.72), border: '1px solid', borderColor: 'divider', height: '100%' }}>
                                            <UserRound size={18} color={theme.palette.primary.main} />
                                            <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ display: 'block', mt: 1 }}>CUSTOMER</Typography>
                                            <Typography variant="body2" fontWeight={900}>{topSoldProduct.latestCustomer}</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                                        <Box sx={{ p: 2, borderRadius: '8px', bgcolor: alpha(theme.palette.background.paper, 0.72), border: '1px solid', borderColor: 'divider', height: '100%' }}>
                                            <Package size={18} color={theme.palette.success.main} />
                                            <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ display: 'block', mt: 1 }}>QUANTITY</Typography>
                                            <Typography variant="body2" fontWeight={900}>{topSoldProduct.quantity}</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                                        <Box sx={{ p: 2, borderRadius: '8px', bgcolor: alpha(theme.palette.background.paper, 0.72), border: '1px solid', borderColor: 'divider', height: '100%' }}>
                                            <BadgeDollarSign size={18} color={theme.palette.warning.main} />
                                            <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ display: 'block', mt: 1 }}>LATEST AMOUNT</Typography>
                                            <Typography variant="body2" fontWeight={900}>
                                                {formatCurrency(topSoldProduct.latestAmount, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                                        <Box sx={{ p: 2, borderRadius: '8px', bgcolor: alpha(theme.palette.background.paper, 0.72), border: '1px solid', borderColor: 'divider', height: '100%' }}>
                                            <CalendarDays size={18} color={theme.palette.info.main} />
                                            <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ display: 'block', mt: 1 }}>LATEST DATE</Typography>
                                            <Typography variant="body2" fontWeight={900}>
                                                {new Date(topSoldProduct.latestDate).toLocaleDateString()}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                </Grid>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 8 }} className="section-rise-delay">
                    <Card sx={{ borderRadius: 4 }}>
                        <CardContent>
                            <Typography variant="h6" fontWeight={700} gutterBottom>
                                Inventory Sales Volume (7 Days)
                            </Typography>
                            <Box sx={{ height: 300, mt: 2 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={last7Days}>
                                        <defs>
                                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.12} />
                                                <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={alpha(theme.palette.text.primary, 0.08)} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                                        <Tooltip
                                            contentStyle={{
                                                borderRadius: '12px',
                                                border: 'none',
                                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                                            }}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="sales"
                                            stroke={theme.palette.primary.main}
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorSales)"
                                            name={`Revenue (${currency})`}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }} className="section-rise-delay">
                    <Card sx={{ borderRadius: 4, height: '100%' }}>
                        <CardContent>
                            <Typography variant="h6" fontWeight={700} gutterBottom>
                                Valuation by Category
                            </Typography>
                            <Box sx={{ height: 280, mt: 2 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dynamicCategoryData} layout="vertical">
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: theme.palette.text.secondary, fontSize: 12, fontWeight: 600 }} width={80} />
                                        <Tooltip
                                            cursor={{ fill: 'transparent' }}
                                            formatter={(value: unknown) => [formatCurrency(Number(value) || 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), 'Value']}
                                        />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={25}>
                                            {dynamicCategoryData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                            <Box sx={{ mt: 2 }}>
                                {dynamicCategoryData.map((item) => (
                                    <Box key={item.name} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color }} />
                                            {item.name}
                                        </Typography>
                                        <Typography variant="body2" fontWeight={700}>
                                            {formatCurrency(item.value, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={12} className="section-rise-delay">
                    <Card sx={{ borderRadius: 4 }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6" fontWeight={700}>
                                    Recent Activity
                                </Typography>
                                <Button size="small" endIcon={<ArrowRight size={16} />} onClick={() => navigate('/transactions')}>View All</Button>
                            </Box>
                            {recentTransactions.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <Typography color="text.secondary">No transactions yet recorded.</Typography>
                                </Box>
                            ) : (
                                <Box>
                                    <TableContainer sx={{ overflowX: 'auto' }}>
                                        <Table size="small" sx={{ minWidth: 860 }}>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Customer</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Quantity</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Value</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {recentTransactions.map((tx) => (
                                                    <TableRow key={tx.id} hover>
                                                        <TableCell sx={{ fontWeight: 600 }}>#{tx.id}</TableCell>
                                                        <TableCell>{tx.productName}</TableCell>
                                                        <TableCell sx={{ fontWeight: 600 }}>{tx.customerName?.trim() || 'Anonymous'}</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={tx.type === 'addition' ? 'Stock In' : 'Stock Out'}
                                                                size="small"
                                                                color={tx.type === 'addition' ? 'success' : 'error'}
                                                                variant="outlined"
                                                                sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                                                            />
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 600 }}>{tx.amount}</TableCell>
                                                        <TableCell sx={{ fontWeight: 700 }}>
                                                            {formatCurrency(tx.totalPrice || 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                        </TableCell>
                                                        <TableCell sx={{ fontWeight: 600 }}>{formatActivityDate(tx.timestamp)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default Dashboard;
