import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../constants/tokens';

// "Save recipe": tap, pick My Recipes or one of the cookbooks, and it is saved.
//   onSave({ bookId }) -> Promise (saves the recipe to rv4_saved; throws on failure)
//   books: raw cookbook list (data.books)
const bookId = (b) => b?.id || b?.uuid || b?.book_id;
const bookName = (b) => b?.title || b?.name || b?.book_title || '';

export default function SaveRecipeButton({ onSave, books, t }) {
  const [state, setState] = useState('idle'); // idle | choosing | saving | done
  const [where, setWhere] = useState('');
  const list = (Array.isArray(books) ? books : []).filter((b) => bookId(b) && bookName(b));

  const save = async (id, label) => {
    setState('saving');
    try {
      const r = await onSave?.({ bookId: id || null });
      setWhere(r === 'exists' ? '' : label);
      setState('done');
    } catch (e) {
      setState('idle');
    }
  };

  if (state === 'done') {
    return (
      <View style={[styles.btn, styles.btnOn]}>
        <Text style={[styles.btnText, { color: '#C0475F' }]}>{where ? t('save_recipe_done_in', { where }) : t('save_recipe_done')}</Text>
      </View>
    );
  }
  if (state === 'choosing' || state === 'saving') {
    return (
      <View style={{ marginTop: 8 }}>
        <Text style={styles.label}>{t('save_recipe_where')}</Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.chip} disabled={state === 'saving'} activeOpacity={0.85} onPress={() => save(null, t('save_recipe_my_recipes'))}>
            <Text style={styles.chipText}>{t('save_recipe_my_recipes')}</Text>
          </TouchableOpacity>
          {list.map((b) => (
            <TouchableOpacity key={String(bookId(b))} style={styles.chip} disabled={state === 'saving'} activeOpacity={0.85} onPress={() => save(bookId(b), bookName(b))}>
              <Text style={styles.chipText} numberOfLines={1}>{`📖 ${bookName(b)}`}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {state === 'saving' ? <ActivityIndicator color={colors?.orange || '#D8607C'} style={{ marginTop: 6, alignSelf: 'flex-start' }} /> : null}
      </View>
    );
  }
  return (
    <TouchableOpacity style={[styles.btn, { backgroundColor: '#C0475F' }]} activeOpacity={0.85} onPress={() => setState('choosing')}>
      <Text style={styles.btnText}>{`📖 ${t('save_recipe_btn')}`}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { alignSelf: 'flex-start', marginTop: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  btnOn: { backgroundColor: '#FBD9CE' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '700', color: '#5A3236', marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: '#F3C9BD', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, maxWidth: '100%' },
  chipText: { fontSize: 13, color: '#5A3236', fontWeight: '700' },
});
