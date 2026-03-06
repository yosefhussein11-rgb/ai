const express = require('express');
const { GoogleGenAI } = require("@google/genai");
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// السماح للسيرفر بقراءة الملفات من مجلد public
app.use(express.static('public'));

// مسار إضافي للطوارئ: في حال نسيان الملف خارج مجلد public
app.get('/tts-output.mp3', (req, res) => {
    res.sendFile(path.join(__dirname, 'tts-output.mp3'));
});

// جيميناي
const ai = new GoogleGenAI({});

// ذاكرة الصوت المؤقتة
const audioStore = new Map();

app.get('/', (req, res) => res.send('🚀 AI Voice Server with Nabrah is Live!'));

// مسار سحب الصوت لنبرة
app.get('/api/audio/:id', (req, res) => {
    const id = req.params.id;
    if (audioStore.has(id)) {
        const audioBuffer = audioStore.get(id);
        res.set('Content-Type', 'audio/mpeg');
        res.send(audioBuffer);
    } else {
        res.status(404).send('Audio not found');
    }
});

app.post('/api/incoming', async (req, res) => {
    // 👈 هنا قمنا بإصلاح الخطأ: تعريف الرابط الخاص بملف الترحيب الخاص بك
    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol; 
    const welcomeAudioUrl = `${protocol}://${host}/tts-output.mp3`;

    const jambonzResponse = [
        {
            "verb": "play",
            "url": welcomeAudioUrl // 👈 الآن المتغير معرف ويعمل بشكل سليم
        },
        {
            "verb": "gather",
            "input": ["speech"],
            "actionHook": "/api/respond",
            "timeout": 10,
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
    const defaultRecognizer = { "vendor": "deepgram", "language": "ar" };

    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol; 
    const welcomeAudioUrl = `${protocol}://${host}/tts-output.mp3`;

    // حماية ضد الصمت (تم إصلاح الخطأ الإملائي هنا)
    if (!speechData || !speechData.alternatives || speechData.alternatives.length === 0) {
        return res.status(200).json([
            { "verb": "play", "url": welcomeAudioUrl },
            { "verb": "gather", "input": ["speech"], "actionHook": "/api/respond", "timeout": 5, "recognizer": defaultRecognizer }
        ]);
    }

    const customerText = speechData.alternatives[0].transcript;
    console.log("🗣️ Customer said:", customerText);

    try {
        const prompt = `أنت موظف كاشير واستقبال سعودي ذكي ولطيف في مطعم اسمه "شاورما المعلم".

قائمة الطعام (المنيو) والأسعار:
- شاورما دجاج (عادي): 10 ريال
- شاورما لحم (عادي): 12 ريال
- وجبة شاورما عربي: 25 ريال
- بطاطس مقلي: 5 ريال
- مشروب غازي (بيبسي/سفن): 4 ريال

تعليماتك الصارمة (يجب الالتزام بها حرفياً):
1. الرد القصير: يجب أن يكون ردك مختصراً جداً جداً (لا تزيد عن 15 إلى 20 كلمة) لأن هذه مكالمة هاتفية، والناس لا تحب الانتظار.
2. اللهجة: تحدث بلهجة سعودية بيضاء محترمة ومرحبة (استخدم كلمات مثل: سم، أبشر، طال عمرك، حياك الله).
3. الالتزام بالمنيو: إذا طلب العميل شيئاً غير موجود في القائمة، اعتذر منه بلطف وأخبره بأبرز ما لدينا.
4. تأكيد الطلب: عندما يختار العميل، أكد له الطلب واحسب له السعر الإجمالي بشكل سريع.

العميل يقول لك الآن: "${customerText}"
بناءً على التعليمات، ماذا ستقول له؟`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', // ✅ الموديل الجديد والصحيح
            contents: prompt,
        });
        const aiTextResponse = response.text;
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

        if (!nabrahResponse.ok) {
            throw new Error(`Nabrah API Error: ${nabrahResponse.status}`);
        }

        const arrayBuffer = await nabrahResponse.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuffer);
        const audioId = Date.now().toString(); 
        
        audioStore.set(audioId, audioBuffer); 
        setTimeout(() => audioStore.delete(audioId), 120000);

        const audioUrl = `${protocol}://${host}/api/audio/${audioId}`;

        console.log("🔊 Audio generated, sending to Jambonz...");

        const jambonzResponse = [
            {
                "verb": "play",
                "url": audioUrl
            },
            {
                "verb": "gather",
                "input": ["speech"],
                "actionHook": "/api/respond",
                "timeout": 5,
                "recognizer": defaultRecognizer 
            }
        ];
        res.status(200).json(jambonzResponse);

    } catch (error) {
        console.error("❌ System Error:", error);
        res.status(200).json([
            { "verb": "play", "url": "https://cdn.pixabay.com/audio/2022/03/10/audio_c3e382f763.mp3" },
            { "verb": "gather", "input": ["speech"], "actionHook": "/api/respond", "timeout": 5, "recognizer": defaultRecognizer }
        ]);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
