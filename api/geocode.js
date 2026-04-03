const handler = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'not allowed' });
    return;
  }

  const address = (req.body || {}).address || '';
  if (!address) {
    res.status(400).json({ error: 'address required' });
    return;
  }

  try {
    const r = await fetch(
      'https://nominatim.openstreetmap.org/search?format=json&q=' +
      encodeURIComponent(address) + '&limit=1&accept-language=ja',
      { headers: { 'User-Agent': 'AniFrame/1.0' } }
    );
    const d = await r.json();
    if (d && d[0]) {
      res.status(200).json({ lat: d[0].lat, lng: d[0].lon });
      return;
    }
  } catch (e) {
    console.log('err:', e.message);
  }

  res.status(404).json({ error: 'not found' });
};

module.exports = handler;
