const express = require('express');
const { GoogleGenAI } = require("@google/genai");
require('dotenv').config();

const app = express();
app.use(express.json());

// 👈 السطر الجديد: السماح للسيرفر بقراءة الملفات من مجلد public
app.use(express.static('public'));

// جيميناي سيتعرف على المفتاح تلقائياً من إعدادات Render
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
        // استبدلنا say بـ play مع صوت مؤقت لمنع انهيار Jambonz بسبب إعدادات Google TTS
        {
            "verb": "play",
            "url": audioUrl
        },
        {
            "verb": "gather",
            "input": ["speech"],
            "actionHook": "/api/respond",
            "timeout": 10,
            // 👈 يجب تحديد ديبجرام هنا لكي يفهم الصوت العربي بشكل صحيح
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
    
    // تعريف ديبجرام الموحد
    const defaultRecognizer = { "vendor": "deepgram", "language": "ar" };

    // حماية ضد الصمت
    if (!speechData || !speechData.alternatives || speechData.alternatives.length === 0) {
        return res.status(200).json([
            { "verb": "play", "url": "htts-output.mp3" },
            { "verb": "gather", "input": ["speech"], "actionHook": "/api/respond", "timeout": 5, "recognizer": defaultRecognizer }
        ]);
    }

    const customerText = speechData.alternatives[0].transcript;
    console.log("🗣️ Customer said:", customerText);

    try {
        // 1. العقل (جيميناي يكتب الرد)
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
        
        // 👈 تم تعديل الموديل هنا إلى الموديل الصحيح المدعوم حالياً
        const response = await ai.models.generateContent({
            model:'gemini-1.5-flash',
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
                voice: "87f4c7b0-d9b5-45aa-8c6c-9e2ccf941912", // 👈 الـ ID للصوت الخاص بك
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
                "verb": "play", // نستخدم play بدلاً من say
                "url": audioUrl
            },
            {
                "verb": "gather",
                "input": ["speech"],
                "actionHook": "/api/respond",
                "timeout": 5,
                "recognizer": defaultRecognizer // 👈 أضفناها هنا أيضاً
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
