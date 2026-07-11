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
    Snackbar,
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
import { Printer, Search, WalletCards } from 'lucide-react';
import api from '../../api/axios';
import useAppCurrency from '../../hooks/useAppCurrency';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { getRegionalIdLabel } from '../../lib/regional';
import AppDatePicker from '../../components/Common/AppDatePicker';

interface CreditCustomer {
    customerName: string;
    customerCnic: string;
    totalInvoices: number;
    totalSoldAmount: number;
    totalPaidAtSale: number;
    totalCreditIssued: number;
    totalRecovered: number;
    outstandingAmount: number;
    lastSaleAt?: string | null;
    lastPaymentAt?: string | null;
    nextDueDate?: string | null;
}

interface CreditPayment {
    _id: string;
    customerName: string;
    customerCnic: string;
    receivedAmount: number;
    paidVia: 'cash' | 'card';
    notes?: string;
    timestamp: string;
}

const todayDateInput = () => new Date().toISOString().split('T')[0];

const CreditCustomersPage: React.FC = () => {
    const { formatCurrency, currencySymbol } = useAppCurrency();
    const { country } = useSelector((state: RootState) => state.settings);
    const regionalIdLabel = getRegionalIdLabel(country);
    const [customers, setCustomers] = useState<CreditCustomer[]>([]);
    const [payments, setPayments] = useState<CreditPayment[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<CreditCustomer | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(todayDateInput());
    const [nextDueDate, setNextDueDate] = useState('');
    const [paidVia, setPaidVia] = useState<'cash' | 'card'>('cash');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const loadCustomers = async () => {
        setLoading(true);
        setError('');

        try {
            const [customersResponse, paymentsResponse] = await Promise.all([
                api.get('/credits/customers'),
                api.get('/credits/payments'),
            ]);
            setCustomers(customersResponse.data || []);
            setPayments(paymentsResponse.data || []);
        } catch (fetchError: any) {
            setError(fetchError.response?.data?.message || 'Unable to load credit customers.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCustomers();
        const refresh = () => loadCustomers();
        window.addEventListener('itemhive-credit-updated', refresh);
        return () => window.removeEventListener('itemhive-credit-updated', refresh);
    }, []);

    const filteredCustomers = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) {
            return customers;
        }

        return customers.filter((customer) => {
            const haystack = [
                customer.customerName,
                customer.customerCnic,
                String(customer.totalInvoices),
                String(customer.totalCreditIssued),
                String(customer.totalRecovered),
                String(customer.outstandingAmount),
                customer.lastSaleAt ? new Date(customer.lastSaleAt).toLocaleString() : '',
            ]
                .join(' ')
                .toLowerCase();
            return haystack.includes(query);
        });
    }, [customers, searchTerm]);

    const filteredPayments = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return payments;
        return payments.filter((payment) => [
            payment.customerName,
            payment.customerCnic,
            payment.receivedAmount,
            payment.paidVia,
            payment.notes,
            new Date(payment.timestamp).toLocaleString(),
        ].join(' ').toLowerCase().includes(query));
    }, [payments, searchTerm]);

    const handlePrint = () => {
        window.print();
    };

    const totals = useMemo(() => filteredCustomers.reduce((acc, customer) => {
        acc.outstanding += customer.outstandingAmount;
        acc.recovered += customer.totalRecovered;
        acc.customers += 1;
        return acc;
    }, { outstanding: 0, recovered: 0, customers: 0 }), [filteredCustomers]);

    const handleOpenPayment = (customer: CreditCustomer) => {
        setSelectedCustomer(customer);
        setPaymentAmount(customer.outstandingAmount.toFixed(2));
        setPaymentDate(todayDateInput());
        setNextDueDate('');
        setPaidVia('cash');
        setNotes('');
    };

    const handleClosePayment = () => {
        setSelectedCustomer(null);
        setPaymentAmount('');
        setPaymentDate(todayDateInput());
        setNextDueDate('');
        setPaidVia('cash');
        setNotes('');
    };

    const remainingAfterPayment = selectedCustomer
        ? Math.max(selectedCustomer.outstandingAmount - Number(paymentAmount || 0), 0)
        : 0;
    const isPartialPayment = remainingAfterPayment > 0;

    const handleSubmitPayment = async () => {
        if (!selectedCustomer) {
            return;
        }

        if (isPartialPayment && !nextDueDate) {
            setError('Please select a due date for the remaining balance.');
            return;
        }

        setSaving(true);

        try {
            await api.post('/credits/payments', {
                customerName: selectedCustomer.customerName,
                customerCnic: selectedCustomer.customerCnic,
                amount: Number(paymentAmount),
                paidVia,
                notes,
                paymentDate,
                nextDueDate: isPartialPayment ? nextDueDate : null,
            });

            const paidLabel = formatCurrency(Number(paymentAmount || 0), { minimumFractionDigits: 0, maximumFractionDigits: 2 });
            setSuccessMessage(`${paidLabel} received from ${selectedCustomer.customerName}.`);
            handleClosePayment();
            await loadCustomers();
        } catch (saveError: any) {
            setError(saveError.response?.data?.message || 'Unable to save payment.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight={800}>Credit Customers</Typography>
                <Typography variant="body2" color="text.secondary">
                    Track udhar balances and update customer payments as they pay back.
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ borderRadius: 4 }}>
                        <CardContent>
                            <Typography variant="body2" color="text.secondary">Customers with due</Typography>
                            <Typography variant="h4" fontWeight={900}>{totals.customers}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ borderRadius: 4 }}>
                        <CardContent>
                            <Typography variant="body2" color="text.secondary">Outstanding balance</Typography>
                            <Typography variant="h4" fontWeight={900} color="warning.main">
                                {formatCurrency(totals.outstanding, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ borderRadius: 4 }}>
                        <CardContent>
                            <Typography variant="body2" color="text.secondary">Recovered so far</Typography>
                            <Typography variant="h4" fontWeight={900} color="success.main">
                                {formatCurrency(totals.recovered, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Card id="printable-credit-customers" sx={{ borderRadius: 4, overflow: 'hidden' }}>
                <CardContent sx={{ p: 0 }}>
                    <Box className="print-only" sx={{ display: 'none', p: 2.5 }}>
                        <Typography variant="h5" fontWeight={900}>Credit Customers</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Generated on {new Date().toLocaleString()}
                        </Typography>
                        <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
                            <Typography variant="body2">Customers with due: {totals.customers}</Typography>
                            <Typography variant="body2">
                                Outstanding: {formatCurrency(totals.outstanding, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </Typography>
                            <Typography variant="body2">
                                Recovered: {formatCurrency(totals.recovered, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </Typography>
                        </Stack>
                    </Box>

                    <Box className="no-print" sx={{ p: 2.5, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid', borderColor: 'divider' }}>
                        <TextField
                            placeholder={`Search by customer, ${regionalIdLabel}, invoices, amount, date...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search size={18} />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ flex: 1, minWidth: { xs: '100%', sm: 300 } }}
                        />
                        <Button
                            variant="outlined"
                            startIcon={<Printer size={18} />}
                            onClick={handlePrint}
                            sx={{ fontWeight: 800 }}
                        >
                            Print
                        </Button>
                    </Box>

                    <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table sx={{ minWidth: 1040 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>CUSTOMER</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>INVOICES</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>CREDIT ISSUED</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>RECOVERED</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>OUTSTANDING</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>LAST SALE</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>NEXT DUE</TableCell>
                                    <TableCell align="right" className="no-print" sx={{ fontWeight: 700 }}>ACTION</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredCustomers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                                            <Typography color="text.secondary">
                                                {loading ? 'Loading credit customers...' : 'No outstanding credit customers right now.'}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredCustomers.map((customer) => (
                                        <TableRow key={`${customer.customerCnic}-${customer.customerName}`} hover>
                                            <TableCell>
                                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                    {customer.customerName}
                                                </Typography>
                                                {customer.customerCnic && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        {regionalIdLabel}: {customer.customerCnic}
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>{customer.totalInvoices}</TableCell>
                                            <TableCell>{formatCurrency(customer.totalCreditIssued, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</TableCell>
                                            <TableCell sx={{ color: 'success.main', fontWeight: 700 }}>
                                                {formatCurrency(customer.totalRecovered, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell sx={{ color: 'warning.main', fontWeight: 900 }}>
                                                {formatCurrency(customer.outstandingAmount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell>
                                                {customer.lastSaleAt ? new Date(customer.lastSaleAt).toLocaleString() : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {customer.nextDueDate
                                                    ? new Date(customer.nextDueDate).toLocaleDateString()
                                                    : '-'}
                                            </TableCell>
                                            <TableCell align="right" className="no-print">
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    startIcon={<WalletCards size={16} />}
                                                    onClick={() => handleOpenPayment(customer)}
                                                >
                                                    Receive Payment
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </CardContent>
            </Card>

            <Card sx={{ borderRadius: 4, overflow: 'hidden', mt: 3 }}>
                <CardContent sx={{ p: 0 }}>
                    <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h6" fontWeight={900}>Payment History</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Amount received and the client it was received for.
                        </Typography>
                    </Box>
                    <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table sx={{ minWidth: 760 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>DATE</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>CLIENT</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>{regionalIdLabel.toUpperCase()}</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>RECEIVED</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>PAID VIA</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>NOTES</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredPayments.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                                        <Typography color="text.secondary">No credit payments received yet.</Typography>
                                    </TableCell></TableRow>
                                ) : filteredPayments.map((payment) => (
                                    <TableRow key={payment._id} hover>
                                        <TableCell>{new Date(payment.timestamp).toLocaleString()}</TableCell>
                                        <TableCell sx={{ fontWeight: 800 }}>{payment.customerName}</TableCell>
                                        <TableCell>{payment.customerCnic || '-'}</TableCell>
                                        <TableCell sx={{ color: 'success.main', fontWeight: 900 }}>
                                            {formatCurrency(payment.receivedAmount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell sx={{ textTransform: 'capitalize' }}>{payment.paidVia}</TableCell>
                                        <TableCell>{payment.notes || '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </CardContent>
            </Card>

            <style>
                {`
                .print-only { display: none; }
                @media print {
                    body * { visibility: hidden; }
                    #printable-credit-customers, #printable-credit-customers * { visibility: visible; }
                    #printable-credit-customers {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                }
                `}
            </style>

            <Dialog open={Boolean(selectedCustomer)} onClose={handleClosePayment} maxWidth="xs" fullWidth>
                <DialogTitle>Update Customer Payment</DialogTitle>
                <DialogContent>
                    {selectedCustomer && (
                        <Stack spacing={2} sx={{ pt: 1 }}>
                            <Box>
                                <Typography variant="subtitle1" fontWeight={800}>{selectedCustomer.customerName}</Typography>
                                <Typography variant="body2" color="text.secondary">{selectedCustomer.customerCnic}</Typography>
                                <Typography variant="body2" color="warning.main" fontWeight={800} sx={{ mt: 0.75 }}>
                                    Outstanding: {formatCurrency(selectedCustomer.outstandingAmount, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                </Typography>
                            </Box>

                            <TextField
                                fullWidth
                                type="number"
                                label="Amount Received"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment>,
                                }}
                            />

                            <AppDatePicker fullWidth label="Payment Date" value={paymentDate} onChange={setPaymentDate} />

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

                            {isPartialPayment && (
                                <Box>
                                    <Typography variant="body2" color="warning.main" fontWeight={800} sx={{ mb: 1 }}>
                                        {formatCurrency(remainingAfterPayment, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} will still be outstanding. When will it be paid?
                                    </Typography>
                                    <AppDatePicker fullWidth required label="Remaining Amount Due Date" value={nextDueDate} onChange={setNextDueDate} minDate={paymentDate} />
                                </Box>
                            )}

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
                <DialogActions sx={{ p: 2.5 }}>
                    <Button variant="outlined" onClick={handleClosePayment}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmitPayment}
                        disabled={saving || (isPartialPayment && !nextDueDate)}
                    >
                        {saving ? 'Saving...' : 'Save Payment'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={Boolean(successMessage)}
                autoHideDuration={2500}
                onClose={() => setSuccessMessage('')}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <Alert severity="success" variant="filled" onClose={() => setSuccessMessage('')}>
                    {successMessage}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default CreditCustomersPage;
