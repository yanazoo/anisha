const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const { lat, lng } = req.body || {};
  if (!lat || !lng) { res.status(400).json({ photos: [] }); return; }

  const UA = 'AniFrame/1.0 (anisha-rho.vercel.app)';

  try {
    // Wikipedia 周辺スポット検索（半径 1km）
    const geoRes = await fetch(
      `https://ja.wikipedia.org/w/api.php?action=query&list=geosearch` +
      `&gsradius=1000&gscoord=${lat}|${lng}&gslimit=10&format=json`,
      { headers: { 'User-Agent': UA } }
    );
    const geoData = await geoRes.json();
    const pages = (geoData?.query?.geosearch || []).slice(0, 8);

    if (pages.length === 0) {
      return res.status(200).json({ photos: [] });
    }

    // 各ページのサムネイル取得
    const titles = pages.map(p => p.title).join('|');
    const thumbRes = await fetch(
      `https://ja.wikipedia.org/w/api.php?action=query` +
      `&titles=${encodeURIComponent(titles)}&prop=pageimages&pithumbsize=600&format=json`,
      { headers: { 'User-Agent': UA } }
    );
    const thumbData = await thumbRes.json();

    const photos = [];
    for (const page of Object.values(thumbData?.query?.pages || {})) {
      if (page.thumbnail?.source) {
        photos.push({ url: page.thumbnail.source, title: page.title });
      }
    }

    console.log('photos found:', photos.length, 'near', lat, lng);
    return res.status(200).json({ photos });
  } catch(e) {
    console.error('photos error:', e.message);
    return res.status(200).json({ photos: [] });
  }
};
module.exports = handler;
