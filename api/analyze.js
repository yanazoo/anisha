module.exports = async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘POST, OPTIONS’);
res.setHeader(‘Access-Control-Allow-Headers’, ‘Content-Type’);
if (req.method === ‘OPTIONS’) return res.status(200).end();
if (req.method !== ‘POST’) return res.status(405).json({ error: ‘Method not allowed’ });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) return res.status(500).json({ error: ‘GEMINI_API_KEY not set’ });

const { imageUrl, prompt, url } = req.body || {};
if (!prompt) return res.status(400).json({ error: ‘prompt is required’ });

try {
let parts = [{ text: prompt + (url ? ’\n\nURL: ’ + url : ‘’) }];

```
if (imageUrl) {
  try {
    const imgRes = await fetch(imageUrl);
    if (imgRes.ok) {
      const buf = await imgRes.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      const mime = imgRes.headers.get('content-type') || 'image/jpeg';
      parts.push({ inline_data: { mime_type: mime, data: b64 } });
    }
  } catch (imgErr) {
    console.log('image fetch failed:', imgErr.message);
  }
}

const geminiRes = await fetch(
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
    })
  }
);

if (!geminiRes.ok) {
  const errText = await geminiRes.text();
  console.error('Gemini error:', errText);
  return res.status(geminiRes.status).json({ error: 'Gemini error: ' + errText.slice(0, 200) });
}

const data = await geminiRes.json();
const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
console.log('Gemini response:', text);

const match = text.match(/\{[\s\S]*\}/);
if (!match) {
  return res.status(200).json({
    work: null, title: null, location: null,
    ep: null, emoji: '📍', confidence: 0, candidates: [], raw: text
  });
}

return res.status(200).json(JSON.parse(match[0]));
```

} catch (e) {
console.error(‘error:’, e.message);
return res.status(500).json({ error: e.message });
}
};