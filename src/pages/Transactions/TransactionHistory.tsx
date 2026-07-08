import React, { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    InputAdornment,
    Chip,
    IconButton,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Divider,
    Popover,
    MenuItem,
    Select,
    Stack,
    Snackbar,
    Alert,
    Slide,
    type SlideProps,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
    Search,
    FileDown,
    Printer,
    ArrowUpRight,
    ArrowDownLeft,
    Calendar,
    Filter,
    X
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import type { Transaction } from '../../features/transactions/transactionSlice';
import { fetchTransactions } from '../../features/transactions/transactionSlice';
import {
    addDays,
    endOfMonth,
    endOfWeek,
    format,
    isAfter,
    isBefore,
    isSameDay,
    isSameMonth,
    parseISO,
    startOfMonth,
    startOfWeek,
    subMonths,
    addMonths
} from 'date-fns';
import useAppCurrency from '../../hooks/useAppCurrency';
import { getRegionalIdLabel } from '../../lib/regional';

const TransactionHistory: React.FC = () => {
    const theme = useTheme();
    const dispatch = useDispatch<AppDispatch>();
    const { transactions, loading, error } = useSelector((state: RootState) => state.transactions || { transactions: [], loading: false, error: null });
    const { country } = useSelector((state: RootState) => state.settings);
    const { formatCurrency } = useAppCurrency();
    const regionalIdLabel = getRegionalIdLabel(country);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [datePickerAnchorEl, setDatePickerAnchorEl] = useState<HTMLElement | null>(null);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [activeDateField, setActiveDateField] = useState<'from' | 'to'>('from');
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [exportingCsv, setExportingCsv] = useState(false);
    const [exportSnackOpen, setExportSnackOpen] = useState(false);
    const isInvalidRange = Boolean(fromDate && toDate && fromDate > toDate);
    const isDatePickerOpen = Boolean(datePickerAnchorEl);
    const TopSlideTransition = (props: SlideProps) => <Slide {...props} direction="down" />;

    useEffect(() => {
        dispatch(fetchTransactions());
    }, [dispatch]);

    const formatDateInput = (date: Date) => date.toISOString().split('T')[0];

    const setQuickRange = (days: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - (days - 1));
        setFromDate(formatDateInput(start));
        setToDate(formatDateInput(end));
    };

    const openCalendarFor = (field: 'from' | 'to') => {
        setActiveDateField(field);
        const seedDate = field === 'from' ? fromDate : toDate;
        if (seedDate) {
            setCalendarMonth(parseISO(seedDate));
        }
    };

    const handleSelectDate = (date: Date) => {
        const value = format(date, 'yyyy-MM-dd');
        if (activeDateField === 'from') setFromDate(value);
        if (activeDateField === 'to') setToDate(value);
    };

    const calendarGridStart = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 0 });
    const calendarGridEnd = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 0 });
    const calendarDays: Date[] = [];
    let dayCursor = calendarGridStart;
    while (isBefore(dayCursor, calendarGridEnd) || isSameDay(dayCursor, calendarGridEnd)) {
        calendarDays.push(dayCursor);
        dayCursor = addDays(dayCursor, 1);
    }

    const selectedFrom = fromDate ? parseISO(fromDate) : null;
    const selectedTo = toDate ? parseISO(toDate) : null;
    const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
        value: i,
        label: format(new Date(2026, i, 1), 'MMMM')
    })), []);
    const currentYear = new Date().getFullYear();
    const yearOptions = useMemo(() => Array.from({ length: 16 }, (_, i) => currentYear - 10 + i), [currentYear]);

    const filteredTransactions = (transactions || []).filter(t =>
        (
            t.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.customerCnic || '').toLowerCase().includes(searchTerm.toLowerCase())
        ) &&
        (!fromDate || new Date(t.timestamp) >= new Date(`${fromDate}T00:00:00`)) &&
        (!toDate || new Date(t.timestamp) <= new Date(`${toDate}T23:59:59.999`))
    );

    const handlePrint = () => {
        window.print();
    };

    const exportToCSV = () => {
        setExportingCsv(true);
        const headers = ['TX ID', 'Timestamp', 'Product', 'User', 'Customer', regionalIdLabel, 'Payment Method', 'Paid Now', 'Remaining Due', 'Type', 'Quantity', 'Unit Price', 'Value', 'Profit/Loss'];
        const rows = filteredTransactions.map(t => [
            t.id,
            t.timestamp,
            t.productName,
            t.userName,
            t.customerName || '',
            t.customerCnic || '',
            t.paymentMethod || '',
            t.paidNow || 0,
            t.dueAmount || 0,
            t.type,
            t.amount,
            t.unitPrice || 0,
            t.totalPrice || 0,
            t.grossProfit || 0
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => {
            setExportingCsv(false);
            setExportSnackOpen(true);
        }, 350);
    };

    return (
        <Box>
            <Box
                sx={{
                    mb: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: 1.5
                }}
            >
                <Typography variant="h4" fontWeight={800}>Transaction History</Typography>
                <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
                    <Button
                        variant="outlined"
                        startIcon={<Calendar size={20} />}
                        sx={{ borderRadius: 2, transition: 'all 0.2s ease' }}
                        onClick={(e) => setDatePickerAnchorEl(e.currentTarget)}
                    >
                        Date Range
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<FileDown size={20} />}
                        sx={{
                            borderRadius: 2,
                            transition: 'all 0.2s ease',
                            transform: exportingCsv ? 'translateY(-1px) scale(1.02)' : 'translateY(0) scale(1)',
                            opacity: exportingCsv ? 0.9 : 1
                        }}
                        onClick={exportToCSV}
                        disabled={filteredTransactions.length === 0 || exportingCsv}
                    >
                        Export CSV
                    </Button>
                </Box>
            </Box>

            <Card sx={{ borderRadius: 4, overflow: 'hidden' }}>
                <CardContent sx={{ p: 0 }}>
                    {error && (
                        <Alert severity="error" sx={{ m: 2 }}>
                            {error}
                        </Alert>
                    )}
                    <Box sx={{ p: 2, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid', borderColor: 'divider' }}>
                        <TextField
                            placeholder="Search by ID, Product or User..."
                            size="small"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search size={18} color="#64748b" />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ flexGrow: 1, width: { xs: '100%', sm: 'auto' }, maxWidth: { sm: 500 } }}
                        />
                        <Button variant="outlined" startIcon={<Filter size={18} />} color="inherit" sx={{ borderColor: 'divider', width: { xs: '100%', sm: 'auto' } }}>
                            Filter Type
                        </Button>
                    </Box>

                    <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table sx={{ minWidth: 980 }}>
                            <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>TX ID</TableCell>
                                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>DATE & TIME</TableCell>
                                    <TableCell sx={{ fontWeight: 700, minWidth: 190 }}>PRODUCT</TableCell>
                                    <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>STAFF</TableCell>
                                    <TableCell sx={{ fontWeight: 700, minWidth: 190 }}>CUSTOMER</TableCell>
                                    <TableCell sx={{ fontWeight: 700, minWidth: 170 }}>PAYMENT</TableCell>
                                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>TYPE</TableCell>
                                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>QTY</TableCell>
                                    <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>AMOUNTS</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>ACTIONS</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredTransactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} align="center" sx={{ py: 8 }}>
                                            <Typography color="text.secondary">
                                                {loading ? 'Loading transactions...' : 'No transactions found.'}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredTransactions.map((tx) => (
                                        <TableRow key={tx.id} hover>
                                            <TableCell sx={{ fontWeight: 700, color: 'primary.main', whiteSpace: 'nowrap' }}>#{tx.id}</TableCell>
                                            <TableCell>
                                                <Box>
                                                    <Typography variant="body2">{format(new Date(tx.timestamp), 'MMM dd, yyyy')}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{format(new Date(tx.timestamp), 'hh:mm a')}</Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={700}>
                                                    {tx.productName}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {tx.unitPrice != null
                                                        ? `Unit: ${formatCurrency(tx.unitPrice, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                                                        : 'Unit price unavailable'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Box
                                                        sx={{
                                                            width: 24,
                                                            height: 24,
                                                            borderRadius: '50%',
                                                            bgcolor: 'primary.light',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '0.7rem',
                                                            color: 'white',
                                                            fontWeight: 700
                                                        }}
                                                    >
                                                        {tx.userName.charAt(0)}
                                                    </Box>
                                                    <Typography variant="body2">{tx.userName}</Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={tx.customerName ? 700 : 500}>
                                                    {tx.customerName || 'Walk-in Customer'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {tx.customerCnic || `No ${regionalIdLabel}`}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={700} sx={{ textTransform: 'capitalize' }}>
                                                    {tx.paymentMethod || '-'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Paid: {formatCurrency(tx.paidNow || 0, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                </Typography>
                                                <Typography variant="caption" display="block" color={(tx.dueAmount || 0) > 0 ? 'warning.main' : 'text.secondary'}>
                                                    Due: {formatCurrency(tx.dueAmount || 0, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    icon={tx.type === 'addition' ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                                                    label={tx.type === 'addition' ? 'Restocked' : 'Sold/Reduced'}
                                                    size="small"
                                                    color={tx.type === 'addition' ? 'success' : 'error'}
                                                    sx={{ fontWeight: 700, borderRadius: 1.5 }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                {tx.type === 'addition' ? '+' : '-'}{tx.amount}
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={800}>
                                                    {tx.totalPrice != null ? formatCurrency(tx.totalPrice, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '-'}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    color={(tx.grossProfit || 0) >= 0 ? 'success.main' : 'error.main'}
                                                    fontWeight={800}
                                                >
                                                    P/L: {tx.grossProfit != null ? formatCurrency(tx.grossProfit, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <IconButton size="small" onClick={() => setSelectedTx(tx)}>
                                                    <Printer size={18} />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </CardContent>
            </Card>

            <Popover
                open={isDatePickerOpen}
                anchorEl={datePickerAnchorEl}
                onClose={() => setDatePickerAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        elevation: 12,
                        sx: {
                            mt: 1,
                            width: { xs: 'calc(100vw - 32px)', sm: 360 },
                            borderRadius: 3,
                            border: '1px solid',
                            borderColor: 'divider',
                            p: 2,
                            bgcolor: 'background.paper',
                            backdropFilter: 'blur(6px)'
                        }
                    }
                }}
                transitionDuration={{ enter: 180, exit: 140 }}
            >
                <Stack spacing={1.5}>
                    <Typography variant="subtitle1" fontWeight={800}>Date Range</Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip label="Last 7 Days" onClick={() => setQuickRange(7)} clickable />
                        <Chip label="Last 30 Days" onClick={() => setQuickRange(30)} clickable />
                        <Chip label="This Month" onClick={() => {
                            const now = new Date();
                            const first = new Date(now.getFullYear(), now.getMonth(), 1);
                            setFromDate(formatDateInput(first));
                            setToDate(formatDateInput(now));
                        }} clickable />
                    </Box>
                    <Stack direction="row" spacing={1}>
                        <TextField
                            label="From"
                            value={fromDate ? format(parseISO(fromDate), 'dd/MM/yyyy') : ''}
                            onClick={() => openCalendarFor('from')}
                            fullWidth
                            InputProps={{ readOnly: true }}
                            size="small"
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderColor: activeDateField === 'from' ? 'primary.main' : undefined,
                                }
                            }}
                        />
                        <TextField
                            label="To"
                            value={toDate ? format(parseISO(toDate), 'dd/MM/yyyy') : ''}
                            onClick={() => openCalendarFor('to')}
                            fullWidth
                            InputProps={{ readOnly: true }}
                            size="small"
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    borderColor: activeDateField === 'to' ? 'primary.main' : undefined,
                                }
                            }}
                        />
                    </Stack>
                    <Box
                        sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            p: 1.25,
                            background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.1 : 0.06)} 0%, ${alpha(theme.palette.background.paper, 1)} 55%)`
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Select
                                size="small"
                                value={calendarMonth.getMonth()}
                                onChange={(e) => setCalendarMonth(new Date(calendarMonth.getFullYear(), Number(e.target.value), 1))}
                                sx={{ minWidth: 140, borderRadius: 2 }}
                            >
                                {monthOptions.map((month) => (
                                    <MenuItem key={month.value} value={month.value}>{month.label}</MenuItem>
                                ))}
                            </Select>
                            <Select
                                size="small"
                                value={calendarMonth.getFullYear()}
                                onChange={(e) => setCalendarMonth(new Date(Number(e.target.value), calendarMonth.getMonth(), 1))}
                                sx={{ minWidth: 100, borderRadius: 2 }}
                            >
                                {yearOptions.map((year) => (
                                    <MenuItem key={year} value={year}>{year}</MenuItem>
                                ))}
                            </Select>
                            <IconButton size="small" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
                                {'<'}
                            </IconButton>
                            <IconButton size="small" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
                                {'>'}
                            </IconButton>
                        </Box>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w) => (
                                <Typography key={w} variant="caption" sx={{ textAlign: 'center', color: 'text.secondary', fontWeight: 700, py: 0.5 }}>
                                    {w}
                                </Typography>
                            ))}
                            {calendarDays.map((day) => {
                                const isCurrentMonth = isSameMonth(day, calendarMonth);
                                const isSelected = (selectedFrom && isSameDay(day, selectedFrom)) || (selectedTo && isSameDay(day, selectedTo));
                                const inRange = selectedFrom && selectedTo && isAfter(day, selectedFrom) && isBefore(day, selectedTo);
                                return (
                                    <Button
                                        key={day.toISOString()}
                                        onClick={() => handleSelectDate(day)}
                                        variant={isSelected ? 'contained' : 'text'}
                                        sx={{
                                            minWidth: 0,
                                            p: 0,
                                            height: 34,
                                            borderRadius: '50%',
                                            fontWeight: 700,
                                            color: isSelected ? 'primary.contrastText' : isCurrentMonth ? 'text.primary' : 'text.disabled',
                                            bgcolor: isSelected ? 'primary.main' : inRange ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                                            '&:hover': {
                                                bgcolor: isSelected ? 'primary.dark' : alpha(theme.palette.primary.main, 0.15),
                                            }
                                        }}
                                    >
                                        {format(day, 'd')}
                                    </Button>
                                );
                            })}
                        </Box>
                    </Box>
                    {isInvalidRange && <Typography variant="caption" color="error.main">From date cannot be later than To date.</Typography>}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        <Button onClick={() => { setFromDate(''); setToDate(''); }}>Clear</Button>
                        <Button variant="contained" onClick={() => setDatePickerAnchorEl(null)} disabled={isInvalidRange}>Apply</Button>
                    </Box>
                </Stack>
            </Popover>

            {/* Print Friendly Invoice Dialog */}
            <Dialog
                open={Boolean(selectedTx)}
                onClose={() => setSelectedTx(null)}
                maxWidth="sm"
                fullWidth
                transitionDuration={{ enter: 220, exit: 170 }}
            >
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" fontWeight={800}>Invoice Detail</Typography>
                    <IconButton onClick={() => setSelectedTx(null)} size="small">
                        <X size={20} />
                    </IconButton>
                </DialogTitle>
                <DialogContent id="printable-invoice">
                    {selectedTx && (
                        <Box sx={{ p: 2 }}>
                            <Box sx={{ textAlign: 'center', mb: 4 }}>
                                <Typography variant="h4" fontWeight={900} color="primary.main">ItemHive</Typography>
                                <Typography variant="body2" color="text.secondary">Inventory Management Solutions</Typography>
                            </Box>

                            <Box sx={{ mb: 4 }}>
                                <Typography variant="subtitle2" color="text.secondary">INVOICE TO:</Typography>
                                <Typography variant="h6" fontWeight={700}>{selectedTx.userName}</Typography>
                                <Typography variant="body2">{format(new Date(selectedTx.timestamp), 'MMMM dd, yyyy • hh:mm a')}</Typography>
                            </Box>

                            <Divider sx={{ mb: 3 }} />

                            <Box sx={{ mb: 4 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography fontWeight={700}>Transaction ID:</Typography>
                                    <Typography color="primary.main" fontWeight={700}>#{selectedTx.id}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography fontWeight={700}>Product:</Typography>
                                    <Typography>{selectedTx.productName}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography fontWeight={700}>Type:</Typography>
                                    <Typography sx={{ textTransform: 'capitalize' }}>{selectedTx.type}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography fontWeight={700}>Quantity:</Typography>
                                    <Typography>{selectedTx.amount} Units</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography fontWeight={700}>Customer:</Typography>
                                    <Typography>{selectedTx.customerName || 'Walk-in Customer'}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography fontWeight={700}>{regionalIdLabel}:</Typography>
                                    <Typography>{selectedTx.customerCnic || '-'}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography fontWeight={700}>Payment Method:</Typography>
                                    <Typography sx={{ textTransform: 'capitalize' }}>{selectedTx.paymentMethod || 'cash'}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography fontWeight={700}>Paid Now:</Typography>
                                    <Typography>{formatCurrency(selectedTx.paidNow || 0, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography fontWeight={700}>Remaining Due:</Typography>
                                    <Typography color={(selectedTx.dueAmount || 0) > 0 ? 'warning.main' : 'text.primary'}>
                                        {formatCurrency(selectedTx.dueAmount || 0, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography fontWeight={700}>Unit Price:</Typography>
                                    <Typography>{formatCurrency((selectedTx.unitPrice ?? (selectedTx.totalPrice / selectedTx.amount)), { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography fontWeight={700}>Profit / Loss:</Typography>
                                    <Typography color={(selectedTx.grossProfit || 0) >= 0 ? 'success.main' : 'error.main'}>
                                        {formatCurrency(selectedTx.grossProfit || 0, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                    </Typography>
                                </Box>
                            </Box>

                            <Box sx={{ bgcolor: 'rgba(99, 102, 241, 0.05)', p: 3, borderRadius: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="h6" fontWeight={800}>Total Value:</Typography>
                                    <Typography variant="h6" fontWeight={900} color="primary.main">
                                        {formatCurrency(selectedTx.totalPrice || 0, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                    </Typography>
                                </Box>
                            </Box>

                            <Box sx={{ mt: 6, textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary">
                                    Thank you for using ItemHive Inventory System.
                                </Typography>
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button onClick={() => setSelectedTx(null)}>Cancel</Button>
                    <Button variant="contained" startIcon={<Printer size={20} />} onClick={handlePrint}>
                        Print Invoice
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={exportSnackOpen}
                autoHideDuration={1800}
                onClose={() => setExportSnackOpen(false)}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                TransitionComponent={TopSlideTransition}
            >
                <Alert severity="success" variant="filled" onClose={() => setExportSnackOpen(false)}>
                    CSV downloaded
                </Alert>
            </Snackbar>

            {/* Global Print Style */}
            <style>
                {`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #printable-invoice, #printable-invoice * {
                        visibility: visible;
                    }
                    #printable-invoice {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .MuiDialogActions-root {
                        display: none !important;
                    }
                    .MuiDialogTitle-root button {
                        display: none !important;
                    }
                }
                `}
            </style>
        </Box>
    );
};

export default TransactionHistory;
