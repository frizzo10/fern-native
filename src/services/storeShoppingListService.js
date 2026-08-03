const API_HEADERS = {
    'Content-Type': 'application/json',
    'User-Agent': 'FernApp/1.0 (myaifern.com)',
};

async function postList(url, payload) {
    const res = await fetch(url, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(`Store list request failed (${res.status})`);
    }

    return res.json();
}

// Instacart accepts the whole list at once — no per-item search fallback.
export async function sendListToInstacart({ items, title }) {
    const json = await postList('https://app.clickpickandcook.com/.netlify/functions/instacart-list', {
        items: Array.isArray(items) ? items : [],
        title: title || 'My Shopping List',
        linkbackUrl: 'https://app.clickpickandcook.com',
    });

    return { url: String(json?.url || '').trim() };
}

// Kroger/Albertsons only support a single-item search URL — the response's
// `url` is a search results page for just the first item, and everything
// else comes back in `remainingItems` for the user to copy/paste themselves.
export async function sendListToKroger({ items, title }) {
    const json = await postList('https://app.clickpickandcook.com/.netlify/functions/kroger-list', {
        items: Array.isArray(items) ? items : [],
        title: title || 'My Shopping List',
        banner: 'Kroger',
        bannerUrl: 'https://www.kroger.com',
    });

    return {
        url: String(json?.url || '').trim(),
        remainingItems: Array.isArray(json?.remainingItems) ? json.remainingItems : [],
    };
}

export async function sendListToAlbertsons({ items, title }) {
    const json = await postList('https://app.clickpickandcook.com/.netlify/functions/albertsons-list', {
        items: Array.isArray(items) ? items : [],
        title: title || 'My Shopping List',
        banner: 'Albertsons',
        bannerUrl: 'https://www.albertsons.com',
    });

    return {
        url: String(json?.url || '').trim(),
        remainingItems: Array.isArray(json?.remainingItems) ? json.remainingItems : [],
    };
}
