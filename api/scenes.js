const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'no key' }); return; }

  const { url } = req.body || {};
  if (!url) { res.status(400).json({ error: 'url required' }); return; }

  const prompt = `この動画を分析し、アニメ・マンガの聖地巡礼に関係する印象的なシーンを最大5つ特定してください。
「名シーン」「聖地スポット」「行ってみたいと思わせる場所」を優先してピックアップしてください。

各シーンについて以下のJSONで返してください：
{
  "scenes": [
    {
      "timestamp": 秒数（整数）,
      "description": "シーンの説明（40文字以内）",
      "spotName": "スポット名の推測",
      "location": "実在する住所または著名な地名（都道府県から記述、不明ならnull）",
      "confidence": 場所の確信度0-100,
      "emoji": "スポットを表す絵文字1文字",
      "work": "アニメ・マンガ作品名（不明ならnull）",
      "ep": "エピソード・シーン名（不明ならnull）"
    }
  ]
}
JSONのみ返してください。説明文は不要です。`;

  try {
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;

    const geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { fileData: { mimeType: 'video/youtube', fileUri: url } },
            { text: prompt }
          ]
        }],
        generationConfig: { temperature: 0.2 }
      })
    });

    const data = await geminiRes.json();
    console.log('scenes status:', geminiRes.status);

    if (!data.candidates || !data.candidates[0]) {
      console.log('no candidates:', JSON.stringify(data).slice(0, 200));
      return res.status(200).json({ scenes: [] });
    }

    const rawText = (data.candidates[0].content?.parts?.[0]?.text || '').trim();
    console.log('rawText length:', rawText.length);

    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    let result;
    try {
      const parsed = JSON.parse(cleaned);
      result = Array.isArray(parsed) ? { scenes: parsed } : parsed;
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      try { result = m ? JSON.parse(m[0]) : { scenes: [] }; } catch { result = { scenes: [] }; }
    }

    if (!result || !Array.isArray(result.scenes)) result = { scenes: [] };

    // タイムスタンプを秒数に正規化
    result.scenes = result.scenes.map(s => ({
      ...s,
      timestamp: typeof s.timestamp === 'string'
        ? s.timestamp.split(':').reduce((acc, t) => acc * 60 + parseInt(t, 10), 0)
        : (parseInt(s.timestamp, 10) || 0)
    }));

    console.log('scenes count:', result.scenes.length);
    return res.status(200).json(result);
  } catch(e) {
    console.error('scenes error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};

module.exports = handler;
