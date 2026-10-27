import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform,
  StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import { colors, radius } from '../../constants/tokens';
import useLanguage from '../../hooks/useLanguage';

// "Add a shared cookbook": paste the link someone sent, Fern fetches it and
// adds it to the library. onAdd(linkText) → Promise<{ ok, error? , name?, count? }>
export default function AddSharedCookbookModal({ visible, onClose, onAdd }) {
  const { t } = useLanguage();
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (visible) { setLink(''); setBusy(false); setMsg(''); setDone(false); }
  }, [visible]);

  const submit = async () => {
    if (busy || !link.trim()) return;
    Keyboard.dismiss();
    setBusy(true);
    setMsg('');
    const r = await onAdd(link);
    setBusy(false);
    if (r?.ok) {
      setDone(true);
      setMsg(r.recipe ? t('shared_rc_added', { name: r.name }) : t('shared_cb_added', { name: r.name, count: r.count }));
    } else {
      setMsg(t(r?.error || 'shared_cb_err_generic'));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.center}>
            <TouchableWithoutFeedback>
              <View style={styles.card}>
                <Text style={styles.title}>{t('shared_cb_title')}</Text>
                <Text style={styles.sub}>{t('shared_cb_sub')}</Text>
                {!done ? (
                  <TextInput
                    style={styles.input}
                    value={link}
                    onChangeText={setLink}
                    placeholder="https://app.clickpickandcook.com/cookbook-share.html?id=…"
                    placeholderTextColor="#9A9A8C"
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    editable={!busy}
                  />
                ) : null}
                {msg ? <Text style={[styles.msg, done ? styles.msgOk : styles.msgErr]}>{msg}</Text> : null}
                {!done ? (
                  <TouchableOpacity style={[styles.btn, (!link.trim() || busy) && { opacity: 0.5 }]} onPress={submit} activeOpacity={0.85}>
                    {busy ? <ActivityIndicator color="#F3EEE4" /> : <Text style={styles.btnText}>{t('shared_cb_add_btn')}</Text>}
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.close} onPress={onClose} activeOpacity={0.7}>
                  <Text style={styles.closeText}>{done ? t('shared_cb_done') : t('shared_cb_cancel')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  center: { flex: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#ECF2E6', borderRadius: radius?.lg || 18, padding: 20 },
  title: { fontSize: 20, color: '#3F5645', fontFamily: 'Jost-Bold', marginBottom: 6 },
  sub: { fontSize: 14, lineHeight: 20, color: '#5C7262', marginBottom: 14, fontFamily: 'Jost-Regular' },
  input: { minHeight: 70, borderWidth: 1, borderColor: '#C8D6BE', borderRadius: 12, padding: 12, fontSize: 14, color: '#2F4535', backgroundColor: '#fff' },
  msg: { marginTop: 12, fontSize: 14, lineHeight: 20 },
  msgOk: { color: '#3F5645' },
  msgErr: { color: '#B3361F' },
  btn: { marginTop: 14, backgroundColor: '#3F5645', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#F3EEE4', fontSize: 14, letterSpacing: 1, fontFamily: 'Jost-Bold' },
  close: { marginTop: 12, alignItems: 'center', padding: 8 },
  closeText: { color: '#5C7262', fontSize: 14 },
});
