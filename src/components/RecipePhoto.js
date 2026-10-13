import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { cache, lookup } from './MealPlannerImage';

// A recipe's photo: its own image when it has one, otherwise looked up by title (same lookup and session
// cache as the meal planner), so a recipe is never shown without a picture when one can be found.
//   useRecipePhoto(title, image) -> url | null
export function useRecipePhoto(title, image) {
  const [url, setUrl] = useState(image || (title && cache.get(title)) || null);
  useEffect(() => {
    let alive = true;
    if (image) { setUrl(image); return undefined; }
    setUrl((title && cache.get(title)) || null);
    if (title && !cache.has(title)) lookup(title).then((u) => { if (alive) setUrl(u); }).catch(() => {});
    return () => { alive = false; };
  }, [title, image]);
  return url;
}

// <RecipePhoto title image style fallback /> — `fallback` (emoji etc.) shows until/unless a photo is found.
export default function RecipePhoto({ title, image, style, fallback = null, resizeMode = 'cover' }) {
  const url = useRecipePhoto(title, image);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  if (!url || failed) return fallback;
  return <Image source={{ uri: url }} style={style} resizeMode={resizeMode} onError={() => setFailed(true)} />;
}
