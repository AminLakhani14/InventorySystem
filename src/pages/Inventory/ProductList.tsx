import React, { useState } from 'react';
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
    IconButton,
    TextField,
    InputAdornment,
    Chip,
    Button,
    Avatar,
    Menu,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Grid,
    Snackbar,
    Alert,
    Stack,
} from '@mui/material';
import {
    Search,
    MoreVertical,
    Edit,
    Trash2,
    Plus,
    Filter,
    Download,
    Eye,
    Save,
    Package,
    Layers,
    Image as ImageIcon,
    X,
    TrendingUp,
    ShieldCheck,
    History,
} from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import {
    deleteProductApi,
    updateProductApi,
    addProductApi,
    fetchProducts,
    type Product,
    resolveProductImage,
    placeholderFallback,
    PRODUCT_CATEGORIES,
} from '../../features/inventory/inventorySlice';
import { useNavigate, useLocation } from 'react-router-dom';
import { alpha, useTheme, styled } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { DEFAULT_PRODUCT_UNIT, getProductUnit, getProductUnitLabel, PRODUCT_UNITS } from '../../lib/productUnits';
import AppDatePicker from '../../components/Common/AppDatePicker';

const IconContainer = styled(Box)<{ color?: string }>(({ theme, color }) => ({
    width: 44,
    height: 44,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(color || theme.palette.primary.main, 0.1),
    color: color || theme.palette.primary.main,
    marginBottom: theme.spacing(1),
}));

const PremiumDialog = styled(Dialog)(({ theme }) => ({
    '& .MuiDialog-paper': {
        borderRadius: 24,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        backgroundImage: 'none',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 64px)',
        margin: theme.spacing(2),
    },
    '& .MuiDialogTitle-root': {
        padding: theme.spacing(3, 4),
        fontWeight: 800,
        fontSize: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
    },
    '& .MuiDialogContent-root': {
        padding: theme.spacing(3, 4),
        flexGrow: 1,
        overflowY: 'auto',
    },
    '& .MuiDialogActions-root': {
        padding: theme.spacing(2, 4, 3),
        gap: theme.spacing(1),
        flexShrink: 0,
    },
}));

const categories_list = PRODUCT_CATEGORIES;
type InlineField = 'stock';

const ProductList: React.FC = () => {
    const theme = useTheme();
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const { products } = useSelector((state: RootState) => state.inventory);
    const { user } = useSelector((state: RootState) => state.auth);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [viewProduct, setViewProduct] = useState<Product | null>(null);
    const [editProduct, setEditProduct] = useState<Product | null>(null);
    const [inlineEdit, setInlineEdit] = useState<{
        id: string;
        field: InlineField;
        value: string;
    } | null>(null);
    const [inlineSaving, setInlineSaving] = useState<string | null>(null);
    const [snack, setSnack] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error' | 'info' | 'warning';
    }>({
        open: false,
        message: '',
        severity: 'success',
    });
    const [showFilters, setShowFilters] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [addFormData, setAddFormData] = useState({
        sku: '',
        name: '',
        category: '',
        purchasePrice: '',
        salePrice: '',
        stock: '',
        minStock: '',
        productUnitCode: DEFAULT_PRODUCT_UNIT.code,
        description: '',
        batchNumber: '',
        expiryDate: '',
        supplier: '',
    });

    const location = useLocation();

    React.useEffect(() => {
        const loadProducts = () => {
            dispatch(fetchProducts());
        };

        loadProducts();
        window.addEventListener('itemhive-workspace-changed', loadProducts);
        return () => window.removeEventListener('itemhive-workspace-changed', loadProducts);
    }, [dispatch]);

    React.useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        if (queryParams.get('add') === 'true') {
            if (user?.role === 'super_admin' || user?.role === 'admin') {
                setShowAddModal(true);
            } else {
                navigate('/inventory/add', { replace: true });
                return;
            }
            navigate('/inventory', { replace: true });
        }
    }, [location.search, navigate, user?.role]);

    const handleSnackClose = () => setSnack({ ...snack, open: false });

    const showSnack = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'success') => {
        setSnack({ open: true, message, severity });
    };

    React.useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const isManager = user?.role === 'super_admin' || user?.role === 'admin';

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, id: string) => {
        setAnchorEl(event.currentTarget);
        setSelectedProductId(id);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedProductId(null);
    };

    const handleDeleteClick = () => {
        setDeleteId(selectedProductId);
        handleMenuClose();
    };

    const handleViewClick = () => {
        const product = products.find((p) => p.id === selectedProductId);
        if (product) setViewProduct(product);
        handleMenuClose();
    };

    const handleEditClick = () => {
        const product = products.find((p) => p.id === selectedProductId);
        if (product) setEditProduct({ ...product });
        handleMenuClose();
    };

    const confirmDelete = () => {
        if (deleteId) {
            dispatch(deleteProductApi(deleteId));
            setDeleteId(null);
            showSnack('Product deleted successfully', 'success');
        }
    };

    const handleUpdateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editProduct) {
            dispatch(updateProductApi(editProduct));
            setEditProduct(null);
            showSnack('Product updated successfully', 'success');
        }
    };

    const saveProductInline = (product: Product, message = 'Product updated successfully') => {
        dispatch(updateProductApi(product))
            .unwrap()
            .then(() => showSnack(message, 'success'))
            .catch((error) => showSnack(typeof error === 'string' ? error : 'Failed to update product', 'error'))
            .finally(() => setInlineSaving(null));
    };

    const startInlineEdit = (product: Product, field: InlineField) => {
        if (!isManager || inlineSaving) return;
        setInlineEdit({
            id: product.id,
            field,
            value: String(product.stock),
        });
    };

    const cancelInlineEdit = () => {
        setInlineEdit(null);
    };

    const commitInlineEdit = (product: Product) => {
        if (!inlineEdit || inlineEdit.id !== product.id) return;

        const numericValue = Number(inlineEdit.value);
        if (!Number.isFinite(numericValue) || numericValue < 0) {
            showSnack('Please enter a valid positive number', 'error');
            return;
        }

        const updatedProduct: Product = { ...product, stock: numericValue };

        setInlineEdit(null);
        setInlineSaving(`${product.id}-${inlineEdit.field}`);
        saveProductInline(updatedProduct, 'Quantity updated successfully');
    };

    const handleUnitUpdate = (product: Product, unitCode: string) => {
        const unit = getProductUnit(unitCode);
        if (!isManager || inlineSaving || product.productUnitCode === unit.code) return;

        setInlineSaving(`${product.id}-unit`);
        saveProductInline(
            {
                ...product,
                productUnitCode: unit.code,
                productUnit: unit.english,
                productUnitUrdu: unit.urdu,
            },
            'Product unit updated successfully',
        );
    };

    const handleAddChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAddFormData({ ...addFormData, [e.target.name]: e.target.value });
    };

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Check for duplicate SKU
        if (products.some((p: Product) => p.sku === addFormData.sku)) {
            showSnack('A product with this SKU already exists!', 'error');
            return;
        }

        dispatch(
            addProductApi({
                id: Math.random().toString(36).substr(2, 9),
                sku: addFormData.sku.toUpperCase(),
                name: addFormData.name,
                category: addFormData.category || 'Uncategorized',
                purchasePrice: Number(addFormData.purchasePrice || 0),
                salePrice: Number(addFormData.salePrice || 0),
                price: Number(addFormData.salePrice || 0),
                stock: parseInt(addFormData.stock),
                minStock: parseInt(addFormData.minStock),
                productUnitCode: getProductUnit(addFormData.productUnitCode).code,
                productUnit: getProductUnit(addFormData.productUnitCode).english,
                productUnitUrdu: getProductUnit(addFormData.productUnitCode).urdu,
                description: addFormData.description,
                batchNumber: addFormData.batchNumber || `B-${Math.floor(Math.random() * 9000) + 1000}`,
                expiryDate: addFormData.expiryDate || new Date(Date.now() + 31536000000).toISOString().split('T')[0],
                supplier: addFormData.supplier || 'General Supplier',
            }),
        );

        setShowAddModal(false);
        setAddFormData({
            sku: '',
            name: '',
            category: '',
            purchasePrice: '',
            salePrice: '',
            stock: '',
            minStock: '',
            productUnitCode: DEFAULT_PRODUCT_UNIT.code,
            description: '',
            batchNumber: '',
            expiryDate: '',
            supplier: '',
        });
        showSnack('Product added successfully', 'success');
    };

    const exportToCSV = () => {
        const headers = ['ID', 'Business', 'Name', 'Category', 'Unit', 'Unit Urdu', 'Stock', 'Min Stock', 'Last Updated'];
        const rows = products.map((p) => [
            p.id,
            p.businessName || '',
            p.name,
            p.category,
            p.productUnit || getProductUnit(p.productUnitCode).english,
            p.productUnitUrdu || getProductUnit(p.productUnitCode).urdu,
            p.stock,
            p.minStock,
            p.lastUpdated,
        ]);

        const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const categories = Array.from(new Set(products.map((p) => p.category))).sort();

    const filteredProducts = products.filter((p) => {
        const matchesSearch = p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || p.category.toLowerCase().includes(debouncedSearch.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
        const matchesStock =
            stockFilter === 'all'
                ? true
                : stockFilter === 'out'
                  ? p.stock <= 0
                  : stockFilter === 'low'
                    ? p.stock > 0 && p.stock <= p.minStock
                    : p.stock > p.minStock;
        return matchesSearch && matchesCategory && matchesStock;
    });

    return (
        <Box>
            <Box
                className="section-rise"
                sx={{
                    mb: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: 1.5,
                }}
            >
                <Box>
                    <Typography variant="h4" fontWeight={800}>
                        Inventory Management
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Track stock levels, product units, and low-stock alerts in one view.
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<Plus size={20} />}
                    onClick={() => navigate('/inventory/add')}
                    sx={{ borderRadius: 2, px: 3, py: 1.2, fontWeight: 800 }}
                >
                    {isManager ? 'Add Product' : 'Request Inventory'}
                </Button>
            </Box>

            <Card className="section-rise-delay" sx={{ borderRadius: 4, overflow: 'hidden' }}>
                <CardContent sx={{ p: 0 }}>
                    <Box
                        sx={{
                            p: 2.5,
                            display: 'flex',
                            gap: 1.2,
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                        }}
                    >
                        <TextField
                            placeholder="Search products..."
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
                            sx={{
                                flexGrow: 1,
                                width: { xs: '100%', sm: 'auto' },
                                maxWidth: { sm: 420 },
                            }}
                        />
                        <Button
                            variant="outlined"
                            startIcon={<Filter size={18} />}
                            color="inherit"
                            sx={{ borderColor: 'divider', width: { xs: '100%', sm: 'auto' } }}
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            Filters
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<Download size={18} />}
                            color="inherit"
                            sx={{ borderColor: 'divider', width: { xs: '100%', sm: 'auto' } }}
                            onClick={exportToCSV}
                        >
                            Export CSV
                        </Button>
                    </Box>

                    {showFilters && (
                        <Box
                            sx={{
                                px: 2.5,
                                py: 2,
                                display: 'flex',
                                gap: 2,
                                alignItems: 'center',
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                flexWrap: 'wrap',
                            }}
                        >
                            <TextField
                                select
                                label="Category"
                                size="small"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                sx={{ minWidth: 180 }}
                            >
                                <MenuItem value="all">All</MenuItem>
                                {categories.map((cat) => (
                                    <MenuItem key={cat} value={cat}>
                                        {cat}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                select
                                label="Stock"
                                size="small"
                                value={stockFilter}
                                onChange={(e) => setStockFilter(e.target.value as 'all' | 'in' | 'low' | 'out')}
                                sx={{ minWidth: 160 }}
                            >
                                <MenuItem value="all">All</MenuItem>
                                <MenuItem value="in">In Stock</MenuItem>
                                <MenuItem value="low">Low Stock</MenuItem>
                                <MenuItem value="out">Out of Stock</MenuItem>
                            </TextField>
                            <Button
                                variant="text"
                                color="inherit"
                                onClick={() => {
                                    setCategoryFilter('all');
                                    setStockFilter('all');
                                }}
                            >
                                Clear Filters
                            </Button>
                        </Box>
                    )}

                    <TableContainer component={Box} sx={{ overflowX: 'auto' }}>
                        <Table sx={{ minWidth: 840 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>PRODUCT NAME</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>CATEGORY</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>QUANTITY</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>PRODUCT UNIT</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>STATUS</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                                        ACTIONS
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredProducts.map((product) => (
                                    <TableRow key={product.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                <Avatar
                                                    variant="rounded"
                                                    src={resolveProductImage(product)}
                                                    alt={product.name}
                                                    imgProps={{
                                                        onError: (e) => {
                                                            const target = e.currentTarget as HTMLImageElement;
                                                            if (target.src !== placeholderFallback) {
                                                                target.src = placeholderFallback;
                                                            }
                                                        },
                                                    }}
                                                    sx={{
                                                        bgcolor: alpha(theme.palette.primary.main, 0.12),
                                                        color: 'primary.main',
                                                        fontWeight: 700,
                                                        width: 48,
                                                        height: 48,
                                                    }}
                                                >
                                                    {product.name.charAt(0)}
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="subtitle2" fontWeight={700}>
                                                        {product.name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        ID: {product.id}
                                                    </Typography>
                                                    {product.businessName && (
                                                        <Typography variant="caption" color="primary.main" display="block" fontWeight={800}>
                                                            {product.businessName}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Chip label={product.category} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
                                        </TableCell>
                                        <TableCell
                                            onClick={() => startInlineEdit(product, 'stock')}
                                            sx={{
                                                cursor: isManager ? 'pointer' : 'default',
                                                minWidth: 150,
                                            }}
                                        >
                                            {inlineEdit?.id === product.id && inlineEdit.field === 'stock' ? (
                                                <TextField
                                                    autoFocus
                                                    size="small"
                                                    type="number"
                                                    value={inlineEdit.value}
                                                    onChange={(e) =>
                                                        setInlineEdit({
                                                            ...inlineEdit,
                                                            value: e.target.value,
                                                        })
                                                    }
                                                    onBlur={() => commitInlineEdit(product)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            e.currentTarget.blur();
                                                        }
                                                        if (e.key === 'Escape') cancelInlineEdit();
                                                    }}
                                                    inputProps={{ min: 0, step: '0.01' }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    sx={{ width: 110 }}
                                                />
                                            ) : (
                                                <Stack spacing={0.25}>
                                                    <Typography variant="body2" fontWeight={800}>
                                                        {product.stock}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {inlineSaving === `${product.id}-stock` ? 'Saving...' : isManager ? '' : 'Quantity'}
                                                    </Typography>
                                                </Stack>
                                            )}
                                        </TableCell>
                                        <TableCell sx={{ minWidth: 190 }}>
                                            {isManager ? (
                                                <TextField
                                                    select
                                                    size="small"
                                                    value={product.productUnitCode || DEFAULT_PRODUCT_UNIT.code}
                                                    onChange={(e) => handleUnitUpdate(product, e.target.value)}
                                                    disabled={inlineSaving === `${product.id}-unit`}
                                                    sx={{
                                                        minWidth: 165,
                                                        '& .MuiInputBase-root': {
                                                            borderRadius: 2,
                                                            fontWeight: 800,
                                                        },
                                                    }}
                                                >
                                                    {PRODUCT_UNITS.map((unit) => (
                                                        <MenuItem key={unit.code} value={unit.code}>
                                                            {unit.english} / {unit.urdu}
                                                        </MenuItem>
                                                    ))}
                                                </TextField>
                                            ) : (
                                                <Typography variant="body2" fontWeight={700}>
                                                    {getProductUnitLabel(product.productUnitCode, product.productUnit, product.productUnitUrdu)}
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {product.stock <= 0 ? (
                                                <Chip label="Out of Stock" size="small" color="error" sx={{ fontWeight: 600 }} />
                                            ) : product.stock <= product.minStock ? (
                                                <Chip label="Low Stock" size="small" color="warning" sx={{ fontWeight: 600 }} />
                                            ) : (
                                                <Chip label="In Stock" size="small" color="success" sx={{ fontWeight: 600 }} />
                                            )}
                                        </TableCell>
                                        <TableCell align="right">
                                            <IconButton onClick={(e) => handleMenuOpen(e, product.id)}>
                                                <MoreVertical size={20} />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </CardContent>
            </Card>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <MenuItem onClick={handleViewClick}>
                    <Eye size={16} style={{ marginRight: 8 }} /> View Details
                </MenuItem>
                {isManager && (
                    <>
                        <MenuItem onClick={handleEditClick}>
                            <Edit size={16} style={{ marginRight: 8 }} /> Edit Product
                        </MenuItem>
                        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
                            <Trash2 size={16} style={{ marginRight: 8 }} /> Delete
                        </MenuItem>
                    </>
                )}
            </Menu>

            {/* View Product Dialog */}
            <PremiumDialog open={Boolean(viewProduct)} onClose={() => setViewProduct(null)} maxWidth="sm" fullWidth scroll="paper">
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <IconContainer color={theme.palette.secondary.main} sx={{ mb: 0 }}>
                            <Eye size={22} />
                        </IconContainer>
                        <span className="gradient-text">Product Details</span>
                    </Box>
                    <IconButton onClick={() => setViewProduct(null)} size="small" sx={{ color: 'text.secondary' }}>
                        <X size={20} />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {viewProduct && (
                        <Box sx={{ py: 1 }}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: { xs: 'column', md: 'row' },
                                    gap: 4,
                                    mb: 4,
                                }}
                            >
                                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                                    <Box
                                        component="img"
                                        src={resolveProductImage(viewProduct)}
                                        alt={viewProduct.name}
                                        onError={(e) => {
                                            const target = e.currentTarget as HTMLImageElement;
                                            if (target.src !== placeholderFallback) {
                                                target.src = placeholderFallback;
                                            }
                                        }}
                                        sx={{
                                            width: { xs: '100%', md: 180 },
                                            height: 180,
                                            borderRadius: 6,
                                            objectFit: 'cover',
                                            border: '4px solid white',
                                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                                        }}
                                    />
                                </motion.div>
                                <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: -1, color: 'text.primary', mb: 1 }}>
                                        {viewProduct.name}
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                                        <Chip
                                            icon={<Package size={14} />}
                                            label={viewProduct.category}
                                            variant="filled"
                                            color="primary"
                                            sx={{
                                                fontWeight: 700,
                                                borderRadius: 2,
                                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                                color: 'primary.main',
                                            }}
                                        />
                                        <Chip label={`SKU: ${viewProduct.sku}`} variant="outlined" sx={{ fontWeight: 600, borderRadius: 2 }} />
                                    </Box>
                                    <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6, mb: 2 }}>
                                        {viewProduct.description || 'No detailed description available for this item.'}
                                    </Typography>
                                </Box>
                            </Box>

                            <Grid container spacing={2}>
                                {[
                                    {
                                        label: 'STOCK',
                                        value: `${viewProduct.stock} ${getProductUnitLabel(viewProduct.productUnitCode, viewProduct.productUnit, viewProduct.productUnitUrdu)}`,
                                        icon: <TrendingUp size={18} />,
                                        color: '#6366f1',
                                    },
                                    {
                                        label: 'MIN STOCK',
                                        value: `${viewProduct.minStock} ${getProductUnitLabel(viewProduct.productUnitCode, viewProduct.productUnit, viewProduct.productUnitUrdu)}`,
                                        icon: <ShieldCheck size={18} />,
                                        color: '#0ea5e9',
                                    },
                                    {
                                        label: 'BATCH',
                                        value: viewProduct.batchNumber || 'N/A',
                                        icon: <Layers size={18} />,
                                        color: '#a855f7',
                                    },
                                    {
                                        label: 'EXPIRY',
                                        value: viewProduct.expiryDate || 'N/A',
                                        icon: <History size={18} />,
                                        color: '#ef4444',
                                    },
                                    {
                                        label: 'SUPPLIER',
                                        value: viewProduct.supplier || 'N/A',
                                        icon: <ShieldCheck size={18} />,
                                        color: '#0ea5e9',
                                    },
                                    {
                                        label: 'UPDATED',
                                        value: viewProduct.lastUpdated ? new Date(viewProduct.lastUpdated).toLocaleDateString() : 'N/A',
                                        icon: <History size={18} />,
                                        color: '#64748b',
                                    },
                                ].map((item, idx) => (
                                    <Grid size={{ xs: 6, sm: 3 }} key={item.label}>
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + idx * 0.05 }}>
                                            <Box
                                                sx={{
                                                    p: 2,
                                                    borderRadius: 4,
                                                    bgcolor: alpha(item.color, 0.05),
                                                    border: `1px solid ${alpha(item.color, 0.1)}`,
                                                    height: '100%',
                                                }}
                                            >
                                                <Box sx={{ color: item.color, mb: 1 }}>{item.icon}</Box>
                                                <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                                    {item.label}
                                                </Typography>
                                                <Typography variant="subtitle1" fontWeight={800} color="text.primary">
                                                    {item.value}
                                                </Typography>
                                            </Box>
                                        </motion.div>
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 4 }}>
                    <Button onClick={() => setViewProduct(null)} variant="outlined" color="inherit" sx={{ borderRadius: 3, px: 3 }}>
                        Close
                    </Button>
                    {isManager && (
                        <Button
                            onClick={() => {
                                setEditProduct(viewProduct);
                                setViewProduct(null);
                            }}
                            variant="contained"
                            startIcon={<Edit size={18} />}
                            sx={{
                                borderRadius: 3,
                                px: 3,
                                fontWeight: 800,
                                boxShadow: theme.shadows[4],
                            }}
                        >
                            Edit Product
                        </Button>
                    )}
                </DialogActions>
            </PremiumDialog>

            {/* Edit Product Dialog */}
            <Dialog open={Boolean(editProduct)} onClose={() => setEditProduct(null)} maxWidth="md" fullWidth>
                <form onSubmit={handleUpdateSubmit}>
                    <DialogTitle sx={{ fontWeight: 800 }}>Edit Product</DialogTitle>
                    <DialogContent dividers>
                        {editProduct && (
                            <Grid container spacing={3} sx={{ mt: 1 }}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        fullWidth
                                        label="Product Name"
                                        required
                                        value={editProduct.name}
                                        onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        select
                                        fullWidth
                                        label="Category"
                                        required
                                        value={editProduct.category}
                                        onChange={(e) =>
                                            setEditProduct({
                                                ...editProduct,
                                                category: e.target.value,
                                            })
                                        }
                                    >
                                        {categories_list.map((cat) => (
                                            <MenuItem key={cat} value={cat}>
                                                {cat}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        fullWidth
                                        label="Current Stock"
                                        type="number"
                                        required
                                        value={editProduct.stock}
                                        onChange={(e) =>
                                            setEditProduct({
                                                ...editProduct,
                                                stock: parseFloat(e.target.value),
                                            })
                                        }
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        select
                                        fullWidth
                                        label="Selling Unit / فروخت کی اکائی"
                                        required
                                        value={editProduct.productUnitCode || DEFAULT_PRODUCT_UNIT.code}
                                        onChange={(e) => {
                                            const unit = getProductUnit(e.target.value);
                                            setEditProduct({
                                                ...editProduct,
                                                productUnitCode: unit.code,
                                                productUnit: unit.english,
                                                productUnitUrdu: unit.urdu,
                                            });
                                        }}
                                    >
                                        {PRODUCT_UNITS.map((unit) => (
                                            <MenuItem key={unit.code} value={unit.code}>
                                                {unit.english} / {unit.urdu}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        fullWidth
                                        label="Min Stock Threshold"
                                        type="number"
                                        required
                                        value={editProduct.minStock}
                                        onChange={(e) =>
                                            setEditProduct({
                                                ...editProduct,
                                                minStock: parseInt(e.target.value),
                                            })
                                        }
                                    />
                                </Grid>
                                <Grid size={12}>
                                    <TextField
                                        fullWidth
                                        multiline
                                        rows={2}
                                        label="Description"
                                        value={editProduct.description}
                                        onChange={(e) =>
                                            setEditProduct({
                                                ...editProduct,
                                                description: e.target.value,
                                            })
                                        }
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        fullWidth
                                        label="Batch Number"
                                        value={editProduct.batchNumber || ''}
                                        onChange={(e) =>
                                            setEditProduct({
                                                ...editProduct,
                                                batchNumber: e.target.value,
                                            })
                                        }
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <AppDatePicker fullWidth label="Expiry Date" value={editProduct.expiryDate || ''} onChange={(value) => setEditProduct({ ...editProduct, expiryDate: value })} />
                                </Grid>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        fullWidth
                                        label="Supplier"
                                        value={editProduct.supplier || ''}
                                        onChange={(e) =>
                                            setEditProduct({
                                                ...editProduct,
                                                supplier: e.target.value,
                                            })
                                        }
                                    />
                                </Grid>
                            </Grid>
                        )}
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button onClick={() => setEditProduct(null)}>Cancel</Button>
                        <Button type="submit" variant="contained" startIcon={<Save size={20} />}>
                            Save Changes
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            <Dialog open={Boolean(deleteId)} onClose={() => setDeleteId(null)}>
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    <Typography>Are you sure you want to delete this product? This action cannot be undone.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteId(null)}>Cancel</Button>
                    <Button onClick={confirmDelete} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add Product Modal */}
            <PremiumDialog
                open={showAddModal}
                onClose={() => setShowAddModal(false)}
                maxWidth="md"
                fullWidth
                scroll="paper"
                PaperProps={{
                    component: 'form',
                    onSubmit: handleAddSubmit,
                }}
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <IconContainer sx={{ mb: 0 }}>
                            <Plus size={24} />
                        </IconContainer>
                        <span className="gradient-text">Add New Product</span>
                    </Box>
                    <IconButton
                        onClick={() => setShowAddModal(false)}
                        size="small"
                        sx={{
                            color: 'text.secondary',
                            '&:hover': {
                                color: 'error.main',
                                bgcolor: alpha('#ef4444', 0.1),
                            },
                        }}
                    >
                        <X size={20} />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={4} sx={{ mt: 0.5 }}>
                        <Grid size={{ xs: 12, md: 7 }}>
                            <Box sx={{ mb: 4 }}>
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={800}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                        mb: 3,
                                    }}
                                >
                                    <Layers size={20} color={theme.palette.primary.main} /> Core Details
                                </Typography>
                                <Grid container spacing={3}>
                                    <Grid size={12}>
                                        <TextField
                                            fullWidth
                                            label="SKU / Barcode"
                                            name="sku"
                                            required
                                            value={addFormData.sku}
                                            onChange={handleAddChange}
                                            placeholder="e.g. ELE-MAC-001"
                                            variant="outlined"
                                            InputProps={{ sx: { borderRadius: 3 } }}
                                        />
                                    </Grid>
                                    <Grid size={12}>
                                        <TextField
                                            fullWidth
                                            label="Full Product Name"
                                            name="name"
                                            required
                                            value={addFormData.name}
                                            onChange={handleAddChange}
                                            InputProps={{ sx: { borderRadius: 3 } }}
                                        />
                                    </Grid>
                                    <Grid size={12}>
                                        <TextField
                                            select
                                            fullWidth
                                            label="Category"
                                            name="category"
                                            required
                                            value={addFormData.category}
                                            onChange={handleAddChange}
                                            InputProps={{ sx: { borderRadius: 3 } }}
                                        >
                                            {categories_list.map((option) => (
                                                <MenuItem key={option} value={option} sx={{ fontWeight: 600 }}>
                                                    {option}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    </Grid>
                                    <Grid size={12}>
                                        <TextField
                                            select
                                            fullWidth
                                            label="Selling Unit / فروخت کی اکائی"
                                            name="productUnitCode"
                                            required
                                            value={addFormData.productUnitCode}
                                            onChange={handleAddChange}
                                            InputProps={{ sx: { borderRadius: 3 } }}
                                            helperText="Choose how this product is sold: Bori, KG, Litre, Carton, etc."
                                        >
                                            {PRODUCT_UNITS.map((unit) => (
                                                <MenuItem key={unit.code} value={unit.code} sx={{ fontWeight: 600 }}>
                                                    {unit.english} / {unit.urdu}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    </Grid>
                                    <Grid size={12}>
                                        <TextField
                                            fullWidth
                                            multiline
                                            rows={2}
                                            label="Product Description"
                                            name="description"
                                            value={addFormData.description}
                                            onChange={handleAddChange}
                                            placeholder="Write something..."
                                            InputProps={{ sx: { borderRadius: 3 } }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <TextField
                                            fullWidth
                                            label="Batch Number"
                                            name="batchNumber"
                                            value={addFormData.batchNumber}
                                            onChange={handleAddChange}
                                            placeholder="e.g. B-90210"
                                            InputProps={{ sx: { borderRadius: 3 } }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <TextField
                                            fullWidth
                                            label="Supplier Name"
                                            name="supplier"
                                            value={addFormData.supplier}
                                            onChange={handleAddChange}
                                            placeholder="e.g. Acme Corp"
                                            InputProps={{ sx: { borderRadius: 3 } }}
                                        />
                                    </Grid>
                                    <Grid size={12}>
                                        <AppDatePicker fullWidth label="Expiry Date" value={addFormData.expiryDate} onChange={(value) => setAddFormData({ ...addFormData, expiryDate: value })} />
                                    </Grid>
                                </Grid>
                            </Box>
                        </Grid>

                        <Grid size={{ xs: 12, md: 5 }}>
                            <Box
                                sx={{
                                    p: 3,
                                    bgcolor: alpha(theme.palette.primary.main, 0.03),
                                    borderRadius: 6,
                                    border: '1px solid',
                                    borderColor: alpha(theme.palette.primary.main, 0.08),
                                    mb: 3,
                                }}
                            >
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={800}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                        mb: 3,
                                    }}
                                >
                                    <Layers size={20} color={theme.palette.primary.main} /> Stock Details
                                </Typography>
                                <Stack spacing={3}>
                                    <TextField
                                        fullWidth
                                        label="Initial Stock"
                                        name="stock"
                                        type="number"
                                        required
                                        value={addFormData.stock}
                                        onChange={handleAddChange}
                                        InputProps={{
                                            sx: { borderRadius: 3, bgcolor: 'background.paper' },
                                        }}
                                        helperText={`Shown as ${addFormData.stock || 0} ${getProductUnitLabel(addFormData.productUnitCode)}`}
                                    />
                                    <TextField
                                        fullWidth
                                        label="Minimum Alert Level"
                                        name="minStock"
                                        type="number"
                                        required
                                        value={addFormData.minStock}
                                        onChange={handleAddChange}
                                        InputProps={{
                                            sx: { borderRadius: 3, bgcolor: 'background.paper' },
                                        }}
                                        helperText="Alert dashboard when stock drops below this"
                                    />
                                </Stack>
                            </Box>

                            <Box>
                                <Typography
                                    variant="subtitle2"
                                    fontWeight={800}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        mb: 1.5,
                                        color: 'text.secondary',
                                    }}
                                >
                                    <ImageIcon size={18} /> Product Imagery
                                </Typography>
                                <Box
                                    sx={{
                                        border: '2px dashed',
                                        borderColor: alpha(theme.palette.primary.main, 0.2),
                                        borderRadius: 4,
                                        p: 2,
                                        textAlign: 'center',
                                        bgcolor: alpha(theme.palette.primary.main, 0.02),
                                        cursor: 'pointer',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        '&:hover': {
                                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                                            borderColor: theme.palette.primary.main,
                                            transform: 'scale(1.02)',
                                        },
                                    }}
                                >
                                    <motion.div whileHover={{ rotate: 10 }}>
                                        <ImageIcon size={32} color={theme.palette.primary.main} style={{ opacity: 0.6, marginBottom: 8 }} />
                                    </motion.div>
                                    <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ display: 'block' }}>
                                        Add Image
                                    </Typography>
                                </Box>
                            </Box>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ px: 4, pb: 4, pt: 2 }}>
                    <Button
                        onClick={() => setShowAddModal(false)}
                        variant="outlined"
                        color="inherit"
                        size="large"
                        sx={{ borderRadius: 3, px: 4, fontWeight: 700 }}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        startIcon={<Plus size={20} />}
                        sx={{
                            borderRadius: 3,
                            px: 6,
                            fontWeight: 800,
                            py: 1.5,
                            fontSize: '1rem',
                            boxShadow: `0 8px 20px -6px ${alpha(theme.palette.primary.main, 0.5)}`,
                        }}
                    >
                        Create Product
                    </Button>
                </DialogActions>
            </PremiumDialog>

            <Snackbar open={snack.open} autoHideDuration={4000} onClose={handleSnackClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert onClose={handleSnackClose} severity={snack.severity} variant="filled" sx={{ width: '100%' }}>
                    {snack.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default ProductList;
