const express = require('express');
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

// ذاكرة الصوت المؤقتة
const audioStore = new Map();

app.get('/', (req, res) => res.send('🚀 AI Voice Server with OpenRouter & Nabrah is Live!'));

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
    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol; 
    const welcomeAudioUrl = `${protocol}://${host}/tts-output.mp3`;

    const jambonzResponse = [
        {
            "verb": "play",
            "url": welcomeAudioUrl
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

    // حماية ضد الصمت
    if (!speechData || !speechData.alternatives || speechData.alternatives.length === 0) {
        return res.status(200).json([
            { "verb": "play", "url": welcomeAudioUrl },
            { "verb": "gather", "input": ["speech"], "actionHook": "/api/respond", "timeout": 5, "recognizer": defaultRecognizer }
        ]);
    }

    const customerText = speechData.alternatives[0].transcript;
    console.log("🗣️ Customer said:", customerText);

    try {
        const systemPrompt = `أنت موظف كاشير واستقبال سعودي ذكي ولطيف في مطعم اسمه "شاورما المعلم".

قائمة الطعام (المنيو) والأسعار:
- شاورما دجاج (عادي): 10 ريال
- شاورما لحم (عادي): 12 ريال
- وجبة شاورما عربي: 25 ريال
- بطاطس مقلي: 5 ريال
- مشروب غازي (بيبسي/سفن): 4 ريال

تعليماتك الصارمة:
1. الرد القصير: يجب أن يكون ردك مختصراً جداً (لا تزيد عن 15 إلى 20 كلمة) لأن هذه مكالمة هاتفية.
2. اللهجة: تحدث بلهجة سعودية محترمة (استخدم: سم، أبشر، طال عمرك).
3. الالتزام بالمنيو: إذا طلب العميل شيئاً غير موجود، اعتذر بلطف.
4. تأكيد الطلب: أكد الطلب واحسب السعر الإجمالي بشكل سريع.`;
        
        // 1. العقل (استخدام OpenRouter بدلاً من جيميناي)
        const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "meta-llama/llama-3.2-3b-instruct:free",
                "messages": [
                    { "role": "system", "content": systemPrompt },
                    { "role": "user", "content": customerText }
                ]
            })
        });

        if (!openRouterResponse.ok) {
            throw new Error(`OpenRouter API Error: ${openRouterResponse.status}`);
        }

        const openRouterData = await openRouterResponse.json();
        const aiTextResponse = openRouterData.choices[0].message.content;
        console.log("🧠 AI Text (Meta LLaMA):", aiTextResponse);

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
                voice: "87f4c7b0-d9b5-45aa-8c6c-9e2ccf941912",
                response_format: "mp3",
                speed: 1.0
            })
        });

        if (!nabrahResponse.ok) {
            throw new Error(`Nabrah API Error: ${nabrahResponse.status}`);
        }

        // 3. محطة الإذاعة (تجهيز الصوت)
        const arrayBuffer = await nabrahResponse.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuffer);
        const audioId = Date.now().toString(); 
        
        audioStore.set(audioId, audioBuffer); 
        setTimeout(() => audioStore.delete(audioId), 120000);

        const audioUrl = `${protocol}://${host}/api/audio/${audioId}`;
        console.log("🔊 Audio generated, sending to Jambonz...");

        // 4. إرسال الرابط لـ Jambonz
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
