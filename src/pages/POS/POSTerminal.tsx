import React, { useState, useMemo } from 'react';
import {
    Box,
    Grid,
    Typography,
    Card,
    CardContent,
    TextField,
    InputAdornment,
    Tabs,
    Tab,
    IconButton,
    Button,
    Divider,
    Paper,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    MenuItem,
    Stack,
    Snackbar,
    Alert,
    useTheme,
    alpha
} from '@mui/material';
import {
    Search,
    ShoppingCart,
    Plus,
    Minus,
    Banknote,
    Receipt,
    CheckCircle,
    Printer,
    Download,
    X
} from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store';
import { addToCart, updateCartItemPrice, updateQuantity, clearCart } from '../../features/pos/posSlice';
import { reduceStockApi, resolveProductImage, PRODUCT_CATEGORIES, fetchProducts } from '../../features/inventory/inventorySlice';
import { fetchTransactions } from '../../features/transactions/transactionSlice';
import type { Product } from '../../features/inventory/inventorySlice';
import type { AppDispatch } from '../../store';
import { motion, AnimatePresence } from 'framer-motion';
import useAppCurrency from '../../hooks/useAppCurrency';
import api from '../../api/axios';
import AppDatePicker from '../../components/Common/AppDatePicker';
import { getRegionalIdLabel } from '../../lib/regional';
import { DEFAULT_APP_SETTINGS } from '../../features/settings/settingsSlice';

const categories = ['All', ...PRODUCT_CATEGORIES];
type CheckoutMethod = 'cash' | 'card' | 'credit' | 'installment';

const escapePdfText = (text: string) => text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '?');

const receiptDivider = '='.repeat(40);

const padReceiptLine = (label: string, value: string, width = 40) => {
    const cleanLabel = label.trim();
    const cleanValue = value.trim();
    const spaces = Math.max(width - cleanLabel.length - cleanValue.length, 1);
    return `${cleanLabel}${' '.repeat(spaces)}${cleanValue}`;
};

const buildSimplePdf = (lines: string[]) => {
    const textStream = [
        'BT',
        '/F1 11 Tf',
        '14 TL',
        '40 800 Td',
        ...lines.map((line, index) => `${index === 0 ? '' : 'T* '}(` + escapePdfText(line) + ') Tj'),
        'ET'
    ].join('\n');

    const objects: string[] = [];
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
    objects[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>';
    objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    objects[5] = `<< /Length ${textStream.length} >>\nstream\n${textStream}\nendstream`;

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [0];
    for (let i = 1; i <= 5; i += 1) {
        offsets[i] = pdf.length;
        pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
    }

    const xrefStart = pdf.length;
    pdf += 'xref\n';
    pdf += `0 ${objects.length}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i <= 5; i += 1) {
        pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    return new Blob([pdf], { type: 'application/pdf' });
};

const POSTerminal: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const theme = useTheme();

    React.useEffect(() => {
        dispatch(fetchProducts());
    }, [dispatch]);

    const { user } = useSelector((state: RootState) => state.auth);
    const { products } = useSelector((state: RootState) => state.inventory);
    const { cart, activeDiscount } = useSelector((state: RootState) => state.pos);
    const { app, country } = useSelector((state: RootState) => state.settings);
    const appSettings = app || DEFAULT_APP_SETTINGS;
    const { formatCurrency, currencySymbol } = useAppCurrency();
    const canOverridePrice = user?.role === 'super_admin' || user?.role === 'admin';
    const regionalIdLabel = getRegionalIdLabel(country);
    const taxRate = Number(appSettings.salesTaxRate || 0) / 100;
    const taxLabel = `Tax (${Number(appSettings.salesTaxRate || 0).toLocaleString()}%)`;

    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState<CheckoutMethod | null>(null);
    const [orderDone, setOrderDone] = useState(false);
    const [receiptId, setReceiptId] = useState('');
    const [receiptTime, setReceiptTime] = useState('');
    const [stockToast, setStockToast] = useState({ open: false, message: '' });
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingMethod, setPendingMethod] = useState<CheckoutMethod | null>(null);
    const [creditOpen, setCreditOpen] = useState(false);
    const [creditPaidInput, setCreditPaidInput] = useState('');
    const [creditPaidVia, setCreditPaidVia] = useState<'cash' | 'card'>('cash');
    const [creditPaidNow, setCreditPaidNow] = useState(0);
    const [creditDue, setCreditDue] = useState(0);
    const [creditCustomerName, setCreditCustomerName] = useState('');
    const [creditCustomerCnic, setCreditCustomerCnic] = useState('');
    const [installmentOpen, setInstallmentOpen] = useState(false);
    const [installmentCustomerName, setInstallmentCustomerName] = useState('');
    const [installmentCustomerCnic, setInstallmentCustomerCnic] = useState('');
    const [installmentCustomerPhone, setInstallmentCustomerPhone] = useState('');
    const [installmentCustomerAddress, setInstallmentCustomerAddress] = useState('');
    const [witnessOneName, setWitnessOneName] = useState('');
    const [witnessOneCnic, setWitnessOneCnic] = useState('');
    const [witnessOneAddress, setWitnessOneAddress] = useState('');
    const [witnessTwoName, setWitnessTwoName] = useState('');
    const [witnessTwoCnic, setWitnessTwoCnic] = useState('');
    const [witnessTwoAddress, setWitnessTwoAddress] = useState('');
    const [installmentMonths, setInstallmentMonths] = useState<3 | 6 | 9 | 12>(3);
    const [installmentSaleDate, setInstallmentSaleDate] = useState(new Date().toISOString().split('T')[0]);
    const [installmentUnitPriceInput, setInstallmentUnitPriceInput] = useState('');
    const [installmentAdvanceInput, setInstallmentAdvanceInput] = useState('0');

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.sku.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = activeTab === 0 || p.category === categories[activeTab];
            return matchesSearch && matchesCategory;
        });
    }, [products, searchTerm, activeTab]);

    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const projectedProfit = cart.reduce((acc, item) => acc + ((item.price - item.purchasePrice) * item.quantity), 0);
    const tax = subtotal * taxRate;
    const total = subtotal + tax - activeDiscount;
    const draftCreditPaid = Math.min(Math.max(Number(creditPaidInput || 0), 0), total);
    const draftCreditDue = Math.max(total - draftCreditPaid, 0);
    const installmentItem = cart[0];
    const installmentQuantity = installmentItem?.quantity || 0;
    const defaultInstallmentUnitPrice = installmentItem?.price || 0;
    const draftInstallmentUnitPrice = Math.max(Number(installmentUnitPriceInput || defaultInstallmentUnitPrice || 0), 0);
    const draftInstallmentTotal = draftInstallmentUnitPrice * installmentQuantity;
    const draftInstallmentAdvance = Math.min(Math.max(Number(installmentAdvanceInput || 0), 0), Math.max(draftInstallmentTotal - 0.01, 0));
    const draftInstallmentRemaining = Math.max(draftInstallmentTotal - draftInstallmentAdvance, 0);
    const draftMonthlyInstallment = installmentMonths > 0 ? draftInstallmentRemaining / installmentMonths : 0;
    const draftInstallmentProfit = installmentItem
        ? (draftInstallmentUnitPrice - installmentItem.purchasePrice) * installmentQuantity
        : 0;

    const handleSaveReceiptPdf = (id: string, method: CheckoutMethod, receiptTimeIso: string) => {
        const dateLabel = new Date(receiptTimeIso).toLocaleString();
        const paymentLabel = method === 'credit'
            ? `CREDIT (${creditPaidVia.toUpperCase()} + DUE)`
            : method === 'installment'
                ? `INSTALLMENT (${installmentMonths} MONTHS)`
                : method.toUpperCase();
        const pdfTotal = method === 'installment' ? draftInstallmentTotal : total;
        const lines = [
            'ITEMHIVE PAYMENT SLIP',
            appSettings.shopName || 'ItemHive POS',
            appSettings.shopPhone ? `Phone: ${appSettings.shopPhone}` : '',
            appSettings.shopAddress ? `Address: ${appSettings.shopAddress}` : '',
            receiptDivider,
            padReceiptLine('Slip No.', id),
            padReceiptLine('Date', dateLabel),
            padReceiptLine('Cashier', user?.name || 'Staff'),
            padReceiptLine('Payment', paymentLabel),
            method === 'credit' ? `Customer: ${creditCustomerName}` : method === 'installment' ? `Customer: ${installmentCustomerName}` : '',
            method === 'credit' ? `${regionalIdLabel}: ${creditCustomerCnic}` : method === 'installment' ? `${regionalIdLabel}: ${installmentCustomerCnic}` : '',
            receiptDivider,
            'ITEMS',
            ...cart.map((item) => {
                const lineUnitPrice = method === 'installment' ? draftInstallmentUnitPrice : item.price;
                return `${item.name} x${item.quantity}\n${padReceiptLine(`  @ ${formatCurrency(lineUnitPrice)}`, formatCurrency(lineUnitPrice * item.quantity))}`;
            }).flatMap((line) => line.split('\n')),
            receiptDivider,
            'SUMMARY',
            padReceiptLine('Subtotal', formatCurrency(subtotal)),
            method !== 'installment' ? padReceiptLine(taxLabel, formatCurrency(tax)) : '',
            activeDiscount > 0 ? padReceiptLine('Discount', `-${formatCurrency(activeDiscount)}`) : '',
            method === 'credit' ? padReceiptLine('Paid Now', formatCurrency(creditPaidNow)) : '',
            method === 'credit' ? padReceiptLine('Remaining Due', formatCurrency(creditDue)) : '',
            method === 'installment' ? padReceiptLine('Advance Paid', formatCurrency(draftInstallmentAdvance)) : '',
            method === 'installment' ? padReceiptLine('EMI Balance', formatCurrency(draftInstallmentRemaining)) : '',
            method === 'installment' ? padReceiptLine('Monthly EMI', formatCurrency(draftMonthlyInstallment)) : '',
            padReceiptLine(method === 'installment' ? 'Installment Total' : method === 'credit' ? 'Order Total' : 'Total Paid', formatCurrency(pdfTotal)),
            receiptDivider,
            'Thank you for shopping with us.',
            'Please keep this slip for your record.'
        ].filter(Boolean);

        const pdfBlob = buildSimplePdf(lines);
        const url = URL.createObjectURL(pdfBlob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `receipt-${id}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    };

    const handleAddToCart = (product: Product) => {
        const itemInCart = cart.find(item => item.id === product.id);
        const currentQty = itemInCart ? itemInCart.quantity : 0;

        if (product.stock <= 0) {
            setStockToast({ open: true, message: `${product.name} is out of stock.` });
            return;
        }

        if (product.stock <= currentQty) {
            setStockToast({ open: true, message: `${product.name} is out of stock.` });
            return;
        }

        dispatch(addToCart(product));
    };

    const handleCheckout = (method: 'cash' | 'card') => {
        setPendingMethod(method);
        setConfirmOpen(true);
    };

    const handleOpenCredit = () => {
        const suggestedPaidNow = Math.max(total * 0.8, 0);
        setCreditPaidInput(suggestedPaidNow.toFixed(2));
        setCreditPaidVia('cash');
        setCreditCustomerName('');
        setCreditCustomerCnic('');
        setCreditOpen(true);
    };

    const handleContinueCredit = () => {
        if (!creditCustomerName.trim() || !creditCustomerCnic.trim()) {
            setStockToast({ open: true, message: `Customer name and ${regionalIdLabel} are required for credit sales.` });
            return;
        }
        if (draftCreditDue <= 0) {
            setStockToast({ open: true, message: 'Use Cash for full payment. Credit requires a due amount.' });
            return;
        }
        setCreditPaidNow(draftCreditPaid);
        setCreditDue(draftCreditDue);
        setPendingMethod('credit');
        setCreditOpen(false);
        setConfirmOpen(true);
    };

    const handleContinueInstallment = () => {
        if (!installmentCustomerName.trim() || !installmentCustomerCnic.trim() || !installmentCustomerPhone.trim() || !installmentCustomerAddress.trim()) {
            setStockToast({ open: true, message: `Customer name, ${regionalIdLabel}, phone, and address are required for installment sales.` });
            return;
        }
        if (!witnessOneName.trim() || !witnessOneCnic.trim() || !witnessOneAddress.trim() || !witnessTwoName.trim() || !witnessTwoCnic.trim() || !witnessTwoAddress.trim()) {
            setStockToast({ open: true, message: `Both witness names, ${regionalIdLabel} values, and addresses are required.` });
            return;
        }
        if (draftInstallmentTotal <= 0) {
            setStockToast({ open: true, message: 'Installment sale price must be greater than zero.' });
            return;
        }
        if (draftInstallmentRemaining <= 0) {
            setStockToast({ open: true, message: 'Advance payment must be less than the installment sale total.' });
            return;
        }

        setPendingMethod('installment');
        setInstallmentOpen(false);
        setConfirmOpen(true);
    };

    const handleConfirmCheckout = async () => {
        if (!pendingMethod) return;

        const id = `R${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10)}`;
        const receiptTimeIso = new Date().toISOString();
        const currentMethod = pendingMethod;

        if (pendingMethod === 'installment') {
            const item = cart[0];

            try {
                await api.post('/installments', {
                    planCode: `INS-${Date.now()}`,
                    productId: item.id,
                    productName: item.name,
                    amount: item.quantity,
                    totalAmount: draftInstallmentTotal,
                    unitPrice: draftInstallmentUnitPrice,
                    advancePayment: draftInstallmentAdvance,
                    customerName: installmentCustomerName.trim(),
                    customerCnic: installmentCustomerCnic.trim(),
                    customerPhone: installmentCustomerPhone.trim(),
                    customerAddress: installmentCustomerAddress.trim(),
                    saleDate: installmentSaleDate,
                    installmentMonths,
                    userName: user?.name || 'Staff',
                    witnesses: [
                        { name: witnessOneName.trim(), cnic: witnessOneCnic.trim(), address: witnessOneAddress.trim() },
                        { name: witnessTwoName.trim(), cnic: witnessTwoCnic.trim(), address: witnessTwoAddress.trim() },
                    ],
                });

                await Promise.all([
                    dispatch(fetchProducts()),
                    dispatch(fetchTransactions()),
                ]);

                window.dispatchEvent(new Event('itemhive-installments-updated'));
                setReceiptId(id);
                setReceiptTime(receiptTimeIso);
                setPaymentMethod(currentMethod);
                setOrderDone(true);
                setConfirmOpen(false);
                setPendingMethod(null);
                return;
            } catch (error: unknown) {
                const maybeError = error as { response?: { data?: { message?: string } } };
                setStockToast({
                    open: true,
                    message: maybeError.response?.data?.message || 'Installment plan could not be created.',
                });
                return;
            }
        }

        const results = await Promise.all(cart.map((item) => {
            const tx = {
                id: `${id}-${item.id.substr(0, 3)}`,
                productId: item.id,
                productName: item.name,
                type: 'reduction' as const,
                amount: item.quantity,
                userName: user?.name || 'Staff',
                timestamp: receiptTimeIso,
                totalPrice: item.price * item.quantity,
                paymentMethod: pendingMethod,
                paidVia: pendingMethod === 'credit' ? creditPaidVia : undefined,
                paidNow: pendingMethod === 'credit' ? creditPaidNow : total,
                dueAmount: pendingMethod === 'credit' ? creditDue : 0,
                customerName: pendingMethod === 'credit' ? creditCustomerName.trim() : undefined,
                customerCnic: pendingMethod === 'credit' ? creditCustomerCnic.trim() : undefined,
                unitPrice: item.price,
            };
            return dispatch(reduceStockApi({ id: item.id, amount: item.quantity, transaction: tx }));
        }));

        const failedResult = results.find((result) => reduceStockApi.rejected.match(result));
        if (failedResult && reduceStockApi.rejected.match(failedResult)) {
            setStockToast({
                open: true,
                message: typeof failedResult.payload === 'string' ? failedResult.payload : 'Credit sale could not be saved.',
            });
            return;
        }

        await Promise.all([
            dispatch(fetchProducts()),
            dispatch(fetchTransactions()),
        ]);

        setReceiptId(id);
        setReceiptTime(receiptTimeIso);
        setPaymentMethod(currentMethod);
        setOrderDone(true);
        setConfirmOpen(false);
        setPendingMethod(null);
    };

    const handleCancelCheckout = () => {
        setConfirmOpen(false);
        setPendingMethod(null);
    };

    const handleCloseOrder = () => {
        dispatch(clearCart());
        setOrderDone(false);
        setPaymentMethod(null);
        setCreditPaidNow(0);
        setCreditDue(0);
        setCreditCustomerName('');
        setCreditCustomerCnic('');
        setInstallmentCustomerName('');
        setInstallmentCustomerCnic('');
        setInstallmentCustomerPhone('');
        setInstallmentCustomerAddress('');
        setWitnessOneName('');
        setWitnessOneCnic('');
        setWitnessOneAddress('');
        setWitnessTwoName('');
        setWitnessTwoCnic('');
        setWitnessTwoAddress('');
        setInstallmentMonths(3);
        setInstallmentUnitPriceInput('');
        setInstallmentAdvanceInput('0');
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: { xs: 'column', lg: 'row' },
                gap: { xs: 1.5, sm: 2 },
                height: { xs: 'auto', lg: 'calc(100vh - 120px)' },
                minHeight: { lg: 'calc(100vh - 120px)' },
                overflow: { xs: 'visible', lg: 'hidden' }
            }}
        >
            {/* Left Side: Product Selection */}
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
                <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: 1.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TextField
                        fullWidth
                        placeholder="Scan Barcode or Search (Name/SKU)..."
                        variant="outlined"
                        size="small"
                        autoFocus
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search size={20} color={theme.palette.primary.main} />
                                </InputAdornment>
                            ),
                        }}
                    />
                </Paper>

                <Tabs
                    value={activeTab}
                    onChange={(_, v) => setActiveTab(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{ mb: 1.5, borderBottom: 1, borderColor: 'divider' }}
                >
                    {categories.map((cat) => (
                        <Tab key={cat} label={cat} sx={{ fontWeight: 700, px: { xs: 1.5, sm: 2.5 }, minHeight: 44, textTransform: 'none' }} />
                    ))}
                </Tabs>

                <Box sx={{ flexGrow: 1, overflowY: 'auto', pr: { xs: 0.5, sm: 1 }, pt: 1.25, pb: 1, px: { xs: 0.5, sm: 1.5 } }}>
                    <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
                        {filteredProducts.map((product) => (
                            <Grid
                                key={product.id}
                                size={{ xs: 12, sm: 6, md: 6, lg: 4, xl: 3 }}
                            >
                                <motion.div
                                    whileHover={{ y: -5, transition: { duration: 0.22 } }}
                                    whileTap={{ scale: 0.98 }}
                                    style={{ height: '100%' }}
                                >
                                    <Card
                                        onClick={() => handleAddToCart(product)}
                                        sx={{
                                            cursor: product.stock > 0 ? 'pointer' : 'default',
                                            height: '100%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            borderRadius: 4,
                                            border: '1px solid',
                                            borderColor: alpha(theme.palette.primary.main, 0.14),
                                            bgcolor: 'background.paper',
                                            boxShadow: theme.palette.mode === 'dark'
                                                ? `0 16px 28px -22px ${alpha('#000', 0.9)}`
                                                : `0 14px 28px -22px ${alpha(theme.palette.primary.dark, 0.38)}`,
                                            overflow: 'hidden',
                                            position: 'relative',
                                            '&::before': {
                                                content: '""',
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                height: 3,
                                                background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.7)} 0%, ${alpha(theme.palette.primary.light, 0.8)} 100%)`,
                                                opacity: product.stock > 0 ? 1 : 0.5,
                                                zIndex: 1
                                            },
                                            '&:hover': {
                                                borderColor: product.stock > 0 ? 'primary.main' : 'divider',
                                                boxShadow: (theme) => product.stock > 0
                                                    ? `0 26px 48px -22px ${alpha(theme.palette.primary.main, 0.42)}`
                                                    : `0 14px 26px -22px ${alpha(theme.palette.error.main, 0.4)}`,
                                                '& .product-img': { transform: product.stock > 0 ? 'scale(1.05)' : 'none' },
                                                '& .add-btn': { opacity: product.stock > 0 ? 1 : 0.4, transform: 'translateY(0)' }
                                            },
                                            opacity: product.stock === 0 ? 0.78 : 1,
                                            transition: 'all 0.3s'
                                        }}
                                    >
                                        <Box sx={{
                                            position: 'relative',
                                            pt: '90%',
                                            bgcolor: (theme) => alpha(theme.palette.text.primary, 0.02),
                                            background: `linear-gradient(165deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.background.paper, 0)} 70%)`,
                                            overflow: 'hidden'
                                        }}>
                                            <Box
                                                className="product-img"
                                                component="img"
                                                src={resolveProductImage(product)}
                                                alt={product.name}
                                                sx={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'contain',
                                                    p: 2.5,
                                                    transition: 'transform 0.5s ease',
                                                }}
                                            />
                                            {product.stock <= 5 && (
                                                <Chip
                                                    label={product.stock === 0 ? "Out of Stock" : "Limited Stock"}
                                                    size="small"
                                                    color={product.stock === 0 ? "error" : "warning"}
                                                    sx={{
                                                        position: 'absolute',
                                                        top: 10,
                                                        left: 10,
                                                        fontSize: '0.62rem',
                                                        fontWeight: 900,
                                                        height: 22,
                                                        borderRadius: 1.5,
                                                        textTransform: 'uppercase'
                                                    }}
                                                />
                                            )}
                                            {product.stock === 0 && (
                                                <Box
                                                    sx={{
                                                        position: 'absolute',
                                                        inset: 0,
                                                        bgcolor: alpha(theme.palette.error.main, 0.18),
                                                        backdropFilter: 'blur(1px)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        zIndex: 2,
                                                        pointerEvents: 'none',
                                                    }}
                                                >
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            px: 1.2,
                                                            py: 0.6,
                                                            borderRadius: 1,
                                                            bgcolor: alpha(theme.palette.background.paper, 0.9),
                                                            color: 'error.main',
                                                            border: '1px solid',
                                                            borderColor: alpha(theme.palette.error.main, 0.4),
                                                            fontWeight: 900,
                                                            letterSpacing: 0.5,
                                                            textTransform: 'uppercase'
                                                        }}
                                                    >
                                                        Out of Stock
                                                    </Typography>
                                                </Box>
                                            )}

                                            <Box
                                                className="add-btn"
                                                sx={{
                                                    position: 'absolute',
                                                    bottom: 12,
                                                    right: 12,
                                                    p: 1,
                                                    borderRadius: 2,
                                                    bgcolor: product.stock > 0 ? 'primary.main' : 'action.disabledBackground',
                                                    color: product.stock > 0 ? 'white' : 'action.disabled',
                                                    display: 'flex',
                                                    opacity: 0,
                                                    transform: 'translateY(10px)',
                                                    transition: 'all 0.3s ease',
                                                    boxShadow: product.stock > 0 ? '0 4px 12px rgba(14, 165, 165, 0.3)' : 'none',
                                                    cursor: product.stock > 0 ? 'pointer' : 'not-allowed'
                                                }}
                                            >
                                                <Plus size={18} strokeWidth={3} />
                                            </Box>
                                        </Box>

                                        <CardContent sx={{ p: 2.25, pt: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                            <Typography
                                                variant="caption"
                                                color="primary.main"
                                                fontWeight={900}
                                                sx={{ mb: 0.55, letterSpacing: 0.55, opacity: 0.9, lineHeight: 1.15 }}
                                            >
                                                {product.category.toUpperCase()}
                                            </Typography>

                                            <Typography
                                                variant="subtitle1"
                                                color="text.primary"
                                                fontWeight={700}
                                                sx={{
                                                    lineHeight: 1.3,
                                                    mb: 1.25,
                                                    fontSize: '1rem',
                                                    minHeight: '2.6em',
                                                    overflow: 'hidden',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    textWrap: 'balance'
                                                }}
                                            >
                                                {product.name}
                                            </Typography>

                                            <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                                <Typography variant="h5" color="primary.main" fontWeight={900} sx={{ letterSpacing: -0.4 }}>
                                                    {formatCurrency(product.price)}
                                                </Typography>

                                                <Box sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.5,
                                                    px: 1.1,
                                                    py: 0.35,
                                                    borderRadius: 2,
                                                    bgcolor: (theme) => {
                                                        if (product.stock === 0) return alpha(theme.palette.error.main, 0.1);
                                                        if (product.stock <= 5) return alpha(theme.palette.warning.main, 0.1);
                                                        return alpha(theme.palette.success.main, 0.06);
                                                    },
                                                    border: '1px solid',
                                                    borderColor: (theme) => {
                                                        if (product.stock === 0) return alpha(theme.palette.error.main, 0.24);
                                                        if (product.stock <= 5) return alpha(theme.palette.warning.main, 0.26);
                                                        return alpha(theme.palette.success.main, 0.22);
                                                    }
                                                }}>
                                                    <Box sx={{
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: '50%',
                                                        bgcolor: (theme) => {
                                                            if (product.stock === 0) return theme.palette.error.main;
                                                            if (product.stock <= 5) return theme.palette.warning.main;
                                                            return theme.palette.success.main;
                                                        }
                                                    }} />
                                                    <Typography
                                                        variant="caption"
                                                        fontWeight={800}
                                                        sx={{
                                                            fontSize: '0.65rem',
                                                            color: (theme) => {
                                                                if (product.stock === 0) return theme.palette.error.main;
                                                                if (product.stock <= 5) return theme.palette.warning.main;
                                                                return theme.palette.success.main;
                                                            }
                                                        }}
                                                    >
                                                        {product.stock === 0 ? 'Out' : product.stock} left
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            </Box>

            {/* Right Side: Cart / Order Summary */}
            <Paper
                elevation={3}
                sx={{
                    width: { xs: '100%', lg: 420 },
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 4,
                    overflow: 'hidden',
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    minHeight: { xs: 360, sm: 420, lg: 0 },
                    height: { lg: '100%' }
                }}
            >
                <Box sx={{ p: 2.5, bgcolor: 'primary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <ShoppingCart size={22} />
                        <Typography variant="h6" fontWeight={800}>Current Order</Typography>
                    </Box>
                </Box>

                <Box
                    sx={{
                        p: 0,
                        flexGrow: 1,
                        minHeight: 0,
                        overflowY: cart.length === 0 ? 'hidden' : 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: cart.length === 0 ? 'center' : 'flex-start'
                    }}
                >
                    {cart.length === 0 ? (
                        <Box sx={{
                            textAlign: 'center',
                            opacity: 0.4,
                            width: '100%',
                            px: 3,
                            py: 2
                        }}>
                            <ShoppingCart size={56} strokeWidth={1} style={{ marginBottom: 12 }} />
                            <Typography variant="h6" fontWeight={800}>Cart is empty</Typography>
                            <Typography variant="body2" fontWeight={600}>Select products to start</Typography>
                        </Box>
                    ) : (
                        <Box sx={{ p: 2, pb: 1 }}>
                            <AnimatePresence>
                                {cart.map((item) => (
                                    <motion.div
                                        key={item.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                    >
                                        <Box sx={{ mb: 1.25, display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, gap: { xs: 1, sm: 2 }, flexWrap: 'wrap' }}>
                                            <Box sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 160 } }}>
                                                <Typography variant="body2" fontWeight={700} noWrap={false} sx={{ wordBreak: 'break-word' }}>{item.name}</Typography>
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                    Cost: {formatCurrency(item.purchasePrice)} | Default sell: {formatCurrency(item.salePrice)}
                                                </Typography>
                                                <TextField
                                                    size="small"
                                                    type="number"
                                                    label="Sell Price"
                                                    value={item.price}
                                                    onChange={(e) => dispatch(updateCartItemPrice({ id: item.id, price: Number(e.target.value || 0) }))}
                                                    disabled={!canOverridePrice}
                                                    sx={{ mt: 1, maxWidth: 150 }}
                                                    InputProps={{
                                                        startAdornment: (
                                                            <InputAdornment position="start">{currencySymbol}</InputAdornment>
                                                        ),
                                                    }}
                                                />
                                            </Box>
                                            <Stack direction="row" alignItems="center" spacing={1} sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 0.5 }}>
                                                <IconButton size="small" onClick={() => dispatch(updateQuantity({ id: item.id, quantity: item.quantity - 1 }))}>
                                                    <Minus size={14} />
                                                </IconButton>
                                                <Typography variant="body2" sx={{ fontWeight: 800, minWidth: 20, textAlign: 'center' }}>
                                                    {item.quantity}
                                                </Typography>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => {
                                                        const product = products.find(p => p.id === item.id);
                                                        if (product && item.quantity < product.stock) {
                                                            dispatch(updateQuantity({ id: item.id, quantity: item.quantity + 1 }));
                                                        }
                                                    }}
                                                >
                                                    <Plus size={14} />
                                                </IconButton>
                                            </Stack>
                                            <Typography variant="body2" fontWeight={800} sx={{ minWidth: { xs: '100%', sm: 70 }, textAlign: { xs: 'left', sm: 'right' } }}>
                                                {formatCurrency(item.price * item.quantity)}
                                            </Typography>
                                        </Box>
                                        <Divider sx={{ mb: 1.25, borderStyle: 'dashed' }} />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </Box>
                    )}
                </Box>

                <Box
                    sx={{
                        p: { xs: 1.5, sm: 2 },
                        bgcolor: 'background.paper',
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        boxShadow: (theme) => `0 -10px 20px -16px ${alpha(theme.palette.text.primary, 0.35)}`,
                        position: 'relative',
                        zIndex: 2,
                        flexShrink: 0
                    }}
                >
                    <Stack spacing={0.75} sx={{ mb: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                            <Typography variant="body2" fontWeight={700}>{formatCurrency(subtotal)}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2" color="text.secondary">{taxLabel}</Typography>
                            <Typography variant="body2" fontWeight={700}>{formatCurrency(tax)}</Typography>
                        </Box>
                        {activeDiscount > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" color="error.main">Discount</Typography>
                                <Typography variant="body2" fontWeight={700} color="error.main">-{formatCurrency(activeDiscount)}</Typography>
                            </Box>
                        )}
                        <Divider sx={{ my: 1 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="h5" fontWeight={900}>Total Payable</Typography>
                            <Typography variant="h5" fontWeight={900} color="primary.main">{formatCurrency(total)}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2" color={projectedProfit >= 0 ? 'success.main' : 'error.main'}>
                                Profit / Loss
                            </Typography>
                            <Typography variant="body2" fontWeight={800} color={projectedProfit >= 0 ? 'success.main' : 'error.main'}>
                                {formatCurrency(projectedProfit)}
                            </Typography>
                        </Box>
                    </Stack>

                    <Grid container spacing={1}>
                        <Grid size={{ xs: 6 }}>
                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<Banknote size={20} />}
                                disabled={cart.length === 0}
                                onClick={() => handleCheckout('cash')}
                                sx={{ py: 1, borderRadius: 2, fontWeight: 700 }}
                            >
                                Cash
                            </Button>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={<Receipt size={20} />}
                                disabled={cart.length === 0}
                                onClick={handleOpenCredit}
                                sx={{ py: 1, borderRadius: 2, fontWeight: 700 }}
                            >
                                Credit
                            </Button>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                            <Button
                                fullWidth
                                variant="outlined"
                                size="large"
                                disabled={cart.length === 0}
                                onClick={() => dispatch(clearCart())}
                                sx={{
                                    py: 1.3,
                                    mt: 0.5,
                                    borderRadius: 3,
                                    fontWeight: 800
                                }}
                            >
                                Clear
                            </Button>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                            <Button
                                fullWidth
                                variant="contained"
                                size="large"
                                startIcon={<Receipt size={24} />}
                                disabled={cart.length === 0}
                                onClick={() => handleCheckout('cash')}
                                sx={{
                                    py: 1.3,
                                    mt: 0.5,
                                    borderRadius: 3,
                                    fontWeight: 900,
                                    fontSize: '1rem',
                                    boxShadow: (theme) => `0 8px 16px -4px ${alpha(theme.palette.primary.main, 0.4)}`
                                }}
                            >
                                Pay Now
                            </Button>
                        </Grid>
                    </Grid>
                </Box>
            </Paper>

            <Dialog
                open={creditOpen}
                onClose={() => setCreditOpen(false)}
                maxWidth="xs"
                fullWidth
                PaperProps={{ sx: { borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>Credit Payment</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Record partial payment now and keep the remaining amount due.
                    </Typography>
                    <TextField
                        fullWidth
                        type="number"
                        label="Paid Now"
                        value={creditPaidInput}
                        onChange={(e) => setCreditPaidInput(e.target.value)}
                        InputProps={{ startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment> }}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        fullWidth
                        label="Customer Name"
                        value={creditCustomerName}
                        onChange={(e) => setCreditCustomerName(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        fullWidth
                        label={`Customer ${regionalIdLabel}`}
                        value={creditCustomerCnic}
                        onChange={(e) => setCreditCustomerCnic(e.target.value)}
                        placeholder={country === 'PK' ? '35202-1234567-1' : `Enter ${regionalIdLabel}`}
                        sx={{ mb: 2 }}
                    />
                    <Grid container spacing={1} sx={{ mb: 2 }}>
                        <Grid size={{ xs: 12 }}>
                            <Button
                                fullWidth
                                variant={creditPaidVia === 'cash' ? 'contained' : 'outlined'}
                                onClick={() => setCreditPaidVia('cash')}
                            >
                                Paid via Cash
                            </Button>
                        </Grid>
                    </Grid>
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="body2" fontWeight={700}>Order Total: {formatCurrency(total)}</Typography>
                        <Typography variant="body2" fontWeight={700}>Paid Now: {formatCurrency(draftCreditPaid)}</Typography>
                        <Typography variant="body2" fontWeight={900} color="warning.main">Remaining Due: {formatCurrency(draftCreditDue)}</Typography>
                        <Typography variant="body2" fontWeight={700} color={projectedProfit >= 0 ? 'success.main' : 'error.main'}>
                            Profit / Loss: {formatCurrency(projectedProfit)}
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button variant="outlined" onClick={() => setCreditOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleContinueCredit}>Continue</Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={installmentOpen}
                onClose={() => setInstallmentOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>Installment Sale</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Capture customer details, witness IDs, set the installment sale price, and create EMI after any advance payment.
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField fullWidth label="Customer Name" value={installmentCustomerName} onChange={(e) => setInstallmentCustomerName(e.target.value)} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField fullWidth label={`Customer ${regionalIdLabel}`} value={installmentCustomerCnic} onChange={(e) => setInstallmentCustomerCnic(e.target.value)} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField fullWidth label="Customer Phone" value={installmentCustomerPhone} onChange={(e) => setInstallmentCustomerPhone(e.target.value)} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField select fullWidth label="Installment Months" value={String(installmentMonths)} onChange={(e) => setInstallmentMonths(Number(e.target.value) as 3 | 6 | 9 | 12)}>
                                <MenuItem value="3">3 Months</MenuItem>
                                <MenuItem value="6">6 Months</MenuItem>
                                <MenuItem value="9">9 Months</MenuItem>
                                <MenuItem value="12">12 Months</MenuItem>
                            </TextField>
                        </Grid>
                        <Grid size={12}>
                            <TextField fullWidth label="Customer Address" value={installmentCustomerAddress} onChange={(e) => setInstallmentCustomerAddress(e.target.value)} multiline rows={2} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField fullWidth label="Witness 1 Name" value={witnessOneName} onChange={(e) => setWitnessOneName(e.target.value)} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField fullWidth label={`Witness 1 ${regionalIdLabel}`} value={witnessOneCnic} onChange={(e) => setWitnessOneCnic(e.target.value)} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField fullWidth label="Witness 1 Address" value={witnessOneAddress} onChange={(e) => setWitnessOneAddress(e.target.value)} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField fullWidth label="Witness 2 Name" value={witnessTwoName} onChange={(e) => setWitnessTwoName(e.target.value)} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField fullWidth label={`Witness 2 ${regionalIdLabel}`} value={witnessTwoCnic} onChange={(e) => setWitnessTwoCnic(e.target.value)} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField fullWidth label="Witness 2 Address" value={witnessTwoAddress} onChange={(e) => setWitnessTwoAddress(e.target.value)} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                fullWidth
                                type="number"
                                label={`Installment Price (${currencySymbol})`}
                                value={installmentUnitPriceInput}
                                onChange={(e) => setInstallmentUnitPriceInput(e.target.value)}
                                disabled={!canOverridePrice}
                                inputProps={{ min: 0, step: '0.01' }}
                                helperText={canOverridePrice ? `Price per unit x ${installmentQuantity}` : 'Only admin and super admin can change installment price'}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                fullWidth
                                type="number"
                                label={`Advance Payment (${currencySymbol})`}
                                value={installmentAdvanceInput}
                                onChange={(e) => setInstallmentAdvanceInput(e.target.value)}
                                inputProps={{ min: 0, step: '0.01' }}
                                helperText="Advance is deducted before EMI is created."
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <AppDatePicker fullWidth label="Sale Date" value={installmentSaleDate} onChange={setInstallmentSaleDate} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="body2" fontWeight={700}>Installment Sale Total: {formatCurrency(draftInstallmentTotal)}</Typography>
                                <Typography variant="body2" fontWeight={700}>Advance Payment: {formatCurrency(draftInstallmentAdvance)}</Typography>
                                <Typography variant="body2" fontWeight={700}>EMI Balance: {formatCurrency(draftInstallmentRemaining)}</Typography>
                                <Typography variant="body2" fontWeight={700}>Monthly Installment: {formatCurrency(draftMonthlyInstallment)}</Typography>
                                <Typography variant="body2" color="text.secondary">First due date will be one month after sale date.</Typography>
                            </Box>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button variant="outlined" onClick={() => setInstallmentOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleContinueInstallment}>Continue</Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={confirmOpen}
                onClose={handleCancelCheckout}
                maxWidth="xs"
                fullWidth
                PaperProps={{ sx: { borderRadius: 3 } }}
            >
                <DialogTitle sx={{ fontWeight: 800 }}>Confirm Payment</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Confirm this payment to finalize sale and update stock.
                    </Typography>
                    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="body2" sx={{ opacity: 0.9 }}>
                            Cashier: <strong>{user?.name || 'Staff'}</strong>
                        </Typography>
                        <Typography variant="body2" fontWeight={700}>
                            Method: {(pendingMethod || '').toUpperCase()}
                        </Typography>
                        {pendingMethod === 'credit' && (
                            <Box sx={{ mt: 1 }}>
                                <Typography variant="body2">Customer: <strong>{creditCustomerName}</strong></Typography>
                                <Typography variant="body2">{regionalIdLabel}: <strong>{creditCustomerCnic}</strong></Typography>
                                <Typography variant="body2" fontWeight={700}>Paid via {creditPaidVia.toUpperCase()}: {formatCurrency(creditPaidNow)}</Typography>
                                <Typography variant="body2" fontWeight={900} color="warning.main">Due Later: {formatCurrency(creditDue)}</Typography>
                            </Box>
                        )}
                        {pendingMethod === 'installment' && (
                            <Box sx={{ mt: 1 }}>
                                <Typography variant="body2">Customer: <strong>{installmentCustomerName}</strong></Typography>
                                <Typography variant="body2">{regionalIdLabel}: <strong>{installmentCustomerCnic}</strong></Typography>
                                <Typography variant="body2">Phone: <strong>{installmentCustomerPhone}</strong></Typography>
                                <Typography variant="body2" fontWeight={700}>Plan: <strong>{installmentMonths} months</strong></Typography>
                                <Typography variant="body2" fontWeight={700}>Sale Total: <strong>{formatCurrency(draftInstallmentTotal)}</strong></Typography>
                                <Typography variant="body2" fontWeight={700}>Advance Paid: <strong>{formatCurrency(draftInstallmentAdvance)}</strong></Typography>
                                <Typography variant="body2" fontWeight={900} color="warning.main">
                                    Monthly Installment: {formatCurrency(draftMonthlyInstallment)}
                                </Typography>
                            </Box>
                        )}
                        <Typography variant="h6" fontWeight={900} color="primary.main" sx={{ mt: 0.5 }}>
                            Total: {formatCurrency(pendingMethod === 'installment' ? draftInstallmentTotal : total)}
                        </Typography>
                        <Typography variant="body2" fontWeight={800} color={(pendingMethod === 'installment' ? draftInstallmentProfit : projectedProfit) >= 0 ? 'success.main' : 'error.main'}>
                            Profit / Loss: {formatCurrency(pendingMethod === 'installment' ? draftInstallmentProfit : projectedProfit)}
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button variant="outlined" onClick={handleCancelCheckout}>
                        Cancel
                    </Button>
                    <Button variant="contained" onClick={handleConfirmCheckout}>
                        Confirm Payment
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Checkout Success & Receipt Dialog */}
            <Dialog
                open={orderDone}
                onClose={handleCloseOrder}
                maxWidth="xs"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 4, p: 1 }
                }}
            >
                <DialogTitle sx={{ textAlign: 'center', pb: 0 }}>
                    <Box sx={{ color: 'success.main', mb: 2 }}>
                        <CheckCircle size={64} strokeWidth={2.5} />
                    </Box>
                    <Typography variant="h5" fontWeight={900}>Payment Successful!</Typography>
                    <Typography variant="body2" color="text.secondary">Order #{receiptId}</Typography>
                </DialogTitle>
                <DialogContent>
                    <Box
                        id="pos-receipt"
                        sx={{
                            mt: 3,
                            borderRadius: 4,
                            overflow: 'hidden',
                            bgcolor: 'background.paper',
                            border: '1px solid',
                            borderColor: alpha(theme.palette.primary.main, 0.18),
                            boxShadow: theme.palette.mode === 'dark'
                                ? `0 24px 44px -28px ${alpha('#000', 0.95)}`
                                : `0 24px 46px -30px ${alpha(theme.palette.primary.dark, 0.32)}`,
                        }}
                    >
                        <Box
                            sx={{
                                px: 3,
                                py: 2.5,
                                color: 'common.white',
                                background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 55%, ${theme.palette.secondary.main} 100%)`,
                            }}
                        >
                            <Typography variant="overline" sx={{ opacity: 0.82, letterSpacing: 1.8 }}>
                                Payment Slip
                            </Typography>
                            <Typography variant="h5" fontWeight={900} sx={{ lineHeight: 1.1 }}>
                                {appSettings.shopName || 'ItemHive POS'}
                            </Typography>
                            {appSettings.shopPhone && <Typography variant="body2" sx={{ mt: 0.75, opacity: 0.9 }}>{appSettings.shopPhone}</Typography>}
                            {appSettings.shopAddress && <Typography variant="caption" sx={{ display: 'block', opacity: 0.82 }}>{appSettings.shopAddress}</Typography>}
                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
                                <Chip size="small" label={`Order #${receiptId}`} sx={{ bgcolor: alpha('#fff', 0.16), color: 'common.white' }} />
                                <Chip size="small" label={`Method: ${paymentMethod?.toUpperCase()}`} sx={{ bgcolor: alpha('#fff', 0.16), color: 'common.white' }} />
                            </Stack>
                        </Box>

                        <Box sx={{ p: 3 }}>
                            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                                        <Typography variant="caption" color="text.secondary">Cashier</Typography>
                                        <Typography variant="body2" fontWeight={800}>{user?.name || 'Staff'}</Typography>
                                    </Box>
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                                        <Typography variant="caption" color="text.secondary">Issued At</Typography>
                                        <Typography variant="body2" fontWeight={800}>{receiptTime ? new Date(receiptTime).toLocaleString() : '-'}</Typography>
                                    </Box>
                                </Grid>
                                {(paymentMethod === 'credit' || paymentMethod === 'installment') && (
                                    <>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: alpha(theme.palette.info.main, 0.06) }}>
                                                <Typography variant="caption" color="text.secondary">Customer</Typography>
                                                <Typography variant="body2" fontWeight={800}>
                                                    {paymentMethod === 'credit' ? creditCustomerName : installmentCustomerName}
                                                </Typography>
                                            </Box>
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: alpha(theme.palette.info.main, 0.06) }}>
                                                <Typography variant="caption" color="text.secondary">Customer {regionalIdLabel}</Typography>
                                                <Typography variant="body2" fontWeight={800}>
                                                    {paymentMethod === 'credit' ? creditCustomerCnic : installmentCustomerCnic}
                                                </Typography>
                                            </Box>
                                        </Grid>
                                    </>
                                )}
                            </Grid>

                            <Box sx={{ borderRadius: 3, border: '1px dashed', borderColor: 'divider', overflow: 'hidden' }}>
                                <Box sx={{ px: 2, py: 1.25, bgcolor: alpha(theme.palette.text.primary, 0.04), display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="caption" fontWeight={800}>Item</Typography>
                                    <Typography variant="caption" fontWeight={800}>Amount</Typography>
                                </Box>
                                <Stack spacing={0} divider={<Divider flexItem sx={{ borderStyle: 'dashed' }} />}>
                                    {cart.map(item => (
                                        <Box key={item.id} sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                                            <Box>
                                                <Typography variant="body2" fontWeight={800}>{item.name}</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {item.quantity} x {formatCurrency(paymentMethod === 'installment' ? draftInstallmentUnitPrice : item.price)}
                                                </Typography>
                                            </Box>
                                            <Typography variant="body2" fontWeight={800}>
                                                {formatCurrency((paymentMethod === 'installment' ? draftInstallmentUnitPrice : item.price) * item.quantity)}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Stack>
                            </Box>

                            <Grid container spacing={2} sx={{ mt: 0.5 }}>
                                <Grid size={{ xs: 12, md: 7 }}>
                                    <Box
                                        sx={{
                                            mt: 2,
                                            p: 2,
                                            borderRadius: 3,
                                            bgcolor: alpha(theme.palette.warning.main, 0.08),
                                            border: '1px solid',
                                            borderColor: alpha(theme.palette.warning.main, 0.16),
                                        }}
                                    >
                                        <Typography variant="overline" color="warning.main" sx={{ letterSpacing: 1.2 }}>
                                            Payment Notes
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {paymentMethod === 'installment'
                                                ? `Advance received and EMI scheduled over ${installmentMonths} months.`
                                                : paymentMethod === 'credit'
                                                    ? 'Partial payment received. Remaining balance is due later.'
                                                    : 'Full payment received successfully.'}
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid size={{ xs: 12, md: 5 }}>
                                    <Box
                                        sx={{
                                            mt: 2,
                                            p: 2,
                                            borderRadius: 3,
                                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                                            border: '1px solid',
                                            borderColor: alpha(theme.palette.primary.main, 0.14),
                                        }}
                                    >
                                        <Stack spacing={1}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="caption">Subtotal</Typography>
                                                <Typography variant="caption" fontWeight={700}>{formatCurrency(subtotal)}</Typography>
                                            </Box>
                                            {paymentMethod !== 'installment' && (
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography variant="caption">{taxLabel}</Typography>
                                                    <Typography variant="caption" fontWeight={700}>{formatCurrency(tax)}</Typography>
                                                </Box>
                                            )}
                                            {paymentMethod === 'credit' && (
                                                <>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="caption">Paid Now ({creditPaidVia.toUpperCase()})</Typography>
                                                        <Typography variant="caption" fontWeight={700}>{formatCurrency(creditPaidNow)}</Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="caption" color="warning.main">Remaining Due</Typography>
                                                        <Typography variant="caption" fontWeight={800} color="warning.main">{formatCurrency(creditDue)}</Typography>
                                                    </Box>
                                                </>
                                            )}
                                            {paymentMethod === 'installment' && (
                                                <>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="caption">Advance Payment</Typography>
                                                        <Typography variant="caption" fontWeight={700}>{formatCurrency(draftInstallmentAdvance)}</Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="caption">EMI Balance</Typography>
                                                        <Typography variant="caption" fontWeight={700}>{formatCurrency(draftInstallmentRemaining)}</Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="caption">Monthly Installment</Typography>
                                                        <Typography variant="caption" fontWeight={800} color="warning.main">{formatCurrency(draftMonthlyInstallment)}</Typography>
                                                    </Box>
                                                </>
                                            )}
                                            <Divider sx={{ borderStyle: 'dashed' }} />
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Typography variant="body1" fontWeight={900}>
                                                    {paymentMethod === 'installment' ? 'Installment Total' : paymentMethod === 'credit' ? 'Order Total' : 'Total Paid'}
                                                </Typography>
                                                <Typography variant="h6" fontWeight={900} color="primary.main">
                                                    {formatCurrency(paymentMethod === 'installment' ? draftInstallmentTotal : total)}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </Box>
                                </Grid>
                            </Grid>

                            <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px dashed', borderColor: 'divider', textAlign: 'center' }}>
                                <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 1.1, color: 'text.secondary' }}>
                                    Please keep this payment slip for your record
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 0.8, fontWeight: 700 }}>
                                    Thank you for shopping with {appSettings.shopName || 'ItemHive'}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3, gap: 1 }}>
                    <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<Download size={18} />}
                        onClick={() => {
                            if (!paymentMethod || !receiptId) return;
                            handleSaveReceiptPdf(receiptId, paymentMethod, receiptTime || new Date().toISOString());
                        }}
                        sx={{ borderRadius: 2 }}
                    >
                        Save
                    </Button>
                    <Button
                        fullWidth
                        variant="contained"
                        startIcon={<Printer size={18} />}
                        onClick={handlePrint}
                        sx={{ borderRadius: 2 }}
                    >
                        Print
                    </Button>
                </DialogActions>
                <IconButton
                    onClick={handleCloseOrder}
                    sx={{ position: 'absolute', right: 16, top: 16, color: 'text.secondary' }}
                >
                    <X size={20} />
                </IconButton>
            </Dialog>

            <Snackbar
                open={stockToast.open}
                autoHideDuration={2200}
                onClose={() => setStockToast({ open: false, message: '' })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setStockToast({ open: false, message: '' })}
                    severity="warning"
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {stockToast.message}
                </Alert>
            </Snackbar>

            {/* Print Friendly Style */}
            <style>
                {`
                @media print {
                    body * { visibility: hidden; }
                    #pos-receipt, #pos-receipt * { visibility: visible; }
                    body {
                        background: #fff !important;
                    }
                    #pos-receipt {
                        position: absolute;
                        left: 50%;
                        top: 0;
                        transform: translateX(-50%);
                        width: 760px;
                        max-width: 100%;
                        background: white !important;
                        border: 1px solid #d7deea !important;
                        border-radius: 18px !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                    }
                    .MuiDialog-container { display: block !important; }
                    .MuiPaper-root {
                        box-shadow: none !important;
                        background: transparent !important;
                    }
                }
                `}
            </style>
        </Box>
    );
};

export default POSTerminal;
