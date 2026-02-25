require('dotenv').config();
const express = require('express');
const { createClient } = require('redis');

const app = express();
app.use(express.json());

// إعداد الاتصال بقاعدة بيانات Redis لحفظ جلسات المكالمات
const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().then(() => console.log('Connected to Redis!')).catch(console.error);

// مسار فحص صحة السيرفر
app.get('/', (req, res) => {
    res.send('🚀 Voice AI Server is running and ready for Jambonz!');
});

// المسار الرئيسي: استقبال الرنة الأولى من Jambonz
app.post('/api/incoming', async (req, res) => {
    try {
        const payload = req.body;
        console.log(`📞 Incoming call from: ${payload.from} to: ${payload.to}`);
        const callSid = payload.call_sid;

        // حفظ بيانات المكالمة في Redis مؤقتاً (لمدة ساعة)
        await redisClient.setEx(`call:${callSid}`, 3600, JSON.stringify({
            caller: payload.from,
            status: 'ringing'
        }));

        // الرد على Jambonz بالتعليمات (Verbs)
        const jambonzResponse = [
            {
                "verb": "play",
                // مؤقتاً سنستخدم نص مقروء من جوجل للتجربة قبل ربط Nabrah AI
                "text": "أهلاً بك في نظام الطلبات الذكي. كيف يمكنني مساعدتك اليوم؟",
                "synthesizer": {
                    "vendor": "google",
                    "language": "ar-SA"
                }
            },
            {
                "verb": "gather",
                "input": ["speech"],
                "actionHook": "/api/speech-result", // أين يرسل كلام العميل بعد أن ينتهي
                "timeout": 5
            }
        ];

        res.status(200).json(jambonzResponse);
    } catch (error) {
        console.error('Error handling incoming call:', error);
        res.status(500).send('Internal Server Error');
    }
});

// المسار الثاني: استلام كلام العميل بعد تحويله لنص (STT)
app.post('/api/speech-result', (req, res) => {
    const transcript = req.body.speech?.alternatives[0]?.transcript || "لم أسمع شيئاً";
    console.log(`🗣️ Customer said: ${transcript}`);
    
    // هنا سنقوم لاحقاً بربط النص بـ ChatGPT للرد عليه
    res.status(200).json([
        {
            "verb": "say",
            "text": "سمعتك بوضوح. جاري معالجة الطلب في الخلفية.",
            "synthesizer": { "vendor": "google", "language": "ar-SA" }
        },
        { "verb": "hangup" }
    ]);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
