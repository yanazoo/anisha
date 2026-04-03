const handler = async function(req, res) {
  const POST = [80,79,83,84].map(c=>String.fromCharCode(c)).join('');
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
        parts.push({ inline_data: { mime_type: r.headers.get([99,111,110,116,101,110,116,45,116,121,112,101].map(c=>String.fromCharCode(c)).join('')) || [105,109,97,103,101,47,106,112,101,103].map(c=>String.fromCharCode(c)).join(''), data: Buffer.from(buf).toString([98,97,115,101,54,52].map(c=>String.fromCharCode(c)).join('')) } });
      }
    } catch(e) {}
  }
  parts.push({ text: (body.prompt||'') + '\nURL: ' + (body.url||'') });
  try {
    const r = await fetch([104,116,116,112,115,58,47,47,103,101,110,101,114,97,116,105,118,101,108,97,110,103,117,97,103,101,46,103,111,111,103,108,101,97,112,105,115,46,99,111,109,47,118,49,98,101,116,97,47,109,111,100,101,108,115,47,103,101,109,105,110,105,45,50,46,53,45,102,108,97,115,104,58,103,101,110,101,114,97,116,101,67,111,110,116,101,110,116,63,107,101,121,61].map(c=>String.fromCharCode(c)).join('')+apiKey,
      { method: POST, headers: { [('Content-Type')]: ('application/json') }, body: JSON.stringify({ contents: [{ parts }] }) });
    const d = await r.json();
    if (!d.candidates || !d.candidates[0] || !d.candidates[0].content) {
      return res.status(200).json({ work: null, title: null, location: null, ep: null, emoji: 0x1F4CD, confidence: 0, candidates: [] });
    }
    const text = d.candidates[0].content.parts[0].text || '';
    const cleaned = text.replace(/\x60\x60\x60json/g,'').replace(/\x60\x60\x60/g,'').trim();
    let result;
    try { const p = JSON.parse(cleaned); result = Array.isArray(p) ? p[0] : p; }
    catch(e) { const m = cleaned.match(/\{[\s\S]*\}/); result = m ? JSON.parse(m[0]) : { work: null, title: null, location: null, ep: null, confidence: 0, candidates: [] }; }
    res.status(200).json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
};
module.exports = handler;
