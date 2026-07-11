import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type OrderStatus = 'pending' | 'fulfilled' | 'rejected';
export type OrderPaymentMethod = 'cash' | 'card' | 'credit' | 'installment';

export interface OrderLineItem {
    lineId: string;
    productId: string;
    productName: string;
    quantity: number;
    rate: number;
    amount: number;
    productUnitCode?: string;
    productUnit?: string;
    productUnitUrdu?: string;
}

export interface Order {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    lineItems?: OrderLineItem[];
    customerName?: string;
    orderAmount?: number;
    requestedBy: string;
    status: OrderStatus;
    timestamp: string;
    notes?: string;
    paymentMethod?: OrderPaymentMethod;
    paidNow?: number;
    dueAmount?: number;
    // Credit snapshot captured at order time (only set for credit orders)
    previousCredit?: number;
    creditPaid?: number;
    closingCredit?: number;
}

interface OrdersState {
    orders: Order[];
}

const initialState: OrdersState = {
    orders: [],
};

const ordersSlice = createSlice({
    name: 'orders',
    initialState,
    reducers: {
        addOrder: (state, action: PayloadAction<Order>) => {
            state.orders.unshift(action.payload);
        },
        updateOrderStatus: (state, action: PayloadAction<{ id: string; status: OrderStatus }>) => {
            const order = state.orders.find(o => o.id === action.payload.id);
            if (order) {
                order.status = action.payload.status;
            }
        },
        removeOrder: (state, action: PayloadAction<string>) => {
            state.orders = state.orders.filter(o => o.id !== action.payload);
        },
    },
});

export const { addOrder, updateOrderStatus, removeOrder } = ordersSlice.actions;
export default ordersSlice.reducer;
