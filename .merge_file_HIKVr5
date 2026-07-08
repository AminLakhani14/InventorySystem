import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import MainLayout from './components/Layout/MainLayout';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import getAppTheme from './theme/theme';
import { useSelector } from 'react-redux';
import type { RootState } from './store';
import ScrollToTop from './components/Common/ScrollToTop';

// Lazy load pages for better performance
import Login from './pages/Auth/Login';
const Dashboard = React.lazy(() => import('./pages/Dashboard/Dashboard'));
const ProductList = React.lazy(() => import('./pages/Inventory/ProductList'));
const ReduceStock = React.lazy(() => import('./pages/Inventory/ReduceStock'));
const POSTerminal = React.lazy(() => import('./pages/POS/POSTerminal'));
const TransactionHistory = React.lazy(() => import('./pages/Transactions/TransactionHistory'));
const ReportsPage = React.lazy(() => import('./pages/Reports/ReportsPage'));
const Signup = React.lazy(() => import('./pages/Auth/Signup'));
const OrderDesk = React.lazy(() => import('./pages/Orders/OrderDesk'));
const SettingsPage = React.lazy(() => import('./pages/Settings/SettingsPage'));
const ProfilePage = React.lazy(() => import('./pages/Profile/ProfilePage'));

const AppContent: React.FC = () => {
  const { mode } = useSelector((state: RootState) => state.theme);
  const theme = React.useMemo(() => getAppTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <ScrollToTop />
        <React.Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route path="/" element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="inventory" element={<ProductList />} />
              <Route path="inventory/reduce" element={
                <ProtectedRoute allowedRoles={['cashier', 'admin']}>
                  <ReduceStock />
                </ProtectedRoute>
              } />
              <Route path="pos" element={
                <ProtectedRoute allowedRoles={['cashier', 'admin']}>
                  <POSTerminal />
                </ProtectedRoute>
              } />
              <Route path="orders" element={
                <ProtectedRoute allowedRoles={['cashier', 'admin']}>
                  <OrderDesk />
                </ProtectedRoute>
              } />
              <Route path="transactions" element={<TransactionHistory />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={
                <ProtectedRoute allowedRoles={['admin', 'cashier']}>
                  <SettingsPage />
                </ProtectedRoute>
              } />
              <Route path="profile" element={
                <ProtectedRoute allowedRoles={['admin', 'cashier']}>
                  <ProfilePage />
                </ProtectedRoute>
              } />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
};

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AppContent />
      </PersistGate>
    </Provider>
  );
};

export default App;
