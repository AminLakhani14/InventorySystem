import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface ThemeState {
    mode: 'light' | 'dark';
    isSidebarCollapsed: boolean;
}

const initialState: ThemeState = {
    mode: 'light',
    isSidebarCollapsed: false,
};

const themeSlice = createSlice({
    name: 'theme',
    initialState,
    reducers: {
        setDarkMode: (state, action: PayloadAction<'light' | 'dark'>) => {
            state.mode = action.payload;
        },
        toggleDarkMode: (state) => {
            state.mode = state.mode === 'light' ? 'dark' : 'light';
        },
        toggleSidebar: (state) => {
            state.isSidebarCollapsed = !state.isSidebarCollapsed;
        },
        setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
            state.isSidebarCollapsed = action.payload;
        }
    },
});

export const { setDarkMode, toggleDarkMode, toggleSidebar, setSidebarCollapsed } = themeSlice.actions;
export default themeSlice.reducer;
