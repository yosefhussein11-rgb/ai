const express = require('express');
const { GoogleGenerativeAI } = require("@google/generativeai");
require('dotenv').config();

const app = express();
app.use(express.json());

// إعداد Gemini
const genAI = new GoogleGenerativeAI(process.env.AIzaSyBneW7GjNxujkA5wEvm-1EzzmGbv2AeVVM);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.get('/', (req, res) => res.send('🚀 AI Server is Live!'));

app.post('/api/incoming', async (req, res) => {
    // 1. استقبال النص من Jambonz (سنقوم بتفعيل خاصية التعرف على الصوت لاحقاً)
    // في هذه المرحلة سنقوم بعمل "رد ترحيبي ذكي" كمرحلة أولى
    
    const prompt = "أنت موظف استقبال في مطعم 'بيت البرجر'. رحب بالعميل بلهجة سعودية لطيفة جداً واسأله كيف يمكنك مساعدته اليوم في الطلب. اجعل الرد قصيراً جداً (جملة واحدة).";

    try {
        const result = await model.generateContent(prompt);
        const aiResponse = result.response.text();

        const jambonzResponse = [
            {
                "verb": "say",
                "text": aiResponse,
                "synthesizer": {
                    "vendor": "google",
                    "language": "ar-SA"
                }
            }
        ];
        res.status(200).json(jambonzResponse);
    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(200).json([{ "verb": "say", "text": "عذراً، حدث خطأ في النظام." }]);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
