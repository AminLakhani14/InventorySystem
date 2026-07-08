import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Grid,
    Stack,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Bell, CalendarClock, ClipboardList, History, Package2, RefreshCw } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import type { RootState } from '../../store';
import { buildNotifications, type InstallmentNotificationPlan, type NotificationItem } from '../../lib/notifications';

const iconByCategory = {
    installment: CalendarClock,
    order: ClipboardList,
    stock: Package2,
    transaction: History,
};

const colorBySeverity = {
    warning: 'warning.main',
    success: 'success.main',
    info: 'info.main',
} as const;

const NotificationsPage: React.FC = () => {
    const theme = useTheme();
    const navigate = useNavigate();
    const { orders } = useSelector((state: RootState) => state.orders);
    const { transactions } = useSelector((state: RootState) => state.transactions);
    const { products } = useSelector((state: RootState) => state.inventory);
    const { notifications } = useSelector((state: RootState) => state.settings);
    const [installmentPlans, setInstallmentPlans] = useState<InstallmentNotificationPlan[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loadInstallmentPlans = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await api.get('/installments');
            setInstallmentPlans(response.data || []);
        } catch (fetchError: any) {
            setError(fetchError.response?.data?.message || 'Unable to load installment notifications.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInstallmentPlans();
        const refresh = () => loadInstallmentPlans();
        window.addEventListener('itemhive-installments-updated', refresh);
        return () => window.removeEventListener('itemhive-installments-updated', refresh);
    }, []);

    const allNotifications = useMemo(
        () =>
            buildNotifications({
                installmentPlans,
                orders,
                transactions,
                products,
                orderUpdatesEnabled: notifications.orderUpdates,
                lowStockAlertsEnabled: notifications.lowStockAlerts,
            }),
        [installmentPlans, notifications.lowStockAlerts, notifications.orderUpdates, orders, products, transactions]
    );

    const summary = useMemo(
        () => ({
            total: allNotifications.length,
            overdue: allNotifications.filter((item) => item.category === 'installment').length,
            stock: allNotifications.filter((item) => item.category === 'stock').length,
            orders: allNotifications.filter((item) => item.category === 'order').length,
        }),
        [allNotifications]
    );

    return (
        <Box>
            <Card
                sx={{
                    borderRadius: 4,
                    mb: 4,
                    overflow: 'hidden',
                    border: '1px solid',
                    borderColor: alpha(theme.palette.primary.main, 0.18),
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.info.main, 0.08)} 45%, ${alpha(theme.palette.background.paper, 1)} 100%)`,
                }}
            >
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                        <Box>
                            <Typography variant="h4" fontWeight={800} gutterBottom>
                                Notifications Center
                            </Typography>
                            <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
                                Review installment dues, stock alerts, order updates, and recent inventory activity in one place.
                            </Typography>
                        </Box>
                        <Button variant="contained" startIcon={<RefreshCw size={16} />} onClick={loadInstallmentPlans} disabled={loading}>
                            Refresh
                        </Button>
                    </Stack>
                </CardContent>
            </Card>

            <Grid container spacing={2.5} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card sx={{ borderRadius: 3 }}>
                        <CardContent>
                            <Typography variant="overline" color="text.secondary">Total Notifications</Typography>
                            <Typography variant="h4" fontWeight={800}>{summary.total}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card sx={{ borderRadius: 3 }}>
                        <CardContent>
                            <Typography variant="overline" color="text.secondary">Installment Alerts</Typography>
                            <Typography variant="h4" fontWeight={800} color="warning.main">{summary.overdue}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card sx={{ borderRadius: 3 }}>
                        <CardContent>
                            <Typography variant="overline" color="text.secondary">Stock Alerts</Typography>
                            <Typography variant="h4" fontWeight={800} color="error.main">{summary.stock}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card sx={{ borderRadius: 3 }}>
                        <CardContent>
                            <Typography variant="overline" color="text.secondary">Order Updates</Typography>
                            <Typography variant="h4" fontWeight={800} color="success.main">{summary.orders}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            <Card sx={{ borderRadius: 4 }}>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                        <Box>
                            <Typography variant="h6" fontWeight={800}>All Notifications</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Newest items appear first.
                            </Typography>
                        </Box>
                        {loading && <CircularProgress size={20} />}
                    </Stack>

                    {allNotifications.length === 0 ? (
                        <Box
                            sx={{
                                py: 6,
                                px: 3,
                                textAlign: 'center',
                                borderRadius: 3,
                                bgcolor: alpha(theme.palette.primary.main, 0.04),
                                border: '1px dashed',
                                borderColor: alpha(theme.palette.primary.main, 0.18),
                            }}
                        >
                            <Bell size={28} color={theme.palette.text.secondary} />
                            <Typography variant="h6" fontWeight={700} sx={{ mt: 1.5 }}>
                                No notifications yet
                            </Typography>
                            <Typography color="text.secondary">
                                Alerts will appear here when installments become due, stock runs low, or orders and inventory change.
                            </Typography>
                        </Box>
                    ) : (
                        <Stack spacing={1.5}>
                            {allNotifications.map((notification: NotificationItem) => {
                                const Icon = iconByCategory[notification.category];
                                return (
                                    <Card
                                        key={notification.id}
                                        variant="outlined"
                                        sx={{
                                            borderRadius: 3,
                                            borderColor: alpha(theme.palette.divider, 0.6),
                                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                            '&:hover': {
                                                transform: 'translateY(-2px)',
                                                boxShadow: theme.shadows[3],
                                            },
                                        }}
                                    >
                                        <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                            <Box
                                                sx={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: 2.5,
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                                                    color: colorBySeverity[notification.severity],
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <Icon size={20} />
                                            </Box>
                                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 0.5 }}>
                                                    <Typography variant="subtitle1" fontWeight={800}>
                                                        {notification.title}
                                                    </Typography>
                                                    <Chip
                                                        size="small"
                                                        label={notification.category}
                                                        sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, textTransform: 'capitalize' }}
                                                    />
                                                </Stack>
                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                    {notification.detail}
                                                </Typography>
                                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {notification.time}
                                                    </Typography>
                                                    {notification.path && (
                                                        <Button size="small" onClick={() => navigate(notification.path!)}>
                                                            Open
                                                        </Button>
                                                    )}
                                                </Stack>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </Stack>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
};

export default NotificationsPage;
