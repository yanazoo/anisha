const handler = async function(req, res) {
res.setHeader(“Access-Control-Allow-Origin”, “*”);
res.setHeader(“Access-Control-Allow-Methods”, “POST, OPTIONS”);
res.setHeader(“Access-Control-Allow-Headers”, “Content-Type”);
if (req.method === “OPTIONS”) { res.status(200).end(); return; }
if (req.method !== “POST”) { res.status(405).end(); return; }
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { res.status(500).json({ error: “no key” }); return; }
const body = req.body || {};
const parts = [];
if (body.imageUrl) {
try {
const imgR = await fetch(body.imageUrl);
if (imgR.ok) {
const buf = await imgR.arrayBuffer();
const mime = imgR.headers.get(“content-type”) || “image/jpeg”;
parts.push({ inline_data: { mime_type: mime, data: Buffer.from(buf).toString(“base64”) } });
}
} catch(imgE) { console.log(“img err”); }
}
const promptText = (body.prompt || “”) + “\nURL: “ + (body.url || “”);
parts.push({ text: promptText });
try {
const geminiUrl = “https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=” + apiKey;
const geminiR = await fetch(geminiUrl, {
method: “POST”,
headers: { “Content-Type”: “application/json” },
body: JSON.stringify({ contents: [{ parts: parts }] })
});
const data = await geminiR.json();
console.log(“gemini ok:”, geminiR.status);
if (!data.candidates || data.candidates.length === 0) {
console.log(“empty candidates”);
return res.status(200).json({ work: null, title: null, location: null, ep: null, emoji: “pin”, confidence: 0, candidates: [] });
}
const cand = data.candidates[0];
if (!cand.content || !cand.content.parts || cand.content.parts.length === 0) {
console.log(“empty content”);
return res.status(200).json({ work: null, title: null, location: null, ep: null, emoji: “pin”, confidence: 0, candidates: [] });
}
const rawText = cand.content.parts[0].text || “”;
console.log(“text len:”, rawText.length);
const cleaned = rawText.replace(/`json/g, "").replace(/`/g, “”).trim();
let result;
try {
const parsed = JSON.parse(cleaned);
result = Array.isArray(parsed) ? parsed[0] : parsed;
} catch(parseE) {
const jsonMatch = cleaned.match(/{[\s\S]*}/);
if (jsonMatch) {
result = JSON.parse(jsonMatch[0]);
} else {
result = { work: null, title: null, location: null, ep: null, confidence: 0, candidates: [] };
}
}
console.log(“work:”, result.work);
return res.status(200).json(result);
} catch(e) {
console.error(“fetch err:”, e.message);
return res.status(500).json({ error: e.message });
}
};
module.exports = handler;