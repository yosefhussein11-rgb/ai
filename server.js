const express = require('express');
const { GoogleGenAI } = require("@google/genai"); // المكتبة الجديدة بناءً على رابط جوجل
require('dotenv').config();

const app = express();
app.use(express.json());

// الإعداد بالطريقة الصحيحة والجديدة (سيقوم تلقائياً بقراءة GEMINI_API_KEY من Render)
const ai = new GoogleGenAI({});

app.get('/', (req, res) => res.send('🚀 AI Voice Server is Live (Free Gemini Flash)!'));

app.post('/api/incoming', async (req, res) => {
    const jambonzResponse = [
        {
            "verb": "say",
            "text": "أهلاً بك في مطعمنا، كيف يمكنني مساعدتك اليوم؟",
            "language": "ar-SA"
        },
        {
            "verb": "gather",
            "input": ["speech"],
            "actionHook": "/api/respond",
            "timeout": 5
        }
    ];
    res.status(200).json(jambonzResponse);
});

app.post('/api/respond', async (req, res) => {
    const speechData = req.body.speech;
    
    // حماية ضد الصمت (إذا لم يقل العميل شيئاً)
    if (!speechData || !speechData.alternatives || speechData.alternatives.length === 0) {
        return res.status(200).json([
            { "verb": "say", "text": "عذراً، لم أسمعك جيداً. هل يمكنك إعادة ما قلت؟", "language": "ar-SA" },
            { "verb": "gather", "input": ["speech"], "actionHook": "/api/respond", "timeout": 5 }
        ]);
    }

    const customerText = speechData.alternatives[0].transcript;
    console.log("🗣️ Customer said:", customerText);

    try {
        const prompt = `أنت موظف استقبال في مطعم سعودي. رد باختصار شديد جداً (لا يزيد عن 15 كلمة) وبلطافة على كلام العميل التالي: "${customerText}"`;
        
        // استخدام النموذج المجاني (Flash) بالطريقة المكتوبة في موقع Google Quickstart
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: prompt,
        });
        
        const aiResponse = response.text;
        console.log("🧠 AI Responded:", aiResponse);

        const jambonzResponse = [
            {
                "verb": "say",
                "text": aiResponse,
                "language": "ar-SA"
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
        console.error("❌ Gemini Error:", error);
        res.status(200).json([{ "verb": "say", "text": "معذرة، هناك ضغط على النظام حالياً.", "language": "ar-SA" }]);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
