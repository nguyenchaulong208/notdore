/**
 * POST /api/nvidia-proxy
 * CORS proxy for NVIDIA NIM API — forwards the browser's request
 * (including the user's own API key in the Authorization header)
 * to integrate.api.nvidia.com, and returns the response.
 *
 * WHY: NVIDIA's API doesn't set CORS headers, so browsers block
 * direct fetch() calls.  This proxy adds nothing secret — it just
 * re-sends whatever the client sent, acting as a transparent relay.
 * The API key still belongs to the user and is passed through as-is.
 *
 * Security: only proxies to the NVIDIA NIM chat/completions endpoint,
 * rejects anything else.
 */
export default async function handler(req, res) {
  // Only allow POST
  if (req.method === 'OPTIONS') {
    // Preflight for CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract Authorization header from client
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(400).json({ error: 'Missing Authorization header' });
  }

  // Fixed target: only NVIDIA NIM chat/completions
  const targetUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';

  try {
    const nvidiaRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(req.body),
    });

    const data = await nvidiaRes.text();

    // Forward NVIDIA's status code and body
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', nvidiaRes.headers.get('content-type') || 'application/json');
    res.status(nvidiaRes.status).send(data);
  } catch (err) {
    console.error('[nvidia-proxy] Fetch error:', err.message);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(502).json({
      error: `Không thể kết nối tới NVIDIA API: ${err.message}`,
    });
  }
}
