'use strict';

/*
 * PXL-AI-0002A — isolated health endpoint for AI Report.
 * Deliberately independent from server.js / Express monkey-patching.
 * No database access. No writes. No Gemini call.
 */
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      ok: false,
      error: 'Method Not Allowed'
    });
  }

  return res.status(200).json({
    ok: true,
    revision: 'PXL-AI-0002A',
    module: 'AI Report',
    mode: 'READ_ONLY',
    report_engine: 'health_only',
    ai_provider: null,
    database_access: false,
    timestamp: new Date().toISOString()
  });
};
