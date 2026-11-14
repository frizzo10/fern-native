const RECIPE_IMAGE_URL = 'https://app.clickpickandcook.com/.netlify/functions/get-recipe-image';

// `index` (optional) is the recipe's position within a set. The get-recipe-image
// function uses it to pick a different Pexels page/result per recipe, so callers
// showing several recipes at once should pass it. Omitted = same behavior as before.
export async function fetchRecipeImage(query, token, index) {
    if (!query) return null;
    try {
        const res = await fetch(RECIPE_IMAGE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'FernApp/1.0 (myaifern.com)',
            },
            body: JSON.stringify(
                Number.isInteger(index) ? { query, token, index } : { query, token }
            ),
        });
        const json = await res.json();
        return json?.url || null;
    } catch (e) {
        console.warn('[recipe-image] fetch failed', query, e);
        return null;
    }
}

// Photos whose own caption names the dish, best first ([] = none, show the emoji instead).
// `title` is the dish name the caption is checked against; `must` (optional) is the one or two
// words the AI says the dish is ("tuile", "clam chowder"); `alt` (optional) is a common look-alike
// food to fall back on ("thin crisp cookies"). An older server that doesn't know
// `strict` answers with a single `url`, which is used as is.
export async function fetchRecipeImages(query, token, { title, must, alt } = {}) {
    if (!query) return [];
    try {
        const res = await fetch(RECIPE_IMAGE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'FernApp/1.0 (myaifern.com)',
            },
            body: JSON.stringify({ query, token, strict: true, title: title || query, must: must || undefined, alt: alt || undefined }),
        });
        const json = await res.json();
        if (Array.isArray(json?.urls)) return json.urls.filter(Boolean);
        return json?.url ? [json.url] : [];
    } catch (e) {
        console.warn('[recipe-image] fetch failed', query, e);
        return [];
    }
}

// A picture made by AI for this exact dish (web function `recipe-picture`; made once per title, then reused).
// Returns { url, error }: url is null when it could not be made, and error says why.
export async function fetchRecipePicture(title, hint) {
    if (!title) return { url: null, error: 'no title' };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 30000);
    try {
        const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/recipe-picture', {
            method: 'POST',
            signal: ctl.signal,
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
            body: JSON.stringify({ title, hint: hint || '' }),
        });
        if (!res.ok) return { url: null, error: `server ${res.status}` };
        const json = await res.json();
        return { url: json?.url || null, error: json?.url ? '' : (json?.error || 'no picture') };
    } catch (e) {
        return { url: null, error: e?.name === 'AbortError' ? 'timed out' : String(e?.message || e) };
    } finally {
        clearTimeout(timer);
    }
}
