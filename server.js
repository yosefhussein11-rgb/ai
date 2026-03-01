app.post('/api/incoming', async (req, res) => {
    const jambonzResponse = [
        // رسالة الترحيب الأولى
        {
            "verb": "say",
            "text": "أهلاً بك، كيف يمكنني مساعدتك؟",
            "synthesizer": {
                "vendor": "google", // 👈 استبدله بـ aws أو azure إذا كنت تستخدم غير جوجل في Jambonz
                "language": "ar-SA"
            }
        },
        {
            "verb": "gather",
            "input": ["speech"],
            "actionHook": "/api/respond",
            "timeout": 5,
            "recognizer": {
                "vendor": "google", // 👈 ضروري جداً لكي يفهم الكلام العربي
                "language": "ar-SA"
            }
        }
    ];
    res.status(200).json(jambonzResponse);
});

app.post('/api/respond', async (req, res) => {
    const speechData = req.body.speech;
    
    // حماية ضد الصمت
    if (!speechData || !speechData.alternatives || speechData.alternatives.length === 0) {
        return res.status(200).json([
            { 
                "verb": "say", 
                "text": "عذراً لم أسمعك.", 
                "synthesizer": { "vendor": "google", "language": "ar-SA" } 
            },
            { 
                "verb": "gather", 
                "input": ["speech"], 
                "actionHook": "/api/respond", 
                "timeout": 5,
                "recognizer": { "vendor": "google", "language": "ar-SA" }
            }
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
                voice: "87f4c7b0-d9b5-45aa-8c6c-9e2ccf941912", 
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
        const audioId = Date.now().toString(); 
        
        audioStore.set(audioId, audioBuffer); 
        
        setTimeout(() => audioStore.delete(audioId), 120000);

        const host = req.get('host');
        const protocol = req.headers['x-forwarded-proto'] || req.protocol; 
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
                "timeout": 5,
                "recognizer": { "vendor": "google", "language": "ar-SA" }
            }
        ];
        res.status(200).json(jambonzResponse);

    } catch (error) {
        console.error("❌ System Error:", error);
        res.status(200).json([{ 
            "verb": "say", 
            "text": "معذرة، هناك عطل فني حالياً.", 
            "synthesizer": { "vendor": "google", "language": "ar-SA" }
        }]);
    }
});
