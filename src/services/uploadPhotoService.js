export async function uploadPhoto(photoBase64DataUri, fileName) {
  const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/upload-photo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'FernApp/1.0 (myaifern.com)',
    },
    body: JSON.stringify({ photoBase64: photoBase64DataUri, fileName }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.url) {
    // Say why (status + size) so a failed upload is never silent.
    throw new Error(`upload ${res.status} (${Math.round((photoBase64DataUri || '').length / 1024)} KB)${json?.error ? ': ' + json.error : ''}`);
  }
  return json.url;
}
