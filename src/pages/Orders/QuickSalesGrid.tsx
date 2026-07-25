import React from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
    DialogContent, DialogTitle, MenuItem, Stack, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { CheckCircle2, PackagePlus, Plus, Save, Store, UserRoundPlus } from 'lucide-react';
import { useDispatch } from 'react-redux';
import api from '../../api/axios';
import type { Product } from '../../features/inventory/inventorySlice';
import { fetchProducts } from '../../features/inventory/inventorySlice';
import { fetchTransactions } from '../../features/transactions/transactionSlice';
import type { AppDispatch } from '../../store';
import useAppCurrency from '../../hooks/useAppCurrency';
import { createHiddenCustomerId } from '../../lib/customerIdentity';

interface Customer { _id: string; fullName: string; cnic?: string; phoneNumber: string; amount: number; customerType: 'regular' | 'credit' | 'installment' | 'wholesale'; status: 'active' | 'inactive'; }
interface TodayProduct { productId: string; productName: string; availableQuantity: number; }
interface TodayVendor { vendorId: string; vendorName: string; products: TodayProduct[]; }
interface SaleLine { id: string; vendorId: string; productId: string; quantity: string; unitPrice: string; }
interface CustomerSaleRow { customer: Customer; lines: SaleLine[]; paymentMethod: 'cash' | 'credit'; paidNow: string; completed: boolean; saving: boolean; }

const blankLine = (): SaleLine => ({ id: `${Date.now()}-${Math.random()}`, vendorId: '', productId: '', quantity: '', unitPrice: '' });
const today = () => new Date().toLocaleDateString('en-CA');
const num = (value: string) => Math.max(Number(value) || 0, 0);

const QuickSalesGrid: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { formatCurrency, currencySymbol } = useAppCurrency();
    const [, setCustomers] = React.useState<Customer[]>([]);
    const [products, setProducts] = React.useState<Product[]>([]);
    const [vendors, setVendors] = React.useState<TodayVendor[]>([]);
    const [rows, setRows] = React.useState<CustomerSaleRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [customerOpen, setCustomerOpen] = React.useState(false);
    const [customerName, setCustomerName] = React.useState('');
    const [customerPhone, setCustomerPhone] = React.useState('');
    const [vendorOpen, setVendorOpen] = React.useState(false);
    const [vendorName, setVendorName] = React.useState('');
    const [receiveVendor, setReceiveVendor] = React.useState<{ id: string; name: string } | null>(null);
    const [receiveProductId, setReceiveProductId] = React.useState('');
    const [receiveQuantity, setReceiveQuantity] = React.useState('');
    const [receivePrice, setReceivePrice] = React.useState('');

    const load = React.useCallback(async () => {
        setLoading(true); setError('');
        try {
            const [customerResponse, productResponse, vendorResponse] = await Promise.all([
                api.get<Customer[]>('/customers'), api.get<Product[]>('/products'), api.get<TodayVendor[]>(`/vendors/today-availability?date=${today()}`),
            ]);
            const activeCustomers = customerResponse.data.filter((customer) => customer.status === 'active');
            setCustomers(activeCustomers); setProducts(productResponse.data); setVendors(vendorResponse.data);
            setRows((current) => current.length
                ? current.map((row) => ({ ...row, customer: activeCustomers.find((customer) => customer._id === row.customer._id) || row.customer }))
                : activeCustomers.map((customer) => ({ customer, lines: [blankLine()], paymentMethod: 'cash', paidNow: '', completed: false, saving: false })));
        } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Unable to load the quick sales grid.'); }
        finally { setLoading(false); }
    }, []);

    React.useEffect(() => { void load(); }, [load]);
    const updateRow = (customerId: string, update: (row: CustomerSaleRow) => CustomerSaleRow) => setRows((current) => current.map((row) => row.customer._id === customerId ? update(row) : row));
    const vendorFor = (vendorId: string) => vendors.find((vendor) => vendor.vendorId === vendorId);
    const productFor = (vendorId: string, productId: string) => vendorFor(vendorId)?.products.find((product) => product.productId === productId);
    const lineTotal = (line: SaleLine) => num(line.quantity) * num(line.unitPrice);
    const rowTotal = (row: CustomerSaleRow) => row.lines.reduce((sum, line) => sum + lineTotal(line), 0);

    const updateLine = (customerId: string, lineId: string, changes: Partial<SaleLine>) => updateRow(customerId, (row) => ({ ...row, lines: row.lines.map((line) => line.id === lineId ? { ...line, ...changes } : line) }));
    const selectVendor = (customerId: string, lineId: string, selectedVendorId: string) => updateLine(customerId, lineId, { vendorId: selectedVendorId, productId: '', quantity: '', unitPrice: '' });
    const selectProduct = (customerId: string, lineId: string, productId: string) => {
        const product = products.find((item) => item.id === productId);
        updateLine(customerId, lineId, { productId, quantity: '', unitPrice: String(product?.salePrice || product?.price || '') });
    };

    const createCustomer = async () => {
        if (!customerName.trim() || !customerPhone.trim()) { setError('Enter the new customer name and phone number.'); return; }
        try {
            const response = await api.post<Customer>('/customers', { fullName: customerName.trim(), phoneNumber: customerPhone.trim(), cnic: createHiddenCustomerId(), amount: 0, customerType: 'regular', status: 'active' });
            setCustomers((current) => [...current, response.data]);
            setRows((current) => [...current, { customer: response.data, lines: [blankLine()], paymentMethod: 'cash', paidNow: '', completed: false, saving: false }]);
            setCustomerName(''); setCustomerPhone(''); setCustomerOpen(false); setMessage(`${response.data.fullName} added to the grid.`);
        } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Unable to create customer.'); }
    };

    const createVendor = async () => {
        if (!vendorName.trim()) { setError('Enter the vendor name.'); return; }
        try {
            const response = await api.post<{ _id: string; name: string }>('/vendors', { name: vendorName.trim() });
            setVendorOpen(false); setVendorName(''); setReceiveVendor({ id: response.data._id, name: response.data.name });
            setMessage(`${response.data.name} created. Record today’s stock before selling.`);
        } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Unable to create vendor.'); }
    };

    const receiveStock = async () => {
        if (!receiveVendor || !receiveProductId || num(receiveQuantity) <= 0) { setError('Select a product and enter a valid received quantity.'); return; }
        try {
            await api.post(`/vendors/${receiveVendor.id}/receive`, { productId: receiveProductId, quantity: num(receiveQuantity), unitPurchasePrice: num(receivePrice) });
            setReceiveVendor(null); setReceiveProductId(''); setReceiveQuantity(''); setReceivePrice(''); await load();
            setMessage('Vendor stock received. The vendor now appears in today’s dropdown.');
        } catch (requestError: any) { setError(requestError?.response?.data?.message || 'Unable to receive vendor stock.'); }
    };

    const completeSale = async (row: CustomerSaleRow) => {
        const total = rowTotal(row);
        const lines = row.lines.filter((line) => line.vendorId && line.productId && num(line.quantity) > 0 && num(line.unitPrice) > 0);
        if (!total || lines.length !== row.lines.length) { setError(`Complete every line for ${row.customer.fullName}.`); return; }
        for (const line of lines) {
            const available = productFor(line.vendorId, line.productId)?.availableQuantity || 0;
            if (num(line.quantity) > available) { setError(`Only ${available} are available from the selected vendor.`); return; }
        }
        if (row.paymentMethod === 'credit' && !row.customer.cnic) { setError('Credit sales need a saved customer record.'); return; }
        updateRow(row.customer._id, (current) => ({ ...current, saving: true }));
        try {
            await api.post('/transactions/quick-sale', {
                customerName: row.customer.fullName, customerCnic: row.customer.cnic || '', paymentMethod: row.paymentMethod, saleDate: today(),
                paidNow: row.paymentMethod === 'cash' ? total : num(row.paidNow), lines: lines.map((line) => ({ vendorId: line.vendorId, productId: line.productId, quantity: num(line.quantity), unitPrice: num(line.unitPrice) })),
            });
            updateRow(row.customer._id, (current) => ({ ...current, completed: true, saving: false }));
            await Promise.all([load(), dispatch(fetchProducts()), dispatch(fetchTransactions())]);
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
                <Box><Typography variant="h6" fontWeight={900}>Today’s Quick Sales</Typography><Typography variant="body2" color="text.secondary">Choose a customer, then sell only vegetables delivered by today’s vendors.</Typography></Box>
                <Stack direction="row" spacing={1}><Button size="small" startIcon={<UserRoundPlus size={16} />} onClick={() => setCustomerOpen(true)}>Add Customer</Button><Button size="small" startIcon={<Store size={16} />} onClick={() => setVendorOpen(true)}>Add Vendor</Button></Stack>
            </Stack>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}
            {!vendors.length && <Alert severity="info" sx={{ mb: 2 }}>No vendor deliveries were recorded today. Add a vendor and receive stock to begin.</Alert>}
            <TableContainer sx={{ maxHeight: 660, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}><Table size="small" stickyHeader sx={{ minWidth: 1100 }}>
                <TableHead><TableRow><TableCell>Customer</TableCell><TableCell>Vendor</TableCell><TableCell>Vegetable</TableCell><TableCell align="right">Qty</TableCell><TableCell align="right">Sale Price</TableCell><TableCell align="right">Amount</TableCell><TableCell>Payment</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead>
                {rows.map((row) => <TableBody key={row.customer._id}>{row.lines.map((line, index) => {
                    const productsForVendor = vendorFor(line.vendorId)?.products || []; const selectedProduct = productFor(line.vendorId, line.productId); const total = rowTotal(row);
                    return <TableRow key={line.id} sx={{ bgcolor: row.completed ? 'success.50' : undefined }}>
                        {index === 0 && <TableCell rowSpan={row.lines.length} sx={{ minWidth: 150, verticalAlign: 'top' }}><Typography fontWeight={800}>{row.customer.fullName}</Typography><Typography variant="caption" color="text.secondary">{row.customer.phoneNumber}</Typography>{row.completed && <Chip icon={<CheckCircle2 size={14} />} label="Completed" color="success" size="small" sx={{ mt: 1, fontWeight: 700 }} />}</TableCell>}
                        <TableCell sx={{ minWidth: 155 }}><TextField select fullWidth size="small" disabled={row.completed} value={line.vendorId} onChange={(event) => selectVendor(row.customer._id, line.id, event.target.value)}><MenuItem value="">Select vendor</MenuItem>{vendors.map((vendor) => <MenuItem key={vendor.vendorId} value={vendor.vendorId}>{vendor.vendorName}</MenuItem>)}</TextField></TableCell>
                        <TableCell sx={{ minWidth: 180 }}><TextField select fullWidth size="small" disabled={!line.vendorId || row.completed} value={line.productId} onChange={(event) => selectProduct(row.customer._id, line.id, event.target.value)}><MenuItem value="">Select vegetable</MenuItem>{productsForVendor.map((product) => <MenuItem key={product.productId} value={product.productId} disabled={product.availableQuantity <= 0}>{product.productName} ({product.availableQuantity} available)</MenuItem>)}</TextField></TableCell>
                        <TableCell sx={{ width: 100 }}><TextField fullWidth size="small" type="number" disabled={!line.productId || row.completed} value={line.quantity} inputProps={{ min: 0, max: selectedProduct?.availableQuantity || 0 }} onChange={(event) => updateLine(row.customer._id, line.id, { quantity: event.target.value })} /></TableCell>
                        <TableCell sx={{ width: 125 }}><TextField fullWidth size="small" type="number" disabled={!line.productId || row.completed} value={line.unitPrice} InputProps={{ startAdornment: <Typography variant="caption">{currencySymbol}</Typography> }} onChange={(event) => updateLine(row.customer._id, line.id, { unitPrice: event.target.value })} /></TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>{formatCurrency(lineTotal(line), { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</TableCell>
                        {index === 0 && <TableCell rowSpan={row.lines.length} sx={{ minWidth: 130, verticalAlign: 'top' }}><TextField select fullWidth size="small" label="Method" disabled={row.completed} value={row.paymentMethod} onChange={(event) => updateRow(row.customer._id, (current) => ({ ...current, paymentMethod: event.target.value as 'cash' | 'credit' }))}><MenuItem value="cash">Cash</MenuItem><MenuItem value="credit">Credit</MenuItem></TextField>{row.paymentMethod === 'credit' && <TextField fullWidth size="small" type="number" label="Paid now" sx={{ mt: 1 }} disabled={row.completed} value={row.paidNow} inputProps={{ min: 0, max: total }} onChange={(event) => updateRow(row.customer._id, (current) => ({ ...current, paidNow: event.target.value }))} />}</TableCell>}
                        {index === 0 && <TableCell rowSpan={row.lines.length} align="right" sx={{ minWidth: 135, verticalAlign: 'top' }}><Typography variant="caption" color="text.secondary">Total</Typography><Typography fontWeight={900} sx={{ mb: 1 }}>{formatCurrency(total, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</Typography>{!row.completed && <><Button fullWidth size="small" startIcon={<Plus size={15} />} sx={{ mb: 1 }} onClick={() => updateRow(row.customer._id, (current) => ({ ...current, lines: [...current.lines, blankLine()] }))}>Add item</Button><Button fullWidth variant="contained" size="small" startIcon={<Save size={15} />} disabled={row.saving} onClick={() => void completeSale(row)}>{row.saving ? 'Saving…' : 'Complete Sale'}</Button></>}</TableCell>}
                    </TableRow>;
                })}</TableBody>)}</Table>
            </TableContainer>
        </CardContent>
        <Dialog open={customerOpen} onClose={() => setCustomerOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Add Customer</DialogTitle><DialogContent><TextField autoFocus fullWidth label="Customer name" sx={{ mt: 1.5, mb: 1.5 }} value={customerName} onChange={(event) => setCustomerName(event.target.value)} /><TextField fullWidth label="Phone number" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></DialogContent><DialogActions><Button onClick={() => setCustomerOpen(false)}>Cancel</Button><Button variant="contained" onClick={() => void createCustomer()}>Add to grid</Button></DialogActions></Dialog>
        <Dialog open={vendorOpen} onClose={() => setVendorOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Add Vendor</DialogTitle><DialogContent><TextField autoFocus fullWidth label="Vendor name" sx={{ mt: 1.5 }} value={vendorName} onChange={(event) => setVendorName(event.target.value)} helperText="You will record today’s received stock next." /></DialogContent><DialogActions><Button onClick={() => setVendorOpen(false)}>Cancel</Button><Button variant="contained" onClick={() => void createVendor()}>Create vendor</Button></DialogActions></Dialog>
        <Dialog open={Boolean(receiveVendor)} onClose={() => setReceiveVendor(null)} fullWidth maxWidth="xs"><DialogTitle>Receive Stock — {receiveVendor?.name}</DialogTitle><DialogContent><TextField select fullWidth label="Vegetable" sx={{ mt: 1.5, mb: 1.5 }} value={receiveProductId} onChange={(event) => setReceiveProductId(event.target.value)}><MenuItem value="">Select vegetable</MenuItem>{products.map((product) => <MenuItem key={product.id} value={product.id}>{product.name}</MenuItem>)}</TextField><TextField fullWidth type="number" label="Received quantity" sx={{ mb: 1.5 }} value={receiveQuantity} onChange={(event) => setReceiveQuantity(event.target.value)} /><TextField fullWidth type="number" label="Purchase price (optional)" value={receivePrice} onChange={(event) => setReceivePrice(event.target.value)} /></DialogContent><DialogActions><Button onClick={() => setReceiveVendor(null)}>Cancel</Button><Button variant="contained" startIcon={<PackagePlus size={16} />} onClick={() => void receiveStock()}>Receive stock</Button></DialogActions></Dialog>
    </Card>;
};

export default QuickSalesGrid;
