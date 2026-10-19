// Turns a recipe ingredient line into something you can actually buy:
// "1/4 cup soy sauce" -> "Soy sauce", "3 cloves garlic, minced" -> "Garlic",
// "1 can (14 oz) coconut milk" -> "Coconut milk". Quantities, units, sizes and prep
// notes are dropped; the grocery name stays. Falls back to the original if nothing is left.

const UNITS = '(?:cups?|c|tablespoons?|tbsps?|tbs|tsps?|teaspoons?|ounces?|oz|pounds?|lbs?|lb|grams?|g|kilograms?|kg|milliliters?|ml|liters?|litres?|l|quarts?|qt|pints?|pt|gallons?|gal|cans?|jars?|bottles?|packages?|pkgs?|packs?|bags?|boxes?|bunch(?:es)?|cloves?|heads?|sprigs?|stalks?|slices?|pieces?|sticks?|dashes|dash|pinch(?:es)?|handfuls?|splash(?:es)?|drizzles?|knobs?|cubes?)';
const NUM = '(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?(?:\\s*(?:-|–|to)\\s*\\d+(?:\\.\\d+)?)?|[¼½¾⅓⅔⅛]|\\d+\\s*[¼½¾⅓⅔⅛])';
const PREP = /\b(?:finely|roughly|thinly|coarsely|freshly)?\s*(?:chopped|minced|diced|sliced|grated|shredded|crushed|peeled|melted|softened|cubed|halved|quartered|trimmed|drained|rinsed|beaten|toasted|mashed|julienned|torn|divided|packed)\b/gi;
const FILLER = /\b(?:to taste|for serving|for garnish|for frying|as needed|optional|plus more|or more|or less|about|approximately|a few|some)\b/gi;
const SIZE = /\b(?:large|medium|small|extra[- ]large|heaping|level|scant|generous|thick|thin)\b/gi;

// Words that only describe an ingredient. "Boneless, skinless chicken thighs" must not be cut at the first comma
// (that left just "Boneless"): keep the descriptors and the noun that follows, drop only the prep notes after it.
const DESCRIPTORS = new Set(['boneless', 'skinless', 'bone-in', 'skin-on', 'fresh', 'frozen', 'lean', 'extra', 'organic', 'whole', 'raw', 'dried', 'dry', 'ground', 'smoked', 'low-sodium', 'unsalted', 'salted', 'sweetened', 'unsweetened', 'plain', 'light', 'full-fat', 'fat-free', 'low-fat', 'reduced-fat', 'canned', 'cooked', 'uncooked', 'and']);
function keepNoun(str) {
    const parts = str.split(/\s*[,;]\s*/);
    let i = 0;
    const isDesc = (p) => { const w = p.toLowerCase().replace(/[^a-z\- ]/g, ' ').split(/\s+/).filter(Boolean); return w.length > 0 && w.every((x) => DESCRIPTORS.has(x)); };
    while (i < parts.length - 1 && isDesc(parts[i])) i += 1;
    return parts.slice(0, i + 1).join(' ');
}

export function toShoppingName(line) {
    const original = String(line || '').trim();
    if (!original) return '';
    let s = original;
    s = s.replace(/\([^)]*\)/g, ' ');                 // (14 oz), (about 2 cups)
    s = s.replace(FILLER, ' ');
    s = s.replace(new RegExp(`^\\s*(?:a|an|one)?\\s*(?:${NUM})?\\s*(?:${UNITS})\\b\\.?\\s*(?:of\\s+)?`, 'i'), ' ');
    s = s.replace(new RegExp(`^\\s*${NUM}\\s*(?:x\\s*)?`, 'i'), ' ');
    s = s.replace(new RegExp(`^\\s*(?:${UNITS})\\b\\.?\\s*(?:of\\s+)?`, 'i'), ' ');
    s = keepNoun(s);                                    // "garlic, minced" -> "garlic"; "boneless, skinless chicken" stays whole
    s = s.replace(SIZE, ' ').replace(PREP, ' ');
    s = s.replace(/\s+/g, ' ').replace(/^(?:of|and|or)\s+/i, '').replace(/[\s.:-]+$/, '').trim();
    if (s.length < 2) return original;
    return s.charAt(0).toUpperCase() + s.slice(1);
}
