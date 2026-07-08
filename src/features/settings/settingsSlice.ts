import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import api from '../../api/axios';

interface NotificationSettings {
    orderUpdates: boolean;
    lowStockAlerts: boolean;
}

export interface AppSettings {
    salesTaxRate: number;
    shopName: string;
    shopPhone: string;
    shopAddress: string;
    installmentsEnabled: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
    salesTaxRate: 0,
    shopName: 'ItemHive POS',
    shopPhone: '',
    shopAddress: '',
    installmentsEnabled: false,
};

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CHF' | 'CDF' | 'XAF' | 'PKR' | 'INR' | 'AED';
export type CountryCode = 'PK' | 'US' | 'DE' | 'GB' | 'CH' | 'CD' | 'CG' | 'IN' | 'AE';

export const countryCurrencyMap: Record<CountryCode, CurrencyCode> = {
    PK: 'PKR',
    US: 'USD',
    DE: 'EUR',
    GB: 'GBP',
    CH: 'CHF',
    CD: 'CDF',
    CG: 'XAF',
    IN: 'INR',
    AE: 'AED',
};

interface SettingsState {
    notifications: NotificationSettings;
    country: CountryCode;
    currency: CurrencyCode;
    app: AppSettings;
    loading: boolean;
    error: string | null;
}

const initialState: SettingsState = {
    notifications: {
        orderUpdates: true,
        lowStockAlerts: true,
    },
    country: 'PK',
    currency: 'PKR',
    app: DEFAULT_APP_SETTINGS,
    loading: false,
    error: null,
};

export const fetchSettings = createAsyncThunk(
    'settings/fetchSettings',
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get('/settings');
            return response.data as {
                country: CountryCode;
                currency: CurrencyCode;
                notifications: NotificationSettings;
                app: AppSettings;
            };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch settings');
        }
    }
);

export const saveSettings = createAsyncThunk(
    'settings/saveSettings',
    async (
        payload: {
            country: CountryCode;
            currency: CurrencyCode;
            notifications: NotificationSettings;
            app: AppSettings;
        },
        { rejectWithValue }
    ) => {
        try {
            const response = await api.put('/settings', payload);
            return response.data as {
                country: CountryCode;
                currency: CurrencyCode;
                notifications: NotificationSettings;
                app: AppSettings;
            };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to save settings');
        }
    }
);

const settingsSlice = createSlice({
    name: 'settings',
    initialState,
    reducers: {
        setOrderUpdatesEnabled: (state, action: PayloadAction<boolean>) => {
            state.notifications.orderUpdates = action.payload;
        },
        setLowStockAlertsEnabled: (state, action: PayloadAction<boolean>) => {
            state.notifications.lowStockAlerts = action.payload;
        },
        setCountry: (state, action: PayloadAction<CountryCode>) => {
            state.country = action.payload;
            state.currency = countryCurrencyMap[action.payload];
        },
        setCurrency: (state, action: PayloadAction<CurrencyCode>) => {
            state.currency = action.payload;
        },
        clearSettingsError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchSettings.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchSettings.fulfilled, (state, action) => {
                state.loading = false;
                state.country = action.payload.country;
                state.currency = action.payload.currency;
                state.notifications = action.payload.notifications;
                state.app = action.payload.app;
            })
            .addCase(fetchSettings.rejected, (state, action: PayloadAction<any>) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(saveSettings.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(saveSettings.fulfilled, (state, action) => {
                state.loading = false;
                state.country = action.payload.country;
                state.currency = action.payload.currency;
                state.notifications = action.payload.notifications;
                state.app = action.payload.app;
            })
            .addCase(saveSettings.rejected, (state, action: PayloadAction<any>) => {
                state.loading = false;
                state.error = action.payload;
            });
    },
});

export const { setOrderUpdatesEnabled, setLowStockAlertsEnabled, setCountry, setCurrency, clearSettingsError } = settingsSlice.actions;
export default settingsSlice.reducer;
