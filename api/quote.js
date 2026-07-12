export default async function handler(req, res) {
  // El frontend siempre llama con path relativo (mismo origen) — reflejar el origen
  // solo si coincide con el propio host, en vez de '*', para no exponer esto como
  // proxy gratuito a Yahoo Finance para cualquier sitio de terceros.
  const origin = req.headers.origin || '';
  if (origin && origin === `https://${req.headers.host}`) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'No symbol' });

  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!response.ok) return res.status(response.status).json({ error: 'upstream error' });
    const data = await response.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return res.status(404).json({ error: 'no data' });
    res.json({
      price: meta.regularMarketPrice ?? meta.chartPreviousClose,
      currency: (meta.currency || 'USD').toUpperCase(),
      symbol: meta.symbol
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
