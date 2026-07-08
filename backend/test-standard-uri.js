
const mongoose = require('mongoose');
const uri = "mongodb://ghufranali510_db_user:mTjR39..weMNgSq@ac-yzgdlas-shard-00-00.ds4hup5.mongodb.net:27017,ac-yzgdlas-shard-00-01.ds4hup5.mongodb.net:27017,ac-yzgdlas-shard-00-02.ds4hup5.mongodb.net:27017/?ssl=true&replicaSet=atlas-yzgdlas-shard-0&authSource=admin&appName=ItemHive";

console.log("Attempting to connect with standard URI...");

mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
    .then(() => {
        console.log("Successfully connected with standard URI!");
        process.exit(0);
    })
    .catch(err => {
        console.error("Connection failed:", err.message);
        process.exit(1);
    });
