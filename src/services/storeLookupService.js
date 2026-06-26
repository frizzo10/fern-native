export async function findStoreLocationByZip(storeName, zipCode) {
  const query = encodeURIComponent(String(storeName || '').trim());
  const zip = encodeURIComponent(String(zipCode || '').trim());
  const url = `https://app.clickpickandcook.com/.netlify/functions/geocode?q=${query}&zip=${zip}`;

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
