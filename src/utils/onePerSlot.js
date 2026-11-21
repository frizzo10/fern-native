// One Breakfast, one Lunch, one Dinner per day. Given a day's meal list with a
// newly added meal at the END, keep only the LAST meal of each slot (the new one
// replaces what was there). Entries with no slot count as Dinner.
export function onePerSlot(dayMeals) {
  const list = Array.isArray(dayMeals) ? dayMeals : [];
  const slotOf = (m) => String((m && m.slot) || 'Dinner').toLowerCase();
  const lastIndex = {};
  list.forEach((m, i) => { lastIndex[slotOf(m)] = i; });
  return list.filter((m, i) => lastIndex[slotOf(m)] === i);
}

// Several items can share one slot (e.g. four appetizers at lunch). Appends the
// new meal to the day; the same title in the same slot is not added twice.
export function addToSlot(dayMeals, entry) {
  const list = Array.isArray(dayMeals) ? dayMeals : [];
  const slotOf = (m) => String((m && m.slot) || 'Dinner').toLowerCase();
  const tl = String((entry && entry.title) || '').trim().toLowerCase();
  const dup = list.some((m) => slotOf(m) === slotOf(entry) && String((m && m.title) || '').trim().toLowerCase() === tl);
  return dup ? list : [...list, entry];
}
