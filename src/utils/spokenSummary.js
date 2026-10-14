// Spoken replies are billed per character, so Fern speaks only the opening of a long
// answer (the full text is still shown on screen). Cuts on a sentence end when it can.
const MAX_SPOKEN_CHARS = 220;

export function spokenSummary(text, maxChars = MAX_SPOKEN_CHARS) {
    const clean = String(text || '')
        .replace(/[*_`#>]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!clean || clean.length <= maxChars) return clean;

    const sentences = clean.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [clean];
    let out = '';
    for (const s of sentences) {
        if ((out + s).trim().length > maxChars) break;
        out += s;
    }
    out = out.trim();
    if (out) return out;

    // First sentence alone is too long: cut at a word boundary.
    const cut = clean.slice(0, maxChars);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}
