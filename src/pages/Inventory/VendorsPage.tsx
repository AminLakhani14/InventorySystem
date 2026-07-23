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
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    Paper,
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
import {
    Eye,
    PackageCheck,
    ReceiptText,
    Search,
    Store,
    Truck,
    WalletCards,
    X,
} from 'lucide-react';
import api from '../../api/axios';
import { useAppCurrency } from '../../hooks/useAppCurrency';

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

interface ProductSummary {
    key: string;
    name: string;
    quantity: number;
    totalPurchase: number;
}

interface VendorSummary {
    key: string;
    name: string;
    orders: PurchaseOrder[];
    products: ProductSummary[];
    totalProductPurchase: number;
    totalVehicleRent: number;
    totalLabourCost: number;
    grandTotal: number;
    lastPurchaseAt: string;
}

const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

const buildVendorSummaries = (orders: PurchaseOrder[]): VendorSummary[] => {
    const vendors = new Map<string, VendorSummary>();

    orders.forEach((order) => {
        const key = normalizeName(order.vendorName);
        if (!key) return;

        let vendor = vendors.get(key);
        if (!vendor) {
            vendor = {
                key,
                name: order.vendorName.trim().replace(/\s+/g, ' '),
                orders: [],
                products: [],
                totalProductPurchase: 0,
                totalVehicleRent: 0,
                totalLabourCost: 0,
                grandTotal: 0,
                lastPurchaseAt: order.createdAt,
            };
            vendors.set(key, vendor);
        }

        vendor.orders.push(order);
        vendor.totalProductPurchase += Number(order.totalProductPurchase) || 0;
        vendor.totalVehicleRent += Number(order.vehicleRent) || 0;
        vendor.totalLabourCost += Number(order.labourCost) || 0;
        vendor.grandTotal += Number(order.grandTotal) || 0;

        if (new Date(order.createdAt).getTime() > new Date(vendor.lastPurchaseAt).getTime()) {
            vendor.lastPurchaseAt = order.createdAt;
            vendor.name = order.vendorName.trim().replace(/\s+/g, ' ');
        }

        order.items.forEach((item) => {
            const productKey = normalizeName(item.productName);
            const product = vendor!.products.find((entry) => entry.key === productKey);
            if (product) {
                product.quantity += Number(item.quantity) || 0;
                product.totalPurchase += Number(item.totalPurchase) || 0;
            } else {
                vendor!.products.push({
                    key: productKey,
                    name: item.productName,
                    quantity: Number(item.quantity) || 0,
                    totalPurchase: Number(item.totalPurchase) || 0,
                });
            }
        });
    });

    return Array.from(vendors.values())
        .map((vendor) => ({
            ...vendor,
            orders: [...vendor.orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
            products: [...vendor.products].sort((a, b) => b.totalPurchase - a.totalPurchase),
        }))
        .sort((a, b) => new Date(b.lastPurchaseAt).getTime() - new Date(a.lastPurchaseAt).getTime());
};

const VendorsPage: React.FC = () => {
    const { formatCurrency } = useAppCurrency();
    const [orders, setOrders] = React.useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [searchQuery, setSearchQuery] = React.useState('');
    const [selectedVendor, setSelectedVendor] = React.useState<VendorSummary | null>(null);

    const loadVendors = React.useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await api.get<PurchaseOrder[]>('/purchase-orders');
            setOrders(response.data);
        } catch (requestError: unknown) {
            const message = (requestError as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(message || 'Unable to load vendors right now.');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadVendors();
    }, [loadVendors]);

    const vendors = React.useMemo(() => buildVendorSummaries(orders), [orders]);
    const filteredVendors = React.useMemo(() => {
        const query = normalizeName(searchQuery);
        if (!query) return vendors;
        return vendors.filter((vendor) =>
            vendor.name.toLocaleLowerCase().includes(query)
            || vendor.products.some((product) => product.name.toLocaleLowerCase().includes(query))
            || vendor.orders.some((order) => order.orderNumber.toLocaleLowerCase().includes(query))
        );
    }, [searchQuery, vendors]);

    const totals = React.useMemo(() => ({
        productPurchase: vendors.reduce((sum, vendor) => sum + vendor.totalProductPurchase, 0),
        grandTotal: vendors.reduce((sum, vendor) => sum + vendor.grandTotal, 0),
        orders: vendors.reduce((sum, vendor) => sum + vendor.orders.length, 0),
    }), [vendors]);

    return (
        <Box>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" fontWeight={800}>Vendors</Typography>
                <Typography variant="body2" color="text.secondary">
                    One vendor record per name, with every vegetable purchase kept in its history.
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} action={<Button color="inherit" onClick={loadVendors}>Retry</Button>}>
                    {error}
                </Alert>
            )}

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
                <Card sx={{ flex: 1, borderRadius: 3 }}>
                    <CardContent>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                            <Store color="#0ea5a5" />
                            <Box><Typography variant="body2" color="text.secondary">Total Vendors</Typography><Typography variant="h5" fontWeight={900}>{vendors.length}</Typography></Box>
                        </Stack>
                    </CardContent>
                </Card>
                <Card sx={{ flex: 1, borderRadius: 3 }}>
                    <CardContent>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                            <ReceiptText color="#0ea5a5" />
                            <Box><Typography variant="body2" color="text.secondary">Purchase Orders</Typography><Typography variant="h5" fontWeight={900}>{totals.orders}</Typography></Box>
                        </Stack>
                    </CardContent>
                </Card>
                <Card sx={{ flex: 1, borderRadius: 3 }}>
                    <CardContent>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                            <PackageCheck color="#0ea5a5" />
                            <Box><Typography variant="body2" color="text.secondary">Vegetable Buying</Typography><Typography variant="h5" fontWeight={900}>{formatCurrency(totals.productPurchase)}</Typography></Box>
                        </Stack>
                    </CardContent>
                </Card>
                <Card sx={{ flex: 1, borderRadius: 3 }}>
                    <CardContent>
                        <Stack direction="row" alignItems="center" spacing={1.5}>
                            <WalletCards color="#0ea5a5" />
                            <Box><Typography variant="body2" color="text.secondary">Total Spend</Typography><Typography variant="h5" fontWeight={900}>{formatCurrency(totals.grandTotal)}</Typography></Box>
                        </Stack>
                    </CardContent>
                </Card>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ mb: 2 }}>
                <Box>
                    <Typography variant="h6" fontWeight={800}>Vendor Grid</Typography>
                    <Typography variant="caption" color="text.secondary">Repeated vendor names are combined automatically.</Typography>
                </Box>
                <TextField
                    size="small"
                    placeholder="Search vendor, vegetable or order..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    slotProps={{ input: { startAdornment: <Search size={18} style={{ marginRight: 8 }} /> } }}
                    sx={{ width: { xs: '100%', sm: 360 } }}
                />
            </Stack>

            {loading ? (
                <Box sx={{ minHeight: 220, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>
            ) : !vendors.length ? (
                <Card sx={{ borderRadius: 3 }}>
                    <CardContent sx={{ textAlign: 'center', py: 6 }}>
                        <Store size={40} style={{ opacity: 0.4 }} />
                        <Typography fontWeight={800} sx={{ mt: 1 }}>No vendors yet</Typography>
                        <Typography variant="body2" color="text.secondary">Vendors will appear here after their first purchase order is saved.</Typography>
                    </CardContent>
                </Card>
            ) : (
                <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
                    <Table sx={{ minWidth: 1050 }}>
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'action.hover' }}>
                                <TableCell>Vendor</TableCell>
                                <TableCell>Vegetables Bought</TableCell>
                                <TableCell align="center">Orders</TableCell>
                                <TableCell>Vegetable Buying</TableCell>
                                <TableCell>Total Spend</TableCell>
                                <TableCell>Last Purchase</TableCell>
                                <TableCell align="right">Action</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredVendors.map((vendor) => (
                                <TableRow key={vendor.key} hover>
                                    <TableCell>
                                        <Typography fontWeight={800}>{vendor.name}</Typography>
                                        <Typography variant="caption" color="text.secondary">{vendor.products.length} unique vegetable{vendor.products.length === 1 ? '' : 's'}</Typography>
                                    </TableCell>
                                    <TableCell sx={{ maxWidth: 360 }}>
                                        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                                            {vendor.products.slice(0, 3).map((product) => <Chip key={product.key} size="small" label={`${product.name} × ${product.quantity}`} />)}
                                            {vendor.products.length > 3 && <Chip size="small" variant="outlined" label={`+${vendor.products.length - 3} more`} />}
                                        </Stack>
                                    </TableCell>
                                    <TableCell align="center"><Chip size="small" color="primary" variant="outlined" label={vendor.orders.length} /></TableCell>
                                    <TableCell><Typography fontWeight={700}>{formatCurrency(vendor.totalProductPurchase)}</Typography></TableCell>
                                    <TableCell><Typography fontWeight={900}>{formatCurrency(vendor.grandTotal)}</Typography></TableCell>
                                    <TableCell>{new Date(vendor.lastPurchaseAt).toLocaleDateString()}</TableCell>
                                    <TableCell align="right">
                                        <Button variant="outlined" size="small" startIcon={<Eye size={16} />} onClick={() => setSelectedVendor(vendor)}>Details</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!filteredVendors.length && (
                                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No vendor matches “{searchQuery.trim()}”.</Typography></TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Dialog open={Boolean(selectedVendor)} onClose={() => setSelectedVendor(null)} fullWidth maxWidth="lg">
                {selectedVendor && (
                    <>
                        <DialogTitle sx={{ pr: 7 }}>
                            <Typography variant="h5" fontWeight={900}>{selectedVendor.name}</Typography>
                            <Typography variant="body2" color="text.secondary">Complete buying history</Typography>
                            <IconButton onClick={() => setSelectedVendor(null)} aria-label="Close vendor details" sx={{ position: 'absolute', right: 16, top: 16 }}><X size={20} /></IconButton>
                        </DialogTitle>
                        <DialogContent>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
                                <Box sx={{ flex: 1, p: 2, borderRadius: 2, bgcolor: 'action.hover' }}><Typography variant="caption" color="text.secondary">Orders</Typography><Typography variant="h6" fontWeight={900}>{selectedVendor.orders.length}</Typography></Box>
                                <Box sx={{ flex: 1, p: 2, borderRadius: 2, bgcolor: 'action.hover' }}><Typography variant="caption" color="text.secondary">Vegetable Buying</Typography><Typography variant="h6" fontWeight={900}>{formatCurrency(selectedVendor.totalProductPurchase)}</Typography></Box>
                                <Box sx={{ flex: 1, p: 2, borderRadius: 2, bgcolor: 'action.hover' }}><Typography variant="caption" color="text.secondary">Rent + Labour</Typography><Typography variant="h6" fontWeight={900}>{formatCurrency(selectedVendor.totalVehicleRent + selectedVendor.totalLabourCost)}</Typography></Box>
                                <Box sx={{ flex: 1, p: 2, borderRadius: 2, bgcolor: 'action.hover' }}><Typography variant="caption" color="text.secondary">Total Spend</Typography><Typography variant="h6" fontWeight={900}>{formatCurrency(selectedVendor.grandTotal)}</Typography></Box>
                            </Stack>

                            <Typography fontWeight={800} sx={{ mb: 1 }}>Vegetable Summary</Typography>
                            <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
                                <Table size="small">
                                    <TableHead><TableRow sx={{ bgcolor: 'action.hover' }}><TableCell>Vegetable</TableCell><TableCell align="right">Total Quantity</TableCell><TableCell align="right">Total Buying</TableCell></TableRow></TableHead>
                                    <TableBody>{selectedVendor.products.map((product) => <TableRow key={product.key}><TableCell>{product.name}</TableCell><TableCell align="right">{product.quantity}</TableCell><TableCell align="right"><Typography fontWeight={700}>{formatCurrency(product.totalPurchase)}</Typography></TableCell></TableRow>)}</TableBody>
                                </Table>
                            </TableContainer>

                            <Divider sx={{ my: 2 }} />
                            <Typography fontWeight={800} sx={{ mb: 1 }}>Purchase Detail</Typography>
                            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                                <Table size="small" sx={{ minWidth: 1000 }}>
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                                            <TableCell>Date / Order</TableCell>
                                            <TableCell>Vegetable</TableCell>
                                            <TableCell align="right">Qty</TableCell>
                                            <TableCell align="right">Unit Price</TableCell>
                                            <TableCell align="right">Buying</TableCell>
                                            <TableCell>Gadi</TableCell>
                                            <TableCell align="right">Rent</TableCell>
                                            <TableCell align="right">Labour</TableCell>
                                            <TableCell>Payment</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {selectedVendor.orders.flatMap((order) => order.items.map((item, index) => (
                                            <TableRow key={`${order._id}-${item.productId}`}>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight={700}>{order.orderNumber}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{new Date(order.createdAt).toLocaleString()}</Typography>
                                                </TableCell>
                                                <TableCell>{item.productName}</TableCell>
                                                <TableCell align="right">{item.quantity}</TableCell>
                                                <TableCell align="right">{formatCurrency(item.unitPurchasePrice)}</TableCell>
                                                <TableCell align="right"><Typography fontWeight={700}>{formatCurrency(item.totalPurchase)}</Typography></TableCell>
                                                <TableCell><Stack direction="row" spacing={0.75} alignItems="center"><Truck size={15} /><span>{order.vehicleNumber}</span></Stack></TableCell>
                                                <TableCell align="right">{index === 0 ? formatCurrency(order.vehicleRent) : '—'}</TableCell>
                                                <TableCell align="right">{index === 0 ? formatCurrency(order.labourCost) : '—'}</TableCell>
                                                <TableCell>{index === 0 ? <Chip size="small" label={order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'} color={order.paymentStatus === 'paid' ? 'success' : 'warning'} /> : '—'}</TableCell>
                                            </TableRow>
                                        )))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </DialogContent>
                    </>
                )}
            </Dialog>
        </Box>
    );
};

export default VendorsPage;
