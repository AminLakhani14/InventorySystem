import React from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    InputAdornment,
    Menu,
    MenuItem,
    Paper,
    Snackbar,
    Stack,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    TextField,
    Tooltip,
    Typography,
    useTheme,
} from '@mui/material';
import {
    ChevronLeft,
    ChevronRight,
    Download,
    FileText,
    Percent,
    Printer,
    ReceiptText,
    RefreshCw,
    Save,
    Search,
    Share2,
    Store,
    WalletCards,
    X,
} from 'lucide-react';
import api from '../../api/axios';
import { useAppCurrency } from '../../hooks/useAppCurrency';
import { downloadBlob } from '../../utils/documentPdf';
import { printHtmlDocument, shareDocument } from '../../utils/documentShare';
import {
    ANONYMOUS_CUSTOMER,
    buildDetailReport,
    buildSummaryReport,
    buildVendorInvoice,
    displayTime,
    invoiceNumber,
    paymentLabel,
    rateOf,
    type CommissionRow,
    type DocumentBundle,
    type SaleLine,
    type VendorGroup,
} from './vendorCommissionDocuments';

interface CommissionSheet {
    date: string;
    rows: CommissionRow[];
    sales: SaleLine[];
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
    const [invoiceVendorId, setInvoiceVendorId] = React.useState('');
    const [reportTab, setReportTab] = React.useState<'' | 'summary' | 'detail'>('');
    // Which vendor the open report covers; '' means the whole sheet.
    const [reportVendorId, setReportVendorId] = React.useState('');
    const [reportMenu, setReportMenu] = React.useState<{ anchor: HTMLElement; vendorId: string } | null>(null);
    const [sharingKey, setSharingKey] = React.useState('');
    const theme = useTheme();

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

    // Every vegetable of a vendor sells at its own price, so the vendor's day figure is the
    // sum of all their lines — amounts and commission included. These groups also back the
    // invoice and the two reports, so they carry the live (unsaved) input values.
    const vendorGroups = React.useMemo<VendorGroup[]>(() => {
        const salesByVendor = new Map<string, SaleLine[]>();
        (sheet?.sales ?? []).forEach((sale) => {
            const bucket = salesByVendor.get(sale.vendorId);
            if (bucket) bucket.push(sale);
            else salesByVendor.set(sale.vendorId, [sale]);
        });

        const groups = new Map<string, VendorGroup>();
        filteredRows.forEach((row) => {
            const draft = drafts[rowKey(row)];
            const liveTotalAmount = toAmount(draft?.totalAmount ?? '') ?? 0;
            const liveCommission = toAmount(draft?.commission ?? '') ?? 0;
            const group = groups.get(row.vendorId) || {
                vendorId: row.vendorId,
                vendorName: row.vendorName,
                vendorPhone: row.vendorPhone,
                rows: [],
                sales: [],
                broughtQuantity: 0,
                soldQuantity: 0,
                salesValue: 0,
                totalAmount: 0,
                commission: 0,
            };
            group.rows.push({ ...row, liveTotalAmount, liveCommission });
            group.broughtQuantity += row.broughtQuantity;
            group.soldQuantity += row.soldQuantity;
            group.salesValue += row.salesValue;
            group.totalAmount += liveTotalAmount;
            group.commission += liveCommission;
            groups.set(row.vendorId, group);
        });

        // Sales follow the same search filter as the rows, so a filtered sheet and its
        // documents always describe the same set of vegetables.
        groups.forEach((group) => {
            const visibleProducts = new Set(group.rows.map((row) => row.productId));
            group.sales = (salesByVendor.get(group.vendorId) ?? []).filter((sale) => visibleProducts.has(sale.productId));
        });

        return Array.from(groups.values());
    }, [drafts, filteredRows, sheet]);

    const vendorTotals = React.useMemo(
        () => new Map(vendorGroups.map((group) => [group.vendorId, group])),
        [vendorGroups],
    );

    // A vendor picked for a document can disappear when the sheet date or the search changes;
    // drop the selection instead of leaving an empty report behind.
    React.useEffect(() => {
        if (invoiceVendorId && !vendorTotals.has(invoiceVendorId)) setInvoiceVendorId('');
        if (reportVendorId && !vendorTotals.has(reportVendorId)) setReportVendorId('');
    }, [invoiceVendorId, reportVendorId, vendorTotals]);

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

    const documentContext = {
        sheetDate: sheet?.date || date,
        money: formatCurrency,
        accentHex: theme.palette.primary.main,
    };

    const invoiceGroup = vendorGroups.find((group) => group.vendorId === invoiceVendorId) || null;
    const invoiceBundle = invoiceGroup ? buildVendorInvoice(invoiceGroup, documentContext) : null;

    // A report is scoped to one vendor unless the selector is switched back to the whole sheet.
    const reportGroups = reportVendorId
        ? vendorGroups.filter((group) => group.vendorId === reportVendorId)
        : vendorGroups;
    const reportScopeName = reportVendorId
        ? reportGroups[0]?.vendorName || 'Vendor'
        : 'All vendors';
    const reportTotals = reportGroups.reduce((acc, group) => ({
        soldQuantity: acc.soldQuantity + group.soldQuantity,
        salesValue: acc.salesValue + group.salesValue,
        totalAmount: acc.totalAmount + group.totalAmount,
        commission: acc.commission + group.commission,
    }), { soldQuantity: 0, salesValue: 0, totalAmount: 0, commission: 0 });

    const reportBundle: DocumentBundle | null = !reportTab
        ? null
        : reportTab === 'summary'
            ? buildSummaryReport(reportGroups, documentContext)
            : buildDetailReport(reportGroups, documentContext);

    const openReport = (vendorId: string, tab: 'summary' | 'detail') => {
        setReportVendorId(vendorId);
        setReportTab(tab);
        setReportMenu(null);
    };

    const handleDownloadPdf = (bundle: DocumentBundle) => {
        downloadBlob(bundle.buildPdf(), bundle.fileName);
        setToast(`Saved ${bundle.fileName}`);
    };

    const handlePrint = (bundle: DocumentBundle) => {
        if (!printHtmlDocument(bundle.html)) {
            setError('Allow pop-ups for this site to print the document.');
        }
    };

    const handleShare = async (bundle: DocumentBundle) => {
        setSharingKey(bundle.fileName);
        const outcome = await shareDocument({
            title: bundle.title,
            text: bundle.shareText,
            file: { blob: bundle.buildPdf(), name: bundle.fileName },
        });
        setSharingKey('');
        if (outcome === 'shared') setToast('Shared as PDF.');
        else if (outcome === 'copied') setToast('Sharing is unavailable here — details copied to the clipboard.');
        else if (outcome === 'failed') setError('Could not share this document.');
    };

    const documentActions = (bundle: DocumentBundle) => (
        <>
            <Button
                variant="contained"
                startIcon={<Download size={16} />}
                onClick={() => handleDownloadPdf(bundle)}
            >
                Download PDF
            </Button>
            <Button
                variant="outlined"
                startIcon={<Printer size={16} />}
                onClick={() => handlePrint(bundle)}
            >
                Print
            </Button>
            <Button
                variant="outlined"
                disabled={sharingKey === bundle.fileName}
                startIcon={sharingKey === bundle.fileName ? <CircularProgress size={14} /> : <Share2 size={16} />}
                onClick={() => handleShare(bundle)}
            >
                Share
            </Button>
        </>
    );

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
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                    <TextField
                        size="small"
                        placeholder="Search vendor or vegetable..."
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        slotProps={{ input: { startAdornment: <Search size={18} style={{ marginRight: 8 }} /> } }}
                        sx={{ width: { xs: '100%', lg: 300 } }}
                    />
                    <Tooltip title="Report covering every vendor on this sheet">
                        <span>
                            <Button
                                size="small"
                                variant="outlined"
                                disabled={!filteredRows.length}
                                startIcon={<FileText size={16} />}
                                onClick={() => openReport('', 'summary')}
                            >
                                All Vendors
                            </Button>
                        </span>
                    </Tooltip>
                </Stack>
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
                                const isLastOfVendor = index === filteredRows.length - 1 || filteredRows[index + 1].vendorId !== row.vendorId;
                                const vendorTotal = vendorTotals.get(row.vendorId);
                                return (
                                    <React.Fragment key={key}>
                                    <TableRow hover>
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
                                    {isLastOfVendor && vendorTotal && (
                                        <TableRow sx={{ bgcolor: 'action.selected' }}>
                                            <TableCell colSpan={5}>
                                                <Typography fontWeight={800}>{row.vendorName} — Vendor Total</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {vendorTotal.rows.length} {vendorTotal.rows.length === 1 ? 'vegetable' : 'vegetables'} · {vendorTotal.sales.length} {vendorTotal.sales.length === 1 ? 'sale' : 'sales'} on this day
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right"><Typography fontWeight={800}>{formatCurrency(vendorTotal.salesValue)}</Typography></TableCell>
                                            <TableCell align="right"><Typography fontWeight={800}>{formatCurrency(vendorTotal.totalAmount)}</Typography></TableCell>
                                            <TableCell align="right"><Typography fontWeight={800}>{formatCurrency(vendorTotal.commission)}</Typography></TableCell>
                                            <TableCell align="right"><Typography fontWeight={900} color="primary.main">{formatCurrency(vendorTotal.totalAmount - vendorTotal.commission)}</Typography></TableCell>
                                            <TableCell align="center">
                                                <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                                                    <Tooltip title={`Invoice for ${row.vendorName}`}>
                                                        <Button
                                                            size="small"
                                                            variant="contained"
                                                            color="secondary"
                                                            startIcon={<ReceiptText size={16} />}
                                                            onClick={() => setInvoiceVendorId(row.vendorId)}
                                                        >
                                                            Invoice
                                                        </Button>
                                                    </Tooltip>
                                                    <Tooltip title={`Reports for ${row.vendorName}`}>
                                                        <IconButton
                                                            size="small"
                                                            onClick={(event) => setReportMenu({ anchor: event.currentTarget, vendorId: row.vendorId })}
                                                        >
                                                            <FileText size={16} />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Stack>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    </React.Fragment>
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

            <Menu
                open={Boolean(reportMenu)}
                anchorEl={reportMenu?.anchor}
                onClose={() => setReportMenu(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem onClick={() => openReport(reportMenu!.vendorId, 'summary')}>Summary report</MenuItem>
                <MenuItem onClick={() => openReport(reportMenu!.vendorId, 'detail')}>Detail report</MenuItem>
            </Menu>

            <Dialog open={Boolean(invoiceGroup)} onClose={() => setInvoiceVendorId('')} maxWidth="lg" fullWidth>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <ReceiptText size={22} />
                    <Box sx={{ flex: 1 }}>
                        <Typography fontWeight={900}>Vendor Commission Invoice</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {invoiceGroup ? `${invoiceGroup.vendorName} · ${invoiceNumber(documentContext.sheetDate, invoiceGroup.vendorId)}` : ''}
                        </Typography>
                    </Box>
                    <IconButton onClick={() => setInvoiceVendorId('')}><X size={18} /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {invoiceGroup && (
                        <>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 2 }}>
                                <Box><Typography variant="caption" color="text.secondary">VENDOR</Typography><Typography fontWeight={800}>{invoiceGroup.vendorName}</Typography></Box>
                                <Box><Typography variant="caption" color="text.secondary">PHONE</Typography><Typography fontWeight={800}>{invoiceGroup.vendorPhone || '—'}</Typography></Box>
                                <Box><Typography variant="caption" color="text.secondary">SHEET DATE</Typography><Typography fontWeight={800}>{new Date(`${documentContext.sheetDate}T00:00:00`).toLocaleDateString()}</Typography></Box>
                                <Box><Typography variant="caption" color="text.secondary">VEGETABLES</Typography><Typography fontWeight={800}>{invoiceGroup.rows.length}</Typography></Box>
                            </Stack>
                            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                                            <TableCell>Vegetable</TableCell>
                                            <TableCell align="right">Brought</TableCell>
                                            <TableCell align="right">Sold</TableCell>
                                            <TableCell align="right">Left</TableCell>
                                            <TableCell align="right">Sales Value</TableCell>
                                            <TableCell align="right">Total Amount</TableCell>
                                            <TableCell align="right">Commission</TableCell>
                                            <TableCell align="right">Net</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {invoiceGroup.rows.map((row) => (
                                            <TableRow key={row.productId}>
                                                <TableCell>{row.productName}</TableCell>
                                                <TableCell align="right">{formatQuantity(row.broughtQuantity)}</TableCell>
                                                <TableCell align="right">{formatQuantity(row.soldQuantity)}</TableCell>
                                                <TableCell align="right">{formatQuantity(row.broughtQuantity - row.soldQuantity)}</TableCell>
                                                <TableCell align="right">{formatCurrency(row.salesValue)}</TableCell>
                                                <TableCell align="right">{formatCurrency(row.liveTotalAmount)}</TableCell>
                                                <TableCell align="right">{formatCurrency(row.liveCommission)}</TableCell>
                                                <TableCell align="right">{formatCurrency(row.liveTotalAmount - row.liveCommission)}</TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow sx={{ bgcolor: 'action.selected' }}>
                                            <TableCell><Typography fontWeight={900}>Total</Typography></TableCell>
                                            <TableCell align="right"><Typography fontWeight={900}>{formatQuantity(invoiceGroup.broughtQuantity)}</Typography></TableCell>
                                            <TableCell align="right"><Typography fontWeight={900}>{formatQuantity(invoiceGroup.soldQuantity)}</Typography></TableCell>
                                            <TableCell align="right"><Typography fontWeight={900}>{formatQuantity(invoiceGroup.broughtQuantity - invoiceGroup.soldQuantity)}</Typography></TableCell>
                                            <TableCell align="right"><Typography fontWeight={900}>{formatCurrency(invoiceGroup.salesValue)}</Typography></TableCell>
                                            <TableCell align="right"><Typography fontWeight={900}>{formatCurrency(invoiceGroup.totalAmount)}</Typography></TableCell>
                                            <TableCell align="right"><Typography fontWeight={900}>{formatCurrency(invoiceGroup.commission)}</Typography></TableCell>
                                            <TableCell align="right"><Typography fontWeight={900} color="primary.main">{formatCurrency(invoiceGroup.totalAmount - invoiceGroup.commission)}</Typography></TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <Stack alignItems="flex-end" sx={{ mt: 2 }}>
                                <Box sx={{ width: 320 }}>
                                    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.75 }}><Typography variant="body2">Total Amount</Typography><Typography fontWeight={800}>{formatCurrency(invoiceGroup.totalAmount)}</Typography></Stack>
                                    <Divider />
                                    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.75 }}><Typography variant="body2">Commission</Typography><Typography fontWeight={800}>{formatCurrency(invoiceGroup.commission)}</Typography></Stack>
                                    <Divider />
                                    <Stack direction="row" justifyContent="space-between" sx={{ py: 1 }}><Typography fontWeight={900}>Net Payable To Vendor</Typography><Typography fontWeight={900} color="primary.main">{formatCurrency(invoiceGroup.totalAmount - invoiceGroup.commission)}</Typography></Stack>
                                </Box>
                            </Stack>
                        </>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap', gap: 1 }}>
                    {invoiceBundle && documentActions(invoiceBundle)}
                    <Button color="inherit" onClick={() => setInvoiceVendorId('')}>Close</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(reportTab)} onClose={() => setReportTab('')} maxWidth="xl" fullWidth>
                <DialogTitle sx={{ pb: 0 }}>
                    <Stack direction="row" alignItems="center" gap={1.5}>
                        <FileText size={22} />
                        <Box sx={{ flex: 1 }}>
                            <Typography fontWeight={900}>Vendor Commission Report</Typography>
                            <Typography variant="caption" color="text.secondary">
                                {reportScopeName} · {new Date(`${documentContext.sheetDate}T00:00:00`).toLocaleDateString()}
                            </Typography>
                        </Box>
                        <TextField
                            select
                            size="small"
                            label="Vendor"
                            value={reportVendorId}
                            onChange={(event) => setReportVendorId(event.target.value)}
                            sx={{ minWidth: 220 }}
                        >
                            <MenuItem value="">All vendors ({vendorGroups.length})</MenuItem>
                            {vendorGroups.map((group) => (
                                <MenuItem key={group.vendorId} value={group.vendorId}>{group.vendorName}</MenuItem>
                            ))}
                        </TextField>
                        <IconButton onClick={() => setReportTab('')}><X size={18} /></IconButton>
                    </Stack>
                    <Tabs value={reportTab || 'summary'} onChange={(_, value) => setReportTab(value)} sx={{ mt: 1 }}>
                        <Tab value="summary" label="Summary" />
                        <Tab value="detail" label="Detail" />
                    </Tabs>
                </DialogTitle>
                <DialogContent dividers>
                    {reportTab === 'summary' && (
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                                        {!reportVendorId && <TableCell>Vendor</TableCell>}
                                        <TableCell>Vegetable</TableCell>
                                        <TableCell align="right">Sold Qty</TableCell>
                                        <TableCell align="right">Rate</TableCell>
                                        <TableCell align="right">Sales Value</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {reportGroups.flatMap((group) => group.rows.map((row) => (
                                        <TableRow key={`${group.vendorId}::${row.productId}`} hover>
                                            {!reportVendorId && <TableCell>{group.vendorName}</TableCell>}
                                            <TableCell>{row.productName}</TableCell>
                                            <TableCell align="right">{formatQuantity(row.soldQuantity)}</TableCell>
                                            <TableCell align="right">{formatCurrency(rateOf(row.salesValue, row.soldQuantity))}</TableCell>
                                            <TableCell align="right">{formatCurrency(row.salesValue)}</TableCell>
                                        </TableRow>
                                    )))}
                                    <TableRow sx={{ bgcolor: 'action.selected' }}>
                                        <TableCell colSpan={reportVendorId ? 1 : 2}>
                                            <Typography fontWeight={900}>{reportVendorId ? 'Vendor Total' : 'Day Total'}</Typography>
                                        </TableCell>
                                        <TableCell align="right"><Typography fontWeight={900}>{formatQuantity(reportTotals.soldQuantity)}</Typography></TableCell>
                                        <TableCell />
                                        <TableCell align="right"><Typography fontWeight={900}>{formatCurrency(reportTotals.salesValue)}</Typography></TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}

                    {reportTab === 'detail' && reportGroups.map((group) => (
                        <Box key={group.vendorId} sx={{ mb: 4 }}>
                            <Typography fontWeight={900} sx={{ mb: 1 }}>
                                {group.vendorName}
                                {group.vendorPhone && <Typography component="span" variant="caption" color="text.secondary"> · {group.vendorPhone}</Typography>}
                            </Typography>

                            <Typography variant="caption" color="text.secondary">Sales ({group.sales.length})</Typography>
                            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 2, mt: 0.5 }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                                            <TableCell>Time</TableCell>
                                            <TableCell>Vegetable</TableCell>
                                            <TableCell align="right">Qty</TableCell>
                                            <TableCell align="right">Unit Price</TableCell>
                                            <TableCell>Customer</TableCell>
                                            <TableCell>Payment</TableCell>
                                            <TableCell>Sold By</TableCell>
                                            <TableCell align="right">Total</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {group.sales.map((sale) => (
                                            <TableRow key={sale.saleId} hover>
                                                <TableCell>{displayTime(sale.time)}</TableCell>
                                                <TableCell>{sale.productName}</TableCell>
                                                <TableCell align="right">{formatQuantity(sale.quantity)}</TableCell>
                                                <TableCell align="right">{formatCurrency(sale.unitPrice)}</TableCell>
                                                <TableCell>{sale.customerName || ANONYMOUS_CUSTOMER}</TableCell>
                                                <TableCell>{paymentLabel(sale.paymentMethod)}</TableCell>
                                                <TableCell>{sale.soldByName || '—'}</TableCell>
                                                <TableCell align="right">{formatCurrency(sale.totalPrice)}</TableCell>
                                            </TableRow>
                                        ))}
                                        {!group.sales.length && (
                                            <TableRow><TableCell colSpan={8} align="center" sx={{ py: 3 }}><Typography variant="body2" color="text.secondary">No sale recorded for this vendor on this day.</Typography></TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            <Typography variant="caption" color="text.secondary">Commission breakdown</Typography>
                            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mt: 0.5 }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                                            <TableCell>Vegetable</TableCell>
                                            <TableCell align="right">Brought</TableCell>
                                            <TableCell align="right">Sold</TableCell>
                                            <TableCell align="right">Left</TableCell>
                                            <TableCell align="right">Sales Value</TableCell>
                                            <TableCell align="right">Total Amount</TableCell>
                                            <TableCell align="right">Commission</TableCell>
                                            <TableCell align="right">Net</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {group.rows.map((row) => (
                                            <TableRow key={row.productId} hover>
                                                <TableCell>{row.productName}</TableCell>
                                                <TableCell align="right">{formatQuantity(row.broughtQuantity)}</TableCell>
                                                <TableCell align="right">{formatQuantity(row.soldQuantity)}</TableCell>
                                                <TableCell align="right">{formatQuantity(row.broughtQuantity - row.soldQuantity)}</TableCell>
                                                <TableCell align="right">{formatCurrency(row.salesValue)}</TableCell>
                                                <TableCell align="right">{formatCurrency(row.liveTotalAmount)}</TableCell>
                                                <TableCell align="right">{formatCurrency(row.liveCommission)}</TableCell>
                                                <TableCell align="right">{formatCurrency(row.liveTotalAmount - row.liveCommission)}</TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow sx={{ bgcolor: 'action.selected' }}>
                                            <TableCell><Typography fontWeight={900}>Vendor Total</Typography></TableCell>
                                            <TableCell align="right"><Typography fontWeight={900}>{formatQuantity(group.broughtQuantity)}</Typography></TableCell>
                                            <TableCell align="right"><Typography fontWeight={900}>{formatQuantity(group.soldQuantity)}</Typography></TableCell>
                                            <TableCell align="right"><Typography fontWeight={900}>{formatQuantity(group.broughtQuantity - group.soldQuantity)}</Typography></TableCell>
                                            <TableCell align="right"><Typography fontWeight={900}>{formatCurrency(group.salesValue)}</Typography></TableCell>
                                            <TableCell align="right"><Typography fontWeight={900}>{formatCurrency(group.totalAmount)}</Typography></TableCell>
                                            <TableCell align="right"><Typography fontWeight={900}>{formatCurrency(group.commission)}</Typography></TableCell>
                                            <TableCell align="right"><Typography fontWeight={900} color="primary.main">{formatCurrency(group.totalAmount - group.commission)}</Typography></TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    ))}
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                        <Typography variant="caption" color="text.secondary">
                            Net after commission · {reportScopeName}
                        </Typography>
                        <Typography fontWeight={900}>{formatCurrency(reportTotals.totalAmount - reportTotals.commission)}</Typography>
                    </Box>
                    {reportBundle && documentActions(reportBundle)}
                    <Button color="inherit" onClick={() => setReportTab('')}>Close</Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={Boolean(toast)} autoHideDuration={2500} onClose={() => setToast('')} message={toast} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} />
        </Box>
    );
};

export default VendorCommissionPage;
