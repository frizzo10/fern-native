// Which saved store is the user at, and is that store's flyer already scanned this week?
// A saved store looks like "Publix - Blowing Rock" or "Harris Teeter # 1066"; a scan's store is whatever the
// flyer printed ("Lowes Foods"). We compare by chain name, so every Publix shares one flyer.
export function chainKey(name) {
  return String(name || '').toLowerCase().split(/ - |#/)[0].replace(/[^a-z0-9]/g, '');
}

export function dealsForStore(deals, storeName) {
  const key = chainKey(storeName);
  if (!key) return [];
  return (deals || []).filter((d) => {
    const dk = chainKey(d.store);
    return dk && (dk === key || dk.includes(key) || key.includes(dk));
  });
}

function meters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Saved store within `maxMeters` of the position, or null.
export function storeAtPosition(stores, coords, maxMeters = 400) {
  if (!coords) return null;
  let best = null;
  let bestD = Infinity;
  (stores || []).forEach((s) => {
    const lat = Number(s.lat);
    const lng = Number(s.lng ?? s.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const d = meters(coords.latitude, coords.longitude, lat, lng);
    if (d < bestD) { bestD = d; best = s; }
  });
  return best && bestD <= maxMeters ? best : null;
}
