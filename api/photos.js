const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const { lat, lng } = req.body || {};
  if (!lat || !lng) { res.status(400).json({ photos: [] }); return; }

  const UA = 'AniFrame/1.0 (anisha-rho.vercel.app)';
  const photos = [];

  // ── 1. Wikipedia ja 周辺スポット（半径 3km）──────────────────────
  try {
    const geoRes = await fetch(
      `https://ja.wikipedia.org/w/api.php?action=query&list=geosearch` +
      `&gsradius=3000&gscoord=${lat}|${lng}&gslimit=12&format=json`,
      { headers: { 'User-Agent': UA } }
    );
    const geoData = await geoRes.json();
    const pages = (geoData?.query?.geosearch || []).slice(0, 10);

    if (pages.length > 0) {
      const titles = pages.map(p => p.title).join('|');
      const thumbRes = await fetch(
        `https://ja.wikipedia.org/w/api.php?action=query` +
        `&titles=${encodeURIComponent(titles)}&prop=pageimages&pithumbsize=600&format=json`,
        { headers: { 'User-Agent': UA } }
      );
      const thumbData = await thumbRes.json();
      for (const page of Object.values(thumbData?.query?.pages || {})) {
        if (page.thumbnail?.source) {
          photos.push({ url: page.thumbnail.source, title: page.title });
        }
      }
    }
  } catch(e) {
    console.error('wikipedia ja error:', e.message);
  }

  // ── 2. Wikipedia en フォールバック（ja で少なければ追加）──────────
  if (photos.length < 3) {
    try {
      const geoRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=geosearch` +
        `&gsradius=3000&gscoord=${lat}|${lng}&gslimit=10&format=json`,
        { headers: { 'User-Agent': UA } }
      );
      const geoData = await geoRes.json();
      const pages = (geoData?.query?.geosearch || []).slice(0, 8);

      if (pages.length > 0) {
        const titles = pages.map(p => p.title).join('|');
        const thumbRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query` +
          `&titles=${encodeURIComponent(titles)}&prop=pageimages&pithumbsize=600&format=json`,
          { headers: { 'User-Agent': UA } }
        );
        const thumbData = await thumbRes.json();
        for (const page of Object.values(thumbData?.query?.pages || {})) {
          if (page.thumbnail?.source) {
            const alreadyHave = photos.some(p => p.title === page.title);
            if (!alreadyHave) photos.push({ url: page.thumbnail.source, title: page.title });
          }
        }
      }
    } catch(e) {
      console.error('wikipedia en error:', e.message);
    }
  }

  // ── 3. Wikimedia Commons 周辺写真（まだ少なければ追加）───────────
  if (photos.length < 4) {
    try {
      const commonsRes = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&list=geosearch` +
        `&gsnamespace=6&gsradius=3000&gscoord=${lat}|${lng}&gslimit=15&format=json`,
        { headers: { 'User-Agent': UA } }
      );
      const commonsData = await commonsRes.json();
      const files = (commonsData?.query?.geosearch || []).slice(0, 10);

      if (files.length > 0) {
        const titles = files.map(f => f.title).join('|');
        const imgRes = await fetch(
          `https://commons.wikimedia.org/w/api.php?action=query` +
          `&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url&iiurlwidth=600&format=json`,
          { headers: { 'User-Agent': UA } }
        );
        const imgData = await imgRes.json();
        for (const page of Object.values(imgData?.query?.pages || {})) {
          const ii = page.imageinfo?.[0];
          if (ii?.thumburl) {
            photos.push({ url: ii.thumburl, title: page.title.replace(/^File:/, '') });
          }
        }
      }
    } catch(e) {
      console.error('wikimedia commons error:', e.message);
    }
  }

  console.log('photos found:', photos.length, 'near', lat, lng);
  return res.status(200).json({ photos: photos.slice(0, 12) });
};
module.exports = handler;
