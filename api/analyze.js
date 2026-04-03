const handler = async function(req, res) {
res.setHeader(String.fromCharCode(65,99,99,101,115,115,45,67,111,110,116,114,111,108,45,65,108,108,111,119,45,79,114,105,103,105,110), String.fromCharCode(42));
res.setHeader(String.fromCharCode(65,99,99,101,115,115,45,67,111,110,116,114,111,108,45,65,108,108,111,119,45,77,101,116,104,111,100,115), String.fromCharCode(80,79,83,84,44,32,79,80,84,73,79,78,83));
res.setHeader(String.fromCharCode(65,99,99,101,115,115,45,67,111,110,116,114,111,108,45,65,108,108,111,119,45,72,101,97,100,101,114,115), String.fromCharCode(67,111,110,116,101,110,116,45,84,121,112,101));
const OPTIONS = String.fromCharCode(79,80,84,73,79,78,83);
const POST = String.fromCharCode(80,79,83,84);
if (req.method === OPTIONS) { res.status(200).end(); return; }
if (req.method !== POST) { res.status(405).end(); return; }
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { res.status(500).json({ error: 1 }); return; }
const body = req.body || {};
const parts = [];
if (body.imageUrl) {
try {
const r = await fetch(body.imageUrl);
if (r.ok) {
const buf = await r.arrayBuffer();
const mime = r.headers.get(String.fromCharCode(99,111,110,116,101,110,116,45,116,121,112,101)) || String.fromCharCode(105,109,97,103,101,47,106,112,101,103);
parts.push({ inline_data: { mime_type: mime, data: Buffer.from(buf).toString(String.fromCharCode(98,97,115,101,54,52)) } });
}
} catch(e) {}
}
parts.push({ text: (body.prompt || String.fromCharCode(32)) + String.fromCharCode(10,85,82,76,58,32) + (body.url || String.fromCharCode(32)) });
try {
const endpoint = String.fromCharCode(104,116,116,112,115,58,47,47,103,101,110,101,114,97,116,105,118,101,108,97,110,103,117,97,103,101,46,103,111,111,103,108,101,97,112,105,115,46,99,111,109,47,118,49,98,101,116,97,47,109,111,100,101,108,115,47,103,101,109,105,110,105,45,50,46,53,45,102,108,97,115,104,58,103,101,110,101,114,97,116,101,67,111,110,116,101,110,116,63,107,101,121,61) + apiKey;
const ct = String.fromCharCode(67,111,110,116,101,110,116,45,84,121,112,101);
const aj = String.fromCharCode(97,112,112,108,105,99,97,116,105,111,110,47,106,115,111,110);
const r = await fetch(endpoint, { method: POST, headers: { [ct]: aj }, body: JSON.stringify({ contents: [{ parts }] }) });
const d = await r.json();
if (!d.candidates || !d.candidates[0] || !d.candidates[0].content) {
return res.status(200).json({ work: null, title: null, location: null, ep: null, confidence: 0, candidates: [] });
}
const text = d.candidates[0].content.parts[0].text || String.fromCharCode(32);
const cleaned = text.replace(/`json/g, String.fromCharCode(32)).replace(/`/g, String.fromCharCode(32)).trim();
let result;
try { const p = JSON.parse(cleaned); result = Array.isArray(p) ? p[0] : p; }
catch(e) { const m = cleaned.match(/{[\s\S]*}/); result = m ? JSON.parse(m[0]) : { work: null, title: null, location: null, ep: null, confidence: 0, candidates: [] }; }
res.status(200).json(result);
} catch(e) { res.status(500).json({ error: e.message }); }
};
module.exports = handler;