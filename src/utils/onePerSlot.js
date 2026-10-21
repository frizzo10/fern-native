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
