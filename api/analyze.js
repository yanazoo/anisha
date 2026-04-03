const handler = async function(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);
if (req.method === ‘OPTIONS’) { res.status(200).end(); return; }
if (req.method !== ‘POST’) { res.status(405).end(); return; }
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { res.status(500).json({ error: ‘no key’ }); return; }
const body = req.body || {};
const parts = [];
if (body.imageUrl) {
try {
const r = await fetch(body.imageUrl);
if (r.ok) {
const buf = await r.arrayBuffer();
const mime = r.headers.get(‘content-type’) || ‘image/jpeg’;
parts.push({ inline_data: { mime_type: mime, data: Buffer.from(buf).toString(‘base64’) } });
}
} catch(e) { console.log(‘img:’, e.message); }
}
parts.push({ text: (body.prompt || ‘’) + ’\nURL: ’ + (body.url || ‘’) });
try {
const r = await fetch(
‘https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=’ + apiKey,
{ method: ‘POST’, headers: { ‘Content-Type’: ‘application/json’ }, body: JSON.stringify({ contents: [{ parts }] }) }
);
const d = await r.json();
console.log(‘gemini status:’, r.status);
if (!d.candidates || !d.candidates[0] || !d.candidates[0].content) {
console.log(‘no candidates:’, JSON.stringify(d).slice(0, 200));
return res.status(200).json({ work: null, title: null, location: null, ep: null, emoji: ‘📍’, confidence: 0, candidates: [] });
}
const text = d.candidates[0].content.parts[0].text || ‘’;
console.log(‘res:’, text.slice(0, 200));
const cleaned = text.replace(/`json/g, '').replace(/`/g, ‘’).trim();
let result;
try {
const p = JSON.parse(cleaned);
result = Array.isArray(p) ? p[0] : p;
} catch(e) {
const m = cleaned.match(/{[\s\S]*}/);
result = m ? JSON.parse(m[0]) : { work: null, title: null, location: null, ep: null, emoji: ‘📍’, confidence: 0, candidates: [] };
}
res.status(200).json(result);
} catch(e) {
console.error(‘err:’, e.message);
res.status(500).json({ error: e.message });
}
};
module.exports = handler;