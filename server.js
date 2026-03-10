const express = require('express');
const path = require('path');
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Anthropic API 프록시
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

// DART API CORS 우회 프록시
const ALLOWED_HOST = 'opendart.fss.or.kr';

app.get('/api/dart/proxy', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: 'url 파라미터 필요' });

    const parsed = new URL(targetUrl);
    if (parsed.hostname !== ALLOWED_HOST) {
      return res.status(403).json({ error: '허용되지 않은 도메인' });
    }

    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    const contentType = response.headers.get('content-type') || '';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');

    // 바이너리(zip) vs 텍스트/JSON 구분
    if (contentType.includes('json') || contentType.includes('text')) {
      const text = await response.text();
      res.status(response.status).send(text);
    } else {
      const buf = await response.arrayBuffer();
      res.status(response.status).send(Buffer.from(buf));
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`서버 실행 중: http://localhost:${PORT}`));
