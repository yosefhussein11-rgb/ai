const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai"); // المكتبة القياسية والمستقرة
require('dotenv').config();

const app = express();
app.use(express.json());

// إعداد Gemini - الترقية لنسخة Pro
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // تم التغيير لنموذج Pro

app.get('/', (req, res) => res.send('🚀 AI Voice Server is Live (Pro Version)!'));

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
    // 1. حماية النظام: التحقق مما إذا كان العميل قد تحدث فعلاً أم كان صامتاً
    const speechData = req.body.speech;
    if (!speechData || !speechData.alternatives || speechData.alternatives.length === 0) {
        return res.status(200).json([
            { "verb": "say", "text": "عذراً، لم أسمعك جيداً. هل يمكنك إعادة ما قلت؟", "language": "ar-SA" },
            { "verb": "gather", "input": ["speech"], "actionHook": "/api/respond", "timeout": 5 }
        ]);
    }

    const customerText = speechData.alternatives[0].transcript;
    console.log("🗣️ Customer said:", customerText);

    try {
        // 2. إرسال النص لـ Gemini Pro
        const prompt = `أنت موظف استقبال في مطعم سعودي. رد باختصار شديد جداً (لا يزيد عن 15 كلمة) وبلطافة على كلام العميل التالي: "${customerText}"`;
        const result = await model.generateContent(prompt);
        const aiResponse = result.response.text();
        
        console.log("🧠 AI Responded:", aiResponse);

        // 3. إرسال الرد الصوتي للعميل
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
