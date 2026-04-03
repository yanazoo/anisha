export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const { imageUrl, prompt, url } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  try {
    const parts = [];

    if (imageUrl) {
      try {
        const imgRes = await fetch(imageUrl);
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer();
          const b64 = Buffer.from(buf).toString("base64");
          const mime = imgRes.headers.get("content-type") || "image/jpeg";
          parts.push({ inline_data: { mime_type: mime, data: b64 } });
        }
      } catch (e) {
        console.log("img err:", e.message);
      }
    }

    parts.push({ text: prompt + (url ? "\n\nURL: " + url : "") });

    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }] })
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      return res.status(500).json({ error: err.slice(0, 200) });
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("response:", text.slice(0, 200));

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(200).json({ work: null, title: null, location: null, ep: null, emoji: "📍", confidence: 0, candidates: [] });

    return res.status(200).json(JSON.parse(match[0]));

  } catch (e) {
    console.error("err:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
