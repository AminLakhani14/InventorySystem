import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import type { UserRole } from '../../features/auth/authSlice';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: UserRole[];
    requireInstallmentAccess?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles, requireInstallmentAccess }) => {
    const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
    const { app } = useSelector((state: RootState) => state.settings);
    const location = useLocation();

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    if (requireInstallmentAccess && user?.role !== 'super_admin' && (!app?.installmentsEnabled || !user?.installmentAccess)) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
