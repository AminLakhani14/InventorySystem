import React from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    IconButton,
    InputAdornment,
    Paper,
    Snackbar,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    ChevronLeft,
    ChevronRight,
    Percent,
    RefreshCw,
    Save,
    Search,
    Store,
    WalletCards,
} from 'lucide-react';
import api from '../../api/axios';
import { useAppCurrency } from '../../hooks/useAppCurrency';

interface CommissionRow {
    vendorId: string;
    vendorName: string;
    vendorPhone: string;
    productId: string;
    productName: string;
    broughtQuantity: number;
    soldQuantity: number;
    salesValue: number;
    availableQuantity: number;
    totalAmount: number;
    commission: number;
    note: string;
    updatedByName: string;
    isSaved: boolean;
}

interface CommissionSheet {
    date: string;
    rows: CommissionRow[];
    totals: {
        broughtQuantity: number;
        soldQuantity: number;
        salesValue: number;
        totalAmount: number;
        commission: number;
        vendors: number;
    };
}

const toInputDate = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const shiftDate = (value: string, days: number) => {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + days);
    return toInputDate(date);
};

const rowKey = (row: CommissionRow) => `${row.vendorId}::${row.productId}`;
const formatQuantity = (value: number) => Number(value.toFixed(2)).toLocaleString();
const toAmount = (value: string) => {
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

type DraftEntry = { totalAmount: string; commission: string };

const VendorCommissionPage: React.FC = () => {
    const { formatCurrency, currencySymbol } = useAppCurrency();
    const [date, setDate] = React.useState(() => toInputDate(new Date()));
    const [sheet, setSheet] = React.useState<CommissionSheet | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [searchQuery, setSearchQuery] = React.useState('');
    const [drafts, setDrafts] = React.useState<Record<string, DraftEntry>>({});
    const [savingKey, setSavingKey] = React.useState('');
    const [toast, setToast] = React.useState('');

    const loadSheet = React.useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await api.get<CommissionSheet>('/vendor-commissions', { params: { date } });
            setSheet(response.data);
            setDrafts(Object.fromEntries(response.data.rows.map((row) => [
                rowKey(row),
                { totalAmount: row.totalAmount ? String(row.totalAmount) : '', commission: row.commission ? String(row.commission) : '' },
            ])));
        } catch (requestError: unknown) {
            const message = (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(message || 'Unable to load the vendor commission sheet right now.');
            setSheet(null);
        } finally {
            setLoading(false);
        }
    }, [date]);

    React.useEffect(() => {
        loadSheet();
    }, [loadSheet]);

    const rows = React.useMemo(() => sheet?.rows ?? [], [sheet]);
    const filteredRows = React.useMemo(() => {
        const query = searchQuery.trim().toLocaleLowerCase();
        if (!query) return rows;
        return rows.filter((row) =>
            row.vendorName.toLocaleLowerCase().includes(query)
            || row.productName.toLocaleLowerCase().includes(query)
            || row.vendorPhone.toLocaleLowerCase().includes(query));
    }, [rows, searchQuery]);

    // Totals follow what is on screen, including edits that have not been saved yet.
    const liveTotals = React.useMemo(() => filteredRows.reduce((acc, row) => {
        const draft = drafts[rowKey(row)];
        return {
            totalAmount: acc.totalAmount + (toAmount(draft?.totalAmount ?? '') ?? 0),
            commission: acc.commission + (toAmount(draft?.commission ?? '') ?? 0),
            salesValue: acc.salesValue + row.salesValue,
        };
    }, { totalAmount: 0, commission: 0, salesValue: 0 }), [drafts, filteredRows]);

    const setDraft = (key: string, field: keyof DraftEntry, value: string) => {
        setDrafts((current) => {
            const entry: DraftEntry = { ...(current[key] || { totalAmount: '', commission: '' }) };
            entry[field] = value;
            return { ...current, [key]: entry };
        });
    };

    const saveRow = async (row: CommissionRow) => {
        const key = rowKey(row);
        const draft = drafts[key] || { totalAmount: '', commission: '' };
        const totalAmount = toAmount(draft.totalAmount || '0');
        const commission = toAmount(draft.commission || '0');
        if (totalAmount === null || commission === null) {
            setError('Total amount and commission must be zero or more.');
            return;
        }

        setSavingKey(key);
        setError('');
        try {
            await api.post('/vendor-commissions', {
                date,
                vendorId: row.vendorId,
                productId: row.productId,
                totalAmount,
                commission,
            });
            setSheet((current) => current && {
                ...current,
                rows: current.rows.map((entry) => (rowKey(entry) === key
                    ? { ...entry, totalAmount, commission, isSaved: true }
                    : entry)),
            });
            setToast(`Saved ${row.vendorName} — ${row.productName}`);
        } catch (requestError: unknown) {
            const message = (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(message || 'Unable to save this commission entry.');
        } finally {
            setSavingKey('');
        }
    };

    const isRowDirty = (row: CommissionRow) => {
        const draft = drafts[rowKey(row)];
        if (!draft) return false;
        return (toAmount(draft.totalAmount || '0') ?? -1) !== row.totalAmount
            || (toAmount(draft.commission || '0') ?? -1) !== row.commission;
    };

    return (
        <Box>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" fontWeight={800}>Vendor Commission</Typography>
                <Typography variant="body2" color="text.secondary">
                    Day-wise sheet of every vendor, the vegetables they brought, what sold and what is left — with your own total and commission.
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError('')} action={<Button color="inherit" onClick={loadSheet}>Retry</Button>}>
                    {error}
                </Alert>
            )}

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
                <Card sx={{ flex: 1, borderRadius: 3 }}>
                    <CardContent>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Store color="#0ea5a5" />
                            <Box><Typography variant="body2" color="text.secondary">Vendors On Sheet</Typography><Typography variant="h5" fontWeight={900}>{sheet?.totals.vendors ?? 0}</Typography></Box>
                        </Stack>
                    </CardContent>
                </Card>
                <Card sx={{ flex: 1, borderRadius: 3 }}>
                    <CardContent>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                            <WalletCards color="#0ea5a5" />
                            <Box><Typography variant="body2" color="text.secondary">Total Amount</Typography><Typography variant="h5" fontWeight={900}>{formatCurrency(liveTotals.totalAmount)}</Typography></Box>
                        </Stack>
                    </CardContent>
                </Card>
                <Card sx={{ flex: 1, borderRadius: 3 }}>
                    <CardContent>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Percent color="#0ea5a5" />
                            <Box><Typography variant="body2" color="text.secondary">Total Commission</Typography><Typography variant="h5" fontWeight={900}>{formatCurrency(liveTotals.commission)}</Typography></Box>
                        </Stack>
                    </CardContent>
                </Card>
                <Card sx={{ flex: 1, borderRadius: 3 }}>
                    <CardContent>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                            <WalletCards color="#0ea5a5" />
                            <Box><Typography variant="body2" color="text.secondary">Net After Commission</Typography><Typography variant="h5" fontWeight={900}>{formatCurrency(liveTotals.totalAmount - liveTotals.commission)}</Typography></Box>
                        </Stack>
                    </CardContent>
                </Card>
            </Stack>

            <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', lg: 'center' }} spacing={2} sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip title="Previous day"><IconButton onClick={() => setDate((current) => shiftDate(current, -1))}><ChevronLeft size={18} /></IconButton></Tooltip>
                    <TextField
                        type="date"
                        size="small"
                        label="Sheet date"
                        value={date}
                        onChange={(event) => setDate(event.target.value || toInputDate(new Date()))}
                        slotProps={{ inputLabel: { shrink: true } }}
                        sx={{ width: 190 }}
                    />
                    <Tooltip title="Next day"><IconButton onClick={() => setDate((current) => shiftDate(current, 1))}><ChevronRight size={18} /></IconButton></Tooltip>
                    <Button size="small" onClick={() => setDate(toInputDate(new Date()))}>Today</Button>
                    <Tooltip title="Refresh"><IconButton onClick={loadSheet}><RefreshCw size={18} /></IconButton></Tooltip>
                </Stack>
                <TextField
                    size="small"
                    placeholder="Search vendor or vegetable..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    slotProps={{ input: { startAdornment: <Search size={18} style={{ marginRight: 8 }} /> } }}
                    sx={{ width: { xs: '100%', lg: 360 } }}
                />
            </Stack>

            {loading ? (
                <Box sx={{ minHeight: 220, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>
            ) : !rows.length ? (
                <Card sx={{ borderRadius: 3 }}>
                    <CardContent sx={{ textAlign: 'center', py: 6 }}>
                        <Percent size={40} style={{ opacity: 0.4 }} />
                        <Typography fontWeight={800} sx={{ mt: 1 }}>Nothing on this date</Typography>
                        <Typography variant="body2" color="text.secondary">No vendor brought or sold vegetables on {new Date(`${date}T00:00:00`).toLocaleDateString()}.</Typography>
                    </CardContent>
                </Card>
            ) : (
                <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
                    <Table sx={{ minWidth: 1250 }}>
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'action.hover' }}>
                                <TableCell>Vendor</TableCell>
                                <TableCell>Vegetable</TableCell>
                                <TableCell align="right">Brought</TableCell>
                                <TableCell align="right">Sold</TableCell>
                                <TableCell align="right">Remaining</TableCell>
                                <TableCell align="right">Sales Value</TableCell>
                                <TableCell align="right">Total Amount</TableCell>
                                <TableCell align="right">Commission</TableCell>
                                <TableCell align="right">Net</TableCell>
                                <TableCell align="center">Save</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredRows.map((row, index) => {
                                const key = rowKey(row);
                                const draft = drafts[key] || { totalAmount: '', commission: '' };
                                const totalAmount = toAmount(draft.totalAmount || '0');
                                const commission = toAmount(draft.commission || '0');
                                const remaining = row.broughtQuantity - row.soldQuantity;
                                const isFirstOfVendor = index === 0 || filteredRows[index - 1].vendorId !== row.vendorId;
                                return (
                                    <TableRow key={key} hover>
                                        <TableCell>
                                            {isFirstOfVendor ? (
                                                <>
                                                    <Typography fontWeight={800}>{row.vendorName}</Typography>
                                                    {row.vendorPhone && <Typography variant="caption" color="text.secondary">{row.vendorPhone}</Typography>}
                                                </>
                                            ) : (
                                                <Typography variant="caption" color="text.secondary">↳ {row.vendorName}</Typography>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight={700}>{row.productName}</Typography>
                                            {row.availableQuantity > 0 && (
                                                <Typography variant="caption" color="text.secondary">{formatQuantity(row.availableQuantity)} in vendor stock now</Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right">{formatQuantity(row.broughtQuantity)}</TableCell>
                                        <TableCell align="right">{formatQuantity(row.soldQuantity)}</TableCell>
                                        <TableCell align="right">
                                            <Chip
                                                size="small"
                                                variant="outlined"
                                                color={remaining > 0 ? 'primary' : remaining < 0 ? 'warning' : 'default'}
                                                label={formatQuantity(remaining)}
                                            />
                                        </TableCell>
                                        <TableCell align="right">{formatCurrency(row.salesValue)}</TableCell>
                                        <TableCell align="right">
                                            <TextField
                                                size="small"
                                                type="number"
                                                placeholder="0"
                                                value={draft.totalAmount}
                                                onChange={(event) => setDraft(key, 'totalAmount', event.target.value)}
                                                error={totalAmount === null}
                                                slotProps={{
                                                    input: { startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment> },
                                                    htmlInput: { min: 0, step: '0.01', style: { textAlign: 'right' } },
                                                }}
                                                sx={{ width: 150 }}
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <TextField
                                                size="small"
                                                type="number"
                                                placeholder="0"
                                                value={draft.commission}
                                                onChange={(event) => setDraft(key, 'commission', event.target.value)}
                                                error={commission === null}
                                                slotProps={{
                                                    input: { startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment> },
                                                    htmlInput: { min: 0, step: '0.01', style: { textAlign: 'right' } },
                                                }}
                                                sx={{ width: 150 }}
                                            />
                                            {Boolean(totalAmount) && commission !== null && (
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                    {((commission / (totalAmount || 1)) * 100).toFixed(1)}% of total
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Typography fontWeight={900}>{formatCurrency((totalAmount ?? 0) - (commission ?? 0))}</Typography>
                                            {row.isSaved && row.updatedByName && (
                                                <Typography variant="caption" color="text.secondary">by {row.updatedByName}</Typography>
                                            )}
                                        </TableCell>
                                        <TableCell align="center">
                                            <Button
                                                size="small"
                                                variant={isRowDirty(row) ? 'contained' : 'outlined'}
                                                disabled={savingKey === key || totalAmount === null || commission === null}
                                                startIcon={savingKey === key ? <CircularProgress size={14} color="inherit" /> : <Save size={16} />}
                                                onClick={() => saveRow(row)}
                                            >
                                                {row.isSaved && !isRowDirty(row) ? 'Saved' : 'Save'}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {!filteredRows.length && (
                                <TableRow><TableCell colSpan={10} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No row matches “{searchQuery.trim()}”.</Typography></TableCell></TableRow>
                            )}
                            {Boolean(filteredRows.length) && (
                                <TableRow sx={{ bgcolor: 'action.hover' }}>
                                    <TableCell colSpan={5}><Typography fontWeight={900}>Day Total</Typography></TableCell>
                                    <TableCell align="right"><Typography fontWeight={900}>{formatCurrency(liveTotals.salesValue)}</Typography></TableCell>
                                    <TableCell align="right"><Typography fontWeight={900}>{formatCurrency(liveTotals.totalAmount)}</Typography></TableCell>
                                    <TableCell align="right"><Typography fontWeight={900}>{formatCurrency(liveTotals.commission)}</Typography></TableCell>
                                    <TableCell align="right"><Typography fontWeight={900}>{formatCurrency(liveTotals.totalAmount - liveTotals.commission)}</Typography></TableCell>
                                    <TableCell />
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Snackbar open={Boolean(toast)} autoHideDuration={2500} onClose={() => setToast('')} message={toast} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} />
        </Box>
    );
};

export default VendorCommissionPage;
