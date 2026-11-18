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

// A picture made by AI for this exact dish (web function `recipe-picture`; made once per title, then reused).
// Returns { url, error }: url is null when it could not be made, and error says why.
export async function fetchRecipePicture(title, hint, ingredients) {
    if (!title) return { url: null, error: 'no title' };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 30000);
    try {
        const res = await fetch('https://app.clickpickandcook.com/.netlify/functions/recipe-picture', {
            method: 'POST',
            signal: ctl.signal,
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
            body: JSON.stringify({ title, hint: hint || '', ingredients: Array.isArray(ingredients) ? ingredients.slice(0, 8) : [] }),
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
