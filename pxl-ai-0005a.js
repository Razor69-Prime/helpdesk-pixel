'use strict';

// PXL-AI-0005A1 — isolated Gemini connection health endpoint.
// No PixelApps business data is sent to Gemini in this revision.
const express = require('express');
const jwt = require('jsonwebtoken');
const originalStatic = express.static;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

function authorized(req){
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : String(req.headers['x-auth-token'] || '');
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, process.env.SESSION_SECRET || 'pixel-helpdesk-2026-secret');
    return !!decoded?.user;
  } catch (_) { return false; }
}

express.static = function pxlAi0005aStatic(root, options){
  const middleware = originalStatic(root, options);
  return async function pxlAi0005aMiddleware(req, res, next){
    if (req.method !== 'GET' || req.path !== '/api/ai/gemini/health') return middleware(req, res, next);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    if (!authorized(req)) return res.status(401).json({ ok:false, connected:false, error:'Unauthorized' });

    const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) return res.status(503).json({ ok:false, connected:false, configured:false, model:MODEL, error:'GEMINI_API_KEY belum dikonfigurasi.' });

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-goog-api-key':apiKey },
        body:JSON.stringify({
          contents:[{ parts:[{ text:'Reply with exactly: PIXEL_GEMINI_OK' }] }],
          generationConfig:{ maxOutputTokens:16 }
        }),
        signal:controller.signal
      }).finally(() => clearTimeout(timer));
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = body?.error?.message || `Gemini HTTP ${response.status}`;
        return res.status(503).json({ ok:false, connected:false, configured:true, model:MODEL, error:message });
      }
      const text = String(body?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('') || '').trim();
      return res.json({ ok:true, connected:true, configured:true, model:MODEL, response_ok:text.includes('PIXEL_GEMINI_OK') });
    } catch (e) {
      return res.status(503).json({ ok:false, connected:false, configured:true, model:MODEL, error:e?.name==='AbortError'?'Gemini timeout':String(e?.message||e) });
    }
  };
};
