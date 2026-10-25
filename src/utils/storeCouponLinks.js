// Where a shopper signs in / loads digital coupons for a store.
// Only chains whose coupon page has a long-stable address are linked directly (Kroger and Albertsons banners
// share one address pattern across every banner; Publix, H-E-B and Target have their own). Every other store
// goes to a web search for its own coupon sign-up page, so a changed store address never gives a dead link.
// NOT verified from the build server (store sites block it): if a direct link ever goes stale, delete its row
// and the store falls back to the search automatically.
const KROGER_PATH = '/savings/cl/coupons/';
const ALBERTSONS_PATH = '/foru/coupons-deals.html';

const KROGER_BANNERS = [
    ['kroger', 'kroger.com'], ['harris teeter', 'harristeeter.com'], ['ralphs', 'ralphs.com'],
    ['fred meyer', 'fredmeyer.com'], ['king soopers', 'kingsoopers.com'], ['smith', 'smithsfoodanddrug.com'],
    ["fry's", 'frysfood.com'], ['frys', 'frysfood.com'], ['qfc', 'qfc.com'], ['dillons', 'dillons.com'],
    ["mariano", 'marianos.com'], ["pick 'n save", 'picknsave.com'], ['pick n save', 'picknsave.com'],
    ['metro market', 'metromarket.com'], ['food 4 less', 'food4less.com'], ['city market', 'citymarket.com'],
    ["baker's", 'bakersplus.com'], ['gerbes', 'gerbes.com'], ['jay c', 'jaycfoods.com'], ['pay less', 'pay-less.com'],
    ['foods co', 'foodsco.com'],
];
const ALBERTSONS_BANNERS = [
    ['albertsons', 'albertsons.com'], ['safeway', 'safeway.com'], ['vons', 'vons.com'], ['jewel', 'jewelosco.com'],
    ["shaw's", 'shaws.com'], ['shaws', 'shaws.com'], ['acme', 'acmemarkets.com'], ['randalls', 'randalls.com'],
    ['tom thumb', 'tomthumb.com'], ['pavilions', 'pavilions.com'], ['star market', 'starmarket.com'],
    ['united supermarkets', 'unitedsupermarkets.com'], ['haggen', 'haggen.com'], ['carrs', 'carrsqc.com'],
];

export function storeChainName(store) {
    return String(store || '').split(/ - |#/)[0].trim();
}

export function storeCouponUrl(store) {
    const name = storeChainName(store);
    const n = name.toLowerCase();
    if (/publix/.test(n)) return 'https://www.publix.com/publix-app/faqs/digital-coupons';
    if (/h-?e-?b\b/.test(n)) return 'https://www.heb.com/digital-coupon';
    if (/^target\b/.test(n)) return 'https://www.target.com/circle';
    for (const [key, host] of KROGER_BANNERS) if (n.includes(key)) return `https://www.${host}${KROGER_PATH}`;
    for (const [key, host] of ALBERTSONS_BANNERS) if (n.includes(key)) return `https://www.${host}${ALBERTSONS_PATH}`;
    return `https://www.google.com/search?q=${encodeURIComponent(`${name} digital coupons sign up`)}`;
}
