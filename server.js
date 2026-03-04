const express = require('express');
const { GoogleGenAI } = require("@google/genai");
require('dotenv').config();

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({});

// "محطة الإذاعة": ذاكرة مؤقتة لحفظ الملفات الصوتية القادمة من نبرة
const audioStore = new Map();

app.get('/', (req, res) => res.send('🚀 AI Voice Server with Nabrah is Live!'));

// مسار (رابط) مخصص لـ Jambonz لكي يسحب منه الملف الصوتي
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
    const jambonzResponse = [
        // استخدام play بدلاً من say لتجنب مشاكل Google و Deepgram تماماً!
        {
            "verb": "play",
            "url": "https://cdn.pixabay.com/audio/2024/08/21/audio_f8edbfa61f.mp3" // هذا رابط صوت تجريبي (رنة قصيرة)، يمكنك تغييره لاحقاً برابط لرسالة مسجلة
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
    
    // حماية ضد الصمت (تمت إزالة خاصية language)
    if (!speechData || !speechData.alternatives || speechData.alternatives.length === 0) {
        return res.status(200).json([
            { "verb": "say", "text": "عذراً لم أسمعك." },
            { "verb": "gather", "input": ["speech"], "actionHook": "/api/respond", "timeout": 5 }
        ]);
    }

    const customerText = speechData.alternatives[0].transcript;
    console.log("🗣️ Customer said:", customerText);

    try {
        // 1. العقل (جيميناي يكتب الرد)
        const prompt = `أنت موظف استقبال في مطعم سعودي. رد باختصار شديد (لا يزيد عن 15 كلمة) وبلطافة على: "${customerText}"`;
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: prompt,
        });
        const aiTextResponse = response.text;
        console.log("🧠 AI Text:", aiTextResponse);

        // 2. الحنجرة (إرسال النص إلى منصة نبرة)
        const nabrahResponse = await fetch('https://api.nabrah.ai/api/ext/tts/generations', {
            method: 'POST',
            headers: {
                'X-API-Key': process.env.NABRAH_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "nabrah-tts",
                input: aiTextResponse,
                voice: "87f4c7b0-d9b5-45aa-8c6c-9e2ccf941912", // 👈 ضع الـ ID للصوت الذي تريده هنا
                response_format: "mp3",
                speed: 1.0
            })
        });

        if (!nabrahResponse.ok) {
            throw new Error(`Nabrah API Error: ${nabrahResponse.status}`);
        }

        // 3. محطة الإذاعة (تحويل الصوت وتجهيز الرابط لـ Jambonz)
        const arrayBuffer = await nabrahResponse.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuffer);
        const audioId = Date.now().toString(); // إنشاء رقم سري للملف
        
        audioStore.set(audioId, audioBuffer); // حفظ الملف في الذاكرة
        
        // مسح الملف من الذاكرة بعد دقيقتين لمنع امتلاء مساحة السيرفر
        setTimeout(() => audioStore.delete(audioId), 120000);

        // إنشاء الرابط الذي سيزوره Jambonz
        const host = req.get('host');
        const protocol = req.headers['x-forwarded-proto'] || req.protocol; // لمعرفة هل الرابط http أو https
        const audioUrl = `${protocol}://${host}/api/audio/${audioId}`;

        console.log("🔊 Audio generated, sending to Jambonz...");

        // 4. إرسال الرابط لـ Jambonz ليتحدث بصوت نبرة
        const jambonzResponse = [
            {
                "verb": "play", 
                "url": audioUrl
            },
            {
                "verb": "gather",
                "input": ["speech"],
                "actionHook": "/api/respond",
                "timeout": 5
            }
        ];
        res.status(200).json(jambonzResponse);

    } catch (error) {
        console.error("❌ System Error:", error);
        // تمت إزالة خاصية language من رسالة الخطأ
        res.status(200).json([{ "verb": "say", "text": "معذرة، هناك عطل فني حالياً." }]);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
