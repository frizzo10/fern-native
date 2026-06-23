import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { colors, radius, shadow } from '../constants/tokens';
import { useSync } from '../hooks/useSync';

function pickFirst(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function normalizeRecipe(item, index) {
  const title = pickFirst(item?.title, item?.name, item?.recipe_name, item?.recipeTitle, 'Untitled recipe');
  const category = pickFirst(item?.cuisine, item?.category, item?.type, item?.mealType, 'Dinner');
  const meal = pickFirst(item?.slot, item?.meal, item?.course, 'Dinner');
  const time = pickFirst(item?.time, item?.minutes ? `${item.minutes} min` : null, item?.duration, '');
  const difficulty = pickFirst(item?.difficulty, item?.skillLevel, item?.level, 'Easy');
  const image = pickFirst(
    Array.isArray(item?._cloudPhotos) ? item._cloudPhotos[0] : null,
    item?._cloudPhotos?.[0],
    item?.image,
    item?.imageUrl,
    item?.photo,
    item?.thumbnail,
    item?.coverImage,
    item?.picture,
  );
  const id = pickFirst(item?.id, item?.uuid, item?.recipe_id, `${index}`);

  return {
    id,
    title,
    category,
    meal,
    time,
    difficulty,
    image,
  };
}

export default function RecipesScreen({ user }) {
  const { data } = useSync(user);
  const [tab, setTab] = useState('recipes');
  const [query, setQuery] = useState('');

  const recipes = useMemo(() => {
    const list = Array.isArray(data.recipes) ? data.recipes : [];
    return list.map(normalizeRecipe);
  }, [data.recipes]);

  const filteredRecipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((recipe) => {
      return [recipe.title, recipe.category, recipe.meal, recipe.difficulty]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [recipes, query]);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.tabsRow}>
          <View style={styles.tabsPill}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setTab('recipes')}
              style={[styles.tabButton, tab === 'recipes' ? styles.tabButtonActive : null]}
            >
              <Text style={[styles.tabButtonText, tab === 'recipes' ? styles.tabButtonTextActive : null]}>
                Recipes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setTab('cookbooks')}
              style={[styles.tabButton, tab === 'cookbooks' ? styles.tabButtonActive : null]}
            >
              <Text style={[styles.tabButtonText, tab === 'cookbooks' ? styles.tabButtonTextActive : null]}>
                Cookbooks
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <TextInput
              placeholder="Search recipes..."
              placeholderTextColor="#AA9D8C"
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
            />
          </View>
        </View>

        {tab === 'recipes' ? (
          filteredRecipes.length ? (
            <View style={styles.grid}>
              {filteredRecipes.map((recipe, index) => (
                <View key={recipe.id} style={[styles.recipeCard, shadow.card]}>
                  <View style={styles.imageWrap}>
                    <ImageBackground
                      source={recipe.image ? { uri: recipe.image } : require('../../assets/icon.png')}
                      style={styles.recipeImage}
                      imageStyle={styles.recipeImageInner}
                    >
                      <View style={styles.badgePill}>
                        <Text style={styles.badgePillText}>📚 MY RECIPES</Text>
                      </View>
                    </ImageBackground>
                  </View>

                  <View style={styles.cardBody}>
                    <Text numberOfLines={2} style={styles.recipeTitle}>{recipe.title}</Text>
                    <Text numberOfLines={1} style={styles.recipeMeta}>
                      {recipe.category} • {recipe.meal}
                      {recipe.time ? ` • ${recipe.time}` : ''}
                    </Text>

                    <View style={styles.difficultyPill}>
                      <View style={[styles.difficultyDot, index === 0 ? styles.difficultyDotDim : styles.difficultyDotFilled]} />
                      <View style={[styles.difficultyDot, index === 0 ? styles.difficultyDotMid : styles.difficultyDotEmpty]} />
                      <View style={[styles.difficultyDot, index === 0 ? styles.difficultyDotEmpty : styles.difficultyDotEmpty]} />
                      <Text style={styles.difficultyText}>{recipe.difficulty}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No saved recipes yet</Text>
              <Text style={styles.emptySub}>Saved recipes from sync will appear here.</Text>
            </View>
          )
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Cookbooks coming soon</Text>
            <Text style={styles.emptySub}>Your cookbooks tab is ready for synced data.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.parch,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'center',
  },
  tabsPill: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#EFE4D2',
    borderColor: '#D9C9AF',
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.forest,
  },
  tabButtonText: {
    color: '#7B5E38',
    fontSize: 12,
    fontFamily: 'Jost-Bold',
  },
  tabButtonTextActive: {
    color: '#F5EFE6',
  },
  searchBox: {
    width: 160,
    flex: 1,
    borderWidth: 1,
    borderColor: '#D9C9AF',
    backgroundColor: '#FFFDF8',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 35,
    justifyContent: 'center',
  },
  searchInput: {
    color: colors.ink,
    fontSize: 10,
    fontFamily: 'Jost-Medium',
    padding: 0,
  },
  grid: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  recipeCard: {
    width: '48%',
    backgroundColor: '#FFFDF8',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DCCFB8',
  },
  imageWrap: {
    height: 100,
  },
  recipeImage: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  recipeImageInner: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  badgePill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    marginLeft: 8,
    backgroundColor: 'rgba(30, 57, 30, 0.96)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  badgePillText: {
    color: '#F1F1E7',
    fontSize: 8,
    fontFamily: 'Jost-Bold',
    letterSpacing: 0.8,
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  recipeTitle: {
    color: '#3A2416',
    fontSize: 14,
    fontFamily: 'PlayfairDisplay-Bold',
  },
  recipeMeta: {
    marginTop: 6,
    color: '#8E6D49',
    fontSize: 10,
    lineHeight: 16,
    fontFamily: 'PlayfairDisplay-Medium',
    fontStyle: 'italic',
  },
  difficultyPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#D7C39A',
    backgroundColor: '#F4ECD8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
  },
  difficultyDotFilled: {
    backgroundColor: '#947117',
  },
  difficultyDotDim: {
    backgroundColor: '#A37B10',
  },
  difficultyDotMid: {
    borderWidth: 1,
    borderColor: '#B99233',
    backgroundColor: 'transparent',
  },
  difficultyDotEmpty: {
    borderWidth: 1,
    borderColor: '#B99233',
    backgroundColor: 'transparent',
  },
  difficultyText: {
    marginLeft: 4,
    color: '#A17A12',
    fontSize: 12,
    fontFamily: 'Jost-Bold',
    fontStyle: 'italic',
  },
  emptyState: {
    marginTop: 36,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: '#DCCFB8',
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 18,
    fontFamily: 'Jost-Bold',
  },
  emptySub: {
    marginTop: 6,
    color: colors.brown,
    fontSize: 13,
    fontFamily: 'Jost-Medium',
  },
});
