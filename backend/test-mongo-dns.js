require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('Missing MONGODB_URI in backend/.env');
    process.exit(1);
}

mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 }).then(() => {
    console.log("Connected using regular URI and Google DNS!");
    process.exit(0);
}).catch(err => {
    console.error("Failed regular URI with Google DNS:", err.message);
    process.exit(1);
});
