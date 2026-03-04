const express = require('express');
// تم تصحيح اسم الفئة المستدعاة هنا 👇
const { GoogleGenerativeAI } = require("@google/generative-ai"); 
require('dotenv').config();

const app = express();
app.use(express.json());

// تأكد من إضافة GEMINI_API_KEY في إعدادات Render (Environment Variables)
// تم تصحيح اسم الفئة هنا أيضاً 👇
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const audioStore = new Map();

app.get('/', (req, res) => res.send('🚀 AI Voice Server with Nabrah is Live!'));

app.get('/api/audio/:id', (req, res) => {
    const id = req.params.id;
    if (audioStore.has(id)) {
        res.set('Content-Type', 'audio/mpeg');
        res.send(audioStore.get(id));
    } else {
        res.status(404).send('Audio not found');
    }
});

app.post('/api/incoming', async (req, res) => {
    const jambonzResponse = [
        {
            "verb": "play",
            "url": "https://upload.wikimedia.org/wikipedia/commons/4/41/Bicycle_bell.mp3" 
        },
        {
            "verb": "gather",
            "input": ["speech"],
            "actionHook": "/api/respond",
            "timeout": 5,
            "recognizer": {
                "vendor": "deepgram",
                "language": "ar"
            }
        }
    ];
    res.status(200).json(jambonzResponse);
});

app.post('/api/respond', async (req, res) => {
    const speechData = req.body.speech;
    
    // إعداد الـ Recognizer الافتراضي لاستخدامه في كل الردود لمنع خطأ Google
    const defaultRecognizer = { "vendor": "deepgram", "language": "ar" };

    if (!speechData || !speechData.alternatives || speechData.alternatives.length === 0) {
        return res.status(200).json([
            { "verb": "play", "url": "https://cdn.pixabay.com/audio/2022/03/15/audio_783ca1e754.mp3" }, // صوت تنبيه بدلاً من say
            { "verb": "gather", "input": ["speech"], "actionHook": "/api/respond", "timeout": 5, "recognizer": defaultRecognizer }
        ]);
    }

    const customerText = speechData.alternatives[0].transcript;
    console.log("🗣️ Customer said:", customerText);

    try {
        const prompt = `أنت موظف استقبال في مطعم سعودي. رد باختصار شديد جداً وبلطافة على: "${customerText}"`;
        const result = await aiModel.generateContent(prompt);
        const aiTextResponse = result.response.text();
        console.log("🧠 AI Text:", aiTextResponse);

        const nabrahResponse = await fetch('https://api.nabrah.ai/api/ext/tts/generations', {
            method: 'POST',
            headers: {
                'X-API-Key': process.env.NABRAH_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "nabrah-tts",
                input: aiTextResponse,
                voice: "87f4c7b0-d9b5-45aa-8c6c-9e2ccf941912",
                response_format: "mp3",
                speed: 1.0
            })
        });

        if (!nabrahResponse.ok) throw new Error(`Nabrah Error: ${nabrahResponse.status}`);

        const audioBuffer = Buffer.from(await nabrahResponse.arrayBuffer());
        const audioId = Date.now().toString();
        audioStore.set(audioId, audioBuffer);
        
        // حذف الملف الصوتي من الذاكرة بعد دقيقتين لمنع تسرب الذاكرة (Memory Leak)
        setTimeout(() => audioStore.delete(audioId), 120000);

        const host = req.get('host');
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const audioUrl = `${protocol}://${host}/api/audio/${audioId}`;

        res.status(200).json([
            { "verb": "play", "url": audioUrl },
            { "verb": "gather", "input": ["speech"], "actionHook": "/api/respond", "timeout": 5, "recognizer": defaultRecognizer }
        ]);

    } catch (error) {
        console.error("❌ System Error:", error);
        res.status(200).json([{ "verb": "play", "url": "https://cdn.pixabay.com/audio/2022/03/10/audio_c3e382f763.mp3" }]); 
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
