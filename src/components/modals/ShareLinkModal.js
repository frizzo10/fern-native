import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { colors, radius } from '../../constants/tokens';
import useLanguage from '../../hooks/useLanguage';

// Generic "make a share link" sheet: optional personal note + sender name, then
// the OS share sheet (which covers Mail, Messages, WhatsApp, Copy…) in place of
// the web app's hand-built Gmail/Email/SMS buttons.
//   onCreateLink({ senderName, message, translateTo: lang === 'es' ? 'es' : '' }) → Promise<string>   (the share URL)
//   buildShareText(url) → string                              (what gets sent)
export default function ShareLinkModal({
    visible,
    onClose,
    title,
    defaultSenderName = '',
    onCreateLink,
    buildShareText,
    allowTranslate = false,
}) {
    const { t } = useLanguage();
    const [senderName, setSenderName] = useState(defaultSenderName);
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState('form'); // form | creating | ready | error
    const [url, setUrl] = useState('');
    const [lang, setLang] = useState('orig'); // orig | es

    useEffect(() => {
        if (visible) {
            setSenderName(defaultSenderName);
            setMessage('');
            setStatus('form');
            setUrl('');
            setLang('orig');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const handleCreate = async () => {
        Keyboard.dismiss();
        setStatus('creating');
        try {
            const link = await onCreateLink({ senderName, message });
            setUrl(link);
            setStatus('ready');
        } catch (e) {
            console.log('[share] create link failed', e?.message || e);
            setStatus('error');
        }
    };

    const handleShare = async () => {
        try {
            // Hand over ONLY the web address. With "Title - N recipes: https://..." as the text, Copy puts that whole
            // line on the clipboard and pasting it into a browser runs a Google search instead of opening the link.
            if (Platform.OS === 'ios') await Share.share({ url });
            else await Share.share({ message: url });
        } catch (e) {
            console.log('[share] share sheet failed', e?.message || e);
        }
    };

    return (
        <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={styles.backdrop}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.sheet}>
                        <View style={styles.topBar}>
                            <Text style={styles.title} numberOfLines={2}>{title}</Text>
                            <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
                                <Text style={styles.closeText}>×</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                            {status === 'ready' ? (
                                <View>
                                    <Text style={styles.readyLabel}>{`✓ ${t('share_link_ready')}`}</Text>
                                    <View style={styles.urlBox}>
                                        <Text style={styles.urlText} selectable>{url}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={handleShare}>
                                        <Text style={styles.primaryBtnText}>{t('share_link_share_btn')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.85} onPress={onClose}>
                                        <Text style={styles.secondaryBtnText}>{t('close_btn')}</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View>
                                    <Text style={styles.fieldLabel}>{t('share_link_note_label')}</Text>
                                    <TextInput
                                        value={message}
                                        onChangeText={setMessage}
                                        placeholder={t('share_link_note_placeholder')}
                                        placeholderTextColor="#B0AEA9"
                                        style={styles.input}
                                        editable={status !== 'creating'}
                                    />

                                    <Text style={styles.fieldLabel}>{t('share_link_name_label')}</Text>
                                    <TextInput
                                        value={senderName}
                                        onChangeText={setSenderName}
                                        placeholder={t('share_link_name_placeholder')}
                                        placeholderTextColor="#B0AEA9"
                                        style={styles.input}
                                        editable={status !== 'creating'}
                                    />

                                    {allowTranslate ? (
                                        <View>
                                            <Text style={styles.fieldLabel}>{t('share_lang_label')}</Text>
                                            <View style={styles.langRow}>
                                                {[['orig', t('share_lang_orig')], ['es', t('share_lang_es')]].map(([k, label]) => (
                                                    <TouchableOpacity
                                                        key={k}
                                                        style={[styles.langChip, lang === k ? styles.langChipOn : null]}
                                                        activeOpacity={0.85}
                                                        onPress={() => setLang(k)}
                                                        disabled={status === 'creating'}
                                                    >
                                                        <Text style={[styles.langChipText, lang === k ? styles.langChipTextOn : null]}>{label}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    ) : null}

                                    {status === 'error' ? (
                                        <Text style={styles.errorText}>{t('share_link_error')}</Text>
                                    ) : null}

                                    <TouchableOpacity
                                        style={[styles.primaryBtn, status === 'creating' ? styles.btnDisabled : null]}
                                        activeOpacity={0.85}
                                        onPress={handleCreate}
                                        disabled={status === 'creating'}
                                    >
                                        {status === 'creating' ? (
                                            <ActivityIndicator color={'#F3C9BD'} />
                                        ) : (
                                            <Text style={styles.primaryBtnText}>{t('share_link_create_btn')}</Text>
                                        )}
                                    </TouchableOpacity>
                                    {status === 'creating' && lang === 'es' ? (
                                        <Text style={styles.translatingText}>{t('share_translating')}</Text>
                                    ) : null}
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.28)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#FDE8E0',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: '#F3C9BD',
        paddingHorizontal: 18,
        paddingTop: 16,
        paddingBottom: 28,
        maxHeight: '85%',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 14,
    },
    title: {
        flex: 1,
        fontFamily: 'Playfair-Bold',
        fontSize: 20,
        color: '#8A4A4E',
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#D8D8D8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeText: {
        fontSize: 24,
        lineHeight: 26,
        color: '#F4F4F4',
    },
    fieldLabel: {
        fontFamily: 'Jost-Bold',
        fontSize: 11,
        letterSpacing: 1,
        color: '#8A5A5C',
        marginTop: 10,
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F3C9BD',
        borderRadius: radius.md,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontFamily: 'Jost-Regular',
        fontSize: 15,
        color: '#5A3236',
    },
    errorText: {
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        color: colors.voiceRed,
        marginTop: 12,
    },
    primaryBtn: {
        backgroundColor: '#8A4A4E',
        borderRadius: radius.md,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 18,
    },
    btnDisabled: {
        opacity: 0.7,
    },
    primaryBtnText: {
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        color: '#F3C9BD',
        letterSpacing: 0.5,
    },
    secondaryBtn: {
        borderRadius: radius.md,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#F3C9BD',
        backgroundColor: '#F3C9BD',
    },
    secondaryBtnText: {
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        color: '#5A3236',
    },
    langRow: { flexDirection: 'row', gap: 8 },
    langChip: {
        flex: 1,
        paddingVertical: 11,
        alignItems: 'center',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: '#F3C9BD',
        backgroundColor: '#FFFFFF',
    },
    langChipOn: { backgroundColor: '#8A4A4E', borderColor: '#8A4A4E' },
    langChipText: { fontFamily: 'Jost-Bold', fontSize: 13, color: '#5A3236' },
    langChipTextOn: { color: '#F3C9BD' },
    translatingText: {
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        color: '#8A5A5C',
        textAlign: 'center',
        marginTop: 10,
    },
    readyLabel: {
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        color: '#C0475F',
        marginBottom: 10,
    },
    urlBox: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F3C9BD',
        borderRadius: radius.md,
        padding: 12,
    },
    urlText: {
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        color: '#5A3236',
    },
});
