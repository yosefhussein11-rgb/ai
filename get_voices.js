// get_voices.js
async function fetchVoices() {
    // 👈 ضع مفتاح نبرة (API Key) الخاص بك هنا بين علامتي التنصيص
    const apiKey = "nb_apbywMYSdHp9uFrYgZpI3Fj-GO4"; 

    try {
        const response = await fetch("https://api.nabrah.ai/api/ext/tts/voices", {
            method: "GET",
            headers: {
                "X-API-Key": apiKey
            }
        });

        if (!response.ok) {
            console.log("❌ خطأ في الاتصال بسيرفرات نبرة:", response.status);
            return;
        }

        const data = await response.json();
        console.log("✅ تم جلب الأصوات بنجاح! إليك القائمة:");
        console.log("------------------------------------------------");
        
        // طباعة اسم كل صوت والرقم الخاص به
        data.voices.forEach(voice => {
            console.log(`🗣️ اسم الصوت: ${voice.name}`);
            console.log(`🔑 الـ ID الخاص به: ${voice.id}`);
            console.log("------------------------------------------------");
        });

    } catch (error) {
        console.log("❌ حدث خطأ:", error.message);
    }
}

fetchVoices();
