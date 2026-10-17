// Groups a cookie-style cookbook into chapters by cookie type, from the recipe titles.
// The same rules (and order) are used by the shared cookbook web page (cookbook-share.html) so the library
// copy and the shared copy always match. Keep the two in step.
//
// buildChapters(recipes) -> null when the book is not a cookie collection (too few recipes or too few matches),
// otherwise [{ key, items: [recipe, ...] }] in chapter order with empty chapters left out.
// `key` is a translation key (ch_*), the chapter number is the position in the returned list.

const DEFAULT_KEY = 'ch_drop';

// First matching rule wins; anything unmatched is a classic drop cookie.
const RULES = [
  ['ch_candy', /(truffles?|toffee|bark|fudge|brittle)\s*$/i],
  ['ch_bars', /\b(bars?|brownies|blondies|squares)\b/i],
  ['ch_meringue', /meringue|macaroon|kisses\b/i],
  ['ch_spritz', /spritz/i],
  ['ch_filled', /thumbprint|sandwich|linzer|rugelach|filled|pillows/i],
  ['ch_slice', /icebox|refrigerator|slice|pinwheel|swirl|ribbon/i],
  ['ch_shortbread', /shortbread|meltaway|wedding cakes|crescent/i],
  ['ch_decorated', /snowm[ae]n|santa|gnome|reindeer|ornament|grinch|\btrees?\b|\bstars?\b|bells|wreath|gingerbread|candy cane|sinterklaas|snowshoe|chevron/i],
];

const ORDER = ['ch_drop', 'ch_meringue', 'ch_spritz', 'ch_filled', 'ch_slice', 'ch_shortbread', 'ch_decorated', 'ch_bars', 'ch_candy'];

export function buildChapters(recipes) {
  const list = Array.isArray(recipes) ? recipes : [];
  if (list.length < 8) return null;

  let matched = 0;
  const groups = {};
  list.forEach((recipe) => {
    const title = String(recipe?.title || '');
    let key = null;
    for (let i = 0; i < RULES.length; i += 1) {
      if (RULES[i][1].test(title)) { key = RULES[i][0]; break; }
    }
    if (key) matched += 1;
    const k = key || DEFAULT_KEY;
    (groups[k] = groups[k] || []).push(recipe);
  });

  if (matched < 4) return null; // not a cookie-style book: keep the plain grid
  return ORDER.filter((k) => groups[k]).map((key) => ({ key, items: groups[key] }));
}
