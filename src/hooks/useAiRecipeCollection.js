import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { fetchRecipeImage } from '../utils/recipeImage';
import { pickFirst, normalizeRecipe } from '../utils/recipeNormalize';

// Shared "AI suggests recipes from what you have" collection logic: save to
// the recipe library, edit/delete a saved note, and add ingredients to the
// shopping list. Used by both Leftover Magic and Fridge Challenge, which are
// the same feature shape (photos/ingredients -> 3 AI recipes -> view/save).
export function useAiRecipeCollection({ source, data, pushAllFromStorage, pull, t }) {
    const [recipes, setRecipes] = useState([]);
    const [selectedRecipe, setSelectedRecipe] = useState(null);
    const [noteText, setNoteText] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [savingKey, setSavingKey] = useState(null);

    const reset = () => {
        setRecipes([]);
        setSelectedRecipe(null);
        setNoteText('');
    };

    const findSavedByTitle = (title) => {
        const target = String(title || '').trim().toLowerCase();
        if (!target) return null;

        const list = Array.isArray(data.recipes) ? data.recipes : [];
        const match = list.find((item) => {
            const itemTitle = String(pickFirst(item?.title, item?.name, item?.recipe_name, item?.recipeTitle, '')).trim().toLowerCase();
            return itemTitle === target;
        });

        return match ? normalizeRecipe(match) : null;
    };

    const isRecipeSaved = (recipe) => Boolean(findSavedByTitle(recipe?.title));

    const normalizeToDetail = (recipe) => {
        const ingredients = Array.isArray(recipe?.ingredients)
            ? recipe.ingredients
                .map((ingredient) => [ingredient?.amount, ingredient?.unit, ingredient?.item].filter(Boolean).join(' ').trim())
                .filter(Boolean)
            : [];
        const methodSteps = Array.isArray(recipe?.instructions) ? recipe.instructions.filter(Boolean) : [];

        return {
            id: recipe?.id,
            title: recipe?.title,
            category: recipe?.cuisine || 'Dinner',
            meal: 'Dinner',
            time: recipe?.time || '',
            difficulty: recipe?.difficulty || 'Medium',
            emoji: recipe?.emoji || '🍽️',
            image: recipe?.image || null,
            description: recipe?.description || '',
            servings: '4',
            ingredients: ingredients.length ? ingredients : ['No ingredients listed yet'],
            methodSteps: methodSteps.length ? methodSteps : ['No method steps listed yet'],
            note: '',
            bookIds: [],
        };
    };

    const syncCache = async (nextSaved) => {
        const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
        await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({ ...cache, recipes: nextSaved }));
    };

    const saveToLibrary = async (detailRecipe, note = '') => {
        const storedSaved = JSON.parse(await AsyncStorage.getItem('rv4_saved') || 'null');
        const baseSaved = Array.isArray(storedSaved) ? storedSaved : (Array.isArray(data.recipes) ? data.recipes : []);

        let imageUrl = detailRecipe.image || null;
        if (!imageUrl) {
            imageUrl = await fetchRecipeImage(`${detailRecipe.title || ''} ${detailRecipe.category || ''} food`.trim());
        }

        const nextSaved = [
            ...baseSaved,
            {
                id: `${source}-${Date.now()}`,
                title: detailRecipe.title,
                emoji: detailRecipe.emoji,
                cuisine: detailRecipe.category,
                mealType: detailRecipe.meal,
                time: detailRecipe.time,
                difficulty: detailRecipe.difficulty,
                description: detailRecipe.description,
                ingredients: detailRecipe.ingredients,
                instructions: detailRecipe.methodSteps,
                note,
                photoSearch: detailRecipe.title,
                _cloudPhotos: imageUrl ? [imageUrl] : [],
            },
        ];

        await AsyncStorage.setItem('rv4_saved', JSON.stringify(nextSaved));
        await syncCache(nextSaved);
        await pushAllFromStorage();
        await pull();

        return imageUrl;
    };

    const handleSaveFromCard = async (recipe) => {
        if (!recipe || isRecipeSaved(recipe)) return;

        const key = recipe.id || recipe.title;
        setSavingKey(key);
        try {
            await saveToLibrary(normalizeToDetail(recipe));
        } catch (e) {
            console.log(`[${source}] save recipe failed`, e?.message || e);
            Alert.alert(t('save_failed'), t('save_recipe_failed_desc'));
        } finally {
            setSavingKey(null);
        }
    };

    const persistSelectedNote = async (onDone) => {
        if (!selectedRecipe) return;

        const trimmed = noteText.trim();
        setIsSaving(true);
        try {
            const existing = findSavedByTitle(selectedRecipe.title);

            if (existing) {
                const storedSaved = JSON.parse(await AsyncStorage.getItem('rv4_saved') || 'null');
                const baseSaved = Array.isArray(storedSaved) ? storedSaved : (Array.isArray(data.recipes) ? data.recipes : []);
                const selectedTitle = String(selectedRecipe.title || '').trim().toLowerCase();

                const updatedSaved = baseSaved.map((item) => {
                    const itemTitle = String(pickFirst(item?.title, item?.name, item?.recipe_name, item?.recipeTitle, '')).trim().toLowerCase();
                    if (itemTitle !== selectedTitle) return item;
                    const { notes, myNote, ...rest } = item;
                    return { ...rest, note: trimmed };
                });

                await AsyncStorage.setItem('rv4_saved', JSON.stringify(updatedSaved));
                await syncCache(updatedSaved);
                await pushAllFromStorage();
                await pull();
            } else {
                await saveToLibrary(selectedRecipe, trimmed);
            }

            onDone?.();
        } catch (e) {
            console.log(`[${source}] save recipe note failed`, e?.message || e);
            Alert.alert(t('save_failed'), t('save_recipe_failed_desc'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteSelected = (onDone) => {
        if (!selectedRecipe) return;
        if (!findSavedByTitle(selectedRecipe.title)) return;

        Alert.alert(
            t('delete_recipe_title'),
            t('delete_recipe_desc', { title: selectedRecipe.title }),
            [
                { text: t('cancel_btn'), style: 'cancel' },
                {
                    text: t('delete_recipe_confirm'),
                    style: 'destructive',
                    onPress: async () => {
                        setIsSaving(true);
                        try {
                            const storedSaved = JSON.parse(await AsyncStorage.getItem('rv4_saved') || 'null');
                            const baseSaved = Array.isArray(storedSaved) ? storedSaved : (Array.isArray(data.recipes) ? data.recipes : []);
                            const selectedTitle = String(selectedRecipe.title || '').trim().toLowerCase();

                            const nextSaved = baseSaved.filter((item) => {
                                const itemTitle = String(pickFirst(item?.title, item?.name, item?.recipe_name, item?.recipeTitle, '')).trim().toLowerCase();
                                return itemTitle !== selectedTitle;
                            });

                            await AsyncStorage.setItem('rv4_saved', JSON.stringify(nextSaved));
                            await syncCache(nextSaved);
                            await pushAllFromStorage();
                            onDone?.();
                            await pull();
                        } catch (e) {
                            console.log(`[${source}] delete recipe failed`, e?.message || e);
                            Alert.alert(t('delete_recipe_failed_title'), t('delete_recipe_failed_desc'));
                        } finally {
                            setIsSaving(false);
                        }
                    },
                },
            ]
        );
    };

    const handleAddToShoppingList = async () => {
        if (!selectedRecipe) return;

        const ingredients = Array.isArray(selectedRecipe.ingredients) ? selectedRecipe.ingredients : [];
        if (!ingredients.length) {
            Alert.alert(t('no_items'), t('no_items_desc'));
            return;
        }

        const existingItems = Array.isArray(data.shopping) ? data.shopping : [];
        const recipeLabel = String(selectedRecipe.title || '').trim().toUpperCase();
        const existingSignatures = new Set(
            existingItems.map((entry) => `${String(entry?.text || '').trim().toLowerCase()}|${String(entry?.recipe || '').trim().toLowerCase()}`)
        );

        const additions = ingredients
            .filter((item) => !existingSignatures.has(`${String(item).trim().toLowerCase()}|${recipeLabel.toLowerCase()}`))
            .map((item, index) => ({
                id: `${source}-shop-${Date.now()}-${index}`,
                text: String(item).trim(),
                recipe: recipeLabel,
                checked: false,
            }));

        if (!additions.length) {
            Alert.alert(t('already_added'), t('leftover_items_already_added_desc'));
            return;
        }

        const nextShopping = [...existingItems, ...additions];

        setIsSaving(true);
        try {
            await AsyncStorage.setItem('rv4_master_shop', JSON.stringify(nextShopping));

            const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
            await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({
                ...cache,
                shopping: nextShopping,
            }));

            await pushAllFromStorage();
            await pull();
            Alert.alert(t('added_title'), t('items_added_success'));
        } catch (e) {
            console.log(`[${source}] add to shopping list failed`, e?.message || e);
            Alert.alert(t('could_not_add_items_title'), t('save_error_desc'));
        } finally {
            setIsSaving(false);
        }
    };

    const viewRecipe = async (recipe, { onOpenDetail } = {}) => {
        if (!recipe) return;

        const existing = findSavedByTitle(recipe.title);
        const detailRecipe = existing || normalizeToDetail(recipe);

        onOpenDetail?.();
        setSelectedRecipe(detailRecipe);
        setNoteText(existing?.note ?? '');

        if (detailRecipe.image) return;

        const imageQuery = `${recipe.title || ''} ${recipe.cuisine || ''} food`.trim();
        const imageUrl = await fetchRecipeImage(imageQuery);
        if (!imageUrl) return;

        setSelectedRecipe((current) => {
            if (!current || current.title !== detailRecipe.title) return current;
            return { ...current, image: imageUrl };
        });
    };

    return {
        recipes,
        setRecipes,
        selectedRecipe,
        setSelectedRecipe,
        noteText,
        setNoteText,
        isSaving,
        savingKey,
        reset,
        findSavedByTitle,
        isRecipeSaved,
        normalizeToDetail,
        saveToLibrary,
        handleSaveFromCard,
        persistSelectedNote,
        handleDeleteSelected,
        handleAddToShoppingList,
        viewRecipe,
    };
}
