import axios from 'axios';

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
        return Promise.reject(error);
    }
);

// Response interceptor for handling errors (like 401 Unauthorized)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            window.dispatchEvent(new Event('itemhive-auth-expired'));
        }
        return Promise.reject(error);
    }
);

export default api;
