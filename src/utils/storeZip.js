// Regional flyers differ by area, so scans are tagged with a ZIP code taken from the
// user's saved stores (their addresses end in a 5-digit ZIP, e.g. "123 Main St, Boone, NC 28607").
import AsyncStorage from '@react-native-async-storage/async-storage';

export function zipFromAddress(address) {
    const found = String(address || '').match(/\b(\d{5})(?:-\d{4})?\b(?!.*\b\d{5}\b)/);
    return found ? found[1] : '';
}

// { "<store name>": "28607" } for every saved store whose address has a ZIP.
export function zipsByStoreName(stores) {
    const out = {};
    (Array.isArray(stores) ? stores : []).forEach((store) => {
        const zip = zipFromAddress(store?.address);
        if (store?.name && zip) out[store.name] = zip;
    });
    return out;
}

// The ZIP to tag a new scan with: the first saved store that has one. '' if none.
export async function defaultScanZip() {
    try {
        const raw = await AsyncStorage.getItem('cpc_user_stores');
        const zips = Object.values(zipsByStoreName(raw ? JSON.parse(raw) : []));
        return zips[0] || '';
    } catch (e) {
        return '';
    }
}
