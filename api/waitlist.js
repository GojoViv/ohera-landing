// Vercel serverless function — O'HERA Waitlist
// Appends email submissions to Google Sheets via the Sheets API

export const config = { runtime: 'edge' };

const SHEET_ID      = '13tBnJKElb_rCjO20gE8Q2RnT4JBcZqCoIHn9nAtoP7o';
const SHEET_RANGE   = 'Sheet1!A:C';
const TOKEN_URL     = 'https://oauth2.googleapis.com/token';
const SHEETS_BASE   = 'https://sheets.googleapis.com/v4/spreadsheets';

async function getAccessToken() {
  const body = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type:    'refresh_token',
  });
  const res  = await fetch(TOKEN_URL, { method: 'POST', body });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token exchange failed: ' + JSON.stringify(data));
  return data.access_token;
}

export default async function handler(req) {
  // CORS — allow the landing page origin
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  let email;
  try {
    const body = await req.json();
    email = (body.email || '').trim().toLowerCase();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400, headers });
  }

  try {
    const token     = await getAccessToken();
    const timestamp = new Date().toISOString();

    const appendRes = await fetch(
      `${SHEETS_BASE}/${SHEET_ID}/values/${encodeURIComponent(SHEET_RANGE)}:append?valueInputOption=USER_ENTERED`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[email, timestamp, 'ohera-landing']],
        }),
      }
    );

    if (!appendRes.ok) {
      const err = await appendRes.text();
      throw new Error('Sheets API error: ' + err);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });

  } catch (err) {
    console.error('Waitlist error:', err.message);
    return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers });
  }
}
