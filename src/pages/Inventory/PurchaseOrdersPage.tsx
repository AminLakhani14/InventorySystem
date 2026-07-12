import React from 'react';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    Grid,
    IconButton,
    MenuItem,
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
    Typography,
} from '@mui/material';
import { ClipboardCheck, PackagePlus, Pencil, Plus, Search, Trash2, Truck, X } from 'lucide-react';
import { useSelector } from 'react-redux';
import api from '../../api/axios';
import { useAppCurrency } from '../../hooks/useAppCurrency';
import type { Product } from '../../features/inventory/inventorySlice';
import type { RootState } from '../../store';

interface PurchaseOrderItem {
    productId: string;
    productName: string;
    quantity: number;
    unitPurchasePrice: number;
    totalPurchase: number;
}

interface PurchaseOrder {
    _id: string;
    orderNumber: string;
    vendorName: string;
    vehicleNumber: string;
    vehicleRent: number;
    labourCost: number;
    paymentStatus: 'paid' | 'unpaid';
    items: PurchaseOrderItem[];
    totalProductPurchase: number;
    grandTotal: number;
    receivedByName: string;
    createdAt: string;
}

interface DraftItem {
    product: Product | null;
    quantity: string;
    unitPurchasePrice: string;
}

interface StoredPurchaseOrderDraft {
    vendorName: string;
    vehicleNumber: string;
    vehicleRent: string;
    labourCost: string;
    paymentStatus: 'paid' | 'unpaid';
    items: Array<{ productId: string | null; quantity: string; unitPurchasePrice: string }>;
    editingId: string | null;
}

const emptyItem = (): DraftItem => ({ product: null, quantity: '', unitPurchasePrice: '' });
const toNumber = (value: string) => Number(value) || 0;

const readDraft = (key: string): StoredPurchaseOrderDraft | null => {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) as StoredPurchaseOrderDraft : null;
    } catch {
        localStorage.removeItem(key);
        return null;
    }
};

const PurchaseOrdersPage: React.FC = () => {
    const { formatCurrency } = useAppCurrency();
    const userId = useSelector((state: RootState) => state.auth.user?.id || 'anonymous');
    const draftKey = `purchase-order-draft:${userId}`;
    const storedDraft = React.useMemo(() => readDraft(draftKey), [draftKey]);
    const draftReady = React.useRef(false);
    const [products, setProducts] = React.useState<Product[]>([]);
    const [orders, setOrders] = React.useState<PurchaseOrder[]>([]);
    const [vendorName, setVendorName] = React.useState(storedDraft?.vendorName || '');
    const [vehicleNumber, setVehicleNumber] = React.useState(storedDraft?.vehicleNumber || '');
    const [vehicleRent, setVehicleRent] = React.useState(storedDraft?.vehicleRent || '');
    const [labourCost, setLabourCost] = React.useState(storedDraft?.labourCost || '');
    const [paymentStatus, setPaymentStatus] = React.useState<'paid' | 'unpaid'>(storedDraft?.paymentStatus || 'unpaid');
    const [items, setItems] = React.useState<DraftItem[]>([emptyItem()]);
    const [editingId, setEditingId] = React.useState<string | null>(storedDraft?.editingId || null);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState('');
    const [snack, setSnack] = React.useState('');
    const [searchQuery, setSearchQuery] = React.useState('');

    const loadData = React.useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [productsResponse, ordersResponse] = await Promise.all([
                api.get<Product[]>('/products'),
                api.get<PurchaseOrder[]>('/purchase-orders'),
            ]);
            setProducts(productsResponse.data);
            setOrders(ordersResponse.data);
        } catch (requestError: any) {
            setError(requestError?.response?.data?.message || 'Unable to load purchase orders right now.');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => { loadData(); }, [loadData]);

    React.useEffect(() => {
        if (loading || draftReady.current) return;

        if (storedDraft?.items?.length) {
            setItems(storedDraft.items.map((item) => ({
                product: products.find((product) => product.id === item.productId) || null,
                quantity: item.quantity,
                unitPurchasePrice: item.unitPurchasePrice,
            })));
        }
        draftReady.current = true;
    }, [loading, products, storedDraft]);

    React.useEffect(() => {
        if (!draftReady.current) return;

        const draft: StoredPurchaseOrderDraft = {
            vendorName,
            vehicleNumber,
            vehicleRent,
            labourCost,
            paymentStatus,
            items: items.map((item) => ({
                productId: item.product?.id || null,
                quantity: item.quantity,
                unitPurchasePrice: item.unitPurchasePrice,
            })),
            editingId,
        };
        localStorage.setItem(draftKey, JSON.stringify(draft));
    }, [draftKey, editingId, items, labourCost, paymentStatus, vehicleNumber, vehicleRent, vendorName]);

    const resetForm = () => {
        localStorage.removeItem(draftKey);
        setVendorName('');
        setVehicleNumber('');
        setVehicleRent('');
        setLabourCost('');
        setPaymentStatus('unpaid');
        setItems([emptyItem()]);
        setEditingId(null);
    };

    const updateItem = (index: number, changes: Partial<DraftItem>) => {
        setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
    };

    const productTotal = items.reduce((total, item) => total + toNumber(item.quantity) * toNumber(item.unitPurchasePrice), 0);
    const grandTotal = productTotal + toNumber(vehicleRent) + toNumber(labourCost);
    const filteredOrders = React.useMemo(() => {
        const query = searchQuery.trim().toLocaleLowerCase();
        if (!query) return orders;

        return orders.filter((order) => [
            order.orderNumber,
            order.vendorName,
            order.vehicleNumber,
            order.paymentStatus,
            ...order.items.map((item) => item.productName),
        ].some((value) => String(value || '').toLocaleLowerCase().includes(query)));
    }, [orders, searchQuery]);

    const handleSave = async () => {
        if (!vendorName.trim() || !vehicleNumber.trim()) {
            setError('Vendor name and Gadi Number are required.');
            return;
        }
        if (items.some((item) => !item.product || toNumber(item.quantity) <= 0 || toNumber(item.unitPurchasePrice) < 0)) {
            setError('Select an inventory product and enter a valid quantity and purchase price for every row.');
            return;
        }

        setSaving(true);
        setError('');
        const payload = {
            vendorName: vendorName.trim(),
            vehicleNumber: vehicleNumber.trim(),
            vehicleRent: toNumber(vehicleRent),
            labourCost: toNumber(labourCost),
            paymentStatus,
            items: items.map((item) => ({ productId: item.product!.id, quantity: toNumber(item.quantity), unitPurchasePrice: toNumber(item.unitPurchasePrice) })),
        };
        try {
            if (editingId) {
                await api.put(`/purchase-orders/${editingId}`, payload);
            } else {
                await api.post('/purchase-orders', payload);
            }
            const message = editingId ? 'Purchase order updated and inventory quantities adjusted.' : 'Purchase order saved and inventory quantities updated.';
            resetForm();
            await loadData();
            setSnack(message);
        } catch (requestError: any) {
            setError(requestError?.response?.data?.message || 'Unable to save this purchase order.');
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (order: PurchaseOrder) => {
        setVendorName(order.vendorName);
        setVehicleNumber(order.vehicleNumber);
        setVehicleRent(String(order.vehicleRent));
        setLabourCost(String(order.labourCost || 0));
        setPaymentStatus(order.paymentStatus || 'unpaid');
        setItems(order.items.map((item) => ({ product: products.find((product) => product.id === item.productId) || null, quantity: String(item.quantity), unitPurchasePrice: String(item.unitPurchasePrice) })));
        setEditingId(order._id);
        setError('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (order: PurchaseOrder) => {
        if (!window.confirm(`Delete purchase order ${order.orderNumber}? Its received quantities will be removed from inventory.`)) return;
        try {
            await api.delete(`/purchase-orders/${order._id}`);
            if (editingId === order._id) resetForm();
            await loadData();
            setSnack('Purchase order deleted and inventory quantities adjusted.');
        } catch (requestError: any) {
            setError(requestError?.response?.data?.message || 'Unable to delete this purchase order.');
        }
    };

    return (
        <Box>
            <Snackbar open={Boolean(snack)} autoHideDuration={3000} onClose={() => setSnack('')} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
                <Alert onClose={() => setSnack('')} severity="success" sx={{ width: '100%' }}>{snack}</Alert>
            </Snackbar>

            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight={800}>Purchase Orders</Typography>
                <Typography variant="body2" color="text.secondary">Record vendor deliveries and add received quantities to inventory.</Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}

            <Card sx={{ borderRadius: 4, mb: 4 }}>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3 }}>
                        <Truck size={22} />
                        <Typography variant="h6" fontWeight={800}>{editingId ? 'Edit Purchase Order' : 'Add Purchase Order'}</Typography>
                    </Stack>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth required label="Vendor Name" value={vendorName} onChange={(event) => setVendorName(event.target.value)} /></Grid>
                        <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth required label="Gadi Number" value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)} /></Grid>
                        <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth label="Gadi Rent" type="number" slotProps={{ htmlInput: { min: 0, step: 'any' } }} value={vehicleRent} onChange={(event) => setVehicleRent(event.target.value)} /></Grid>
                        <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth label="Labour Cost" type="number" slotProps={{ htmlInput: { min: 0, step: 'any' } }} value={labourCost} onChange={(event) => setLabourCost(event.target.value)} /></Grid>
                        <Grid size={{ xs: 12, md: 2 }}><TextField select fullWidth label="Payment Status" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as 'paid' | 'unpaid')}><MenuItem value="paid">Paid</MenuItem><MenuItem value="unpaid">Unpaid</MenuItem></TextField></Grid>
                    </Grid>

                    <Divider sx={{ my: 3 }} />
                    <Stack spacing={2}>
                        {items.map((item, index) => {
                            const lineTotal = toNumber(item.quantity) * toNumber(item.unitPurchasePrice);
                            return <Grid container spacing={2} key={index} alignItems="center">
                                <Grid size={{ xs: 12, md: 4 }}><Autocomplete options={products} value={item.product} onChange={(_, product) => updateItem(index, { product })} getOptionLabel={(product) => `${product.name} (${product.sku})`} isOptionEqualToValue={(option, value) => option.id === value.id} renderInput={(params) => <TextField {...params} required label="Product Name" />} /></Grid>
                                <Grid size={{ xs: 6, md: 2 }}><TextField fullWidth required label="Qty" type="number" slotProps={{ htmlInput: { min: 0.0001, step: 'any' } }} value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} /></Grid>
                                <Grid size={{ xs: 6, md: 2 }}><TextField fullWidth required label="Purchase Price" type="number" slotProps={{ htmlInput: { min: 0, step: 'any' } }} value={item.unitPurchasePrice} onChange={(event) => updateItem(index, { unitPurchasePrice: event.target.value })} /></Grid>
                                <Grid size={{ xs: 10, md: 3 }}><Typography variant="caption" color="text.secondary">Total Purchase</Typography><Typography fontWeight={800}>{formatCurrency(lineTotal)}</Typography></Grid>
                                <Grid size={{ xs: 2, md: 1 }} sx={{ textAlign: 'right' }}><IconButton color="error" aria-label="Remove product" onClick={() => setItems((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index))} disabled={items.length === 1}><Trash2 size={18} /></IconButton></Grid>
                            </Grid>;
                        })}
                    </Stack>

                    <Button sx={{ mt: 2 }} startIcon={<Plus size={18} />} onClick={() => setItems((current) => [...current, emptyItem()])}>Add Another Product</Button>
                    <Box sx={{ mt: 3, ml: 'auto', maxWidth: 360, p: 2, borderRadius: 3, bgcolor: 'action.hover' }}>
                        <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Products Total</Typography><Typography fontWeight={700}>{formatCurrency(productTotal)}</Typography></Stack>
                        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}><Typography color="text.secondary">Gadi Rent</Typography><Typography fontWeight={700}>{formatCurrency(toNumber(vehicleRent))}</Typography></Stack>
                        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}><Typography color="text.secondary">Labour Cost</Typography><Typography fontWeight={700}>{formatCurrency(toNumber(labourCost))}</Typography></Stack>
                        <Divider sx={{ my: 1.25 }} />
                        <Stack direction="row" justifyContent="space-between"><Typography fontWeight={800}>Grand Total</Typography><Typography fontWeight={900}>{formatCurrency(grandTotal)}</Typography></Stack>
                    </Box>
                    <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
                        <Button variant="contained" size="large" sx={{ borderRadius: 2, fontWeight: 800 }} startIcon={<PackagePlus size={18} />} onClick={handleSave} disabled={saving || loading}>{saving ? 'Saving Purchase Order...' : editingId ? 'Update Purchase Order' : 'Save Purchase Order'}</Button>
                        {editingId && <Button size="large" startIcon={<X size={18} />} onClick={resetForm}>Cancel Edit</Button>}
                    </Stack>
                </CardContent>
            </Card>

            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ mb: 2 }}>
                <Typography variant="h6" fontWeight={800}>Recent Purchase Orders</Typography>
                <TextField
                    size="small"
                    placeholder="Search purchase orders..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    slotProps={{ input: { startAdornment: <Search size={18} style={{ marginRight: 8 }} /> } }}
                    sx={{ width: { xs: '100%', sm: 340 } }}
                />
            </Stack>
            {loading ? <Box sx={{ minHeight: 160, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : !orders.length ? <Card sx={{ borderRadius: 3 }}><CardContent sx={{ textAlign: 'center', py: 5 }}><ClipboardCheck size={36} style={{ opacity: 0.45 }} /><Typography fontWeight={800} sx={{ mt: 1 }}>No purchase orders yet</Typography><Typography variant="body2" color="text.secondary">Your vendor deliveries will appear here.</Typography></CardContent></Card> : (
                <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
                    <Table size="small" sx={{ minWidth: 1100 }}>
                        <TableHead><TableRow sx={{ bgcolor: 'action.hover' }}><TableCell>Order / Vendor</TableCell><TableCell>Products</TableCell><TableCell>Gadi Rent</TableCell><TableCell>Labour</TableCell><TableCell>Purchase</TableCell><TableCell>Total Amount</TableCell><TableCell>Payment</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead>
                        <TableBody>{filteredOrders.map((order) => <TableRow key={order._id} hover>
                            <TableCell><Typography fontWeight={800}>{order.vendorName}</Typography><Typography variant="caption" color="text.secondary">{order.orderNumber} · Gadi: {order.vehicleNumber}</Typography></TableCell>
                            <TableCell><Typography variant="body2">{order.items.map((item) => `${item.productName} × ${item.quantity}`).join(', ')}</Typography><Typography variant="caption" color="text.secondary">{new Date(order.createdAt).toLocaleString()}</Typography></TableCell>
                            <TableCell>{formatCurrency(order.vehicleRent)}</TableCell>
                            <TableCell>{formatCurrency(order.labourCost || 0)}</TableCell>
                            <TableCell>{formatCurrency(order.totalProductPurchase)}</TableCell>
                            <TableCell><Typography fontWeight={800}>{formatCurrency(order.grandTotal)}</Typography></TableCell>
                            <TableCell><Chip size="small" label={order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'} color={order.paymentStatus === 'paid' ? 'success' : 'warning'} /></TableCell>
                            <TableCell align="right"><IconButton aria-label="Edit purchase order" color="primary" onClick={() => startEdit(order)}><Pencil size={18} /></IconButton><IconButton aria-label="Delete purchase order" color="error" onClick={() => handleDelete(order)}><Trash2 size={18} /></IconButton></TableCell>
                        </TableRow>)}
                        {!filteredOrders.length && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5 }}><Typography color="text.secondary">No purchase orders match "{searchQuery.trim()}".</Typography></TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
};

export default PurchaseOrdersPage;

