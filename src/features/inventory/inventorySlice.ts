import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import api from '../../api/axios';
import { DEFAULT_PRODUCT_UNIT } from '../../lib/productUnits';

export interface Product {
    _id?: string;
    id: string; // The readable ID (e.g. "1")
    sku: string;
    name: string;
    category: string;
    purchasePrice: number;
    salePrice: number;
    price: number;
    stock: number;
    minStock: number;
    productUnitCode?: string;
    productUnit?: string;
    productUnitUrdu?: string;
    description: string;
    imageUrl?: string;
    lastUpdated?: string;
    batchNumber?: string;
    expiryDate?: string;
    supplier?: string;
    businessName?: string;
}

export interface ProductImageSuggestion {
    id: string;
    title: string;
    brand: string;
    imageUrl: string;
    thumbnailUrl: string;
    source: 'openfoodfacts' | 'openbeautyfacts' | 'openproductsfacts' | 'openpetfoodfacts';
    subtitle: string;
}

interface InventoryState {
    products: Product[];
    loading: boolean;
    error: string | null;
}

type ProductResponse = Partial<Product> & Record<string, unknown>;

type ApiError = {
    response?: {
        data?: {
            message?: string;
        };
    };
};

const initialState: InventoryState = {
    products: [],
    loading: false,
    error: null,
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
    const apiError = error as ApiError;
    return apiError.response?.data?.message || fallback;
};

const normalizeProduct = (product: ProductResponse): Product => {
    const salePrice = Number(product.salePrice ?? product.price ?? 0);
    const purchasePrice = Number(product.purchasePrice ?? product.price ?? 0);

    return {
        ...(product as Product),
        purchasePrice,
        salePrice,
        price: salePrice,
        productUnitCode: typeof product.productUnitCode === 'string' ? product.productUnitCode : DEFAULT_PRODUCT_UNIT.code,
        productUnit: typeof product.productUnit === 'string' ? product.productUnit : DEFAULT_PRODUCT_UNIT.english,
        productUnitUrdu: typeof product.productUnitUrdu === 'string' ? product.productUnitUrdu : DEFAULT_PRODUCT_UNIT.urdu,
    };
};

// Async Thunks
export const fetchProducts = createAsyncThunk(
    'inventory/fetchProducts',
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get<ProductResponse[]>('/products');
            return response.data.map(normalizeProduct);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch products'));
        }
    }
);

export const addProductApi = createAsyncThunk(
    'inventory/addProduct',
    async (product: Product, { rejectWithValue }) => {
        try {
            const response = await api.post<ProductResponse>('/products', product);
            return normalizeProduct(response.data);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to add product'));
        }
    }
);

export const fetchProductImageSuggestions = createAsyncThunk(
    'inventory/fetchProductImageSuggestions',
    async (
        { name, category }: { name: string; category?: string },
        { rejectWithValue }
    ) => {
        try {
            const response = await api.get('/products/image-suggestions', {
                params: { name, category },
            });
            return response.data.suggestions as ProductImageSuggestion[];
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to fetch image suggestions'));
        }
    }
);

export const updateProductApi = createAsyncThunk(
    'inventory/updateProduct',
    async (product: Product, { rejectWithValue }) => {
        try {
            const response = await api.put<ProductResponse>(`/products/${product.id}`, product);
            return normalizeProduct(response.data);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to update product'));
        }
    }
);

export const deleteProductApi = createAsyncThunk(
    'inventory/deleteProduct',
    async (id: string, { rejectWithValue }) => {
        try {
            await api.delete(`/products/${id}`);
            return id;
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to delete product'));
        }
    }
);

export const reduceStockApi = createAsyncThunk(
    'inventory/reduceStock',
    async (data: { id: string; amount: number; transaction: Record<string, unknown> }, { rejectWithValue }) => {
        try {
            // Typically, in a POS scenario, we just create a transaction
            // and the backend handles the stock reduction atomically.
            await api.post('/transactions', data.transaction);
            return { id: data.id, amount: data.amount };
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to process transaction'));
        }
    }
);

export const PRODUCT_CATEGORIES = [
    'Snacks & Candy',
    'Gum & Mints',
    'Health & Personal',
    'Accessories',
    'Rolling Supplies',
    'Groceries',
    'General'
];

export const placeholderFallback = `https://placehold.co/160x160/png?text=Item`;

export const resolveProductImage = (product: Pick<Product, 'name' | 'category' | 'imageUrl'>): string => {
    if (product.imageUrl && product.imageUrl.trim().length > 0) {
        const trimmed = product.imageUrl.trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('/')) {
            return trimmed;
        }
    }
    return placeholderFallback;
};

const inventorySlice = createSlice({
    name: 'inventory',
    initialState,
    reducers: {
        clearInventoryError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch
            .addCase(fetchProducts.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchProducts.fulfilled, (state, action: PayloadAction<Product[]>) => {
                state.loading = false;
                state.products = action.payload;
            })
            .addCase(fetchProducts.rejected, (state, action) => {
                state.loading = false;
                state.error = typeof action.payload === 'string' ? action.payload : 'Failed to fetch products';
            })
            // Add
            .addCase(addProductApi.fulfilled, (state, action: PayloadAction<Product>) => {
                state.products.push(action.payload);
            })
            // Update
            .addCase(updateProductApi.fulfilled, (state, action: PayloadAction<Product>) => {
                const index = state.products.findIndex(p => p.id === action.payload.id);
                if (index !== -1) {
                    state.products[index] = action.payload;
                }
            })
            // Delete
            .addCase(deleteProductApi.fulfilled, (state, action: PayloadAction<string>) => {
                state.products = state.products.filter(p => p.id !== action.payload);
            })
            // Reduce Stock (local optimistic update or synced result)
            .addCase(reduceStockApi.fulfilled, (state, action: PayloadAction<{ id: string; amount: number }>) => {
                const product = state.products.find(p => p.id === action.payload.id);
                if (product) {
                    product.stock -= action.payload.amount;
                    product.lastUpdated = new Date().toISOString();
                }
            });
    },
});

export const { clearInventoryError } = inventorySlice.actions;
export default inventorySlice.reducer;
