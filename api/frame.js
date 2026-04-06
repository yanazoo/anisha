// api/frame.js
// YouTube動画の指定秒数のフレームを取得する
// storyboard（進行バープレビュー）を使って任意時刻のサムネを取得

const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const { videoId, seconds } = req.body || {};
  if (!videoId || seconds === undefined) {
    return res.status(400).json({ error: 'videoId and seconds required' });
  }

  try {
    // YouTube動画ページを取得してytInitialPlayerResponseを抽出
    const ytRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9'
      }
    });
    const html = await ytRes.text();

    // ytInitialPlayerResponseを抽出
    const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s);
    if (!playerMatch) {
      return res.status(422).json({ error: 'could not parse youtube response' });
    }
    const playerData = JSON.parse(playerMatch[1]);

    // ストーリーボードspecを取得
    const spec = playerData?.storyboards?.playerStoryboardSpecRenderer?.spec;
    if (!spec) {
      return res.status(422).json({ error: 'no storyboard found' });
    }

    // spec形式: baseUrl|level0Spec|level1Spec|level2Spec
    // 各levelSpec: width#height#?#cols#rows#interval(ms)#...
    const parts = spec.split('|');
    const baseUrl = parts[0]; // 例: https://i.ytimg.com/sb/{id}/storyboard3_L$L/$N.jpg?...

    // 最高品質（level2）を優先、なければlevel1、level0
    let levelIdx = Math.min(parts.length - 2, 2); // 2=最高品質
    const levelSpec = parts[levelIdx + 1];
    if (!levelSpec) {
      return res.status(422).json({ error: 'no level spec' });
    }

    const specParts = levelSpec.split('#');
    const thumbW    = parseInt(specParts[0]);
    const thumbH    = parseInt(specParts[1]);
    const cols      = parseInt(specParts[3]);
    const rows      = parseInt(specParts[4]);
    const intervalMs = parseInt(specParts[5]);

    if (!thumbW || !thumbH || !cols || !rows || !intervalMs) {
      return res.status(422).json({ error: 'invalid storyboard spec' });
    }

    const frameIndex = Math.floor((seconds * 1000) / intervalMs);
    const framesPerSprite = cols * rows;
    const spriteN  = Math.floor(frameIndex / framesPerSprite);
    const localIdx = frameIndex % framesPerSprite;
    const col      = localIdx % cols;
    const row      = Math.floor(localIdx / cols);

    // スプライトURL生成（$L=level, $N=sprite番号）
    const spriteUrl = baseUrl
      .replace('$L', String(levelIdx))
      .replace('$N', String(spriteN));

    console.log('storyboard:', { videoId, seconds, levelIdx, spriteN, col, row, thumbW, thumbH, intervalMs });

    // スプライト画像を取得してcropする
    const imgRes = await fetch(spriteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!imgRes.ok) {
      return res.status(502).json({ error: 'sprite fetch failed: ' + imgRes.status });
    }

    const imgBuf = Buffer.from(await imgRes.arrayBuffer());

    // sharp で crop（Vercel環境ではsharpが使えない場合は生データ返し）
    try {
      const sharp = require('sharp');
      const cropped = await sharp(imgBuf)
        .extract({ left: col * thumbW, top: row * thumbH, width: thumbW, height: thumbH })
        .jpeg({ quality: 85 })
        .toBuffer();
      const b64 = cropped.toString('base64');
      return res.status(200).json({ imageBase64: b64, mime: 'image/jpeg', w: thumbW, h: thumbH });
    } catch(sharpErr) {
      // sharpが使えない場合: スプライトURLだけ返す（フロントでcanvas cropする）
      console.log('sharp unavailable, returning sprite url');
      return res.status(200).json({
        spriteUrl,
        crop: { x: col * thumbW, y: row * thumbH, w: thumbW, h: thumbH }
      });
    }

  } catch(e) {
    console.error('frame api error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
module.exports = handler;
