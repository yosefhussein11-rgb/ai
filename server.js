const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// السماح للسيرفر بقراءة الملفات من مجلد public
app.use(express.static('public'));

app.get('/tts-output.mp3', (req, res) => {
    res.sendFile(path.join(__dirname, 'tts-output.mp3'));
});

// ذاكرة الصوت المؤقتة
const audioStore = new Map();

app.get('/', (req, res) => res.send('🚀 AI Voice Server with OpenRouter (Brain) & Groq Canopy Labs (Voice) is Live!'));

// مسار سحب الصوت 
app.get('/api/audio/:id', (req, res) => {
    const id = req.params.id;
    if (audioStore.has(id)) {
        const audioBuffer = audioStore.get(id);
        // التعديل الأول: تغيير نوع الملف إلى wav
        res.set('Content-Type', 'audio/wav');
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
        // تم تقصير الأوامر هنا لتسريع رد الذكاء الاصطناعي
        const systemPrompt = `أنت موظف كاشير سعودي لطيف وسريع في مطعم "شاورما المعلم".
المنيو: شاورما دجاج (10 ريال)، لحم (12 ريال)، عربي (25 ريال)، بطاطس (5 ريال)، مشروب (4 ريال).
تعليمات صارمة:
1. الرد قصير جداً ومباشر (أقصى حد 15 كلمة).
2. استخدم لهجة سعودية (سم، أبشر، طال عمرك).
3. أكد الطلب واحسب السعر الإجمالي بسرعة.`;
        
        // 1. العقل (استخدام OpenRouter مع نموذج GPT-4o-mini)
        const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "openai/gpt-4o-mini",
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
        console.log("🧠 AI Text (GPT-4o-mini):", aiTextResponse);

        // 2. الحنجرة ⭐ (إرسال النص إلى منصة Groq - Canopy Labs Orpheus) ⭐
        const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "canopylabs/orpheus-arabic-saudi",
                input: aiTextResponse,
                voice: "fahad", // الأصوات المتاحة: fahad, sultan, lulwa, noura
                // التعديل الثاني: تغيير الصيغة المطلوبة إلى wav
                response_format: "wav" 
            })
        });

        if (!groqResponse.ok) {
            const errorDetails = await groqResponse.text();
            console.error("🔴 تفاصيل خطأ Groq:", errorDetails);
            throw new Error(`Groq API Error: ${groqResponse.status} - ${errorDetails}`);
        }

        // 3. محطة الإذاعة (تجهيز الصوت من Groq)
        const arrayBuffer = await groqResponse.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuffer);
        const audioId = Date.now().toString(); 
        
        audioStore.set(audioId, audioBuffer); 
        setTimeout(() => audioStore.delete(audioId), 120000);

        const audioUrl = `${protocol}://${host}/api/audio/${audioId}`;
        console.log("🔊 Groq Audio generated, sending to Jambonz...");

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
        console.error("❌ System Error:", error.message);
        res.status(200).json([
            // رسالة خطأ لطيفة بدلاً من الموسيقى
            { "verb": "say", "text": "المعذرة طال عمرك، صار فيه عطل بسيط بالسيستم، ممكن تعيد طلبك؟", "language": "ar-SA" },
            { "verb": "gather", "input": ["speech"], "actionHook": "/api/respond", "timeout": 5, "recognizer": defaultRecognizer }
        ]);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
