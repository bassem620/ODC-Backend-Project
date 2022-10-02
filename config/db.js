const mongoose = require('mongoose');

const connectDB = async _ => {
    try{
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDb connected: ${conn.connection.host}` .green.underline);
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

module.exports = connectDB;