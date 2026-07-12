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
import { Download, Printer, Search, Share2 } from 'lucide-react';

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

interface PaymentHistoryItem {
    id: string;
    source: 'installment' | 'balance';
    timestamp: string;
    customerName: string;
    customerCnic: string;
    description: string;
    amount: number;
    paidVia: 'cash' | 'card';
    notes: string;
    remainingAmount: number;
}

const todayDateInput = () => new Date().toISOString().split('T')[0];

const escapePdfText = (value: string) => value
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const InstallmentsPage: React.FC = () => {
    const { formatCurrency, currencySymbol } = useAppCurrency();
    const { country } = useSelector((state: RootState) => state.settings);
    const regionalIdLabel = getRegionalIdLabel(country);
    const [plans, setPlans] = useState<InstallmentPlan[]>([]);
    const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
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
    const [searchTerm, setSearchTerm] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const loadPlans = async () => {
        setLoading(true);
        setError('');
        try {
            const [plansResponse, paymentsResponse] = await Promise.all([
                api.get('/installments'),
                api.get('/installments/payments'),
            ]);
            setPlans(plansResponse.data || []);
            setPaymentHistory(paymentsResponse.data || []);
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

    const activePlans = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();

        return plans
            .filter((plan) => plan.status === 'active')
            .filter((plan) => {
                const saleDate = new Date(plan.saleDate);
                if (fromDate && saleDate < new Date(`${fromDate}T00:00:00`)) return false;
                if (toDate && saleDate > new Date(`${toDate}T23:59:59.999`)) return false;
                return true;
            })
            .filter((plan) => {
                if (!query) return true;
                return [
                    plan.customerName,
                    plan.customerCnic,
                    plan.customerPhone,
                    plan.customerAddress,
                    plan.productName,
                    plan.installmentMonths,
                    plan.totalAmount,
                    plan.paidAmount,
                    plan.remainingAmount,
                    new Date(plan.saleDate).toLocaleDateString(),
                ].join(' ').toLowerCase().includes(query);
            });
    }, [plans, searchTerm, fromDate, toDate]);

    const exportToExcel = () => {
        const escapeCsv = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
        const rows = activePlans.map((plan) => [
            plan.customerName,
            plan.customerCnic,
            plan.customerPhone,
            plan.productName,
            plan.installmentMonths ? `${plan.installmentMonths} months` : 'Manual balance',
            plan.totalAmount,
            plan.paidAmount,
            plan.remainingAmount,
            plan.schedule.find((item) => item.status === 'pending')?.dueDate || '',
        ]);
        const csv = [
            ['Customer', 'Customer ID', 'Contact', 'Product', 'Term', 'Total', 'Paid', 'Remaining', 'Next Due'],
            ...rows,
        ].map((row) => row.map(escapeCsv).join(',')).join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `installments-${todayDateInput()}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const buildPaymentPdf = (payment: PaymentHistoryItem) => {
        const lines = [
            'ITEMHIVE - PAYMENT RECEIPT',
            `Date: ${new Date(payment.timestamp).toLocaleString()}`,
            `Customer: ${payment.customerName}`,
            `Customer ID: ${payment.customerCnic || 'N/A'}`,
            `Payment: ${payment.description}`,
            `Amount Received: ${formatCurrency(payment.amount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
            `Paid Via: ${payment.paidVia}`,
            `Remaining Balance: ${formatCurrency(payment.remainingAmount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
            payment.notes ? `Notes: ${payment.notes}` : '',
        ].filter(Boolean);
        const stream = lines.map((line, index) => `BT /F${index === 0 ? '2' : '1'} ${index === 0 ? 18 : 12} Tf 54 ${790 - index * 35} Td (${escapePdfText(line)}) Tj ET`).join('\n');
        const objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
            `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
        ];
        let pdf = '%PDF-1.4\n';
        const offsets = [0];
        objects.forEach((object, index) => {
            offsets.push(pdf.length);
            pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
        });
        const xrefOffset = pdf.length;
        pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
        offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
        pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
        return new Blob([pdf], { type: 'application/pdf' });
    };

    const sharePaymentPdf = async (payment: PaymentHistoryItem) => {
        const fileName = `payment-receipt-${payment.customerName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date(payment.timestamp).toISOString().slice(0, 10)}.pdf`;
        const file = new File([buildPaymentPdf(payment)], fileName, { type: 'application/pdf' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
            try {
                await navigator.share({ title: 'Payment Receipt', files: [file] });
                return;
            } catch (shareError: any) {
                if (shareError?.name === 'AbortError') return;
            }
        }
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
    };

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
                            <Box
                                sx={{
                                    p: 2.5,
                                    display: 'flex',
                                    gap: 1.5,
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    borderBottom: '1px solid',
                                    borderColor: 'divider',
                                }}
                            >
                                <TextField
                                    size="small"
                                    placeholder="Search customer, contact, product, amount..."
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Search size={18} />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{ minWidth: { xs: '100%', sm: 340 } }}
                                />
                                <AppDatePicker size="small" label="From" value={fromDate} onChange={setFromDate} maxDate={toDate || undefined} />
                                <AppDatePicker size="small" label="To" value={toDate} onChange={setToDate} minDate={fromDate || undefined} />
                                {(searchTerm || fromDate || toDate) && (
                                    <Button
                                        size="small"
                                        onClick={() => {
                                            setSearchTerm('');
                                            setFromDate('');
                                            setToDate('');
                                        }}
                                        sx={{ fontWeight: 800 }}
                                    >
                                        Clear Filters
                                    </Button>
                                )}
                                <Button variant="outlined" size="small" startIcon={<Download size={17} />} onClick={exportToExcel} sx={{ fontWeight: 800, ml: 'auto' }}>
                                    Export Excel
                                </Button>
                                <Button variant="outlined" size="small" startIcon={<Printer size={17} />} onClick={() => window.print()} sx={{ fontWeight: 800 }}>
                                    Print
                                </Button>
                            </Box>
                            <TableContainer sx={{ overflowX: 'auto' }}>
                                <Table sx={{ minWidth: 1120 }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 700 }}>CUSTOMER</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>CONTACT</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>PRODUCT</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>TERM</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>TOTAL</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>PAID</TableCell>
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
                                                            <Typography variant="body2" fontWeight={700}>{plan.customerName}</Typography>
                                                            <Typography variant="caption" color="text.secondary">{plan.customerCnic}</Typography>
                                                            <Typography variant="caption" color="text.secondary" display="block">
                                                                {isClosingBalance ? 'Balance' : 'Sale'}: {new Date(plan.saleDate).toLocaleDateString()}
                                                            </Typography>
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
                                                        <TableCell sx={{ color: 'success.main', fontWeight: 800 }}>
                                                            {formatCurrency(plan.paidAmount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                        </TableCell>
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
                <Grid size={12}>
                    <Card sx={{ borderRadius: 4, overflow: 'hidden' }}>
                        <CardContent sx={{ p: 0 }}>
                            <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="h6" fontWeight={800}>Received Installment Payments</Typography>
                                <Typography variant="body2" color="text.secondary">Every received installment and credit-balance payment. Use the PDF action to share a receipt.</Typography>
                            </Box>
                            <TableContainer sx={{ overflowX: 'auto' }}>
                                <Table sx={{ minWidth: 1060 }} size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 700 }}>DATE</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>CUSTOMER</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>PAYMENT</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>PAID VIA</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>RECEIVED</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>REMAINING</TableCell>
                                            <TableCell sx={{ fontWeight: 700 }}>NOTES</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700 }}>PDF</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {paymentHistory.length === 0 ? (
                                            <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No installment payments received yet.</Typography></TableCell></TableRow>
                                        ) : paymentHistory.map((payment) => (
                                            <TableRow key={payment.id} hover>
                                                <TableCell>{new Date(payment.timestamp).toLocaleString()}</TableCell>
                                                <TableCell><Typography fontWeight={700}>{payment.customerName}</Typography><Typography variant="caption" color="text.secondary">{payment.customerCnic || 'No ID'}</Typography></TableCell>
                                                <TableCell>{payment.description}</TableCell>
                                                <TableCell sx={{ textTransform: 'capitalize' }}>{payment.paidVia}</TableCell>
                                                <TableCell sx={{ color: 'success.main', fontWeight: 800 }}>{formatCurrency(payment.amount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</TableCell>
                                                <TableCell sx={{ color: payment.remainingAmount > 0 ? 'warning.main' : 'success.main', fontWeight: 800 }}>{formatCurrency(payment.remainingAmount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</TableCell>
                                                <TableCell>{payment.notes || '-'}</TableCell>
                                                <TableCell align="right"><Button size="small" variant="outlined" startIcon={<Share2 size={15} />} onClick={() => void sharePaymentPdf(payment)}>PDF</Button></TableCell>
                                            </TableRow>
                                        ))}
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
