const express = require('express');
const { GoogleGenerativeAI } = require("@google/genai");
require('dotenv').config();

const app = express();
app.use(express.json());

// إعداد Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.get('/', (req, res) => res.send('🚀 AI Voice Server is Live!'));

// المسار الذي يستقبل المكالمة لأول مرة
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
            "actionHook": "/api/respond", // بعد ما العميل يتكلم، نرسل كلامه لهذا المسار
            "timeout": 5
        }
    ];
    res.status(200).json(jambonzResponse);
});

// المسار الذي يعالج كلام العميل ويرد عليه عبر Gemini
app.post('/api/respond', async (req, res) => {
    const customerText = req.body.speech.alternatives[0].transcript;
    console.log("Customer said:", customerText);

    try {
        // نطلب من Gemini الرد بشخصية مطعم
        const prompt = `أنت موظف استقبال في مطعم سعودي. رد باختصار شديد جداً (لا يزيد عن 15 كلمة) وبلطافة على العميل: ${customerText}`;
        const result = await model.generateContent(prompt);
        const aiResponse = result.response.text();

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
        console.error("Gemini Error:", error);
        res.status(200).json([{ "verb": "say", "text": "معذرة، حدث خطأ ما." }]);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
