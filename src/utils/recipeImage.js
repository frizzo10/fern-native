const RECIPE_IMAGE_URL = 'https://app.clickpickandcook.com/.netlify/functions/get-recipe-image';

export async function fetchRecipeImage(query, token) {
    if (!query) return null;
    try {
        const res = await fetch(RECIPE_IMAGE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'FernApp/1.0 (myaifern.com)',
            },
            body: JSON.stringify({ query, token }),
        });
        const json = await res.json();
        return json?.url || null;
    } catch (e) {
        console.warn('[recipe-image] fetch failed', query, e);
        return null;
    }
}
