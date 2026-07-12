import React from 'react';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Divider,
    Grid,
    IconButton,
    Snackbar,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { ClipboardCheck, PackagePlus, Plus, Trash2, Truck } from 'lucide-react';
import api from '../../api/axios';
import { useAppCurrency } from '../../hooks/useAppCurrency';
import type { Product } from '../../features/inventory/inventorySlice';

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

const emptyItem = (): DraftItem => ({ product: null, quantity: '', unitPurchasePrice: '' });
const toNumber = (value: string) => Number(value) || 0;

const PurchaseOrdersPage: React.FC = () => {
    const { formatCurrency } = useAppCurrency();
    const [products, setProducts] = React.useState<Product[]>([]);
    const [orders, setOrders] = React.useState<PurchaseOrder[]>([]);
    const [vendorName, setVendorName] = React.useState('');
    const [vehicleNumber, setVehicleNumber] = React.useState('');
    const [vehicleRent, setVehicleRent] = React.useState('');
    const [items, setItems] = React.useState<DraftItem[]>([emptyItem()]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState('');
    const [snack, setSnack] = React.useState('');

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

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const updateItem = (index: number, changes: Partial<DraftItem>) => {
        setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
    };

    const productTotal = items.reduce((total, item) => total + toNumber(item.quantity) * toNumber(item.unitPurchasePrice), 0);
    const grandTotal = productTotal + toNumber(vehicleRent);

    const handleSave = async () => {
        if (!vendorName.trim() || !vehicleNumber.trim()) {
            setError('Vendor name and Gadi Number are required.');
            return;
        }
        if (items.some((item) => !item.product || toNumber(item.quantity) <= 0 || toNumber(item.unitPurchasePrice) < 0)) {
            setError('Select a product and enter a valid quantity and purchase price for every row.');
            return;
        }

        setSaving(true);
        setError('');
        try {
            await api.post('/purchase-orders', {
                vendorName: vendorName.trim(),
                vehicleNumber: vehicleNumber.trim(),
                vehicleRent: toNumber(vehicleRent),
                items: items.map((item) => ({
                    productId: item.product!.id,
                    quantity: toNumber(item.quantity),
                    unitPurchasePrice: toNumber(item.unitPurchasePrice),
                })),
            });
            setVendorName('');
            setVehicleNumber('');
            setVehicleRent('');
            setItems([emptyItem()]);
            await loadData();
            setSnack('Purchase order saved and inventory quantities updated.');
        } catch (requestError: any) {
            setError(requestError?.response?.data?.message || 'Unable to save this purchase order.');
        } finally {
            setSaving(false);
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
                        <Typography variant="h6" fontWeight={800}>Add Purchase Order</Typography>
                    </Stack>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth required label="Vendor Name" value={vendorName} onChange={(event) => setVendorName(event.target.value)} /></Grid>
                        <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth required label="Gadi Number" value={vehicleNumber} onChange={(event) => setVehicleNumber(event.target.value)} /></Grid>
                        <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Gadi Rent" type="number" slotProps={{ htmlInput: { min: 0, step: 'any' } }} value={vehicleRent} onChange={(event) => setVehicleRent(event.target.value)} /></Grid>
                    </Grid>

                    <Divider sx={{ my: 3 }} />
                    <Stack spacing={2}>
                        {items.map((item, index) => {
                            const lineTotal = toNumber(item.quantity) * toNumber(item.unitPurchasePrice);
                            return (
                                <Grid container spacing={2} key={index} alignItems="center">
                                    <Grid size={{ xs: 12, md: 4 }}>
                                        <Autocomplete
                                            options={products}
                                            value={item.product}
                                            onChange={(_, product) => updateItem(index, { product })}
                                            getOptionLabel={(product) => `${product.name} (${product.sku})`}
                                            isOptionEqualToValue={(option, value) => option.id === value.id}
                                            renderInput={(params) => <TextField {...params} required label="Product Name" />}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 6, md: 2 }}><TextField fullWidth required label="Qty" type="number" slotProps={{ htmlInput: { min: 0.0001, step: 'any' } }} value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} /></Grid>
                                    <Grid size={{ xs: 6, md: 2 }}><TextField fullWidth required label="Purchase Price" type="number" slotProps={{ htmlInput: { min: 0, step: 'any' } }} value={item.unitPurchasePrice} onChange={(event) => updateItem(index, { unitPurchasePrice: event.target.value })} /></Grid>
                                    <Grid size={{ xs: 10, md: 3 }}>
                                        <Typography variant="caption" color="text.secondary">Total Purchase</Typography>
                                        <Typography fontWeight={800}>{formatCurrency(lineTotal)}</Typography>
                                    </Grid>
                                    <Grid size={{ xs: 2, md: 1 }} sx={{ textAlign: 'right' }}>
                                        <IconButton color="error" aria-label="Remove product" onClick={() => setItems((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index))} disabled={items.length === 1}><Trash2 size={18} /></IconButton>
                                    </Grid>
                                </Grid>
                            );
                        })}
                    </Stack>

                    <Button sx={{ mt: 2 }} startIcon={<Plus size={18} />} onClick={() => setItems((current) => [...current, emptyItem()])}>Add Another Product</Button>
                    <Box sx={{ mt: 3, ml: 'auto', maxWidth: 360, p: 2, borderRadius: 3, bgcolor: 'action.hover' }}>
                        <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Products Total</Typography><Typography fontWeight={700}>{formatCurrency(productTotal)}</Typography></Stack>
                        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}><Typography color="text.secondary">Gadi Rent</Typography><Typography fontWeight={700}>{formatCurrency(toNumber(vehicleRent))}</Typography></Stack>
                        <Divider sx={{ my: 1.25 }} />
                        <Stack direction="row" justifyContent="space-between"><Typography fontWeight={800}>Grand Total</Typography><Typography fontWeight={900}>{formatCurrency(grandTotal)}</Typography></Stack>
                    </Box>
                    <Button variant="contained" size="large" sx={{ mt: 3, borderRadius: 2, fontWeight: 800 }} startIcon={<PackagePlus size={18} />} onClick={handleSave} disabled={saving || loading}>
                        {saving ? 'Saving Purchase Order...' : 'Save Purchase Order'}
                    </Button>
                </CardContent>
            </Card>

            <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>Recent Purchase Orders</Typography>
            {loading ? <Box sx={{ minHeight: 160, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : (
                <Grid container spacing={2}>
                    {orders.map((order) => <Grid key={order._id} size={{ xs: 12, md: 6 }}><Card sx={{ borderRadius: 3, height: '100%' }}><CardContent>
                        <Stack direction="row" justifyContent="space-between" gap={2}><Box><Typography fontWeight={800}>{order.vendorName}</Typography><Typography variant="body2" color="text.secondary">{order.orderNumber} · Gadi: {order.vehicleNumber}</Typography></Box><Typography fontWeight={800}>{formatCurrency(order.grandTotal)}</Typography></Stack>
                        <Typography variant="body2" sx={{ mt: 2 }}>{order.items.map((item) => `${item.productName} × ${item.quantity}`).join(', ')}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Received by {order.receivedByName} · {new Date(order.createdAt).toLocaleString()}</Typography>
                    </CardContent></Card></Grid>)}
                    {!orders.length && <Grid size={12}><Card sx={{ borderRadius: 3 }}><CardContent sx={{ textAlign: 'center', py: 5 }}><ClipboardCheck size={36} style={{ opacity: 0.45 }} /><Typography fontWeight={800} sx={{ mt: 1 }}>No purchase orders yet</Typography><Typography variant="body2" color="text.secondary">Your vendor deliveries will appear here.</Typography></CardContent></Card></Grid>}
                </Grid>
            )}
        </Box>
    );
};

export default PurchaseOrdersPage;
