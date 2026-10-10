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
