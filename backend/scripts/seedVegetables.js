require('dotenv').config();

const mongoose = require('mongoose');
const Product = require('../dist/models/Product').default;
const Business = require('../dist/models/Business').default;

const urdu = (...codes) => String.fromCodePoint(...codes);

const vegetables = [
    {
        sku: 'VEG-ALOO',
        english: 'Potato',
        romanUrdu: 'Aloo',
        urduName: urdu(0x622, 0x644, 0x648),
        stock: 120,
        minStock: 20,
        purchasePrice: 95,
        salePrice: 120,
    },
    {
        sku: 'VEG-PAYAZ',
        english: 'Onion',
        romanUrdu: 'Payaz',
        urduName: urdu(0x67e, 0x6cc, 0x627, 0x632),
        stock: 110,
        minStock: 20,
        purchasePrice: 80,
        salePrice: 100,
    },
    {
        sku: 'VEG-TAMATAR',
        english: 'Tomato',
        romanUrdu: 'Tamatar',
        urduName: urdu(0x679, 0x645, 0x627, 0x679, 0x631),
        stock: 90,
        minStock: 15,
        purchasePrice: 130,
        salePrice: 160,
    },
    {
        sku: 'VEG-GAJAR',
        english: 'Carrot',
        romanUrdu: 'Gajar',
        urduName: urdu(0x6af, 0x627, 0x62c, 0x631),
        stock: 75,
        minStock: 12,
        purchasePrice: 145,
        salePrice: 180,
    },
    {
        sku: 'VEG-KHEERA',
        english: 'Cucumber',
        romanUrdu: 'Kheera',
        urduName: urdu(0x6a9, 0x6be, 0x6cc, 0x631, 0x627),
        stock: 80,
        minStock: 12,
        purchasePrice: 85,
        salePrice: 110,
    },
    {
        sku: 'VEG-PALAK',
        english: 'Spinach',
        romanUrdu: 'Palak',
        urduName: urdu(0x67e, 0x627, 0x644, 0x6a9),
        stock: 60,
        minStock: 10,
        purchasePrice: 60,
        salePrice: 80,
    },
    {
        sku: 'VEG-PHOOL-GOBI',
        english: 'Cauliflower',
        romanUrdu: 'Phool Gobi',
        urduName: `${urdu(0x67e, 0x6be, 0x648, 0x644)} ${urdu(0x6af, 0x648, 0x628, 0x6be, 0x6cc)}`,
        stock: 55,
        minStock: 10,
        purchasePrice: 110,
        salePrice: 140,
    },
    {
        sku: 'VEG-BAND-GOBI',
        english: 'Cabbage',
        romanUrdu: 'Band Gobi',
        urduName: `${urdu(0x628, 0x646, 0x62f)} ${urdu(0x6af, 0x648, 0x628, 0x6be, 0x6cc)}`,
        stock: 65,
        minStock: 10,
        purchasePrice: 100,
        salePrice: 130,
    },
    {
        sku: 'VEG-HARI-MIRCH',
        english: 'Green Chili',
        romanUrdu: 'Hari Mirch',
        urduName: `${urdu(0x6c1, 0x631, 0x6cc)} ${urdu(0x645, 0x631, 0x686)}`,
        stock: 35,
        minStock: 8,
        purchasePrice: 210,
        salePrice: 260,
    },
    {
        sku: 'VEG-LEHSAN',
        english: 'Garlic',
        romanUrdu: 'Lehsan',
        urduName: urdu(0x644, 0x6c1, 0x633, 0x646),
        stock: 45,
        minStock: 8,
        purchasePrice: 380,
        salePrice: 450,
    },
    {
        sku: 'VEG-ADRAK',
        english: 'Ginger',
        romanUrdu: 'Adrak',
        urduName: urdu(0x627, 0x62f, 0x631, 0x6a9),
        stock: 40,
        minStock: 8,
        purchasePrice: 440,
        salePrice: 520,
    },
    {
        sku: 'VEG-BHINDI',
        english: 'Okra',
        romanUrdu: 'Bhindi',
        urduName: urdu(0x628, 0x6be, 0x646, 0x688, 0x6cc),
        stock: 50,
        minStock: 10,
        purchasePrice: 175,
        salePrice: 220,
    },
    {
        sku: 'VEG-BAINGAN',
        english: 'Eggplant',
        romanUrdu: 'Baingan',
        urduName: urdu(0x628, 0x6cc, 0x646, 0x6af, 0x646),
        stock: 70,
        minStock: 12,
        purchasePrice: 125,
        salePrice: 160,
    },
    {
        sku: 'VEG-MATAR',
        english: 'Peas',
        romanUrdu: 'Matar',
        urduName: urdu(0x645, 0x679, 0x631),
        stock: 45,
        minStock: 8,
        purchasePrice: 195,
        salePrice: 240,
    },
    {
        sku: 'VEG-LAUKI',
        english: 'Bottle Gourd',
        romanUrdu: 'Lauki',
        urduName: urdu(0x644, 0x648, 0x6a9, 0x6cc),
        stock: 65,
        minStock: 10,
        purchasePrice: 100,
        salePrice: 130,
    },
];

const targetBusinessName = process.env.VEGETABLE_SEED_BUSINESS_NAME || 'Owais Shaikh Inventory';

const getImagePath = (sku) =>
    `/product-images/vegetables/${sku.replace('VEG-', '').toLowerCase()}.png`;

const run = async () => {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is required');
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const businesses = await Business.find({ name: targetBusinessName, isActive: true });
    if (!businesses.length) {
        throw new Error(`No active business found with name "${targetBusinessName}"`);
    }

    for (const business of businesses) {
        for (const item of vegetables) {
            const name = `${item.english} (${item.romanUrdu}) / ${item.urduName}`;
            await Product.findOneAndUpdate(
                { businessId: business._id, sku: item.sku },
                {
                    $set: {
                        id: item.sku,
                        sku: item.sku,
                        name,
                        category: 'Groceries',
                        purchasePrice: item.purchasePrice,
                        salePrice: item.salePrice,
                        price: item.salePrice,
                        stock: item.stock,
                        minStock: item.minStock,
                        productUnitCode: 'kg',
                        productUnit: 'Kilogram',
                        productUnitUrdu: urdu(0x6a9, 0x644, 0x648),
                        description: `${item.english} / ${item.urduName} sold by KG for local vegetable shops.`,
                        imageUrl: getImagePath(item.sku),
                        batchNumber: `SABZI-${item.sku.replace('VEG-', '')}`,
                        expiryDate: '',
                        supplier: 'Karachi Sabzi Mandi',
                        businessId: business._id,
                        businessName: business.name,
                        lastUpdated: new Date(),
                    },
                },
                { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
            );
        }

        console.log(`Seeded ${vegetables.length} vegetable products for ${business.name}`);
    }

    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});
