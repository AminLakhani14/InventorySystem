import React, { useRef, useState } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Grid,
    TextField,
    Button,
    MenuItem,
    Divider,
    Alert,
    IconButton,
    CircularProgress,
    Stack
} from '@mui/material';
import {
    ChevronLeft,
    Save,
    Image as ImageIcon,
    Layers,
    Upload,
    Link as LinkIcon,
    Sparkles,
    Trash2,
    Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { addProductApi, fetchProductImageSuggestions, type Product, type ProductImageSuggestion, PRODUCT_CATEGORIES } from '../../features/inventory/inventorySlice';
import type { AppDispatch } from '../../store';
import type { RootState } from '../../store';
import { motion } from 'framer-motion';
import api from '../../api/axios';
import { DEFAULT_PRODUCT_UNIT, getProductUnit, PRODUCT_UNITS } from '../../lib/productUnits';

const categories = PRODUCT_CATEGORIES;

const getErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === 'string') return error;
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'object' && error !== null && 'response' in error) {
        const maybeAxiosError = error as { response?: { data?: { message?: string } } };
        return maybeAxiosError.response?.data?.message || fallback;
    }
    return fallback;
};

const AddProduct: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch<AppDispatch>();
    const [success, setSuccess] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [imageSuggestions, setImageSuggestions] = useState<ProductImageSuggestion[]>([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [imageError, setImageError] = useState('');
    const [suggestionError, setSuggestionError] = useState('');
    const [imageUrlInput, setImageUrlInput] = useState('');
    const [selectedSuggestionId, setSelectedSuggestionId] = useState('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const { products } = useSelector((state: RootState) => state.inventory);
    const { user } = useSelector((state: RootState) => state.auth);
    const canCreateDirectly = user?.role === 'super_admin' || user?.role === 'admin';
    const [formData, setFormData] = useState({
        sku: '',
        name: '',
        category: '',
        purchasePrice: '',
        salePrice: '',
        stock: '',
        minStock: '',
        productUnitCode: DEFAULT_PRODUCT_UNIT.code,
        description: '',
        imageUrl: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const selectedUnit = getProductUnit(formData.productUnitCode);

    const applyImageUrl = (nextImageUrl: string, source: 'suggestion' | 'manual') => {
        setFormData((current) => ({ ...current, imageUrl: nextImageUrl }));
        setImageError('');

        if (source === 'manual') {
            setSelectedSuggestionId('');
        }
    };

    const handleUseImageUrl = () => {
        const trimmed = imageUrlInput.trim();

        if (!trimmed) {
            setImageError('Paste an image URL first.');
            return;
        }

        try {
            const parsedUrl = new URL(trimmed);
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                throw new Error('Invalid protocol');
            }
            applyImageUrl(trimmed, 'manual');
        } catch {
            setImageError('Please enter a valid http or https image URL.');
        }
    };

    const handleSuggestionLookup = async () => {
        const trimmedName = formData.name.trim();

        if (trimmedName.length < 2) {
            setSuggestionError('Enter a product name first so we can suggest images.');
            return;
        }

        setSuggestionsLoading(true);
        setSuggestionError('');

        try {
            const suggestions = await dispatch(
                fetchProductImageSuggestions({
                    name: trimmedName,
                    category: formData.category || undefined,
                })
            ).unwrap() as ProductImageSuggestion[];
            setImageSuggestions(suggestions);

            if (suggestions.length === 0) {
                setSuggestionError('No strong image matches were found. You can still upload a file or paste an image URL.');
            }
        } catch (error: unknown) {
            setImageSuggestions([]);
            setSuggestionError(getErrorMessage(error, 'Unable to fetch image suggestions right now.'));
        } finally {
            setSuggestionsLoading(false);
        }
    };

    const handleSelectSuggestion = (suggestion: ProductImageSuggestion) => {
        setSelectedSuggestionId(suggestion.id);
        applyImageUrl(suggestion.imageUrl, 'suggestion');
    };

    const readFileAsDataUrl = (file: File) =>
        new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Unable to read the selected file'));
            reader.readAsDataURL(file);
        });

    const handleImageFile = async (file?: File) => {
        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {
            setImageError('Please choose an image file.');
            return;
        }

        if (file.size > 1_500_000) {
            setImageError('Please use an image smaller than 1.5 MB for now.');
            return;
        }

        try {
            const dataUrl = await readFileAsDataUrl(file);
            applyImageUrl(dataUrl, 'manual');
        } catch (error: unknown) {
            setImageError(getErrorMessage(error, 'Unable to read the image file.'));
        }
    };

    const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        await handleImageFile(e.target.files?.[0]);
        e.target.value = '';
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        await handleImageFile(e.dataTransfer.files?.[0]);
    };

    const clearSelectedImage = () => {
        setFormData((current) => ({ ...current, imageUrl: '' }));
        setImageUrlInput('');
        setSelectedSuggestionId('');
        setImageError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError('');

        // Check for duplicate SKU
        if (products.some((p: Product) => p.sku === formData.sku)) {
            alert('A product with this SKU already exists!');
            return;
        }

        const payload = {
            id: Math.random().toString(36).substr(2, 9),
            sku: formData.sku.toUpperCase(),
            name: formData.name,
            category: formData.category || 'Uncategorized',
            purchasePrice: Number(formData.purchasePrice || 0),
            salePrice: Number(formData.salePrice || 0),
            price: Number(formData.salePrice || 0),
            stock: parseInt(formData.stock),
            minStock: parseInt(formData.minStock),
            productUnitCode: selectedUnit.code,
            productUnit: selectedUnit.english,
            productUnitUrdu: selectedUnit.urdu,
            description: formData.description,
            imageUrl: formData.imageUrl
        };

        setSubmitting(true);

        try {
            if (canCreateDirectly) {
                await dispatch(addProductApi(payload)).unwrap();
            } else {
                await api.post('/inventory-requests', payload);
            }

            setSuccess(true);
            setTimeout(() => {
                navigate(canCreateDirectly ? '/inventory' : '/inventory/requests');
            }, 1500);
        } catch (error: unknown) {
            setSubmitError(getErrorMessage(error, 'Unable to submit this product right now.'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
            <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton onClick={() => navigate('/inventory')} sx={{ bgcolor: 'background.paper' }}>
                    <ChevronLeft size={20} />
                </IconButton>
                <Typography variant="h4" fontWeight={800}>{canCreateDirectly ? 'Add New Product' : 'Request Inventory Approval'}</Typography>
            </Box>

            {success && (
                <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
                    {canCreateDirectly
                        ? 'Product added successfully! Redirecting to inventory...'
                        : 'Inventory request submitted successfully! Redirecting to requests...'}
                </Alert>
            )}

            {!canCreateDirectly && (
                <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                    Users cannot add stock directly. This request will go to an admin or super admin for approval.
                </Alert>
            )}

            {submitError && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                    {submitError}
                </Alert>
            )}

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
            >
                <Card sx={{ borderRadius: 4 }}>
                    <CardContent sx={{ p: 4 }}>
                        <form onSubmit={handleSubmit}>
                            <Grid container spacing={3}>
                                <Grid size={12}>
                                    <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Layers size={20} /> General Information
                                    </Typography>
                                    <Divider sx={{ mb: 3 }} />
                                </Grid>

                                <Grid size={12}>
                                    <TextField
                                        fullWidth
                                        label="SKU (Unique Identifier)"
                                        name="sku"
                                        required
                                        value={formData.sku}
                                        onChange={handleChange}
                                        placeholder="e.g. ELE-MAC-001"
                                        variant="outlined"
                                        sx={{ mb: 1 }}
                                    />
                                </Grid>

                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        fullWidth
                                        label="Product Name"
                                        name="name"
                                        required
                                        value={formData.name}
                                        onChange={handleChange}
                                        variant="outlined"
                                    />
                                </Grid>

                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        select
                                        fullWidth
                                        label="Category"
                                        name="category"
                                        required
                                        value={formData.category}
                                        onChange={handleChange}
                                    >
                                        {categories.map((option) => (
                                            <MenuItem key={option} value={option}>
                                                {option}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Grid>

                                <Grid size={{ xs: 12, md: 6 }}>
                                    <TextField
                                        select
                                        fullWidth
                                        label="Selling Unit / فروخت کی اکائی"
                                        name="productUnitCode"
                                        required
                                        value={formData.productUnitCode}
                                        onChange={handleChange}
                                        helperText={`Example display: 10 ${selectedUnit.english} / ${selectedUnit.urdu}`}
                                    >
                                        {PRODUCT_UNITS.map((unit) => (
                                            <MenuItem key={unit.code} value={unit.code}>
                                                {unit.english} / {unit.urdu}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                </Grid>

                                <Grid size={12}>
                                    <TextField
                                        fullWidth
                                        multiline
                                        rows={4}
                                        label="Description"
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        placeholder="Enter product features and details..."
                                    />
                                </Grid>

                                <Grid size={12} sx={{ mt: 2 }}>
                                    <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Layers size={20} /> Stock Details
                                    </Typography>
                                    <Divider sx={{ mb: 3 }} />
                                </Grid>

                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        fullWidth
                                        label="Initial Stock"
                                        name="stock"
                                        type="number"
                                        required
                                        value={formData.stock}
                                        onChange={handleChange}
                                        helperText={`Stock will be shown as ${formData.stock || 0} ${selectedUnit.english} / ${selectedUnit.urdu}`}
                                    />
                                </Grid>

                                <Grid size={{ xs: 12, md: 4 }}>
                                    <TextField
                                        fullWidth
                                        label="Minimum Stock Level"
                                        name="minStock"
                                        type="number"
                                        required
                                        value={formData.minStock}
                                        onChange={handleChange}
                                        helperText="Alert dashboard when stock drops below this"
                                    />
                                </Grid>

                                <Grid size={12} sx={{ mt: 2 }}>
                                    <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <ImageIcon size={20} /> Media
                                    </Typography>
                                    <Divider sx={{ mb: 3 }} />
                                    <Stack spacing={2}>
                                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                                            <Button
                                                variant="contained"
                                                startIcon={suggestionsLoading ? <CircularProgress size={16} color="inherit" /> : <Sparkles size={18} />}
                                                onClick={handleSuggestionLookup}
                                                disabled={suggestionsLoading}
                                                sx={{ borderRadius: 2 }}
                                            >
                                                {suggestionsLoading ? 'Finding images...' : 'Suggest up to 4 images'}
                                            </Button>
                                            <Typography variant="body2" color="text.secondary">
                                                Free image suggestions powered by Open Facts datasets for groceries, personal care, pet, and general products.
                                            </Typography>
                                        </Box>

                                        {suggestionError && (
                                            <Alert severity="info" sx={{ borderRadius: 2 }}>
                                                {suggestionError}
                                            </Alert>
                                        )}

                                        {imageSuggestions.length > 0 && (
                                            <Grid container spacing={2}>
                                                {imageSuggestions.map((suggestion) => {
                                                    const isSelected = selectedSuggestionId === suggestion.id && formData.imageUrl === suggestion.imageUrl;

                                                    return (
                                                        <Grid key={suggestion.id} size={{ xs: 12, sm: 6, md: 3 }}>
                                                            <Card
                                                                variant="outlined"
                                                                sx={{
                                                                    borderRadius: 3,
                                                                    overflow: 'hidden',
                                                                    borderColor: isSelected ? 'primary.main' : 'divider',
                                                                    boxShadow: isSelected ? 3 : 0,
                                                                }}
                                                            >
                                                                <Box
                                                                    component="img"
                                                                    src={suggestion.thumbnailUrl || suggestion.imageUrl}
                                                                    alt={suggestion.title}
                                                                    sx={{ width: '100%', height: 160, objectFit: 'contain', bgcolor: 'grey.50', p: 1.5 }}
                                                                />
                                                                <CardContent sx={{ p: 2 }}>
                                                                    <Typography variant="subtitle2" fontWeight={700} noWrap>
                                                                        {suggestion.title}
                                                                    </Typography>
                                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', minHeight: 34 }}>
                                                                        {suggestion.subtitle || suggestion.brand}
                                                                    </Typography>
                                                                    <Button
                                                                        fullWidth
                                                                        variant={isSelected ? 'contained' : 'outlined'}
                                                                        size="small"
                                                                        startIcon={isSelected ? <Check size={16} /> : <ImageIcon size={16} />}
                                                                        onClick={() => handleSelectSuggestion(suggestion)}
                                                                        sx={{ mt: 1.5, borderRadius: 2 }}
                                                                    >
                                                                        {isSelected ? 'Selected' : 'Use this image'}
                                                                    </Button>
                                                                </CardContent>
                                                            </Card>
                                                        </Grid>
                                                    );
                                                })}
                                            </Grid>
                                        )}

                                        <Box
                                            onClick={() => fileInputRef.current?.click()}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={handleDrop}
                                            sx={{
                                                border: '2px dashed',
                                                borderColor: 'divider',
                                                borderRadius: 4,
                                                p: 4,
                                                textAlign: 'center',
                                                bgcolor: 'rgba(0,0,0,0.01)',
                                                cursor: 'pointer',
                                                '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' }
                                            }}
                                        >
                                            <Upload size={44} color="#64748b" style={{ marginBottom: 12 }} />
                                            <Typography variant="body1" fontWeight={700}>
                                                Drag and drop an image, or click to browse
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                JPG, PNG, WEBP up to 1.5 MB. Stored directly with the product for now.
                                            </Typography>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                hidden
                                                onChange={handleFileInputChange}
                                            />
                                        </Box>

                                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                            <TextField
                                                fullWidth
                                                label="Or paste an image URL"
                                                placeholder="https://example.com/product-image.jpg"
                                                value={imageUrlInput}
                                                onChange={(e) => setImageUrlInput(e.target.value)}
                                            />
                                            <Button
                                                variant="outlined"
                                                startIcon={<LinkIcon size={18} />}
                                                onClick={handleUseImageUrl}
                                                sx={{ minWidth: 160, borderRadius: 2, height: 56 }}
                                            >
                                                Use image URL
                                            </Button>
                                        </Box>

                                        {imageError && (
                                            <Alert severity="warning" sx={{ borderRadius: 2 }}>
                                                {imageError}
                                            </Alert>
                                        )}

                                        {formData.imageUrl && (
                                            <Card variant="outlined" sx={{ borderRadius: 3 }}>
                                                <CardContent sx={{ p: 2.5 }}>
                                                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                                                        <Box
                                                            component="img"
                                                            src={formData.imageUrl}
                                                            alt={formData.name || 'Selected product image'}
                                                            sx={{ width: 120, height: 120, objectFit: 'contain', bgcolor: 'grey.50', borderRadius: 2, p: 1 }}
                                                        />
                                                        <Box sx={{ flex: 1, minWidth: 220 }}>
                                                            <Typography variant="subtitle1" fontWeight={700}>
                                                                Selected product image
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                                                                {formData.imageUrl.startsWith('data:') ? 'Uploaded from your device' : formData.imageUrl}
                                                            </Typography>
                                                        </Box>
                                                        <Button
                                                            color="error"
                                                            variant="text"
                                                            startIcon={<Trash2 size={18} />}
                                                            onClick={clearSelectedImage}
                                                        >
                                                            Remove
                                                        </Button>
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        )}
                                    </Stack>
                                </Grid>

                                <Grid size={12} sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                                    <Button
                                        variant="outlined"
                                        size="large"
                                        onClick={() => navigate('/inventory')}
                                        sx={{ borderRadius: 2, px: 4 }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        size="large"
                                        startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Save size={20} />}
                                        disabled={submitting}
                                        sx={{ borderRadius: 2, px: 4 }}
                                    >
                                        {submitting ? 'Submitting...' : canCreateDirectly ? 'Save Product' : 'Submit for Approval'}
                                    </Button>
                                </Grid>
                            </Grid>
                        </form>
                    </CardContent>
                </Card>
            </motion.div>
        </Box>
    );
};

export default AddProduct;
