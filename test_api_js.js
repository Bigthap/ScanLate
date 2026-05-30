const fs = require('fs');

async function testStream() {
    const formData = new FormData();
    const imageBlob = new Blob([fs.readFileSync("D:/PlayGround/Manga-Trans2/test.jpg")], { type: "image/jpeg" });
    formData.append("image", imageBlob, "image.jpg");
    formData.append("source_lang", "ja");
    formData.append("profile_name", "default");

    console.log("Fetching stream...");
    const response = await fetch("http://127.0.0.1:8745/translate/stream", {
        method: "POST",
        body: formData
    });
    
    console.log("Response status:", response.status);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            console.log("Stream DONE.");
            break;
        }
        
        const chunkStr = decoder.decode(value, { stream: true });
        console.log(`[CHUNK RAW LENGTH]: ${chunkStr.length} characters`);
        buffer += chunkStr;
        
        const lines = buffer.split('\n');
        buffer = lines.pop();
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const dataStr = line.substring(6).trim();
                if (!dataStr) continue;
                try {
                    const dataObj = JSON.parse(dataStr);
                    console.log("RECEIVED EVENT:", dataObj.type, "INDEX:", dataObj.index, "TEXT:", dataObj.text);
                } catch (err) {
                    console.error("Failed to parse:", dataStr);
                }
            }
        }
    }
}
testStream();
