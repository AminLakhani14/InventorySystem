import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import api from '../../api/axios';

export interface Transaction {
    _id?: string;
    id: string;
    productId: string;
    productName: string;
    type: 'addition' | 'reduction';
    amount: number;
    userName: string;
    timestamp: string;
    totalPrice: number;
    paymentMethod?: 'cash' | 'card' | 'credit' | 'installment';
    paidVia?: 'cash' | 'card';
    paidNow?: number;
    dueAmount?: number;
    customerName?: string;
    customerCnic?: string;
    unitCost?: number;
    unitPrice?: number;
    grossProfit?: number;
    installmentPlanId?: string;
}

interface TransactionState {
    transactions: Transaction[];
    loading: boolean;
    error: string | null;
}

const initialState: TransactionState = {
    transactions: [],
    loading: false,
    error: null,
};

export const fetchTransactions = createAsyncThunk(
    'transactions/fetchTransactions',
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get('/transactions');
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch transactions');
        }
    }
);

export const addTransactionApi = createAsyncThunk(
    'transactions/addTransaction',
    async (tx: Transaction, { rejectWithValue }) => {
        try {
            const response = await api.post('/transactions', tx);
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to record transaction');
        }
    }
);

const transactionSlice = createSlice({
    name: 'transactions',
    initialState,
    reducers: {
        clearTransactionError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchTransactions.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchTransactions.fulfilled, (state, action: PayloadAction<Transaction[]>) => {
                state.loading = false;
                state.transactions = action.payload;
            })
            .addCase(fetchTransactions.rejected, (state, action: PayloadAction<any>) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(addTransactionApi.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(addTransactionApi.fulfilled, (state, action: PayloadAction<Transaction>) => {
                state.loading = false;
                state.transactions.unshift(action.payload);
            })
            .addCase(addTransactionApi.rejected, (state, action: PayloadAction<any>) => {
                state.loading = false;
                state.error = action.payload;
            });
    }
});

export const { clearTransactionError } = transactionSlice.actions;
export default transactionSlice.reducer;
