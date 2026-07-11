import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    InputAdornment,
    MenuItem,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import api from '../../api/axios';
import useAppCurrency from '../../hooks/useAppCurrency';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { getRegionalIdLabel } from '../../lib/regional';
import AppDatePicker from '../../components/Common/AppDatePicker';

interface InstallmentScheduleItem {
    installmentNumber: number;
    dueDate: string;
    amount: number;
    status: 'pending' | 'paid';
    paidAt?: string;
    paidVia?: 'cash' | 'card';
    notes?: string;
}

interface InstallmentWitness {
    name: string;
    cnic: string;
    address: string;
}

interface InstallmentPlan {
    planCode: string;
    productId: string;
    productName: string;
    customerName: string;
    customerCnic: string;
    customerPhone: string;
    customerAddress: string;
    witnesses: InstallmentWitness[];
    saleDate: string;
    installmentMonths: 0 | 3 | 6 | 9 | 12;
    unitPrice: number;
    advancePayment: number;
    financedAmount: number;
    monthlyInstallmentAmount: number;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: 'active' | 'cleared';
    schedule: InstallmentScheduleItem[];
    source?: 'installment' | 'closing-balance';
}

const todayDateInput = () => new Date().toISOString().split('T')[0];

const InstallmentsPage: React.FC = () => {
    const { formatCurrency, currencySymbol } = useAppCurrency();
    const { country } = useSelector((state: RootState) => state.settings);
    const regionalIdLabel = getRegionalIdLabel(country);
    const [plans, setPlans] = useState<InstallmentPlan[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<InstallmentPlan | null>(null);
    const [selectedInstallmentNumber, setSelectedInstallmentNumber] = useState('');
    const [paidVia, setPaidVia] = useState<'cash' | 'card'>('cash');
    const [notes, setNotes] = useState('');
    const [balancePaymentAmount, setBalancePaymentAmount] = useState('');
    const [balancePaymentDate, setBalancePaymentDate] = useState(todayDateInput());
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');

    const loadPlans = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await api.get('/installments');
            setPlans(response.data || []);
        } catch (fetchError: any) {
            setError(fetchError.response?.data?.message || 'Unable to load installment plans.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPlans();
        const refresh = () => loadPlans();
        window.addEventListener('itemhive-installments-updated', refresh);
        return () => window.removeEventListener('itemhive-installments-updated', refresh);
    }, []);

    const activePlans = useMemo(() => plans.filter((plan) => plan.status === 'active'), [plans]);

    const handleOpenPayment = (plan: InstallmentPlan) => {
        const nextPending = plan.schedule.find((item) => item.status === 'pending');
        setSelectedPlan(plan);
        setSelectedInstallmentNumber(nextPending ? String(nextPending.installmentNumber) : '');
        setBalancePaymentAmount(plan.source === 'closing-balance' ? plan.remainingAmount.toFixed(2) : '');
        setBalancePaymentDate(todayDateInput());
        setPaidVia('cash');
        setNotes('');
    };

    const handleClosePayment = () => {
        setSelectedPlan(null);
        setSelectedInstallmentNumber('');
        setBalancePaymentAmount('');
        setBalancePaymentDate(todayDateInput());
        setPaidVia('cash');
        setNotes('');
    };

    const handleSavePayment = async () => {
        if (!selectedPlan) {
            return;
        }

        const isClosingBalance = selectedPlan.source === 'closing-balance';
        if (!isClosingBalance && !selectedInstallmentNumber) {
            return;
        }

        setSaving(true);
        try {
            if (isClosingBalance) {
                const amount = Number(balancePaymentAmount || 0);
                if (!Number.isFinite(amount) || amount <= 0) {
                    throw new Error('Payment amount must be greater than zero.');
                }
                if (amount > selectedPlan.remainingAmount) {
                    throw new Error('Payment cannot exceed the remaining balance.');
                }

                await api.post('/credits/payments', {
                    customerName: selectedPlan.customerName,
                    customerCnic: selectedPlan.customerCnic,
                    amount,
                    paidVia,
                    notes,
                    paymentDate: balancePaymentDate,
                });
                setSuccess(`Payment received from ${selectedPlan.customerName}.`);
                window.dispatchEvent(new Event('itemhive-credit-updated'));
            } else {
                await api.post(`/installments/${selectedPlan.planCode}/payments`, {
                    installmentNumber: Number(selectedInstallmentNumber),
                    paidVia,
                    notes,
                });
                setSuccess(`Installment marked paid for ${selectedPlan.customerName}.`);
            }
            window.dispatchEvent(new Event('itemhive-installments-updated'));
            handleClosePayment();
            await loadPlans();
        } catch (saveError: any) {
            setError(saveError.response?.data?.message || saveError.message || 'Unable to update installment payment.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight={800}>Installments</Typography>
                <Typography variant="body2" color="text.secondary">
                    Manage installment customers, due dates, and monthly payment status.
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}
            {success && (
                <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
                    {success}
                </Alert>
            )}

            <Grid container spacing={3}>
                <Grid size={12}>
                    <Card sx={{ borderRadius: 4, overflow: 'hidden' }}>
                        <CardContent sx={{ p: 0 }}>
                            <TableContainer sx={{ overflowX: 'auto' }}>
                                <Table sx={{ minWidth: 1180 }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 700 }}>PLAN</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>CUSTOMER</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>CONTACT</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>PRODUCT</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>TERM</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>TOTAL</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>REMAINING</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>NEXT DUE</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700 }}>ACTION</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {activePlans.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={9} align="center" sx={{ py: 8 }}>
                                                    <Typography color="text.secondary">
                                                        {loading ? 'Loading installment plans...' : 'No active installment plans right now.'}
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            activePlans.map((plan) => {
                                                const isClosingBalance = plan.source === 'closing-balance';
                                                const nextPending = plan.schedule.find((item) => item.status === 'pending');
                                                const nextDueDate = nextPending ? new Date(nextPending.dueDate) : null;
                                                const isOverdue = nextDueDate ? nextDueDate <= new Date() : false;

                                                return (
                                                    <TableRow key={plan.planCode} hover>
                                                        <TableCell>
                                                            <Typography variant="body2" fontWeight={800}>{plan.planCode}</Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {isClosingBalance ? 'Balance' : 'Sale'}: {new Date(plan.saleDate).toLocaleDateString()}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" fontWeight={700}>{plan.customerName}</Typography>
                                                            <Typography variant="caption" color="text.secondary">{plan.customerCnic}</Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2">{plan.customerPhone}</Typography>
                                                            <Typography variant="caption" color="text.secondary">{plan.customerAddress}</Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" fontWeight={700}>{plan.productName}</Typography>
                                                            {isClosingBalance ? (
                                                                <Typography variant="caption" color="text.secondary">
                                                                    Customer closing amount
                                                                </Typography>
                                                            ) : (
                                                                <>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        {plan.witnesses[0]?.name} / {plan.witnesses[1]?.name}
                                                                    </Typography>
                                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                                        Witness IDs ({regionalIdLabel}): {plan.witnesses[0]?.cnic} / {plan.witnesses[1]?.cnic}
                                                                    </Typography>
                                                                </>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {isClosingBalance ? (
                                                                <>
                                                                    <Typography variant="body2" fontWeight={700}>Manual balance</Typography>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        Receivable credit
                                                                    </Typography>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Typography variant="body2" fontWeight={700}>{plan.installmentMonths} months</Typography>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        {formatCurrency(plan.monthlyInstallmentAmount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/month
                                                                    </Typography>
                                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                                        Advance: {formatCurrency(plan.advancePayment, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                                    </Typography>
                                                                </>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>{formatCurrency(plan.totalAmount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</TableCell>
                                                        <TableCell sx={{ color: 'warning.main', fontWeight: 800 }}>
                                                            {formatCurrency(plan.remainingAmount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                        </TableCell>
                                                        <TableCell>
                                                            {nextPending ? (
                                                                <>
                                                                    <Typography variant="body2" fontWeight={700} color={isOverdue ? 'warning.main' : 'text.primary'}>
                                                                        {new Date(nextPending.dueDate).toLocaleDateString()}
                                                                    </Typography>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        Installment #{nextPending.installmentNumber}
                                                                    </Typography>
                                                                </>
                                                            ) : '-'}
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Button variant="contained" size="small" onClick={() => handleOpenPayment(plan)}>
                                                                {isClosingBalance ? 'Receive Payment' : 'Mark Paid'}
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Dialog open={Boolean(selectedPlan)} onClose={handleClosePayment} maxWidth="sm" fullWidth>
                <DialogTitle>{selectedPlan?.source === 'closing-balance' ? 'Receive Balance Payment' : 'Mark Installment Paid'}</DialogTitle>
                <DialogContent>
                    {selectedPlan && (
                        <Stack spacing={2} sx={{ pt: 1 }}>
                            <Box>
                                <Typography variant="subtitle1" fontWeight={800}>{selectedPlan.customerName}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {selectedPlan.productName} | Remaining {formatCurrency(selectedPlan.remainingAmount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </Typography>
                            </Box>
                            {selectedPlan.source === 'closing-balance' ? (
                                <>
                                    <TextField
                                        fullWidth
                                        type="number"
                                        label="Amount Received"
                                        value={balancePaymentAmount}
                                        onChange={(e) => setBalancePaymentAmount(e.target.value)}
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment>,
                                        }}
                                    />
                                    <AppDatePicker fullWidth label="Payment Date" value={balancePaymentDate} onChange={setBalancePaymentDate} />
                                </>
                            ) : (
                                <TextField
                                    select
                                    fullWidth
                                    label="Installment"
                                    value={selectedInstallmentNumber}
                                    onChange={(e) => setSelectedInstallmentNumber(e.target.value)}
                                >
                                    {selectedPlan.schedule.filter((item) => item.status === 'pending').map((item) => (
                                        <MenuItem key={item.installmentNumber} value={String(item.installmentNumber)}>
                                            #{item.installmentNumber} | {new Date(item.dueDate).toLocaleDateString()} | {formatCurrency(item.amount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            )}
                            <TextField
                                select
                                fullWidth
                                label="Paid Via"
                                value={paidVia}
                                onChange={(e) => setPaidVia(e.target.value as 'cash' | 'card')}
                            >
                                <MenuItem value="cash">Cash</MenuItem>
                                <MenuItem value="card">Card</MenuItem>
                            </TextField>
                            <TextField
                                fullWidth
                                label="Notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                multiline
                                rows={3}
                            />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button variant="outlined" onClick={handleClosePayment}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSavePayment}
                        disabled={saving || (selectedPlan?.source !== 'closing-balance' && !selectedInstallmentNumber)}
                    >
                        {saving ? 'Saving...' : 'Save Payment'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default InstallmentsPage;
