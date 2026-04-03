const handler = async function(req, res) {
const H1 = [65,99,99,101,115,115,45,67,111,110,116,114,111,108,45,65,108,108,111,119,45,79,114,105,103,105,110].map(n=>String.fromCharCode(n)).join(`); const H2 = [65,99,99,101,115,115,45,67,111,110,116,114,111,108,45,65,108,108,111,119,45,77,101,116,104,111,100,115].map(n=>String.fromCharCode(n)).join(`);
const H3 = [65,99,99,101,115,115,45,67,111,110,116,114,111,108,45,65,108,108,111,119,45,72,101,97,100,101,114,115].map(n=>String.fromCharCode(n)).join(`); const STAR = [42].map(n=>String.fromCharCode(n)).join(`);
const METHODS = [80,79,83,84,44,32,79,80,84,73,79,78,83].map(n=>String.fromCharCode(n)).join(`); const CT = [67,111,110,116,101,110,116,45,84,121,112,101].map(n=>String.fromCharCode(n)).join(`);
const OPTIONS = [79,80,84,73,79,78,83].map(n=>String.fromCharCode(n)).join(`); const POST = [80,79,83,84].map(n=>String.fromCharCode(n)).join(`);
const BASE64 = [98,97,115,101,54,52].map(n=>String.fromCharCode(n)).join(`); const AJ = [97,112,112,108,105,99,97,116,105,111,110,47,106,115,111,110].map(n=>String.fromCharCode(n)).join(`);
const IMGJ = [105,109,97,103,101,47,106,112,101,103].map(n=>String.fromCharCode(n)).join(`); const CONTTYPE = [99,111,110,116,101,110,116,45,116,121,112,101].map(n=>String.fromCharCode(n)).join(`);
const GURL = [104,116,116,112,115,58,47,47,103,101,110,101,114,97,116,105,118,101,108,97,110,103,117,97,103,101,46,103,111,111,103,108,101,97,112,105,115,46,99,111,109,47,118,49,98,101,116,97,47,109,111,100,101,108,115,47,103,101,109,105,110,105,45,50,46,53,45,102,108,97,115,104,58,103,101,110,101,114,97,116,101,67,111,110,116,101,110,116,63,107,101,121,61].map(n=>String.fromCharCode(n)).join(``);

res.setHeader(H1, STAR);
res.setHeader(H2, METHODS);
res.setHeader(H3, CT);

if (req.method === OPTIONS) { res.status(200).end(); return; }
if (req.method !== POST) { res.status(405).end(); return; }

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { res.status(500).json({ error: 1 }); return; }

const body = req.body || {};
const parts = [];

if (body.imageUrl) {
try {
const imgR = await fetch(body.imageUrl);
if (imgR.ok) {
const buf = await imgR.arrayBuffer();
const mime = imgR.headers.get(CONTTYPE) || IMGJ;
parts.push({ inline_data: { mime_type: mime, data: Buffer.from(buf).toString(BASE64) } });
}
} catch(imgE) { console.log(99); }
}

const urlStr = [85,82,76,58,32].map(n=>String.fromCharCode(n)).join(`); parts.push({ text: (body.prompt || `) + `\n` + urlStr + (body.url || ``) });

try {
const endpoint = GURL + apiKey;
const headers = {};
headers[CT] = AJ;
const geminiR = await fetch(endpoint, {
method: POST,
headers: headers,
body: JSON.stringify({ contents: [{ parts: parts }] })
});

```
const data = await geminiR.json();
console.log(geminiR.status);

if (!data.candidates || data.candidates.length === 0) {
  return res.status(200).json({ work: null, title: null, location: null, ep: null, confidence: 0, candidates: [] });
}

const cand = data.candidates[0];
if (!cand.content || !cand.content.parts || cand.content.parts.length === 0) {
  return res.status(200).json({ work: null, title: null, location: null, ep: null, confidence: 0, candidates: [] });
}

const rawText = cand.content.parts[0].text || ``;
console.log(rawText.length);

const bq = String.fromCharCode(96);
const bq3json = bq+bq+bq+[106,115,111,110].map(n=>String.fromCharCode(n)).join(``);
const bq3 = bq+bq+bq;
const cleaned = rawText.split(bq3json).join(``).split(bq3).join(``).trim();

let result;
try {
  const parsed = JSON.parse(cleaned);
  result = Array.isArray(parsed) ? parsed[0] : parsed;
} catch(pe) {
  const m = cleaned.match(/\{[\s\S]*\}/);
  result = m ? JSON.parse(m[0]) : { work: null, title: null, location: null, ep: null, confidence: 0, candidates: [] };
}

console.log(result.work || 0);
return res.status(200).json(result);
```

} catch(e) {
console.error(e.message);
return res.status(500).json({ error: e.message });
}
};
module.exports = handler;