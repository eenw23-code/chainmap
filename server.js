const express = require('express');
const path = require('path');
const app = express();

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/v1/messages', async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(401).json({ error: { message: 'API Key 없음' } });
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// DART 보고서 zip을 브라우저로 스트림하는 프록시 엔드포인트
// (CORS 우회용 — DART API는 브라우저 직접 호출 불가)
app.get('/api/dart/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || !url.startsWith('https://opendart.fss.or.kr/')) {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    const r = await fetch(url);
    const contentType = r.headers.get('content-type') || 'application/octet-stream';
    res.set('Content-Type', contentType);
    const buf = Buffer.from(await r.arrayBuffer());
    res.status(r.status).send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`서버 실행 중: http://localhost:${PORT}`));
