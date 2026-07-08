import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Product } from '../inventory/inventorySlice';

export interface CartItem extends Product {
    quantity: number;
    discount?: number;
}

interface POSState {
    cart: CartItem[];
    activeDiscount: number; // Flat discount on whole cart
}

const initialState: POSState = {
    cart: [],
    activeDiscount: 0,
};

const posSlice = createSlice({
    name: 'pos',
    initialState,
    reducers: {
        addToCart: (state, action: PayloadAction<Product>) => {
            const existingItem = state.cart.find(item => item.id === action.payload.id);
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                state.cart.push({ ...action.payload, quantity: 1 });
            }
        },
        updateCartItemPrice: (state, action: PayloadAction<{ id: string; price: number }>) => {
            const item = state.cart.find(cartItem => cartItem.id === action.payload.id);
            if (item) {
                item.price = Math.max(0, action.payload.price);
            }
        },
        removeFromCart: (state, action: PayloadAction<string>) => {
            state.cart = state.cart.filter(item => item.id !== action.payload);
        },
        updateQuantity: (state, action: PayloadAction<{ id: string; quantity: number }>) => {
            const item = state.cart.find(item => item.id === action.payload.id);
            if (item) {
                item.quantity = Math.max(0, action.payload.quantity);
                if (item.quantity === 0) {
                    state.cart = state.cart.filter(i => i.id !== action.payload.id);
                }
            }
        },
        clearCart: (state) => {
            state.cart = [];
            state.activeDiscount = 0;
        },
        setCartDiscount: (state, action: PayloadAction<number>) => {
            state.activeDiscount = action.payload;
        },
    },
});

export const { addToCart, updateCartItemPrice, removeFromCart, updateQuantity, clearCart, setCartDiscount } = posSlice.actions;
export default posSlice.reducer;
