const express = require('express');
const { createClient } = require('redis');
require('dotenv').config();

const app = express();
app.use(express.json());

const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

async function connectRedis() {
    try {
        await redisClient.connect();
        console.log('Connected to Redis!');
    } catch (err) {
        console.error('Could not connect to Redis', err);
    }
}
connectRedis();

app.get('/', (req, res) => {
    res.send('🚀 Server is Live!');
});

app.post('/api/incoming', async (req, res) => {
    console.log("📞 Received a call from Jambonz!");
    
    const jambonzResponse = [
        {
            "verb": "say",
            "text": "Hello! The connection is successful.",
            "language": "en-US"
        }
    ];
    
    res.status(200).json(jambonzResponse);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
