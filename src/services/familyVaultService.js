import { logApiResponse } from '../utils/apiLogger';

const AI_URL = 'https://app.clickpickandcook.com/.netlify/functions/ai';

function extractResponseText(json) {
    return json?.content?.find((part) => part?.type === 'text')?.text
        || json?.message
        || json?.reply
        || '';
}

function parseJsonLoose(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) return null;

        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }
}

async function postToAi(payload, label) {
    const res = await fetch(AI_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FernApp/1.0 (myaifern.com)',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(`Family Vault ${label} request failed (${res.status})`);
    }

    const json = await res.json();
    logApiResponse(`ai (family_vault ${label})`, json);
    return json;
}

function normalizeParsedRecipe(parsed) {
    const ingredients = Array.isArray(parsed?.ingredients)
        ? parsed.ingredients.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
    const instructions = Array.isArray(parsed?.instructions)
        ? parsed.instructions.map((step) => String(step || '').trim()).filter(Boolean)
        : [];

    return {
        title: String(parsed?.title || '').trim(),
        origin: String(parsed?.origin || '').trim(),
        story: String(parsed?.story || '').trim(),
        ingredients,
        instructions,
    };
}

// "Let Fern help tell the story" — turns a name/origin into a short warm
// family-recipe story paragraph. Plain text back, not JSON.
export async function tellRecipeStory({ title, origin, locale, token }) {
    const json = await postToAi({
        system: 'You are Fern, a warm family-recipe storyteller. Write a short (2-4 sentence), heartfelt story paragraph about a family recipe, based on whatever the user gives you. Return ONLY the story paragraph, no preamble, no quotes.',
        messages: [
            {
                role: 'user',
                content: `Write a short family-recipe story for "${title || 'this recipe'}"${origin ? `, made by ${origin}` : ''}.`,
            },
        ],
        locale: locale || 'en',
        token,
    }, 'tell-story');

    return extractResponseText(json).trim();
}

// Import a recipe from a URL. The backend AI proxy is asked to fetch and
// parse the page; if it can't actually browse, it still returns its best
// structured guess, which the caller should let the user review/edit.
export async function importRecipeFromUrl({ url, locale, token }) {
    const json = await postToAi({
        system: 'You are a recipe import assistant. Given a URL to a recipe page, fetch it and extract the recipe. Return ONLY a single JSON object, no markdown, no explanation: {"title":"","origin":"","story":"","ingredients":["1 cup flour"],"instructions":["Preheat oven..."]}. "origin" is the site/author if known. "story" is a 1-2 sentence summary of the recipe\'s background if the page mentions one, else empty string.',
        messages: [
            {
                role: 'user',
                content: `Import the recipe from this URL: ${url}`,
            },
        ],
        feature: 'recipe_search',
        locale: locale || 'en',
        token,
    }, 'import-url');

    const parsed = parseJsonLoose(extractResponseText(json));
    return normalizeParsedRecipe(parsed || {});
}

const SCAN_PROMPTS = {
    full: 'This photo is a handwritten or printed family recipe card showing both ingredients and instructions. Read it carefully and transcribe it faithfully.',
    ingredients: 'This photo is the ingredients page of a family recipe card. Read it carefully and transcribe just the ingredients faithfully.',
    instructions: 'This photo is the instructions/directions page of a family recipe card. Read it carefully and transcribe just the steps faithfully.',
};

// Scans a photographed recipe card via the same AI proxy every other AI
// feature in this app uses, sending the image as a vision content block
// (the `ai` endpoint's response shape — `content: [{type:'text',...}]` —
// mirrors Anthropic's Messages API, which accepts an `image` content block
// alongside `text` in the same message).
export async function scanRecipeCard({ photo, mode, locale, token }) {
    const promptIntro = SCAN_PROMPTS[mode] || SCAN_PROMPTS.full;
    const wantsIngredients = mode !== 'instructions';
    const wantsInstructions = mode !== 'ingredients';

    const json = await postToAi({
        system: `You are transcribing a photographed family recipe card. ${promptIntro} Return ONLY a single JSON object, no markdown, no explanation: {"title":"","origin":"","story":"","ingredients":[${wantsIngredients ? '"1 cup flour"' : ''}],"instructions":[${wantsInstructions ? '"Preheat oven..."' : ''}]}. Only fill "title"/"origin"/"story" if they're visibly written on the card, otherwise leave them as empty strings. ${!wantsIngredients ? 'Leave "ingredients" as an empty array.' : ''} ${!wantsInstructions ? 'Leave "instructions" as an empty array.' : ''}`,
        messages: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: 'Transcribe this recipe card. Return ONLY the JSON object.' },
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: photo?.mimeType || 'image/jpeg',
                            data: photo?.base64 || '',
                        },
                    },
                ],
            },
        ],
        feature: 'recipe_search',
        locale: locale || 'en',
        token,
    }, `scan-card-${mode}`);

    const parsed = parseJsonLoose(extractResponseText(json));
    return normalizeParsedRecipe(parsed || {});
}
