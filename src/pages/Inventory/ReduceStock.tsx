import React, { useState } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Grid,
    TextField,
    Button,
    InputAdornment,
    Divider,
    Alert,
    Autocomplete,
    Avatar,
    Paper,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton
} from '@mui/material';
import {
    ShoppingCart,
    MinusCircle,
    Search,
    Package,
    Printer,
    X
} from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store';
import { reduceStockApi } from '../../features/inventory/inventorySlice';
import type { AppDispatch } from '../../store';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import useAppCurrency from '../../hooks/useAppCurrency';

const ReduceStock: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { products } = useSelector((state: RootState) => state.inventory);
    const { user } = useSelector((state: RootState) => state.auth);
    const { formatCurrency } = useAppCurrency();

    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [reduceAmount, setReduceAmount] = useState<number | string>(1);
    const [success, setSuccess] = useState(false);
    const [lastTx, setLastTx] = useState<any>(null);
    const [showInvoice, setShowInvoice] = useState(false);

    const handleReduce = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct) return;

        const amount = parseInt(reduceAmount.toString());
        if (amount <= 0 || amount > selectedProduct.stock) {
            alert('Invalid amount or insufficient stock');
            return;
        }

        const invoiceId = Math.random().toString(36).substr(2, 9).toUpperCase();
        const newTx = {
            id: invoiceId,
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            type: 'reduction' as const,
            amount,
            userName: user?.name || 'Unknown',
            timestamp: new Date().toISOString(),
            totalPrice: amount * selectedProduct.price
        };

        dispatch(reduceStockApi({ id: selectedProduct.id, amount, transaction: newTx }));

        setLastTx(newTx);
        setSuccess(true);
        setSelectedProduct(null);
        setReduceAmount(1);

        setTimeout(() => {
            setSuccess(false);
        }, 8000);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
            <Box sx={{ mb: 4, '@media print': { display: 'none' } }}>
                <Typography variant="h4" fontWeight={800} gutterBottom>Reduce Stock / New Sale</Typography>
                <Typography variant="body1" color="text.secondary">Select a product and the quantity to remove from inventory.</Typography>
            </Box>

            {success && lastTx && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '24px' }}>
                    <Alert
                        severity="success"
                        sx={{ borderRadius: 2 }}
                        action={
                            <Button color="inherit" size="small" startIcon={<Printer size={16} />} onClick={() => setShowInvoice(true)}>
                                VIEW INVOICE
                            </Button>
                        }
                    >
                        Stock reduced successfully! Transaction ID: #{lastTx.id}
                    </Alert>
                </motion.div>
            )}

            <Grid container spacing={3} sx={{ '@media print': { display: 'none' } }}>
                <Grid size={{ xs: 12, md: 7 }}>
                    <Card sx={{ borderRadius: 4 }}>
                        <CardContent sx={{ p: 4 }}>
                            <form onSubmit={handleReduce}>
                                <Typography variant="h6" fontWeight={700} gutterBottom>Transaction Details</Typography>
                                <Divider sx={{ mb: 3 }} />

                                <Box sx={{ mb: 3 }}>
                                    <Autocomplete
                                        options={products}
                                        getOptionLabel={(option) => option.name}
                                        value={selectedProduct}
                                        onChange={(_, newValue) => setSelectedProduct(newValue)}
                                        renderOption={(props, option) => (
                                            <Box component="li" {...props} sx={{ display: 'flex', gap: 2 }}>
                                                <Avatar variant="rounded" sx={{ width: 32, height: 32, bgcolor: 'rgba(99, 102, 241, 0.1)', color: 'primary.main' }}>
                                                    {option.name.charAt(0)}
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="body2" fontWeight={600}>{option.name}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{option.category} • {option.stock} in stock</Typography>
                                                </Box>
                                            </Box>
                                        )}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Search Product"
                                                required
                                                placeholder="Type product name..."
                                                InputProps={{
                                                    ...params.InputProps,
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <Search size={20} />
                                                        </InputAdornment>
                                                    ),
                                                }}
                                            />
                                        )}
                                    />
                                </Box>

                                <Box sx={{ mb: 4 }}>
                                    <TextField
                                        fullWidth
                                        label="Quantity to Reduce"
                                        type="number"
                                        required
                                        value={reduceAmount}
                                        onChange={(e) => setReduceAmount(e.target.value)}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <MinusCircle size={20} color="#f43f5e" />
                                                </InputAdornment>
                                            ),
                                        }}
                                        helperText={selectedProduct ? `Available stock: ${selectedProduct.stock} ` : ''}
                                    />
                                </Box>

                                <Button
                                    fullWidth
                                    variant="contained"
                                    size="large"
                                    type="submit"
                                    disabled={!selectedProduct || parseInt(reduceAmount.toString()) <= 0 || parseInt(reduceAmount.toString()) > (selectedProduct?.stock || 0)}
                                    startIcon={<ShoppingCart size={20} />}
                                    sx={{ py: 1.5, borderRadius: 2, fontWeight: 700 }}
                                >
                                    Process Transaction
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>
                    <AnimatePresence mode="wait">
                        {selectedProduct ? (
                            <motion.div
                                key="product-details"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <Card sx={{ borderRadius: 4, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                                    <CardContent sx={{ p: 4 }}>
                                        <Typography variant="h6" fontWeight={700} gutterBottom>Product Summary</Typography>
                                        <Divider sx={{ mb: 2, borderColor: 'rgba(255,255,255,0.2)' }} />

                                        <Box sx={{ textAlign: 'center', mb: 3 }}>
                                            <Avatar
                                                variant="rounded"
                                                sx={{ width: 80, height: 80, mx: 'auto', mb: 2, bgcolor: 'rgba(255,255,255,0.2)', fontSize: '2rem', fontWeight: 800 }}
                                            >
                                                {selectedProduct.name.charAt(0)}
                                            </Avatar>
                                            <Typography variant="h5" fontWeight={800}>{selectedProduct.name}</Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.8 }}>{selectedProduct.category}</Typography>
                                        </Box>

                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2">Current Stock:</Typography>
                                            <Typography variant="body2" fontWeight={700}>{selectedProduct.stock} Units</Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                            <Typography variant="body2">Unit Price:</Typography>
                                            <Typography variant="body2" fontWeight={700}>{formatCurrency(selectedProduct.price)}</Typography>
                                        </Box>
                                        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.2)' }} />
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Typography variant="h6">Total Value:</Typography>
                                            <Typography variant="h6" fontWeight={800}>
                                                {formatCurrency(parseInt(reduceAmount.toString() || '0') * selectedProduct.price, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="no-product"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        borderRadius: 4,
                                        p: 4,
                                        textAlign: 'center',
                                        borderStyle: 'dashed',
                                        bgcolor: 'rgba(0,0,0,0.01)'
                                    }}
                                >
                                    <Package size={48} color="#64748b" style={{ marginBottom: 16, opacity: 0.5 }} />
                                    <Typography color="text.secondary">
                                        Select a product to see details and price calculation.
                                    </Typography>
                                </Paper>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Grid>
            </Grid>

            {/* Invoice Dialog */}
            <Dialog open={showInvoice} onClose={() => setShowInvoice(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" fontWeight={800}>Sales Invoice</Typography>
                    <IconButton onClick={() => setShowInvoice(false)} size="small">
                        <X size={20} />
                    </IconButton>
                </DialogTitle>
                <DialogContent id="printable-invoice">
                    {lastTx && (
                        <Box sx={{ p: 2 }}>
                            <Box sx={{ textAlign: 'center', mb: 4 }}>
                                <Typography variant="h4" fontWeight={900} color="primary.main">ItemHive</Typography>
                                <Typography variant="body2" color="text.secondary">Inventory Management Solutions</Typography>
                            </Box>

                            <Box sx={{ mb: 4 }}>
                                <Typography variant="subtitle2" color="text.secondary">ISSUED BY:</Typography>
                                <Typography variant="h6" fontWeight={700}>{lastTx.userName}</Typography>
                                <Typography variant="body2">{format(new Date(lastTx.timestamp), 'MMMM dd, yyyy • hh:mm a')}</Typography>
                            </Box>

                            <Divider sx={{ mb: 3 }} />

                            <Box sx={{ mb: 4 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography fontWeight={700}>Invoice No:</Typography>
                                    <Typography color="primary.main" fontWeight={700}>#{lastTx.id}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography fontWeight={700}>Product Name:</Typography>
                                    <Typography>{lastTx.productName}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography fontWeight={700}>Quantity Sold:</Typography>
                                    <Typography>{lastTx.amount} Units</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography fontWeight={700}>Unit Price:</Typography>
                                    <Typography>{formatCurrency((lastTx.totalPrice / lastTx.amount), { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</Typography>
                                </Box>
                            </Box>

                            <Box sx={{ bgcolor: 'rgba(99, 102, 241, 0.05)', p: 3, borderRadius: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="h6" fontWeight={800}>Total Amount:</Typography>
                                    <Typography variant="h6" fontWeight={900} color="primary.main">
                                        {formatCurrency(lastTx.totalPrice || 0, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                    </Typography>
                                </Box>
                            </Box>

                            <Box sx={{ mt: 6, textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary">
                                    Thank you for your purchase. Electronic invoice generated by ItemHive.
                                </Typography>
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 3, '@media print': { display: 'none' } }}>
                    <Button onClick={() => setShowInvoice(false)}>Close</Button>
                    <Button variant="contained" startIcon={<Printer size={20} />} onClick={handlePrint}>
                        Print Invoice
                    </Button>
                </DialogActions>
            </Dialog>

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
                    .MuiDialogActions-root, .MuiDialogTitle-root button {
                        display: none !important;
                    }
                }
                `}
            </style>
        </Box>
    );
};

export default ReduceStock;
