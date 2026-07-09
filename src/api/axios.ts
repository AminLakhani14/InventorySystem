import axios from 'axios';

type ApiLoadingListener = (loading: boolean) => void;

let pendingApiRequests = 0;
const apiLoadingListeners = new Set<ApiLoadingListener>();

const notifyApiLoadingListeners = () => {
    const loading = pendingApiRequests > 0;
    apiLoadingListeners.forEach((listener) => listener(loading));
};

const startApiLoading = () => {
    pendingApiRequests += 1;
    notifyApiLoadingListeners();
};

const stopApiLoading = () => {
    pendingApiRequests = Math.max(0, pendingApiRequests - 1);
    notifyApiLoadingListeners();
};

export const subscribeApiLoading = (listener: ApiLoadingListener) => {
    apiLoadingListeners.add(listener);
    listener(pendingApiRequests > 0);

    return () => {
        apiLoadingListeners.delete(listener);
    };
};

const defaultApiUrl = import.meta.env.DEV
    ? 'http://localhost:5050/api'
    : 'https://itemhive-8552.onrender.com/api';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || defaultApiUrl,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor for adding the bearer token
api.interceptors.request.use(
    (config) => {
        startApiLoading();
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        const selectedWorkspaceId = localStorage.getItem('itemhive-workspace-id');
        if (selectedWorkspaceId) {
            config.headers['x-itemhive-workspace-id'] = selectedWorkspaceId;
        }
        return config;
    },
    (error) => {
        stopApiLoading();
        return Promise.reject(error);
    }
);

// Response interceptor for handling errors (like 401 Unauthorized)
api.interceptors.response.use(
    (response) => {
        stopApiLoading();
        return response;
    },
    (error) => {
        stopApiLoading();
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            window.dispatchEvent(new Event('itemhive-auth-expired'));
        }
        return Promise.reject(error);
    }
);

export default api;
