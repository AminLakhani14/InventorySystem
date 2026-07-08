import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import api from '../../api/axios';

export interface SalesTrendPoint {
    _id: string;
    revenue: number;
    sales: number;
    profit?: number;
}

export type ReportPeriod = '7days' | 'monthly' | 'yearly' | 'custom';

export interface ReportFilters {
    period: ReportPeriod;
    from?: string;
    to?: string;
}

export interface CategoryValuationPoint {
    name: string;
    value: number;
}

export interface TopSellingProduct {
    _id: string;
    name: string;
    totalReduced: number;
    revenue: number;
    profit?: number;
}

interface ReportsState {
    salesTrend: SalesTrendPoint[];
    categoryValuation: CategoryValuationPoint[];
    topSelling: TopSellingProduct[];
    loading: boolean;
    error: string | null;
}

const initialState: ReportsState = {
    salesTrend: [],
    categoryValuation: [],
    topSelling: [],
    loading: false,
    error: null,
};

export const fetchSalesTrend = createAsyncThunk(
    'reports/fetchSalesTrend',
    async (filters: ReportFilters = { period: '7days' }, { rejectWithValue }) => {
        try {
            const response = await api.get('/reports/sales-trend', { params: filters });
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch sales trend');
        }
    }
);

export const fetchCategoryValuation = createAsyncThunk(
    'reports/fetchCategoryValuation',
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get('/reports/category-valuation');
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch category valuation');
        }
    }
);

export const fetchTopSellingProducts = createAsyncThunk(
    'reports/fetchTopSellingProducts',
    async (filters: ReportFilters = { period: '7days' }, { rejectWithValue }) => {
        try {
            const response = await api.get('/reports/top-selling', { params: filters });
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch top-selling products');
        }
    }
);

const reportSlice = createSlice({
    name: 'reports',
    initialState,
    reducers: {
        clearReportError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchSalesTrend.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchSalesTrend.fulfilled, (state, action: PayloadAction<SalesTrendPoint[]>) => {
                state.loading = false;
                state.salesTrend = action.payload;
            })
            .addCase(fetchSalesTrend.rejected, (state, action: PayloadAction<any>) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(fetchCategoryValuation.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchCategoryValuation.fulfilled, (state, action: PayloadAction<CategoryValuationPoint[]>) => {
                state.loading = false;
                state.categoryValuation = action.payload;
            })
            .addCase(fetchCategoryValuation.rejected, (state, action: PayloadAction<any>) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(fetchTopSellingProducts.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchTopSellingProducts.fulfilled, (state, action: PayloadAction<TopSellingProduct[]>) => {
                state.loading = false;
                state.topSelling = action.payload;
            })
            .addCase(fetchTopSellingProducts.rejected, (state, action: PayloadAction<any>) => {
                state.loading = false;
                state.error = action.payload;
            });
    }
});

export const { clearReportError } = reportSlice.actions;
export default reportSlice.reducer;
