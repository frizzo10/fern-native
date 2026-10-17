// Groups a cookie-style cookbook into chapters by cookie type, from the recipe titles.
// The same rules (and order) are used by the shared cookbook web page (cookbook-share.html) so the library
// copy and the shared copy always match. Keep the two in step.
//
// buildChapters(recipes, saved) -> null when there is nothing to chapter, otherwise
// [{ key | name, items: [recipe, ...] }] in chapter order with empty chapters left out.
//  - `saved` = AI-made layout from cookbookOrganizer ({ chapters: [{ name, ids }] }); when present it wins.
//  - otherwise the built-in cookie-type rules below (instant, no AI), only for cookie-style books.
// `key` is a translation key (ch_*); `name` is a literal AI chapter name. Chapter number = position.

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

export function buildChapters(recipes, saved) {
  const list = Array.isArray(recipes) ? recipes : [];
  if (list.length < 8) return null;

  if (saved && Array.isArray(saved.chapters) && saved.chapters.length) {
    const byId = new Map(list.map((r) => [String(r.id), r]));
    const placed = new Set();
    const out = [];
    saved.chapters.forEach((c) => {
      const items = [];
      (c.ids || []).forEach((id) => {
        const r = byId.get(String(id));
        if (r && !placed.has(String(id))) { placed.add(String(id)); items.push(r); }
      });
      if (items.length) out.push({ name: c.name, items });
    });
    // Recipes added after the layout was made go in a trailing chapter until it is redone.
    const extra = list.filter((r) => !placed.has(String(r.id)));
    if (extra.length) out.push({ key: 'ch_more', items: extra });
    if (out.length >= 2) return out;
  }

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

// Name of the chapter each recipe sits in, for the shared page: { [recipeId]: 'Chapter name' }.
export function chapterNameById(chapters, t) {
  const m = {};
  (chapters || []).forEach((c) => {
    const name = c.name || t(c.key);
    c.items.forEach((r) => { m[String(r.id)] = name; });
  });
  return m;
}
