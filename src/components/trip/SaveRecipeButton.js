import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// "Save recipe": tap, pick My Recipes or one of the cookbooks, and it is saved.
//   onSave({ bookId }) -> Promise (saves the recipe to rv4_saved; throws on failure)
//   books: raw cookbook list (data.books)
const bookId = (b) => b?.id || b?.uuid || b?.book_id;
const bookName = (b) => b?.title || b?.name || b?.book_title || '';

export default function SaveRecipeButton({ onSave, books, t }) {
  const [state, setState] = useState('idle'); // idle | choosing | saving | done
  const [where, setWhere] = useState('');
  const [picked, setPicked] = useState(null);
  const list = (Array.isArray(books) ? books : []).filter((b) => bookId(b) && bookName(b));

  const save = async (id, label) => {
    setPicked(id || 'mine');
    setState('saving');
    try {
      const r = await onSave?.({ bookId: id || null });
      setWhere(r === 'exists' ? '' : label);
      setState('done');
    } catch (e) {
      setState('idle');
    }
  };

  // The chip being saved turns solid green with a small spinner; the others fade.
  const chipStyle = (key) => (state === 'saving' ? (picked === key ? styles.chipOn : styles.chipFade) : null);
  const chipBody = (key, label) => (
    <View style={styles.chipInner}>
      {state === 'saving' && picked === key ? <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} /> : null}
      <Text style={[styles.chipText, state === 'saving' && picked === key ? { color: '#fff' } : null]} numberOfLines={1}>{label}</Text>
    </View>
  );

  if (state === 'done') {
    return (
      <View style={[styles.btn, styles.btnOn]}>
        <Text style={[styles.btnText, { color: '#3F6845' }]}>{where ? t('save_recipe_done_in', { where }) : t('save_recipe_done')}</Text>
      </View>
    );
  }
  if (state === 'choosing' || state === 'saving') {
    return (
      <View style={{ marginTop: 8 }}>
        <Text style={styles.label}>{t('save_recipe_where')}</Text>
        <View style={styles.row}>
          <TouchableOpacity style={[styles.chip, chipStyle('mine')]} disabled={state === 'saving'} activeOpacity={0.85} onPress={() => save(null, t('save_recipe_my_recipes'))}>
            {chipBody('mine', t('save_recipe_my_recipes'))}
          </TouchableOpacity>
          {list.map((b) => (
            <TouchableOpacity key={String(bookId(b))} style={[styles.chip, chipStyle(bookId(b))]} disabled={state === 'saving'} activeOpacity={0.85} onPress={() => save(bookId(b), bookName(b))}>
              {chipBody(bookId(b), `📖 ${bookName(b)}`)}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }
  return (
    <TouchableOpacity style={[styles.btn, { backgroundColor: '#3F6845' }]} activeOpacity={0.85} onPress={() => setState('choosing')}>
      <Text style={styles.btnText}>{`📖 ${t('save_recipe_btn')}`}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { alignSelf: 'flex-start', marginTop: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  btnOn: { backgroundColor: '#DDE7D5' },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '700', color: '#2F4535', marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: '#C8D6BE', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, maxWidth: '100%' },
  chipOn: { backgroundColor: '#3F6845', borderColor: '#3F6845' },
  chipFade: { opacity: 0.4 },
  chipInner: { flexDirection: 'row', alignItems: 'center' },
  chipText: { fontSize: 13, color: '#2F4535', fontWeight: '700' },
});
