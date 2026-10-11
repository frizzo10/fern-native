import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { fetchRecipeImage } from '../utils/recipeImage';

// Photo for a meal in the AI Meal Planner (matches the web planner, which
// fetches a photo per meal title via get-recipe-image and keeps the emoji as
// the fallback). The planner's meals carry no image of their own, so it is
// looked up by title and remembered for the session — the day cards and the
// detail view share the same lookup, and swapping a meal just looks up the
// new title.
const cache = new Map(); // title -> url | null (null = looked up, none found)
const inflight = new Map(); // title -> Promise

function lookup(title, index) {
    if (cache.has(title)) return Promise.resolve(cache.get(title));
    if (inflight.has(title)) return inflight.get(title);
    const p = fetchRecipeImage(title, undefined, index)
        .then((url) => { cache.set(title, url || null); return url || null; })
        .finally(() => inflight.delete(title));
    inflight.set(title, p);
    return p;
}

// `fallback` is what shows when there is no photo (the meal's emoji, styled by
// the caller). `variant` 'thumb' is a small rounded square; 'hero' is a wide banner.
export default function MealPlannerImage({ title, index, variant = 'thumb', fallback }) {
    const [url, setUrl] = useState(cache.get(title) || null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        setFailed(false);
        setUrl(cache.get(title) || null);
        if (title && !cache.has(title)) {
            lookup(title, index).then((u) => { if (alive) setUrl(u); });
        }
        return () => { alive = false; };
    }, [title, index]);

    const showPhoto = !!url && !failed;
    const box = variant === 'hero'
        ? { width: '100%', height: 190, borderRadius: 16, overflow: 'hidden', marginTop: 10, marginBottom: 12 }
        : { width: 44, height: 44, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' };

    if (!showPhoto) {
        // Hero: no banner at all without a photo (the emoji stays where it was).
        return variant === 'hero' ? (fallback || null) : <View style={box}>{fallback}</View>;
    }
    return (
        <View style={box}>
            <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" onError={() => setFailed(true)} />
        </View>
    );
}
