import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import Product from './models/Product';
import User from './models/User';
import connectDB from './config/db';
import { ensureLegacyBusiness } from './utils/tenancy';

dotenv.config();

const seedData = async () => {
    try {
        await connectDB();

        // Clear existing data
        await Product.deleteMany({});
        await User.deleteMany({});
        const legacyBusiness = await ensureLegacyBusiness();

        // Seed Super Admin User
        const admin = new User({
            name: 'Super Admin',
            email: 'admin@itemhive.com',
            password: 'admin123', // Will be hashed by pre-save hook
            role: 'super_admin',
            businessId: legacyBusiness._id,
        });
        await admin.save();

        // Read the CSV from the frontend directory (adjust path as needed)
        // For simplicity, I'll use a local copy or if I can read the one in tableau_stock.csv
        const csvPath = path.join(__dirname, '../../tableau_stock.csv');

        if (fs.existsSync(csvPath)) {
            const csvData = fs.readFileSync(csvPath, 'utf8');
            const lines = csvData.split('\n').map(l => l.trim()).filter(Boolean);

            const productsToSeed = lines.slice(1).map((line, index) => {
                const [article = '', qty = '', price = '', date = ''] = line.split(',').map(item => item.trim());

                const normalizeNumber = (val: string) => {
                    const numeric = val.replace(/[^\d.]/g, '');
                    return parseFloat(numeric) || 0;
                };

                const slugToSku = (name: string) => {
                    return name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 18);
                };

                return {
                    id: `${index + 1}`,
                    sku: slugToSku(article) || `SKU-${index + 1}`,
                    name: article,
                    category: 'Snacks & Candy', // Default category
                    purchasePrice: normalizeNumber(price),
                    salePrice: normalizeNumber(price),
                    price: normalizeNumber(price),
                    stock: normalizeNumber(qty),
                    minStock: 5,
                    description: `Imported on ${date}`,
                    batchNumber: `B-${1000 + index}`,
                    expiryDate: '2026-12-31',
                    supplier: 'Global Trade Co.',
                    businessId: legacyBusiness._id,
                };
            });

            await Product.insertMany(productsToSeed);
            console.log(`✅ Seeded ${productsToSeed.length} products from CSV`);
        } else {
            console.warn('⚠️ tableau_stock.csv not found at', csvPath);
        }

        console.log('✨ Database seeding completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

seedData();
