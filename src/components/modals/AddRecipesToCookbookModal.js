import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import useLanguage from '../../hooks/useLanguage';

export default function AddRecipesToCookbookModal({
  visible,
  book,
  recipes,
  onClose,
  onSave,
  isSaving,
}) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    if (visible && book) {
      const initial = new Set(
        recipes.filter((recipe) => recipe.bookIds.includes(book.id)).map((recipe) => String(recipe.id))
      );
      setSelectedIds(initial);
      setQuery('');
    }
  }, [visible, book?.id]);

  const toggleRecipe = (recipeId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const id = String(recipeId);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    if (isSaving) return;
    onSave(Array.from(selectedIds));
  };

  if (!book) return null;

  const q = query.trim().toLowerCase();
  const filteredRecipes = q
    ? recipes.filter((recipe) => recipe.title.toLowerCase().includes(q))
    : recipes;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>{t('add_recipes_modal_title')}</Text>
              <Text style={styles.subtitle}>{book.title}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('search_recipes_placeholder')}
              placeholderTextColor="#B0AEA9"
              style={styles.searchInput}
            />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {filteredRecipes.length ? (
              filteredRecipes.map((recipe) => {
                const isSelected = selectedIds.has(String(recipe.id));
                return (
                  <TouchableOpacity
                    key={recipe.id}
                    activeOpacity={0.85}
                    style={[styles.recipeRow, isSelected ? styles.recipeRowSelected : null]}
                    onPress={() => toggleRecipe(recipe.id)}
                  >
                    <ImageBackground
                      source={recipe.image ? { uri: recipe.image } : require('../../../assets/icon.png')}
                      style={styles.recipeThumb}
                      imageStyle={styles.recipeThumbInner}
                    />
                    <View style={styles.recipeInfo}>
                      <Text numberOfLines={1} style={styles.recipeTitle}>{recipe.title}</Text>
                      <Text numberOfLines={1} style={styles.recipeMeta}>{recipe.category} · {recipe.meal}</Text>
                    </View>
                    <View style={[styles.checkbox, isSelected ? styles.checkboxSelected : null]}>
                      {isSelected ? <Text style={styles.checkboxMark}>✓</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>{t('no_recipes_found')}</Text>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveBtn, isSaving ? styles.saveBtnDisabled : null]}
            activeOpacity={0.85}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#F3EEE4" />
            ) : (
              <Text style={styles.saveBtnText}>
                {t('save_selected_recipes_btn', { count: selectedIds.size })}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.34)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: '#FBF8F2',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#D9CFBF',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E0D4C4',
    gap: 10,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    color: '#2A1A11',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 20,
  },
  subtitle: {
    marginTop: 4,
    color: '#8C7355',
    fontFamily: 'Jost-Regular',
    fontSize: 12,
    fontStyle: 'italic',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E5E4DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#2A1A11',
    fontSize: 20,
    lineHeight: 22,
    fontFamily: 'Jost-Regular',
  },
  searchBox: {
    marginHorizontal: 20,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#D9CFBF',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: '#2A1A11',
    fontSize: 13,
    fontFamily: 'Jost-Medium',
    paddingVertical: 10,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E3D9C6',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
  },
  recipeRowSelected: {
    borderColor: '#1C512A',
    backgroundColor: '#EAF2E8',
  },
  recipeThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#E7E0D6',
  },
  recipeThumbInner: {
    borderRadius: 8,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeTitle: {
    color: '#2A1A11',
    fontFamily: 'Jost-Bold',
    fontSize: 13,
  },
  recipeMeta: {
    marginTop: 2,
    color: '#8C7355',
    fontFamily: 'Jost-Regular',
    fontSize: 11,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#D9CFBF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#1C512A',
    borderColor: '#1C512A',
  },
  checkboxMark: {
    color: '#F3EEE4',
    fontSize: 14,
    fontFamily: 'Jost-Bold',
  },
  emptyState: {
    marginTop: 30,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#8C7355',
    fontFamily: 'Jost-Regular',
    fontSize: 13,
  },
  saveBtn: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 14,
    backgroundColor: '#1C512A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  saveBtnDisabled: {
    opacity: 0.55,
  },
  saveBtnText: {
    color: '#F3EEE4',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
});
