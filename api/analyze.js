const handler = async (req, res) => {
if (req.method !== “POST”) { res.status(405).json({ error: “not allowed” }); return; }
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { res.status(500).json({ error: “no key” }); return; }
const body = req.body || {};
const prompt = body.prompt || “”;
const imageUrl = body.imageUrl || null;
const url = body.url || “”;
const parts = [];
if (imageUrl) {
try {
const r = await fetch(imageUrl);
if (r.ok) {
const buf = await r.arrayBuffer();
const b64 = Buffer.from(buf).toString(“base64”);
const mime = r.headers.get(“content-type”) || “image/jpeg”;
parts.push({ inline_data: { mime_type: mime, data: b64 } });
}
} catch (e) { console.log(“img:”, e.message); }
}
parts.push({ text: prompt + “\nURL: “ + url });
try {
const r = await fetch(
“https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=” + apiKey,
{ method: “POST”, headers: { “Content-Type”: “application/json” }, body: JSON.stringify({ contents: [{ parts: parts }] }) }
);
const d = await r.json();
console.log(“status:”, r.status);
if (!d.candidates || !d.candidates[0] || !d.candidates[0].content) {
console.log(“no candidates:”, JSON.stringify(d).slice(0, 300));
return res.status(200).json({ work: null, title: null, location: null, ep: null, emoji: “📍”, confidence: 0, candidates: [] });
}
const text = d.candidates[0].content.parts[0].text || “”;
console.log(“res:”, text.slice(0, 300));
const cleaned = text.replace(/`json/g, "").replace(/`/g, “”).trim();
let result;
try {
const parsed = JSON.parse(cleaned);
result = Array.isArray(parsed) ? parsed[0] : parsed;
} catch (e) {
const match = cleaned.match(/{[\s\S]*}/);
result = match ? JSON.parse(match[0]) : { work: null, title: null, location: null, ep: null, emoji: “📍”, confidence: 0, candidates: [] };
}
res.status(200).json(result);
} catch (e) {
console.error(“err:”, e.message);
res.status(500).json({ error: e.message });
}
};
module.exports = handler;