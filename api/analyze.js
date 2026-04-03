const handler = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "not allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "no key" });
    return;
  }

  const body = req.body || {};
  const prompt = body.prompt || "";
  const imageUrl = body.imageUrl || null;
  const url = body.url || "";

  const parts = [];

  if (imageUrl) {
    try {
      const r = await fetch(imageUrl);
      if (r.ok) {
        const buf = await r.arrayBuffer();
        const b64 = Buffer.from(buf).toString("base64");
        const mime = r.headers.get("content-type") || "image/jpeg";
        parts.push({ inline_data: { mime_type: mime, data: b64 } });
      }
    } catch (e) {
      console.log("img:", e.message);
    }
  }

  parts.push({ text: prompt + "\nURL: " + url });

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: parts }] })
      }
    );

    const d = await r.json();
    const text = d.candidates[0].content.parts[0].text || "";
    console.log("res:", text.slice(0, 200));

    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const result = Array.isArray(parsed) ? parsed[0] : parsed;

    res.status(200).json(result);
  } catch (e) {
    console.error("err:", e.message);
    res.status(500).json({ error: e.message });
  }
};

module.exports = handler;
