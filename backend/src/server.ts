import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import connectDB from './config/db';
import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import transactionRoutes from './routes/transactionRoutes';
import reportRoutes from './routes/reportRoutes';
import creditRoutes from './routes/creditRoutes';
import installmentRoutes from './routes/installmentRoutes';
import settingsRoutes from './routes/settingsRoutes';
import userRoutes from './routes/userRoutes';
import inventoryRequestRoutes from './routes/inventoryRequestRoutes';
import notesRoutes from './routes/notesRoutes';
import signupRequestRoutes from './routes/signupRequestRoutes';
import customerRoutes from './routes/customerRoutes';
import { errorHandler, notFound } from './middleware/errorHandler';
import { ensureTenantIndexes } from './utils/tenantIndexes';

// Environmental variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const deploymentCommit = process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'local';

const configuredOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [];

const defaultAllowedOrigins = [
    // 'https://itemhiveinventorysystem.netlify.app',
    'http://owaisinventorysystem.netlify.app',
    'http://localhost:5173'
];

const allowedOrigins = Array.from(new Set([...configuredOrigins, ...defaultAllowedOrigins]));
console.log('📦 CORS allowed origins:', allowedOrigins);

const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const privateNetworkRegex = /^https?:\/\/((10(\.\d{1,3}){3})|(172\.(1[6-9]|2\d|3[0-1])(\.\d{1,3}){2})|(192\.168(\.\d{1,3}){2}))(:\d+)?$/i;

const corsOptions: cors.CorsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) {
            return callback(null, true);
        }

        const isAllowedOrigin = allowedOrigins.includes(origin);
        const isLocalDevOrigin = localhostRegex.test(origin);
        const isPrivateNetworkOrigin = process.env.NODE_ENV !== 'production' && privateNetworkRegex.test(origin);

        if (isAllowedOrigin || isLocalDevOrigin || isPrivateNetworkOrigin) {
            return callback(null, true);
        }

        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-itemhive-workspace-id'],
    optionsSuccessStatus: 204
};

// ── Security & Parsing Middleware ────────────────────────────
app.use(helmet());
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static Files ─────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Root & Health Routes ─────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
    res.json({
        status: 'success',
        message: 'ItemHive Pro API is online 🚀',
        version: '1.0.0',
        commit: deploymentCommit,
        environment: process.env.NODE_ENV || 'development',
        endpoints: ['/api/auth', '/api/products', '/api/transactions', '/api/reports', '/api/customers', '/api/credits', '/api/users', '/api/signup-requests']
    });
});

app.get('/health', (_req: Request, res: Response) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    res.status(200).json({
        status: 'healthy',
        database: dbStatus,
        commit: deploymentCommit,
        timestamp: new Date().toISOString()
    });
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/credit', creditRoutes);
app.use('/api/installments', installmentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/inventory-requests', inventoryRequestRoutes);
app.use('/api/signup-requests', signupRequestRoutes);
app.use('/api/notes', notesRoutes);

// ── 404 & Error Handling ──────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Database + Server Boot ────────────────────────────────────
const startServer = async () => {
    try {
        await connectDB();
        await ensureTenantIndexes();
    } catch (error) {
        console.error('❌ Server database init failed:', error);
    }

    // Always start the server so Render health checks pass
    app.listen(PORT as number, '0.0.0.0', () => {
        console.log(`🚀 ItemHive Server running on port ${PORT}`);
        console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
};

startServer();
