require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('Missing MONGODB_URI in backend/.env');
    process.exit(1);
}

mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 }).then(() => {
    console.log("Connected using SRV URI!");
    process.exit(0);
}).catch(err => {
    console.error("Failed SRV URI:", err.message);
    process.exit(1);
});
