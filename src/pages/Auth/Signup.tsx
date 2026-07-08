import React, { useEffect, useState } from 'react';
import {
    Box,
    Typography,
    TextField,
    Button,
    InputAdornment,
    IconButton,
    Alert,
    Container,
    Paper,
    MenuItem,
    CircularProgress
} from '@mui/material';
import { Mail, Lock, Eye, EyeOff, UserPlus, User, Smartphone, Tablet, Package, ScanLine, Boxes, ShoppingCart, Barcode } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { alpha, useTheme } from '@mui/material/styles';
import { clearError, registerUser } from '../../features/auth/authSlice';
import type { AppDispatch, RootState } from '../../store';
import api from '../../api/axios';
import { countryCurrencyMap, type CountryCode } from '../../features/settings/settingsSlice';

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

const packageOptions = [
    { id: 'free_trial', name: 'Free Trial', detail: '2 months free access' },
    { id: 'starter', name: 'Starter Monthly', detail: 'Inventory, POS, reports' },
    { id: 'pro', name: 'Pro Monthly', detail: 'Everything plus credits, installments, team controls' },
];

const Signup: React.FC = () => {
    const theme = useTheme();
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const location = useLocation();
    const { loading, error, user } = useSelector((state: RootState) => state.auth);
    const [showPassword, setShowPassword] = useState(false);
    const [success, setSuccess] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [packageId, setPackageId] = useState('free_trial');
    const [country, setCountry] = useState<CountryCode>('PK');
    const [businessType, setBusinessType] = useState('');
    const [phone, setPhone] = useState('');
    const [employeeCount, setEmployeeCount] = useState('1');
    const [address, setAddress] = useState('');
    const [notes, setNotes] = useState('');
    const [requestError, setRequestError] = useState('');
    const isSuperAdmin = user?.role === 'super_admin';
    const [role, setRole] = useState<'super_admin' | 'admin' | 'user'>(isSuperAdmin ? 'admin' : 'user');
    const [password, setPassword] = useState('');

    useEffect(() => {
        setRole(isSuperAdmin ? 'admin' : 'user');
    }, [isSuperAdmin]);

    useEffect(() => {
        const queryPlan = new URLSearchParams(location.search).get('plan');
        if (queryPlan && packageOptions.some((plan) => plan.id === queryPlan)) {
            setPackageId(queryPlan);
        }
    }, [location.search]);
    const floatingWidgets = [
        { icon: <Smartphone size={20} />, left: '12%', top: '20%', rotate: -7 },
        { icon: <Tablet size={20} />, left: '30%', top: '42%', rotate: 6 },
        { icon: <Package size={20} />, left: '74%', top: '22%', rotate: -5 },
        { icon: <ScanLine size={20} />, left: '68%', top: '58%', rotate: 7 },
        { icon: <Boxes size={20} />, left: '20%', top: '66%', rotate: -8 },
        { icon: <ShoppingCart size={20} />, left: '82%', top: '44%', rotate: 4 },
        { icon: <Barcode size={20} />, left: '46%', top: '14%', rotate: -3 },
        { icon: <Package size={20} />, left: '56%', top: '74%', rotate: 8 },
    ];

    useEffect(() => {
        return () => {
            dispatch(clearError());
        };
    }, [dispatch]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user) {
            setRequestError('');
            try {
                await api.post('/signup-requests', {
                    fullName: name,
                    email,
                    password,
                    businessName,
                    packageId,
                    packageName: packageOptions.find((plan) => plan.id === packageId)?.name || 'Free Trial',
                    country,
                    currency: countryCurrencyMap[country],
                    businessType,
                    phone,
                    employeeCount: Number(employeeCount || 1),
                    address,
                    notes,
                });
                setSuccess(true);
            } catch (error: any) {
                setRequestError(error.response?.data?.message || 'Unable to submit signup request.');
            }
            return;
        }

        const result = await dispatch(registerUser({
            name,
            email,
            password,
            role,
            businessName: isSuperAdmin && role === 'admin' ? businessName : undefined,
        }));
        if (registerUser.fulfilled.match(result)) {
            setSuccess(true);
        }
    };

    useEffect(() => {
        if (!success) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            dispatch(clearError());
            setSuccess(false);
            navigate('/login');
        }, 1500);

        return () => window.clearTimeout(timeoutId);
    }, [success, dispatch, navigate]);

    return (
        <Box
            sx={{
                position: 'relative',
                minHeight: '100dvh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'auto',
                background: theme.palette.mode === 'light'
                    ? 'radial-gradient(circle at 15% 10%, rgba(14, 165, 165, 0.2), transparent 45%), radial-gradient(circle at 85% 0%, rgba(37, 99, 235, 0.14), transparent 45%), linear-gradient(180deg, #eef6f7 0%, #e8eff7 100%)'
                    : 'radial-gradient(circle at 15% 10%, rgba(45, 212, 191, 0.2), transparent 45%), radial-gradient(circle at 85% 0%, rgba(59, 130, 246, 0.18), transparent 45%), linear-gradient(180deg, #0b1220 0%, #0f172a 100%)',
                p: { xs: 1, md: 2 },
                py: { xs: 1.5, md: 2 }
            }}
        >
            {floatingWidgets.map((item, index) => (
                <motion.div
                    key={`${item.left}-${item.top}`}
                    initial={{ y: 0, opacity: 0.48, rotate: item.rotate }}
                    animate={{ y: [0, -13, 0], rotate: [item.rotate, item.rotate + 3, item.rotate] }}
                    transition={{ duration: 4.2 + index * 0.6, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                        position: 'absolute',
                        left: item.left,
                        top: item.top,
                        zIndex: 0,
                        pointerEvents: 'none',
                    }}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'light' ? 0.78 : 0.2),
                            border: '1px solid',
                            borderColor: alpha(theme.palette.primary.main, 0.35),
                            color: theme.palette.primary.main,
                            boxShadow: '0 10px 24px -14px rgba(2, 6, 23, 0.5)',
                            backdropFilter: 'blur(6px)'
                        }}
                    >
                        {item.icon}
                    </Box>
                </motion.div>
            ))}
            <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <Paper
                        elevation={24}
                        sx={{
                            borderRadius: { xs: 4, md: 5 },
                            p: 0,
                            border: '1px solid',
                            borderColor: 'divider',
                            maxHeight: { xs: 'calc(100dvh - 24px)', md: 'calc(100dvh - 48px)' },
                            maxWidth: 760,
                            mx: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}
                    >
                        <Box sx={{ px: { xs: 2, md: 3 }, pt: { xs: 2, md: 2.5 }, pb: 1, textAlign: 'center', flexShrink: 0 }}>
                            <Typography variant="h4" fontWeight={800} color="primary.main" sx={{ fontSize: { xs: '1.7rem', md: '2.05rem' } }}>
                                Join ItemHive
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {user ? 'Create a new workspace account.' : 'Request a new business workspace.'}
                            </Typography>
                        </Box>

                        <Box
                            component="form"
                            onSubmit={handleSubmit}
                            sx={{
                                px: { xs: 2, md: 3 },
                                pb: { xs: 2, md: 2.5 },
                                flexGrow: 1,
                                minHeight: 0,
                                overflowY: 'auto',
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                                columnGap: 1.5,
                                rowGap: 0.75,
                                '& .MuiTextField-root': { mb: 0 },
                                '&::-webkit-scrollbar': { width: 6 },
                                '&::-webkit-scrollbar-thumb': {
                                    backgroundColor: alpha(theme.palette.primary.main, 0.35),
                                    borderRadius: 8,
                                },
                            }}
                        >
                            {success && (
                                <Alert severity="success" sx={{ borderRadius: 2, gridColumn: '1 / -1' }}>
                                    {user ? 'Account created successfully! Redirecting to login...' : 'Request submitted successfully. We will email you after review.'}
                                </Alert>
                            )}

                            {(error || requestError) && (
                                <Alert severity="error" sx={{ borderRadius: 2, gridColumn: '1 / -1' }}>
                                    {error || requestError}
                                </Alert>
                            )}
                            <TextField
                                fullWidth
                                label="Full Name"
                                variant="outlined"
                                margin="dense"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                disabled={loading || success}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <User size={20} color="#64748b" />
                                        </InputAdornment>
                                    ),
                                }}
                            />
                            <TextField
                                fullWidth
                                label="Email Address"
                                variant="outlined"
                                margin="dense"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading || success}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <Mail size={20} color="#64748b" />
                                        </InputAdornment>
                                    ),
                                }}
                            />
                            <TextField
                                select
                                fullWidth
                                label="Role"
                                variant="outlined"
                                margin="dense"
                                value={role}
                                onChange={(e) => setRole(e.target.value as 'super_admin' | 'admin' | 'user')}
                                required
                                disabled={loading || success}
                            >
                                {isSuperAdmin && <MenuItem value="admin">Administrator</MenuItem>}
                                {isSuperAdmin && <MenuItem value="super_admin">Super Admin</MenuItem>}
                                <MenuItem value="user">User</MenuItem>
                            </TextField>
                            {(!user || (isSuperAdmin && role === 'admin')) && (
                                <TextField
                                    fullWidth
                                    label="Business / Shop Name"
                                    variant="outlined"
                                    margin="dense"
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    required
                                    disabled={loading || success}
                                    helperText={user ? 'A separate workspace will be created for this shop.' : 'Tell us which business this account is for.'}
                                />
                            )}
                            {!user && (
                                <TextField
                                    select
                                    fullWidth
                                    label="Package"
                                    variant="outlined"
                                    margin="dense"
                                    value={packageId}
                                    onChange={(e) => setPackageId(e.target.value)}
                                    required
                                    disabled={loading || success}
                                >
                                    {packageOptions.map((plan) => (
                                        <MenuItem key={plan.id} value={plan.id}>
                                            {plan.name} - {plan.detail}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            )}
                            {!user && (
                                <>
                                    <TextField
                                        select
                                        fullWidth
                                        label="Country"
                                        variant="outlined"
                                        margin="dense"
                                        value={country}
                                        onChange={(e) => setCountry(e.target.value as CountryCode)}
                                        required
                                        disabled={loading || success}
                                    >
                                        {countryOptions.map((option) => (
                                            <MenuItem key={option.value} value={option.value}>
                                                {option.label} ({countryCurrencyMap[option.value]})
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                    <TextField
                                        fullWidth
                                        label="Business Type"
                                        variant="outlined"
                                        margin="dense"
                                        value={businessType}
                                        onChange={(e) => setBusinessType(e.target.value)}
                                        disabled={loading || success}
                                        placeholder="Retail, grocery, pharmacy, electronics..."
                                    />
                                    <TextField
                                        fullWidth
                                        label="Phone / WhatsApp"
                                        variant="outlined"
                                        margin="dense"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        disabled={loading || success}
                                    />
                                    <TextField
                                        fullWidth
                                        label="Employees"
                                        type="number"
                                        variant="outlined"
                                        margin="dense"
                                        value={employeeCount}
                                        onChange={(e) => setEmployeeCount(e.target.value)}
                                        required
                                        inputProps={{ min: 1 }}
                                        disabled={loading || success}
                                    />
                                    <TextField
                                        fullWidth
                                        label="Business Address"
                                        variant="outlined"
                                        margin="dense"
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        disabled={loading || success}
                                    />
                                    <TextField
                                        fullWidth
                                        label="Notes"
                                        variant="outlined"
                                        margin="dense"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        disabled={loading || success}
                                        multiline
                                        minRows={2}
                                        placeholder="Anything the team should know before approving?"
                                        sx={{ gridColumn: { xs: 'auto', md: '1 / -1' } }}
                                    />
                                </>
                            )}
                            <TextField
                                fullWidth
                                label="Password"
                                type={showPassword ? 'text' : 'password'}
                                variant="outlined"
                                margin="dense"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={loading || success}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <Lock size={20} color="#64748b" />
                                        </InputAdornment>
                                    ),
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" disabled={loading || success}>
                                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />

                            <Button
                                fullWidth
                                variant="contained"
                                size="large"
                                type="submit"
                                disabled={loading || success}
                                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <UserPlus size={20} />}
                                sx={{
                                    gridColumn: '1 / -1',
                                    mt: 0.75,
                                    py: 1.05,
                                    borderRadius: 2,
                                    fontSize: '0.95rem',
                                    fontWeight: 800,
                                    boxShadow: `0 12px 22px -12px ${alpha(theme.palette.primary.main, 0.8)}`
                                }}
                            >
                                {loading ? 'Creating Account...' : user ? 'Create Account' : 'Submit Request'}
                            </Button>
                        </Box>

                        <Box sx={{ px: { xs: 2, md: 3 }, py: 1.4, textAlign: 'center', flexShrink: 0, borderTop: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="body2" color="text.secondary">
                                Already have an account?{' '}
                                <Button
                                    variant="text"
                                    size="small"
                                    onClick={() => navigate('/login')}
                                    disabled={loading}
                                    sx={{ fontWeight: 700, textTransform: 'none' }}
                                >
                                    Sign In
                                </Button>
                            </Typography>
                        </Box>
                    </Paper>
                </motion.div>
            </Container>
        </Box>
    );
};

export default Signup;
