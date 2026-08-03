// Dev-only console print of raw API responses, so a bad/unexpected shape from
// a Netlify function is visible immediately instead of silently parsing into
// an empty result (e.g. "0 picks" when the AI didn't return valid JSON).
// Long payloads are truncated so one call doesn't flood the console.
const MAX_CHARS = 2000;

export function logApiResponse(label, payload) {
    let text;
    try {
        text = JSON.stringify(payload, null, 2);
    } catch {
        text = String(payload);
    }

    if (text && text.length > MAX_CHARS) {
        text = `${text.slice(0, MAX_CHARS)}\n…(truncated, ${text.length} chars total)`;
    }

    console.log(`[api] ${label} →\n${text}`);
}
