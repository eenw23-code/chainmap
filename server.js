const express = require('express');
const path = require('path');
const AdmZip = require('adm-zip');
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

app.post('/api/dart/report-text', async (req, res) => {
  try {
    const { key, corpName } = req.body;
    const DART = 'https://opendart.fss.or.kr/api';

    const tryNames = [
      corpName,
      corpName.replace(/^\(주\)|^주식회사\s*/,'').replace(/\(주\)$|\s*주식회사$/,'').trim()
    ].filter((v,i,a) => a.indexOf(v) === i);

    let corpCode = null;
    for (const name of tryNames) {
      const r = await fetch(`${DART}/list.json?crtfc_key=${key}&corp_name=${encodeURIComponent(name)}&page_count=5&sort=date&sort_mth=desc`);
      const j = await r.json();
      if (j.status === '000' && j.list?.length) { corpCode = j.list[0].corp_code; break; }
    }
    if (!corpCode) return res.json({ text: null, error: '기업을 DART에서 찾을 수 없습니다' });

    const filingR = await fetch(`${DART}/list.json?crtfc_key=${key}&corp_code=${corpCode}&pblntf_ty=A&page_count=10&sort=date&sort_mth=desc`);
    const filingJ = await filingR.json();
    const filing = filingJ.list?.find(f =>
      f.report_nm.includes('사업보고서') || f.report_nm.includes('감사보고서')
    );
    if (!filing) return res.json({ text: null, error: 'DART에서 사업보고서/감사보고서를 찾을 수 없습니다' });

    const docR = await fetch(`${DART}/document.json?crtfc_key=${key}&rcept_no=${filing.rcept_no}`);
    const docBuf = Buffer.from(await docR.arrayBuffer());

    const zip = new AdmZip(docBuf);
    let allText = '';
    for (const entry of zip.getEntries()) {
      const ename = entry.entryName.toLowerCase();
      if (ename.endsWith('.xml') || ename.endsWith('.html') || ename.endsWith('.htm')) {
        try {
          const raw = entry.getData();
          let content;
          try { content = new TextDecoder('euc-kr').decode(raw); }
          catch { content = raw.toString('utf8'); }
          const text = content.replace(/<[^>]+>/g,' ').replace(/&[a-zA-Z]+;/g,' ').replace(/\s+/g,' ').trim();
          allText += text + '\n';
        } catch {}
      }
    }

    const idx = allText.search(/사업의\s*내용/);
    const extracted = idx !== -1 ? allText.slice(idx, idx + 18000) : allText.slice(0, 18000);

    res.json({ text: extracted, reportName: filing.report_nm, reportDate: filing.rcept_dt, corpCode });
  } catch (err) {
    res.status(500).json({ text: null, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`서버 실행 중: http://localhost:${PORT}`));
