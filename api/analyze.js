// analyze.js — Groq のみ
// 注意: このファイルはiPhoneのGitHubアプリで直接編集しないこと（文字化けの原因）

const GROQ_VISION_MODEL = 'llama-3.2-11b-vision-preview'; // 画像あり用（ビジョン対応）
const GROQ_TEXT_MODEL   = 'llama-3.3-70b-versatile';      // テキストのみ用（高精度）

const handler = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).end(); return; }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured' });

  const body = req.body || {};
  const prompt = (body.prompt || '') + '\nURL: ' + (body.url || '');

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
    console.error('Groq error:', e.message);
    return res.status(500).json({ error: e.message });
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
