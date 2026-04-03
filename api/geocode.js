const handler = async (req, res) => {
if (req.method !== “POST”) {
res.status(405).json({ error: “not allowed” });
return;
}

const address = (req.body || {}).address || “”;
if (!address) {
res.status(400).json({ error: “address required” });
return;
}

console.log(“geocoding:”, address);

// Nominatim (OSM) - サーバーサイドからはUser-Agent制限なし
try {
const r = await fetch(
“https://nominatim.openstreetmap.org/search?format=json&q=” +
encodeURIComponent(address) + “&limit=1&accept-language=ja”,
{ headers: { “User-Agent”: “AniFrame/1.0 (anisha-rho.vercel.app)” } }
);
const d = await r.json();
console.log(“nominatim result:”, JSON.stringify(d).slice(0, 200));
if (d && d[0]) {
res.status(200).json({ lat: d[0].lat, lng: d[0].lon, source: “nominatim” });
return;
}
} catch (e) {
console.log(“nominatim err:”, e.message);
}

// Photon (Komoot) フォールバック
try {
const r = await fetch(
“https://photon.komoot.io/api/?q=” + encodeURIComponent(address) + “&limit=1&lang=ja”
);
const d = await r.json();
if (d && d.features && d.features[0]) {
const coords = d.features[0].geometry.coordinates;
res.status(200).json({ lat: coords[1], lng: coords[0], source: “photon” });
return;
}
} catch (e) {
console.log(“photon err:”, e.message);
}

res.status(404).json({ error: “not found” });
};

module.exports = handler;