import { parseDateKey, formatDayLabel } from './familyDates';

// Suggested meals + recurring activities for the Weekly Review prompt.
// Pure function (no hooks/state) so callers can compute it once, right when
// the sheet is about to open, rather than every render — re-renders from
// tapping "+ Add" on one suggestion shouldn't reshuffle or recompute the
// rest out from under the user.
export function buildWeeklyReviewData(savedRecipes, currentMealPlan, currentActivities, currentDateKeys) {
    const recipes = Array.isArray(savedRecipes) ? savedRecipes : [];

    // How many times each saved recipe has actually been cooked, per the
    // full meal-plan history — old date keys are never purged from the
    // synced meal plan, so this reflects real history, not just this week.
    const cookedCountByTitle = {};
    Object.values(currentMealPlan || {}).forEach((dayMeals) => {
        (Array.isArray(dayMeals) ? dayMeals : []).forEach((entry) => {
            const key = String(entry?.title || '').trim().toLowerCase();
            if (key) cookedCountByTitle[key] = (cookedCountByTitle[key] || 0) + 1;
        });
    });

    const titlesThisWeek = new Set(
        currentDateKeys.flatMap((key) => ((currentMealPlan || {})[key] || []).map((e) => String(e?.title || '').trim().toLowerCase()))
    );
    const mealCandidates = recipes.filter((r) => r?.title && !titlesThisWeek.has(String(r.title).trim().toLowerCase()));
    const shuffledMeals = [...mealCandidates].sort(() => Math.random() - 0.5);
    const suggestedMeals = shuffledMeals.slice(0, 3).map((r) => ({
        id: String(r.id || r.title),
        title: r.title,
        emoji: r.emoji || '🍽️',
        cuisine: r.cuisine || '',
        image: r.image || null,
        cookedCount: cookedCountByTitle[String(r.title).trim().toLowerCase()] || 0,
    }));

    // An activity "recurs" if it's shown up on the same weekday at least
    // twice in history. Skipped if that weekday in the upcoming window
    // already has that same activity (added earlier this session, or
    // synced from another device).
    const recurringByKey = {};
    (currentActivities || []).forEach((activity) => {
        if (!activity?.dateKey || !activity?.label) return;
        const weekday = parseDateKey(activity.dateKey).getDay();
        const normalizedLabel = String(activity.label).trim().toLowerCase();
        const key = `${weekday}|${normalizedLabel}`;
        if (!recurringByKey[key]) {
            recurringByKey[key] = { key, weekday, label: activity.label, emoji: activity.emoji || '🗓️', count: 0 };
        }
        recurringByKey[key].count += 1;
    });

    const alreadyScheduledKeys = new Set(
        (currentActivities || [])
            .filter((activity) => currentDateKeys.includes(activity?.dateKey))
            .map((activity) => `${parseDateKey(activity.dateKey).getDay()}|${String(activity.label || '').trim().toLowerCase()}`)
    );

    const recurringActivities = Object.values(recurringByKey)
        .filter((entry) => entry.count >= 2 && !alreadyScheduledKeys.has(entry.key))
        .map((entry) => {
            const targetDateKey = currentDateKeys.find((key) => parseDateKey(key).getDay() === entry.weekday);
            return targetDateKey ? { ...entry, targetDateKey, dayLabel: formatDayLabel(targetDateKey) } : null;
        })
        .filter(Boolean);

    return { suggestedMeals, recurringActivities };
}
