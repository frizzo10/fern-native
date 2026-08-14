export async function uploadPhoto(photoBase64DataUri, fileName) {
  const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/upload-photo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'FernApp/1.0 (myaifern.com)',
    },
    body: JSON.stringify({ photoBase64: photoBase64DataUri, fileName }),
  });

  const json = await res.json();
  return json?.url || null;
}
