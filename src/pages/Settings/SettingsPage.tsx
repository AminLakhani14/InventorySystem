import React from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    Divider,
    Switch,
    FormControlLabel,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Button,
    Stack,
    Chip,
    alpha,
    useTheme
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { setDarkMode } from '../../features/theme/themeSlice';
import {
    countryCurrencyMap,
    fetchSettings,
    saveSettings,
    setCountry,
    setCurrency,
    setLowStockAlertsEnabled,
    setOrderUpdatesEnabled,
    type CountryCode,
    type CurrencyCode,
    type AppSettings,
    DEFAULT_APP_SETTINGS
} from '../../features/settings/settingsSlice';
import type { AppDispatch } from '../../store';
import type { User } from '../../features/auth/authSlice';
import api from '../../api/axios';

const currencyOptions: Array<{ value: CurrencyCode; label: string }> = [
    { value: 'USD', label: 'USD - US Dollar' },
    { value: 'EUR', label: 'EUR - Euro' },
    { value: 'GBP', label: 'GBP - British Pound' },
    { value: 'CHF', label: 'CHF - Swiss Franc' },
    { value: 'CDF', label: 'CDF - Congolese Franc (DRC)' },
    { value: 'XAF', label: 'XAF - Central African CFA Franc (Congo)' },
    { value: 'PKR', label: 'PKR - Pakistani Rupee' },
    { value: 'INR', label: 'INR - Indian Rupee' },
    { value: 'AED', label: 'AED - UAE Dirham' },
];

const countryOptions: Array<{ value: CountryCode; label: string }> = [
    { value: 'PK', label: 'Pakistan' },
    { value: 'US', label: 'United States' },
    { value: 'DE', label: 'Germany' },
    { value: 'GB', label: 'United Kingdom' },
    { value: 'CH', label: 'Switzerland' },
    { value: 'CD', label: 'DR Congo' },
    { value: 'CG', label: 'Congo' },
    { value: 'IN', label: 'India' },
    { value: 'AE', label: 'United Arab Emirates' },
];

const SettingsPage: React.FC = () => {
    const theme = useTheme();
    const dispatch = useDispatch<AppDispatch>();
    const { mode } = useSelector((state: RootState) => state.theme);
    const { user } = useSelector((state: RootState) => state.auth);
    const { notifications, country, currency, app, loading } = useSelector((state: RootState) => state.settings);
    const activeAppSettings = app || DEFAULT_APP_SETTINGS;
    const [appDraft, setAppDraft] = React.useState<AppSettings>(activeAppSettings);
    const [teamUsers, setTeamUsers] = React.useState<User[]>([]);
    const [teamLoading, setTeamLoading] = React.useState(false);
    const [teamSavingId, setTeamSavingId] = React.useState('');
    const [teamError, setTeamError] = React.useState('');

    React.useEffect(() => {
        dispatch(fetchSettings());
    }, [dispatch]);

    React.useEffect(() => {
        setAppDraft(app || DEFAULT_APP_SETTINGS);
    }, [app]);

    const loadTeamUsers = React.useCallback(async () => {
        if (user?.role !== 'super_admin') return;

        setTeamLoading(true);
        setTeamError('');
        try {
            const response = await api.get('/users');
            setTeamUsers((response.data as User[]).filter((teamUser) => teamUser.role !== 'super_admin'));
        } catch (error: any) {
            setTeamError(error.response?.data?.message || 'Unable to load accounts.');
        } finally {
            setTeamLoading(false);
        }
    }, [user?.role]);

    React.useEffect(() => {
        loadTeamUsers();
    }, [loadTeamUsers]);

    const handleInstallmentAccessChange = async (teamUser: User, installmentAccess: boolean) => {
        setTeamSavingId(teamUser.id);
        setTeamError('');
        try {
            await api.patch(`/users/${teamUser.id}/status`, { installmentAccess });
            await loadTeamUsers();
        } catch (error: any) {
            setTeamError(error.response?.data?.message || 'Unable to update installment access.');
        } finally {
            setTeamSavingId('');
        }
    };

    const persistSettings = (
        nextCountry: CountryCode,
        nextCurrency: CurrencyCode,
        nextNotifications: typeof notifications,
        nextApp: AppSettings = activeAppSettings
    ) => {
        dispatch(saveSettings({
            country: nextCountry,
            currency: nextCurrency,
            notifications: nextNotifications,
            app: nextApp,
        }));
    };

    return (
        <Box>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight={800}>Settings</Typography>
                <Typography variant="body2" color="text.secondary">
                    Personalize your workspace and preferences.
                </Typography>
            </Box>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" fontWeight={700} gutterBottom>Regional</Typography>
                            <Divider sx={{ mb: 2 }} />
                            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                <InputLabel
                                    id="country-select-label"
                                    sx={{
                                        fontWeight: 600,
                                        '&.Mui-focused': { color: 'primary.main' },
                                    }}
                                >
                                    Country
                                </InputLabel>
                                <Select
                                    labelId="country-select-label"
                                    value={country}
                                    label="Country"
                                    onChange={(e) => {
                                        const nextCountry = e.target.value as CountryCode;
                                        const nextCurrency = countryCurrencyMap[nextCountry];
                                        dispatch(setCountry(nextCountry));
                                        persistSettings(nextCountry, nextCurrency, notifications);
                                    }}
                                    sx={{
                                        fontWeight: 600,
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: alpha(theme.palette.primary.main, 0.25),
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                            borderColor: alpha(theme.palette.primary.main, 0.5),
                                        },
                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'primary.main',
                                            borderWidth: 2,
                                        },
                                    }}
                                    MenuProps={{
                                        PaperProps: {
                                            sx: {
                                                mt: 0.5,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                bgcolor: 'background.paper',
                                            },
                                        },
                                    }}
                                >
                                    {countryOptions.map((option) => (
                                        <MenuItem
                                            key={option.value}
                                            value={option.value}
                                            sx={{
                                                fontWeight: option.value === country ? 700 : 500,
                                                '&:hover': {
                                                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                                    color: 'primary.main',
                                                },
                                                '&.Mui-selected': {
                                                    backgroundColor: alpha(theme.palette.primary.main, 0.14),
                                                    color: 'primary.main',
                                                },
                                                '&.Mui-selected:hover': {
                                                    backgroundColor: alpha(theme.palette.primary.main, 0.2),
                                                },
                                            }}
                                        >
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth size="small">
                                <InputLabel
                                    id="currency-select-label"
                                    sx={{
                                        fontWeight: 600,
                                        '&.Mui-focused': { color: 'primary.main' },
                                    }}
                                >
                                    Currency
                                </InputLabel>
                                <Select
                                    labelId="currency-select-label"
                                    value={currency}
                                    label="Currency"
                                    onChange={(e) => {
                                        const nextCurrency = e.target.value as CurrencyCode;
                                        dispatch(setCurrency(nextCurrency));
                                        persistSettings(country, nextCurrency, notifications);
                                    }}
                                    sx={{
                                        fontWeight: 600,
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: alpha(theme.palette.primary.main, 0.25),
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                            borderColor: alpha(theme.palette.primary.main, 0.5),
                                        },
                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                            borderColor: 'primary.main',
                                            borderWidth: 2,
                                        },
                                    }}
                                    MenuProps={{
                                        PaperProps: {
                                            sx: {
                                                mt: 0.5,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                bgcolor: 'background.paper',
                                            },
                                        },
                                    }}
                                >
                                    {currencyOptions.map((option) => (
                                        <MenuItem
                                            key={option.value}
                                            value={option.value}
                                            sx={{
                                                fontWeight: option.value === currency ? 700 : 500,
                                                '&:hover': {
                                                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                                    color: 'primary.main',
                                                },
                                                '&.Mui-selected': {
                                                    backgroundColor: alpha(theme.palette.primary.main, 0.14),
                                                    color: 'primary.main',
                                                },
                                                '&.Mui-selected:hover': {
                                                    backgroundColor: alpha(theme.palette.primary.main, 0.2),
                                                },
                                            }}
                                        >
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
                                Default currency follows the selected country. Pakistan starts with PKR by default.
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" fontWeight={700} gutterBottom>Appearance</Typography>
                            <Divider sx={{ mb: 2 }} />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={mode === 'dark'}
                                        onChange={(e) => dispatch(setDarkMode(e.target.checked ? 'dark' : 'light'))}
                                    />
                                }
                                label="Enable dark mode"
                            />
                        </CardContent>
                    </Card>
                </Grid>

                {user?.role === 'super_admin' && (
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" fontWeight={700} gutterBottom>POS & Receipt</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Shared configuration used by every POS account and customer receipt.
                                </Typography>
                                <Divider sx={{ mb: 2 }} />
                                <Stack spacing={2}>
                                    <TextField
                                        size="small"
                                        label="Sales Tax %"
                                        type="number"
                                        value={appDraft.salesTaxRate}
                                        onChange={(event) => setAppDraft({ ...appDraft, salesTaxRate: Number(event.target.value) })}
                                        inputProps={{ min: 0, max: 100, step: 0.01 }}
                                    />
                                    <TextField
                                        size="small"
                                        label="Shop Name"
                                        value={appDraft.shopName}
                                        onChange={(event) => setAppDraft({ ...appDraft, shopName: event.target.value })}
                                    />
                                    <TextField
                                        size="small"
                                        label="Shop Phone"
                                        value={appDraft.shopPhone}
                                        onChange={(event) => setAppDraft({ ...appDraft, shopPhone: event.target.value })}
                                    />
                                    <TextField
                                        size="small"
                                        label="Shop Address"
                                        value={appDraft.shopAddress}
                                        onChange={(event) => setAppDraft({ ...appDraft, shopAddress: event.target.value })}
                                        multiline
                                        rows={2}
                                    />
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={appDraft.installmentsEnabled}
                                                onChange={(event) => setAppDraft({ ...appDraft, installmentsEnabled: event.target.checked })}
                                            />
                                        }
                                        label="Enable installments for permitted accounts"
                                    />
                                    <Typography variant="caption" color="text.secondary">
                                        Super admin always keeps access. Enable this switch before granting installment access to selected accounts in Team Management.
                                    </Typography>
                                    <Button
                                        variant="contained"
                                        onClick={() => persistSettings(country, currency, notifications, appDraft)}
                                        disabled={loading}
                                    >
                                        Save POS Settings
                                    </Button>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                )}

                {user?.role === 'super_admin' && (
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" fontWeight={700} gutterBottom>Installment Access</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Choose which accounts can use installments after the master switch is enabled.
                                </Typography>
                                <Divider sx={{ mb: 2 }} />
                                {teamError && (
                                    <Typography variant="body2" color="error.main" sx={{ mb: 1.5 }}>
                                        {teamError}
                                    </Typography>
                                )}
                                <Stack spacing={1.5}>
                                    {teamLoading && <Typography variant="body2" color="text.secondary">Loading accounts...</Typography>}
                                    {!teamLoading && teamUsers.map((teamUser) => (
                                        <Box
                                            key={teamUser.id}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 2,
                                                p: 1.5,
                                                borderRadius: 2,
                                                bgcolor: 'action.hover',
                                            }}
                                        >
                                            <Box>
                                                <Typography variant="body2" fontWeight={700}>{teamUser.name}</Typography>
                                                <Typography variant="caption" color="text.secondary">{teamUser.email}</Typography>
                                            </Box>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Chip size="small" label={teamUser.role === 'admin' ? 'Admin' : 'User'} />
                                                <Switch
                                                    checked={Boolean(teamUser.installmentAccess)}
                                                    onChange={(_, checked) => handleInstallmentAccessChange(teamUser, checked)}
                                                    disabled={teamSavingId === teamUser.id}
                                                />
                                            </Stack>
                                        </Box>
                                    ))}
                                    {!teamLoading && !teamUsers.length && (
                                        <Typography variant="body2" color="text.secondary">No accounts created yet.</Typography>
                                    )}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                )}

                <Grid size={{ xs: 12, md: 6 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" fontWeight={700} gutterBottom>Notifications</Typography>
                            <Divider sx={{ mb: 2 }} />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={notifications.orderUpdates}
                                        onChange={(e) => {
                                            const nextNotifications = {
                                                ...notifications,
                                                orderUpdates: e.target.checked,
                                            };
                                            dispatch(setOrderUpdatesEnabled(e.target.checked));
                                            persistSettings(country, currency, nextNotifications);
                                        }}
                                    />
                                }
                                label="Order updates"
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={notifications.lowStockAlerts}
                                        onChange={(e) => {
                                            const nextNotifications = {
                                                ...notifications,
                                                lowStockAlerts: e.target.checked,
                                            };
                                            dispatch(setLowStockAlertsEnabled(e.target.checked));
                                            persistSettings(country, currency, nextNotifications);
                                        }}
                                    />
                                }
                                label="Low stock alerts"
                            />
                            <Typography variant="caption" color="text.secondary">
                                {loading ? 'Saving changes...' : 'Settings are synced with the backend database.'}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default SettingsPage;
