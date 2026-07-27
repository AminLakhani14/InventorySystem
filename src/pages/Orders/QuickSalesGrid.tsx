import React from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
    DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem, Stack, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { PackagePlus, Plus, Save, Search, Store, Trash2, UserRoundPlus, X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../api/axios';
import { fetchProducts } from '../../features/inventory/inventorySlice';
import { fetchTransactions } from '../../features/transactions/transactionSlice';
import type { AppDispatch, RootState } from '../../store';
import useAppCurrency from '../../hooks/useAppCurrency';
import { createHiddenCustomerId } from '../../lib/customerIdentity';

interface Customer { _id: string; fullName: string; cnic?: string; phoneNumber: string; amount: number; customerType: 'regular' | 'credit' | 'installment' | 'wholesale'; status: 'active' | 'inactive'; }
interface AvailableProduct { productId: string; productName: string; availableQuantity: number; }
interface AvailableVendor { vendorId: string; vendorName: string; vendorPhone?: string; products: AvailableProduct[]; }
interface SaleLine { id: string; vendorId: string; productId: string; quantity: string; unitPrice: string; }
interface CustomerSaleRow { customer: Customer; lines: SaleLine[]; saving: boolean; }
interface VendorOption { _id: string; name: string; phoneNumber?: string; }
interface ReceiveLine { id: string; productId: string; quantity: string; }

const blankLine = (): SaleLine => ({ id: `${Date.now()}-${Math.random()}`, vendorId: '', productId: '', quantity: '', unitPrice: '' });
const blankReceiveLine = (): ReceiveLine => ({ id: `${Date.now()}-${Math.random()}`, productId: '', quantity: '' });
const num = (value: string) => Math.max(Number(value) || 0, 0);

const QuickSalesGrid: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { formatCurrency, currencySymbol } = useAppCurrency();
    const [, setCustomers] = React.useState<Customer[]>([]);
    // Products come from the store the parent screen already loads — no second /products call.
    const products = useSelector((state: RootState) => state.inventory.products);
    const [vendors, setVendors] = React.useState<AvailableVendor[]>([]);
    const [allVendors, setAllVendors] = React.useState<VendorOption[]>([]);
    const [rows, setRows] = React.useState<CustomerSaleRow[]>([]);
    const [customerSearch, setCustomerSearch] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [customerOpen, setCustomerOpen] = React.useState(false);
    const [customerName, setCustomerName] = React.useState('');
    const [customerPhone, setCustomerPhone] = React.useState('');
    const [vendorOpen, setVendorOpen] = React.useState(false);
    const [vendorName, setVendorName] = React.useState('');
    const [vendorPhone, setVendorPhone] = React.useState('');
    const [receiveOpen, setReceiveOpen] = React.useState(false);
    const [receiveVendorId, setReceiveVendorId] = React.useState('');
    const [receiveLines, setReceiveLines] = React.useState<ReceiveLine[]>([blankReceiveLine()]);
    const [receiveSaving, setReceiveSaving] = React.useState(false);

    const load = React.useCallback(async () => {
        setLoading(true); setError('');
        try {
            const [customerResponse, vendorListResponse, vendorResponse] = await Promise.all([
                api.get<Customer[]>('/customers'), api.get<VendorOption[]>('/vendors'), api.get<AvailableVendor[]>('/vendors/today-availability'),
            ]);
            const activeCustomers = customerResponse.data.filter((customer) => customer.status === 'active');
            setCustomers(activeCustomers); setAllVendors(vendorListResponse.data); setVendors(vendorResponse.data);
            setRows((current) => current.length
                ? current.map((row) => ({ ...row, customer: activeCustomers.find((customer) => customer._id === row.customer._id) || row.customer }))
                : activeCustomers.map((customer) => ({ customer, lines: [blankLine()], saving: false })));
        } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Unable to load the quick sales grid.'); }
        finally { setLoading(false); }
    }, []);

    // Only vendor stock moves when a sale is saved, so the post-save refresh skips
    // the customer and vendor lists instead of reloading the whole grid.
    const loadAvailability = React.useCallback(async () => {
        const response = await api.get<AvailableVendor[]>('/vendors/today-availability');
        setVendors(response.data);
    }, []);

    React.useEffect(() => { void load(); }, [load]);
    const updateRow = (customerId: string, update: (row: CustomerSaleRow) => CustomerSaleRow) => setRows((current) => current.map((row) => row.customer._id === customerId ? update(row) : row));
    const vendorFor = (vendorId: string) => vendors.find((vendor) => vendor.vendorId === vendorId);
    const productFor = (vendorId: string, productId: string) => vendorFor(vendorId)?.products.find((product) => product.productId === productId);
    const lineTotal = (line: SaleLine) => num(line.quantity) * num(line.unitPrice);
    const rowTotal = (row: CustomerSaleRow) => row.lines.reduce((sum, line) => sum + lineTotal(line), 0);
    const visibleRows = React.useMemo(() => {
        const term = customerSearch.trim().toLowerCase();
        if (!term) return rows;
        return rows.filter((row) => row.customer.fullName.toLowerCase().includes(term) || (row.customer.phoneNumber || '').toLowerCase().includes(term));
    }, [rows, customerSearch]);

    const updateLine = (customerId: string, lineId: string, changes: Partial<SaleLine>) => updateRow(customerId, (row) => ({ ...row, lines: row.lines.map((line) => line.id === lineId ? { ...line, ...changes } : line) }));
    const selectVendor = (customerId: string, lineId: string, selectedVendorId: string) => updateLine(customerId, lineId, { vendorId: selectedVendorId, productId: '', quantity: '', unitPrice: '' });
    const removeLine = (customerId: string, lineId: string) => updateRow(customerId, (row) => ({
        ...row,
        lines: row.lines.length === 1 ? [blankLine()] : row.lines.filter((line) => line.id !== lineId),
    }));
    // Sale price is negotiated per sale, so it stays blank for the user to type.
    const selectProduct = (customerId: string, lineId: string, productId: string) => updateLine(customerId, lineId, { productId, quantity: '', unitPrice: '' });

    const createCustomer = async () => {
        if (!customerName.trim() || !customerPhone.trim()) { setError('Enter the new customer name and phone number.'); return; }
        try {
            const response = await api.post<Customer>('/customers', { fullName: customerName.trim(), phoneNumber: customerPhone.trim(), cnic: createHiddenCustomerId(), amount: 0, customerType: 'credit', status: 'active' });
            setCustomers((current) => [...current, response.data]);
            setRows((current) => [...current, { customer: response.data, lines: [blankLine()], saving: false }]);
            setCustomerName(''); setCustomerPhone(''); setCustomerOpen(false); setMessage(`${response.data.fullName} added to the grid.`);
        } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Unable to create customer.'); }
    };

    const openReceiveStock = (vendorId = '') => {
        setReceiveVendorId(vendorId);
        setReceiveLines([blankReceiveLine()]);
        setReceiveOpen(true);
    };

    const updateReceiveLine = (lineId: string, changes: Partial<ReceiveLine>) => setReceiveLines((current) => current.map((line) => line.id === lineId ? { ...line, ...changes } : line));
    const removeReceiveLine = (lineId: string) => setReceiveLines((current) => current.length === 1 ? [blankReceiveLine()] : current.filter((line) => line.id !== lineId));

    const createVendor = async () => {
        if (!vendorName.trim()) { setError('Enter the vendor name.'); return; }
        try {
            const response = await api.post<VendorOption>('/vendors', { name: vendorName.trim(), phoneNumber: vendorPhone.trim() });
            setAllVendors((current) => current.some((vendor) => vendor._id === response.data._id) ? current : [...current, response.data]);
            setVendorOpen(false); setVendorName(''); setVendorPhone('');
            openReceiveStock(response.data._id);
            setMessage(`${response.data.name} created. Add the vegetables received from this vendor.`);
        } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Unable to create vendor.'); }
    };

    const receiveStock = async () => {
        const items = receiveLines
            .filter((line) => line.productId || line.quantity)
            .map((line) => ({ productId: line.productId, quantity: num(line.quantity) }));
        if (!receiveVendorId) { setError('Select the vendor receiving this stock.'); return; }
        if (!items.length || items.some((item) => !item.productId || item.quantity <= 0)) { setError('Select a vegetable and enter a valid quantity on every line.'); return; }
        setReceiveSaving(true);
        try {
            await api.post(`/vendors/${receiveVendorId}/receive`, { items });
            setReceiveOpen(false); setReceiveVendorId(''); setReceiveLines([blankReceiveLine()]);
            await Promise.all([loadAvailability(), dispatch(fetchProducts())]);
            setMessage(`${items.length} vegetable${items.length === 1 ? '' : 's'} received. The vendor now appears in the available-stock dropdown.`);
        } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Unable to receive vendor stock.'); }
        finally { setReceiveSaving(false); }
    };

    const completeSale = async (row: CustomerSaleRow) => {
        const total = rowTotal(row);
        const lines = row.lines.filter((line) => line.vendorId && line.productId && num(line.quantity) > 0 && num(line.unitPrice) > 0);
        if (!total || lines.length !== row.lines.length) { setError(`Complete every line for ${row.customer.fullName}.`); return; }
        for (const line of lines) {
            const available = productFor(line.vendorId, line.productId)?.availableQuantity || 0;
            if (num(line.quantity) > available) { setError(`Only ${available} are available from the selected vendor.`); return; }
        }
        if (!row.customer.cnic) { setError('Credit sales need a saved customer record.'); return; }
        updateRow(row.customer._id, (current) => ({ ...current, saving: true }));
        try {
            await api.post('/transactions/quick-sale', {
                customerName: row.customer.fullName, customerCnic: row.customer.cnic || '', paymentMethod: 'credit',
                paidNow: 0, lines: lines.map((line) => ({ vendorId: line.vendorId, productId: line.productId, quantity: num(line.quantity), unitPrice: num(line.unitPrice) })),
            });
            // Keep the customer in the grid and immediately ready for another credit sale.
            updateRow(row.customer._id, (current) => ({ ...current, lines: [blankLine()], saving: false }));
            await Promise.all([loadAvailability(), dispatch(fetchProducts()), dispatch(fetchTransactions())]);
            setMessage(`Sale completed for ${row.customer.fullName}.`);
        } catch (requestError: any) {
            updateRow(row.customer._id, (current) => ({ ...current, saving: false }));
            setError(requestError?.response?.data?.message || 'Unable to complete quick sale.');
        }
    };

    if (loading) return <Card sx={{ mb: 3, borderRadius: 2 }}><CardContent sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></CardContent></Card>;

    return <Card sx={{ mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'primary.light' }}>
        <CardContent sx={{ p: { xs: 1.5, md: 2.5 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
                <Box><Typography variant="h6" fontWeight={900}>Quick Credit Sales</Typography><Typography variant="body2" color="text.secondary">Sell available vendor stock on credit. Saved customers remain ready for their next sale.</Typography></Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                    <TextField size="small" placeholder="Search customer or phone" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} sx={{ minWidth: 230 }} InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>, endAdornment: customerSearch ? <InputAdornment position="end"><IconButton size="small" aria-label="Clear customer search" onClick={() => setCustomerSearch('')}><X size={14} /></IconButton></InputAdornment> : undefined }} />
                    <Stack direction="row" spacing={1}><Button size="small" startIcon={<UserRoundPlus size={16} />} onClick={() => setCustomerOpen(true)}>Add Customer</Button><Button size="small" startIcon={<Store size={16} />} onClick={() => setVendorOpen(true)}>Add Vendor</Button><Button size="small" startIcon={<PackagePlus size={16} />} onClick={() => openReceiveStock()}>Receive Stock</Button></Stack>
                </Stack>
            </Stack>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}
            {!vendors.length && <Alert severity="info" sx={{ mb: 2 }}>No vendor has stock remaining. Add a vendor and receive stock to begin.</Alert>}
            <TableContainer sx={{ maxHeight: 660, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}><Table size="small" stickyHeader sx={{ minWidth: 1190 }}>
                <TableHead><TableRow><TableCell>Customer</TableCell><TableCell>Vendor</TableCell><TableCell>Vegetable</TableCell><TableCell align="right">Qty</TableCell><TableCell align="right">Sale Price</TableCell><TableCell align="right">Amount</TableCell><TableCell align="center">Item</TableCell><TableCell>Sale</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead>
                {!visibleRows.length && <TableBody><TableRow><TableCell colSpan={9} align="center" sx={{ py: 3, color: 'text.secondary' }}>No customer matches “{customerSearch.trim()}”.</TableCell></TableRow></TableBody>}
                {visibleRows.map((row) => <TableBody key={row.customer._id}>{row.lines.map((line, index) => {
                    const productsForVendor = vendorFor(line.vendorId)?.products || []; const selectedProduct = productFor(line.vendorId, line.productId); const total = rowTotal(row);
                    return <TableRow key={line.id}>
                        {index === 0 && <TableCell rowSpan={row.lines.length} sx={{ minWidth: 150, verticalAlign: 'top' }}><Typography fontWeight={800}>{row.customer.fullName}</Typography><Typography variant="caption" color="text.secondary">{row.customer.phoneNumber}</Typography></TableCell>}
                        <TableCell sx={{ minWidth: 155 }}><TextField select fullWidth size="small" value={line.vendorId} onChange={(event) => selectVendor(row.customer._id, line.id, event.target.value)}><MenuItem value="">Select vendor</MenuItem>{vendors.map((vendor) => <MenuItem key={vendor.vendorId} value={vendor.vendorId}>{vendor.vendorName}{vendor.vendorPhone ? ` · ${vendor.vendorPhone}` : ''} ({vendor.products.reduce((sum, product) => sum + product.availableQuantity, 0)} remaining)</MenuItem>)}</TextField></TableCell>
                        <TableCell sx={{ minWidth: 180 }}><TextField select fullWidth size="small" disabled={!line.vendorId} value={line.productId} onChange={(event) => selectProduct(row.customer._id, line.id, event.target.value)}><MenuItem value="">Select vegetable</MenuItem>{productsForVendor.map((product) => <MenuItem key={product.productId} value={product.productId}>{product.productName} ({product.availableQuantity} available)</MenuItem>)}</TextField></TableCell>
                        <TableCell sx={{ width: 100 }}><TextField fullWidth size="small" type="number" disabled={!line.productId} value={line.quantity} inputProps={{ min: 0, max: selectedProduct?.availableQuantity || 0 }} onChange={(event) => updateLine(row.customer._id, line.id, { quantity: event.target.value })} /></TableCell>
                        <TableCell sx={{ width: 125 }}><TextField fullWidth size="small" type="number" disabled={!line.productId} value={line.unitPrice} InputProps={{ startAdornment: <Typography variant="caption">{currencySymbol}</Typography> }} onChange={(event) => updateLine(row.customer._id, line.id, { unitPrice: event.target.value })} /></TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>{formatCurrency(lineTotal(line), { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell align="center" sx={{ width: 72 }}><Button aria-label="Remove item" title="Remove item" size="small" color="error" disabled={row.lines.length === 1} onClick={() => removeLine(row.customer._id, line.id)} sx={{ minWidth: 36, px: 0.75 }}><Trash2 size={16} /></Button></TableCell>
                        {index === 0 && <TableCell rowSpan={row.lines.length} sx={{ minWidth: 100, verticalAlign: 'top' }}><Chip label="Credit" color="warning" size="small" sx={{ fontWeight: 800 }} /></TableCell>}
                        {index === 0 && <TableCell rowSpan={row.lines.length} align="right" sx={{ minWidth: 135, verticalAlign: 'top' }}><Typography variant="caption" color="text.secondary">Total</Typography><Typography fontWeight={900} sx={{ mb: 1 }}>{formatCurrency(total, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</Typography><Button fullWidth size="small" startIcon={<Plus size={15} />} sx={{ mb: 1 }} onClick={() => updateRow(row.customer._id, (current) => ({ ...current, lines: [...current.lines, blankLine()] }))}>Add item</Button><Button fullWidth variant="contained" size="small" startIcon={<Save size={15} />} disabled={row.saving} onClick={() => void completeSale(row)}>{row.saving ? 'Saving…' : 'Save Credit Sale'}</Button></TableCell>}
                    </TableRow>;
                })}</TableBody>)}</Table>
            </TableContainer>
        </CardContent>
        <Dialog open={customerOpen} onClose={() => setCustomerOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Add Customer</DialogTitle><DialogContent><TextField autoFocus fullWidth label="Customer name" sx={{ mt: 1.5, mb: 1.5 }} value={customerName} onChange={(event) => setCustomerName(event.target.value)} /><TextField fullWidth label="Phone number" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></DialogContent><DialogActions><Button onClick={() => setCustomerOpen(false)}>Cancel</Button><Button variant="contained" onClick={() => void createCustomer()}>Add to grid</Button></DialogActions></Dialog>
        <Dialog open={vendorOpen} onClose={() => setVendorOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Add Vendor</DialogTitle><DialogContent><TextField autoFocus fullWidth label="Vendor name" sx={{ mt: 1.5, mb: 1.5 }} value={vendorName} onChange={(event) => setVendorName(event.target.value)} /><TextField fullWidth label="Phone number" value={vendorPhone} onChange={(event) => setVendorPhone(event.target.value)} helperText="Record vendor stock next so it can be sold from this grid." /></DialogContent><DialogActions><Button onClick={() => setVendorOpen(false)}>Cancel</Button><Button variant="contained" onClick={() => void createVendor()}>Create vendor</Button></DialogActions></Dialog>
        <Dialog open={receiveOpen} onClose={() => setReceiveOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>Receive Stock</DialogTitle>
            <DialogContent>
                <TextField select fullWidth label="Vendor" sx={{ mt: 1.5, mb: 2 }} value={receiveVendorId} onChange={(event) => setReceiveVendorId(event.target.value)}>
                    <MenuItem value="">Select vendor</MenuItem>
                    {allVendors.map((vendor) => <MenuItem key={vendor._id} value={vendor._id}>{vendor.name}{vendor.phoneNumber ? ` · ${vendor.phoneNumber}` : ''}</MenuItem>)}
                </TextField>
                <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>Vegetables received</Typography>
                <Stack spacing={1.5}>
                    {receiveLines.map((line) => <Stack key={line.id} direction="row" spacing={1} alignItems="center">
                        <TextField select fullWidth size="small" label="Vegetable" value={line.productId} onChange={(event) => updateReceiveLine(line.id, { productId: event.target.value })}>
                            <MenuItem value="">Select vegetable</MenuItem>
                            {products.map((product) => <MenuItem key={product.id} value={product.id}>{product.name}</MenuItem>)}
                        </TextField>
                        <TextField size="small" type="number" label="Quantity" sx={{ width: 130 }} inputProps={{ min: 0 }} value={line.quantity} onChange={(event) => updateReceiveLine(line.id, { quantity: event.target.value })} />
                        <Button aria-label="Remove vegetable" title="Remove vegetable" size="small" color="error" disabled={receiveLines.length === 1} onClick={() => removeReceiveLine(line.id)} sx={{ minWidth: 36, px: 0.75 }}><Trash2 size={16} /></Button>
                    </Stack>)}
                </Stack>
                <Button size="small" startIcon={<Plus size={15} />} sx={{ mt: 1.5 }} onClick={() => setReceiveLines((current) => [...current, blankReceiveLine()])}>Add another vegetable</Button>
            </DialogContent>
            <DialogActions><Button onClick={() => setReceiveOpen(false)}>Cancel</Button><Button variant="contained" disabled={receiveSaving} startIcon={<PackagePlus size={16} />} onClick={() => void receiveStock()}>{receiveSaving ? 'Saving…' : 'Receive stock'}</Button></DialogActions>
        </Dialog>
    </Card>;
};

export default QuickSalesGrid;
