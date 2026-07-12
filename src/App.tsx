import React, { useEffect } from 'react';
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
import { useDispatch } from 'react-redux';
import type { AppDispatch } from './store';
import { fetchSettings } from './features/settings/settingsSlice';
import { logout } from './features/auth/authSlice';
import { subscribeApiLoading } from './api/axios';
import ModernLoader from './components/Common/ModernLoader';

// Lazy load pages for better performance
import Login from './pages/Auth/Login';
const Dashboard = React.lazy(() => import('./pages/Dashboard/Dashboard'));
const ProductList = React.lazy(() => import('./pages/Inventory/ProductList'));
const AddProduct = React.lazy(() => import('./pages/Inventory/AddProduct'));
const ReduceStock = React.lazy(() => import('./pages/Inventory/ReduceStock'));
const ProductUnitsPage = React.lazy(() => import('./pages/Inventory/ProductUnitsPage'));
const POSTerminal = React.lazy(() => import('./pages/POS/POSTerminal'));
const TransactionHistory = React.lazy(() => import('./pages/Transactions/TransactionHistory'));
const ReportsPage = React.lazy(() => import('./pages/Reports/ReportsPage'));
const TodaysCollectionPage = React.lazy(() => import('./pages/Collections/TodaysCollectionPage'));
const Signup = React.lazy(() => import('./pages/Auth/Signup'));
const OrderDesk = React.lazy(() => import('./pages/Orders/OrderDesk'));
const SettingsPage = React.lazy(() => import('./pages/Settings/SettingsPage'));
const ProfilePage = React.lazy(() => import('./pages/Profile/ProfilePage'));
const CustomersPage = React.lazy(() => import('./pages/Customers/CustomersPage'));
const CustomerRecordsPage = React.lazy(() => import('./pages/Customers/CustomerRecordsPage'));
const CreditCustomersPage = React.lazy(() => import('./pages/Credit/CreditCustomersPage'));
const InstallmentsPage = React.lazy(() => import('./pages/Installments/InstallmentsPage'));
const NotificationsPage = React.lazy(() => import('./pages/Notifications/NotificationsPage'));
const StickyNotes = React.lazy(() => import('./pages/Notes/StickyNotes'));
const TeamManagementPage = React.lazy(() => import('./pages/Admin/TeamManagementPage'));
const SignupRequestsPage = React.lazy(() => import('./pages/Admin/SignupRequestsPage'));
const PurchaseOrdersPage = React.lazy(() => import('./pages/Inventory/PurchaseOrdersPage'));
const AppContent: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { mode } = useSelector((state: RootState) => state.theme);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [apiLoading, setApiLoading] = React.useState(false);
  const theme = React.useMemo(() => getAppTheme(mode), [mode]);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchSettings());
    }
  }, [dispatch, isAuthenticated]);

  useEffect(() => {
    const handleAuthExpired = () => dispatch(logout());
    window.addEventListener('itemhive-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('itemhive-auth-expired', handleAuthExpired);
  }, [dispatch]);

  useEffect(() => subscribeApiLoading(setApiLoading), []);

  return (
    <ThemeProvider theme={theme}>
      {apiLoading && <ModernLoader />}
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
              <Route path="inventory/add" element={<AddProduct />} />
              <Route path="inventory/units" element={<ProductUnitsPage />} />
              <Route path="inventory/purchase-orders" element={<ProtectedRoute allowedRoles={['super_admin', 'admin']}><PurchaseOrdersPage /></ProtectedRoute>} />
              <Route path="inventory/requests" element={<Navigate to="/inventory/purchase-orders" replace />} />
              <Route path="inventory/reduce" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <ReduceStock />
                </ProtectedRoute>
              } />
              <Route path="pos" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'user']}>
                  <POSTerminal />
                </ProtectedRoute>
              } />
              <Route path="orders" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'user']}>
                  <OrderDesk />
                </ProtectedRoute>
              } />
              <Route path="transactions" element={<TransactionHistory />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="todays-collection" element={<TodaysCollectionPage />} />
              <Route path="notes" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'user']}>
                  <StickyNotes />
                </ProtectedRoute>
              } />
              <Route path="customers" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'user']}>
                  <CustomersPage />
                </ProtectedRoute>
              } />
              <Route path="customer-records" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'user']}>
                  <CustomerRecordsPage />
                </ProtectedRoute>
              } />
              <Route path="credits" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'user']}>
                  <CreditCustomersPage />
                </ProtectedRoute>
              } />
              <Route path="installments" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'user']} requireInstallmentAccess>
                  <InstallmentsPage />
                </ProtectedRoute>
              } />
              <Route path="notifications" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'user']}>
                  <NotificationsPage />
                </ProtectedRoute>
              } />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="team" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <TeamManagementPage />
                </ProtectedRoute>
              } />
              <Route path="signup-requests" element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <SignupRequestsPage />
                </ProtectedRoute>
              } />
              <Route path="settings" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'user']}>
                  <SettingsPage />
                </ProtectedRoute>
              } />
              <Route path="profile" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'user']}>
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
