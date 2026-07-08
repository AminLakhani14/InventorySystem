import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { REHYDRATE } from 'redux-persist';
import api from '../../api/axios';

export type UserRole = 'super_admin' | 'admin' | 'user';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    photoUrl?: string;
    isActive?: boolean;
    isVisible?: boolean;
    installmentAccess?: boolean;
    userCreationLimit?: number;
    businessId?: string;
    businessName?: string;
    createdBy?: string;
    visiblePassword?: string;
    preferences?: {
        country: 'PK' | 'US' | 'DE' | 'GB' | 'CH' | 'CD' | 'CG' | 'IN' | 'AE';
        currency: 'USD' | 'EUR' | 'GBP' | 'CHF' | 'CDF' | 'XAF' | 'PKR' | 'INR' | 'AED';
        notifications: {
            orderUpdates: boolean;
            lowStockAlerts: boolean;
        };
    };
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    loading: boolean;
    error: string | null;
}

const SUPER_ADMIN_EMAILS = ['admin@itemhive.com', 'admin@itemhive.pro'];

const normalizeRole = (role?: string, email?: string): UserRole => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (SUPER_ADMIN_EMAILS.includes(normalizedEmail)) {
        return 'super_admin';
    }

    if (role === 'super_admin' || role === 'admin' || role === 'user') {
        return role;
    }

    if (role === 'cashier') {
        return 'user';
    }

    return 'user';
};

const normalizeUser = (user: User | null): User | null => {
    if (!user) {
        return null;
    }

    return {
        ...user,
        role: normalizeRole(user.role, user.email),
    };
};

const initialState: AuthState = {
    user: null,
    token: localStorage.getItem('token'),
    isAuthenticated: !!localStorage.getItem('token'),
    loading: false,
    error: null,
};

export const loginUser = createAsyncThunk(
    'auth/login',
    async (credentials: { email: string; password: string }, { rejectWithValue }) => {
        try {
            const response = await api.post('/auth/login', credentials);
            localStorage.setItem('token', response.data.token);
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.details || error.response?.data?.message || 'Login failed');
        }
    }
);

export const registerUser = createAsyncThunk(
    'auth/register',
    async (
        payload: { name: string; email: string; password: string; role: UserRole; businessName?: string },
        { rejectWithValue }
    ) => {
        try {
            const response = await api.post('/auth/register', payload);
            return response.data;
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.details || error.response?.data?.message || 'Registration failed');
        }
    }
);

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        logout: (state) => {
            state.user = null;
            state.token = null;
            state.isAuthenticated = false;
            localStorage.removeItem('token');
        },
        clearError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(loginUser.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(loginUser.fulfilled, (state, action: PayloadAction<{ token: string; user: User }>) => {
                state.loading = false;
                state.isAuthenticated = true;
                state.user = normalizeUser(action.payload.user);
                state.token = action.payload.token;
            })
            .addCase(loginUser.rejected, (state, action: PayloadAction<any>) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(registerUser.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(registerUser.fulfilled, (state) => {
                state.loading = false;
            })
            .addCase(registerUser.rejected, (state, action: PayloadAction<any>) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(REHYDRATE as any, (state, action: PayloadAction<any>) => {
                const persistedAuth = action.payload?.auth;
                if (!persistedAuth) {
                    return;
                }

                state.user = normalizeUser(persistedAuth.user ?? state.user);
                state.token = persistedAuth.token ?? state.token;
                state.isAuthenticated = Boolean(persistedAuth.token ?? state.token);
                if (state.token) {
                    localStorage.setItem('token', state.token);
                }
            });
    }
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
