// analyze.js — Groq (primary) + Gemini (fallback)
// 注意: このファイルはiPhoneのGitHubアプリで直接編集しないこと（文字化けの原因）

const GROQ_VISION_MODEL = 'llama-3.2-11b-vision-preview'; // 画像あり用（ビジョン対応）
const GROQ_TEXT_MODEL   = 'llama-3.3-70b-versatile';      // テキストのみ用（高精度）
const GEMINI_MODEL      = 'gemini-2.0-flash-lite';         // フォールバック（クォータ多め）

const handler = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).end(); return; }

  const groqKey   = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!groqKey && !geminiKey) {
    return res.status(500).json({ error: 'no API key configured' });
  }

  const body = req.body || {};
  const prompt = (body.prompt || '') + '\nURL: ' + (body.url || '');

  // ── Groq (優先) ──────────────────────────────────────
  if (groqKey) {
    try {
      const result = await callGroq(groqKey, prompt, body);
      console.log('Groq ok:', result.work || '-');
      return res.status(200).json(result);
    } catch(e) {
      if (e.message === 'quota_exceeded') {
        return res.status(429).json({
          error: 'quota_exceeded',
          message: 'Groq APIのクォータが上限に達しています。しばらく時間をおいてお試しください。'
        });
      }
      console.error('Groq error, trying Gemini fallback:', e.message);
    }
  }

  // ── Gemini (フォールバック) ───────────────────────────
  if (geminiKey) {
    try {
      const result = await callGemini(geminiKey, prompt, body);
      console.log('Gemini ok:', result.work || '-');
      return res.status(200).json(result);
    } catch(e) {
      if (e.message === 'quota_exceeded') {
        return res.status(429).json({
          error: 'quota_exceeded',
          message: 'Gemini APIのクォータが上限に達しています。しばらく時間をおいてお試しください。'
        });
      }
      console.error('Gemini error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }
};

// ── Groq 呼び出し ─────────────────────────────────────
async function callGroq(apiKey, prompt, body) {
  const hasImage = !!(body.imageBase64 || body.imageUrl);
  const model = hasImage ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL;
  const content = [];

  if (body.imageBase64) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${body.imageMime || 'image/jpeg'};base64,${body.imageBase64}` }
    });
  } else if (body.imageUrl) {
    content.push({ type: 'image_url', image_url: { url: body.imageUrl } });
  }
  content.push({ type: 'text', text: prompt });

  console.log('Groq model:', model, 'hasImage:', hasImage);

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      temperature: 0.2,
      max_tokens: 1024
    })
  });

  console.log('Groq status:', res.status);
  if (res.status === 429) throw new Error('quota_exceeded');

  const data = await res.json();
  if (!data.choices || !data.choices[0]) throw new Error('no response from Groq: ' + JSON.stringify(data).slice(0, 200));

  return parseResult(data.choices[0].message.content);
}

// ── Gemini 呼び出し ───────────────────────────────────
async function callGemini(apiKey, prompt, body) {
  const parts = [];

  if (body.imageBase64) {
    parts.push({ inline_data: { mime_type: body.imageMime || 'image/jpeg', data: body.imageBase64 } });
  } else if (body.imageUrl) {
    try {
      const imgRes = await fetch(body.imageUrl);
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer();
        const mime = imgRes.headers.get('content-type') || 'image/jpeg';
        parts.push({ inline_data: { mime_type: mime, data: Buffer.from(buf).toString('base64') } });
      }
    } catch(e) { console.log('image fetch error:', e.message); }
  }
  parts.push({ text: prompt });

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] })
  });

  console.log('Gemini status:', res.status);
  const data = await res.json();

  if (res.status === 429 || (data.error && (data.error.status === 'RESOURCE_EXHAUSTED' || data.error.code === 429))) {
    throw new Error('quota_exceeded');
  }
  if (!data.candidates || !data.candidates[0]) {
    return { work: null, title: null, location: null, ep: null, confidence: 0, candidates: [] };
  }

  return parseResult(data.candidates[0].content?.parts?.[0]?.text || '');
}

// ── JSON パース ───────────────────────────────────────
function parseResult(rawText) {
  const cleaned = (rawText || '').replace(/```json/g, '').replace(/```/g, '').trim();
  let result;
  try {
    const parsed = JSON.parse(cleaned);
    result = Array.isArray(parsed) ? parsed[0] : parsed;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    try { result = m ? JSON.parse(m[0]) : null; } catch { result = null; }
  }
  if (!result || typeof result !== 'object') {
    result = { work: null, title: null, location: null, ep: null, confidence: 0, candidates: [] };
  }
  return result;
}

module.exports = handler;
