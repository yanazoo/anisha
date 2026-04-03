export default async function handler(req, res) {
if (req.method !== ‘POST’) {
return res.status(405).json({ error: ‘Method not allowed’ });
}

const { imageUrl, prompt, url } = req.body;
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
return res.status(500).json({ error: ‘API key not configured’ });
}

try {
const parts = [];

```
// 画像がある場合は追加
if (imageUrl) {
  try {
    const imageRes = await fetch(imageUrl);
    if (imageRes.ok) {
      const imageBuffer = await imageRes.arrayBuffer();
      const base64 = Buffer.from(imageBuffer).toString('base64');
      const mimeType = imageRes.headers.get('content-type') || 'image/jpeg';
      parts.push({ inline_data: { mime_type: mimeType, data: base64 } });
    }
  } catch (imgErr) {
    console.log('image fetch failed:', imgErr.message);
  }
}

// テキストプロンプト（URLも含める）
const fullPrompt = prompt + (url ? '\n\n対象URL: ' + url : '');
parts.push({ text: fullPrompt });

const geminiRes = await fetch(
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: parts }]
    })
  }
);

if (!geminiRes.ok) {
  const err = await geminiRes.text();
  return res.status(geminiRes.status).json({ error: err });
}

const data = await geminiRes.json();
const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
console.log('Gemini response:', text.slice(0, 300));

const match = text.match(/\{[\s\S]*\}/);
const result = match ? JSON.parse(match[0]) : { raw: text };

return res.status(200).json(result);
```

} catch (e) {
console.error(‘error:’, e.message);
return res.status(500).json({ error: e.message });
}
}