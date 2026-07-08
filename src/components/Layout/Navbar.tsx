import React from 'react';
import {
    AppBar,
    Toolbar,
    Typography,
    IconButton,
    Box,
    Avatar,
    Menu,
    MenuItem,
    Tooltip,
    Badge,
    Button,
    TextField,
    Chip
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
    Menu as MenuIcon,
    Bell as NotificationsIcon,
    Sun,
    Moon,
    UserCircle2,
    Settings,
    LogOut,
    Sparkles,
    ChevronRight,
    Building2
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { logout } from '../../features/auth/authSlice';
import { toggleDarkMode, setDarkMode } from '../../features/theme/themeSlice';
import { fetchProducts } from '../../features/inventory/inventorySlice';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { buildNotifications, type InstallmentNotificationPlan, type NotificationItem } from '../../lib/notifications';
import type { AppDispatch } from '../../store';

interface NavbarProps {
    onMenuClick: () => void;
}

interface WorkspaceOption {
    id: string;
    name: string;
    email: string;
    role: string;
    businessId: string;
    businessName?: string;
}

const formatRoleLabel = (role?: string) =>
    role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'Administrator' : 'Team User';

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();
    const { user } = useSelector((state: RootState) => state.auth);
    const { mode, isSidebarCollapsed } = useSelector((state: RootState) => state.theme);
    const { transactions } = useSelector((state: RootState) => state.transactions);
    const { orders } = useSelector((state: RootState) => state.orders);
    const { products } = useSelector((state: RootState) => state.inventory);
    const { notifications, app } = useSelector((state: RootState) => state.settings);
    const canAccessInstallments = user?.role === 'super_admin' || Boolean(app?.installmentsEnabled && user?.installmentAccess);
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const [notifAnchorEl, setNotifAnchorEl] = React.useState<null | HTMLElement>(null);
    const [installmentPlans, setInstallmentPlans] = React.useState<InstallmentNotificationPlan[]>([]);
    const [workspaceOptions, setWorkspaceOptions] = React.useState<WorkspaceOption[]>([]);
    const [selectedWorkspaceId, setSelectedWorkspaceId] = React.useState(() => localStorage.getItem('itemhive-workspace-id') || '');
    const roleLabel = formatRoleLabel(user?.role);

    const drawerWidth = 260;
    const collapsedWidth = 80;
    const currentWidth = isSidebarCollapsed ? collapsedWidth : drawerWidth;

    const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleNotifOpen = (event: React.MouseEvent<HTMLElement>) => {
        setNotifAnchorEl(event.currentTarget);
    };

    const handleNotifClose = () => {
        setNotifAnchorEl(null);
    };

    React.useEffect(() => {
        const loadInstallmentNotifications = async () => {
            if (!canAccessInstallments) {
                setInstallmentPlans([]);
                return;
            }
            try {
                const response = await api.get('/installments');
                setInstallmentPlans((response.data || []) as InstallmentNotificationPlan[]);
            } catch {
                setInstallmentPlans([]);
            }
        };

        loadInstallmentNotifications();
        window.addEventListener('itemhive-installments-updated', loadInstallmentNotifications);
        return () => window.removeEventListener('itemhive-installments-updated', loadInstallmentNotifications);
    }, [canAccessInstallments, location.pathname]);

    React.useEffect(() => {
        const loadWorkspaceOptions = async () => {
            if (user?.role !== 'super_admin') {
                setWorkspaceOptions([]);
                return;
            }

            try {
                const response = await api.get('/users', { params: { page: 1, limit: 100 } });
                const users = Array.isArray(response.data) ? response.data : response.data.users || [];
                setWorkspaceOptions(users.filter((entry: WorkspaceOption) => Boolean(entry.businessId)));
            } catch {
                setWorkspaceOptions([]);
            }
        };

        loadWorkspaceOptions();
        window.addEventListener('itemhive-team-updated', loadWorkspaceOptions);
        return () => window.removeEventListener('itemhive-team-updated', loadWorkspaceOptions);
    }, [user?.role]);

    const selectedWorkspace = React.useMemo(
        () => workspaceOptions.find((option) => option.businessId === selectedWorkspaceId),
        [selectedWorkspaceId, workspaceOptions]
    );

    const handleWorkspaceChange = (businessId: string) => {
        setSelectedWorkspaceId(businessId);
        if (businessId) {
            localStorage.setItem('itemhive-workspace-id', businessId);
        } else {
            localStorage.removeItem('itemhive-workspace-id');
        }
        window.dispatchEvent(new Event('itemhive-workspace-changed'));
        dispatch(fetchProducts());
    };

    const allNotifications = React.useMemo(
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

    const recentNotifications = React.useMemo(() => allNotifications.slice(0, 6), [allNotifications]);
    const hasConfigurableNotificationsEnabled = notifications.orderUpdates || notifications.lowStockAlerts;

    const handleLogout = () => {
        dispatch(logout());
        navigate('/login');
        handleClose();
    };

    const handleNavigateTo = (path: string) => {
        navigate(path);
        handleClose();
    };

    const handleThemeToggle = () => {
        dispatch(toggleDarkMode());
    };

    const isActivePath = (path: string) => location.pathname === path;
    const buildActionItemSx = (isDanger = false, active = false) => ({
        borderRadius: 2,
        mx: 1,
        my: 0.4,
        px: 1.25,
        py: 1,
        minHeight: 42,
        fontWeight: 700,
        color: isDanger ? 'error.main' : 'text.primary',
        border: '1px solid',
        borderColor: active
            ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.45 : 0.26)
            : 'transparent',
        background: active
            ? `linear-gradient(100deg, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.24 : 0.14)} 0%, ${alpha(theme.palette.secondary.main, theme.palette.mode === 'dark' ? 0.15 : 0.08)} 100%)`
            : 'transparent',
        transition: 'all 180ms ease',
        '& .menu-action-icon': {
            transition: 'transform 180ms ease, color 180ms ease',
        },
        '& .menu-action-arrow': {
            transition: 'transform 180ms ease, opacity 180ms ease',
            opacity: active ? 1 : 0.35,
            color: isDanger ? 'error.main' : 'text.secondary',
        },
        '&:hover': {
            borderColor: isDanger
                ? alpha(theme.palette.error.main, 0.35)
                : alpha(theme.palette.primary.main, 0.28),
            background: isDanger
                ? alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.2 : 0.08)
                : `linear-gradient(100deg, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.28 : 0.16)} 0%, ${alpha(theme.palette.secondary.main, theme.palette.mode === 'dark' ? 0.18 : 0.1)} 100%)`,
            transform: 'translateX(3px)',
            '& .menu-action-icon': {
                transform: 'scale(1.08)',
                color: isDanger ? theme.palette.error.main : theme.palette.primary.main,
            },
            '& .menu-action-arrow': {
                opacity: 1,
                transform: 'translateX(2px)',
                color: isDanger ? theme.palette.error.main : theme.palette.primary.main,
            },
        },
    });

    return (
        <AppBar
            position="fixed"
            sx={{
                width: { sm: `calc(100% - ${currentWidth}px)` },
                ml: { sm: `${currentWidth}px` },
                backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.8),
                backdropFilter: 'blur(12px)',
                transition: (theme) => theme.transitions.create(['width', 'margin'], {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.enteringScreen,
                }),
                borderBottom: '1px solid',
                borderColor: 'divider',
                color: 'text.primary',
                boxShadow: 'none',
            }}
        >
            <Toolbar>
                <IconButton
                    color="inherit"
                    aria-label="open drawer"
                    edge="start"
                    onClick={onMenuClick}
                    sx={{ mr: 2, display: { sm: 'none' } }}
                >
                    <MenuIcon size={20} />
                </IconButton>

                <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                    <Box
                        sx={{
                            display: { xs: 'flex', sm: 'none' },
                            alignItems: 'center',
                            gap: 1.5
                        }}
                    >
                        <Box
                            component="img"
                            src="/favicon.png"
                            alt="Logo"
                            sx={{ width: 28, height: 28 }}
                        />
                        <Typography
                            variant="h6"
                            className="gradient-text"
                            sx={{
                                fontWeight: 800,
                                letterSpacing: -1,
                                fontSize: '1.2rem'
                            }}
                        >
                            ItemHive
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {user?.role === 'super_admin' && (
                        <Box
                            sx={{
                                display: { xs: 'none', lg: 'flex' },
                                alignItems: 'center',
                                gap: 1,
                                px: 1,
                                py: 0.6,
                                borderRadius: 999,
                                border: '1px solid',
                                borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.34 : 0.18),
                                bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.05),
                                boxShadow: theme.palette.mode === 'dark'
                                    ? `inset 0 1px 0 ${alpha('#fff', 0.04)}`
                                    : `0 10px 28px -22px ${alpha(theme.palette.primary.dark, 0.45)}`,
                            }}
                        >
                            <Building2 size={17} color={theme.palette.primary.main} />
                            <TextField
                                select
                                size="small"
                                value={workspaceOptions.some((option) => option.businessId === selectedWorkspaceId) ? selectedWorkspaceId : ''}
                                onChange={(event) => handleWorkspaceChange(event.target.value)}
                                variant="standard"
                                InputProps={{ disableUnderline: true }}
                                SelectProps={{
                                    displayEmpty: true,
                                    renderValue: (value) => {
                                        const option = workspaceOptions.find((entry) => entry.businessId === value);
                                        return (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                                                <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary' }}>
                                                    Viewing
                                                </Typography>
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        fontWeight: 900,
                                                        maxWidth: 160,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {option?.businessName || option?.name || 'Own workspace'}
                                                </Typography>
                                            </Box>
                                        );
                                    },
                                }}
                                sx={{
                                    minWidth: 230,
                                    '& .MuiInputBase-root': {
                                        fontWeight: 800,
                                        fontSize: 14,
                                    },
                                }}
                            >
                                <MenuItem value="">
                                    <Box sx={{ py: 0.3 }}>
                                        <Typography variant="body2" fontWeight={900}>Own workspace</Typography>
                                        <Typography variant="caption" color="text.secondary">Default super admin view</Typography>
                                    </Box>
                                </MenuItem>
                                {workspaceOptions.map((option) => (
                                    <MenuItem key={`${option.id}-${option.businessId}`} value={option.businessId}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, width: '100%' }}>
                                            <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: 12, fontWeight: 900 }}>
                                                {option.name.charAt(0).toUpperCase()}
                                            </Avatar>
                                            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                                                <Typography variant="body2" fontWeight={900} noWrap>{option.businessName || option.name}</Typography>
                                                <Typography variant="caption" color="text.secondary" noWrap>{option.name} - {option.email}</Typography>
                                            </Box>
                                            <Chip size="small" label={formatRoleLabel(option.role)} sx={{ height: 22, fontWeight: 800 }} />
                                        </Box>
                                    </MenuItem>
                                ))}
                            </TextField>
                            {selectedWorkspace && (
                                <Chip
                                    size="small"
                                    label={formatRoleLabel(selectedWorkspace.role)}
                                    sx={{
                                        height: 24,
                                        fontWeight: 900,
                                        bgcolor: alpha(theme.palette.primary.main, 0.12),
                                        color: 'primary.main',
                                    }}
                                />
                            )}
                        </Box>
                    )}

                    <Box
                        sx={{
                            display: { xs: 'none', md: 'flex' },
                            alignItems: 'center',
                            position: 'relative',
                            borderRadius: 999,
                            p: 0.5,
                            bgcolor: 'action.hover',
                            border: '1px solid',
                            borderColor: 'divider',
                            minWidth: 72,
                            height: 38,
                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
                            gap: 1
                        }}
                    >
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 4,
                                left: mode === 'light' ? 4 : 'calc(50% + 2px)',
                                width: 'calc(50% - 6px)',
                                height: 28,
                                borderRadius: 999,
                                bgcolor: 'background.paper',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                border: '1px solid',
                                borderColor: 'divider',
                            }}
                        />
                        <IconButton
                            onClick={() => dispatch(setDarkMode('light'))}
                            size="small"
                            sx={{
                                flex: 1,
                                height: 28,
                                zIndex: 1,
                                color: mode === 'light' ? 'primary.main' : 'text.secondary',
                                transition: 'color 0.3s',
                            }}
                        >
                            <Sun size={18} strokeWidth={2.5} />
                        </IconButton>
                        <IconButton
                            onClick={() => dispatch(setDarkMode('dark'))}
                            size="small"
                            sx={{
                                flex: 1,
                                height: 28,
                                zIndex: 1,
                                color: mode === 'dark' ? 'primary.main' : 'text.secondary',
                                transition: 'color 0.3s',
                            }}
                        >
                            <Moon size={18} strokeWidth={2.5} />
                        </IconButton>
                    </Box>

                    <IconButton color="inherit" onClick={handleThemeToggle} sx={{ display: { xs: 'inline-flex', md: 'none' } }}>
                        {mode === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                    </IconButton>

                    <IconButton color="inherit" onClick={handleNotifOpen}>
                        <Badge badgeContent={recentNotifications.length} color="secondary">
                            <NotificationsIcon size={20} />
                        </Badge>
                    </IconButton>

                    <Tooltip title="Profile settings">
                        <IconButton onClick={handleMenu} sx={{ p: 0.5, ml: 1 }}>
                            <Avatar
                                src={user?.photoUrl}
                                alt={user?.name}
                                sx={{
                                    width: 35,
                                    height: 35,
                                    bgcolor: 'primary.main',
                                    fontSize: '0.9rem',
                                    fontWeight: 600
                                }}
                            >
                                {user?.name?.charAt(0).toUpperCase()}
                            </Avatar>
                        </IconButton>
                    </Tooltip>

                    <Menu
                        id="menu-appbar"
                        anchorEl={anchorEl}
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'right',
                        }}
                        keepMounted
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                        }}
                        open={Boolean(anchorEl)}
                        onClose={handleClose}
                        PaperProps={{
                            elevation: 0,
                            sx: {
                                mt: 1,
                                width: 250,
                                overflow: 'visible',
                                borderRadius: 3,
                                border: '1px solid',
                                borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.35 : 0.16),
                                background: `linear-gradient(160deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.background.paper, 0.92)} 100%)`,
                                backdropFilter: 'blur(12px)',
                                boxShadow: theme.palette.mode === 'dark'
                                    ? `0 22px 44px -24px ${alpha('#000', 0.9)}`
                                    : `0 18px 40px -22px ${alpha(theme.palette.primary.dark, 0.36)}`,
                            },
                        }}
                    >
                        <Box
                            sx={{
                                px: 1.2,
                                pt: 1.2,
                                pb: 0.8,
                            }}
                        >
                            <Box
                                sx={{
                                    px: 1.4,
                                    py: 1.15,
                                    borderRadius: 2.2,
                                    border: '1px solid',
                                    borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.4 : 0.2),
                                    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.14 : 0.06),
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.1,
                                }}
                            >
                                <Sparkles size={16} color={theme.palette.primary.main} />
                                <Box>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.25 }}>
                                        {user?.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.2 }}>
                                        {roleLabel}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>
                        <MenuItem onClick={() => handleNavigateTo('/profile')} sx={buildActionItemSx(false, isActivePath('/profile'))}>
                            <UserCircle2 size={18} className="menu-action-icon" />
                            <Box sx={{ flexGrow: 1, ml: 1 }}>Profile</Box>
                            <ChevronRight size={16} className="menu-action-arrow" />
                        </MenuItem>
                        <MenuItem onClick={() => handleNavigateTo('/settings')} sx={buildActionItemSx(false, isActivePath('/settings'))}>
                            <Settings size={18} className="menu-action-icon" />
                            <Box sx={{ flexGrow: 1, ml: 1 }}>Settings</Box>
                            <ChevronRight size={16} className="menu-action-arrow" />
                        </MenuItem>
                        <MenuItem onClick={handleLogout} sx={buildActionItemSx(true, false)}>
                            <LogOut size={18} className="menu-action-icon" />
                            <Box sx={{ flexGrow: 1, ml: 1 }}>Logout</Box>
                            <ChevronRight size={16} className="menu-action-arrow" />
                        </MenuItem>
                    </Menu>

                    <Menu
                        id="menu-notifications"
                        anchorEl={notifAnchorEl}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                        open={Boolean(notifAnchorEl)}
                        onClose={handleNotifClose}
                        PaperProps={{ sx: { width: { xs: 'calc(100vw - 32px)', sm: 320 }, p: 0.5 } }}
                    >
                        <Box sx={{ px: 2, py: 1 }}>
                            <Typography variant="subtitle2">Notifications</Typography>
                            <Typography variant="caption" color="text.secondary">
                                Latest order and stock updates
                            </Typography>
                        </Box>
                        {!hasConfigurableNotificationsEnabled && recentNotifications.length === 0 ? (
                            <Box sx={{ px: 2, py: 2, color: 'text.secondary' }}>
                                Notifications are turned off in Settings.
                            </Box>
                        ) : recentNotifications.length === 0 ? (
                            <Box sx={{ px: 2, py: 2, color: 'text.secondary' }}>
                                No notifications yet.
                            </Box>
                        ) : (
                            recentNotifications.map((n: NotificationItem) => (
                                <MenuItem
                                    key={n.id}
                                    onClick={() => {
                                        handleNotifClose();
                                        if (n.path) {
                                            navigate(n.path);
                                        }
                                    }}
                                    sx={{ alignItems: 'flex-start', gap: 1 }}
                                >
                                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', mt: 0.8 }} />
                                    <Box>
                                        <Typography variant="body2" fontWeight={700}>{n.title}</Typography>
                                        <Typography variant="caption" color="text.secondary">{n.detail}</Typography>
                                        <Typography variant="caption" color="text.secondary" display="block">{n.time}</Typography>
                                    </Box>
                                </MenuItem>
                            ))
                        )}
                        <Box sx={{ px: 2, py: 1 }}>
                            <Button
                                fullWidth
                                variant="text"
                                onClick={() => {
                                    handleNotifClose();
                                    navigate('/notifications');
                                }}
                            >
                                Show all notifications
                            </Button>
                        </Box>
                    </Menu>
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default Navbar;
