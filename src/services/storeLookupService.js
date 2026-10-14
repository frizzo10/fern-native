import { logApiResponse } from '../utils/apiLogger';

// The geocode function only searches the `q` text (it ignores `zip` when it has a Google key),
// so the ZIP has to be inside `q` or the result is just "a Walmart somewhere". The web app
// sends "<name> grocery store near <zip>"; do the same, then retry "<name> <zip>".
async function geocodeOnce(q, zipCode, token) {
  const query = encodeURIComponent(q);
  const zip = encodeURIComponent(String(zipCode || '').trim());
  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
  const url = `https://app.clickpickandcook.com/.netlify/functions/geocode?q=${query}&zip=${zip}${tokenParam}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'FernApp/1.0 (myaifern.com)',
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    return null;
  }

  const payload = await res.json();
  logApiResponse('geocode', payload);
  if (!payload || typeof payload !== 'object') return null;

  const lat = Number.parseFloat(payload.lat);
  const lon = Number.parseFloat(payload.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return {
    lat,
    lon,
    lng: lon,
    address: String(payload.address || '').trim(),
    source: String(payload.source || '').trim(),
  };
}

export async function findStoreLocationByZip(storeName, zipCode, token) {
  const name = String(storeName || '').trim();
  const zip = String(zipCode || '').trim();
  const first = await geocodeOnce(`${name} grocery store near ${zip}`, zip, token);
  if (first) return first;
  return geocodeOnce(`${name} ${zip}`, zip, token);
}
