import React from 'react';
import { Clipboard, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../../constants/tokens';
import useLanguage from '../../hooks/useLanguage';

// Kroger/Albertsons can only deep-link a search for one item at a time — this
// shows everything else so the user can paste it into the store's own search
// box as they shop. Rendered as its own small Modal (not stacked on top of
// another one) since ShoppingScreen has no other Modal open at the same time.
export default function StoreRemainingItemsModal({ visible, storeName, items, onClose }) {
    const { t } = useLanguage();

    const listText = (items || []).join('\n');

    const handleCopy = () => {
        Clipboard.setString(listText);
    };

    return (
        <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <View style={styles.topRow}>
                        <Text style={styles.title}>{t('store_list_title', { store: storeName })}</Text>
                        <TouchableOpacity style={styles.closeIconBtn} activeOpacity={0.85} onPress={onClose}>
                            <Text style={styles.closeIconText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>{t('store_list_subtitle')}</Text>

                    <TextInput
                        style={styles.textBox}
                        value={listText}
                        editable={false}
                        multiline
                        scrollEnabled
                    />

                    <View style={styles.actionsRow}>
                        <TouchableOpacity style={styles.copyBtn} activeOpacity={0.85} onPress={handleCopy}>
                            <Text style={styles.copyBtnText}>{`📋 ${t('store_list_copy_btn')}`}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
                            <Text style={styles.closeBtnText}>{t('close_btn')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 420,
        borderRadius: 20,
        backgroundColor: '#FBF8F2',
        borderWidth: 1,
        borderColor: '#D9CFBF',
        padding: 20,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    title: {
        flex: 1,
        color: colors.forest,
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 20,
        lineHeight: 26,
    },
    closeIconBtn: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeIconText: {
        color: '#2A1A11',
        fontSize: 20,
        fontFamily: 'Jost-Bold',
    },
    subtitle: {
        marginTop: 4,
        color: '#8C6B46',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
    },
    textBox: {
        marginTop: 16,
        height: 220,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#7FA6D9',
        backgroundColor: '#FFFFFF',
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
        lineHeight: 21,
        paddingHorizontal: 14,
        paddingVertical: 12,
        textAlignVertical: 'top',
    },
    actionsRow: {
        marginTop: 16,
        flexDirection: 'row',
        gap: 10,
    },
    copyBtn: {
        flex: 1,
        borderRadius: 12,
        backgroundColor: 'rgb(216, 109, 51)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
    },
    copyBtnText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    closeBtn: {
        flex: 1,
        borderRadius: 12,
        backgroundColor: colors.forest,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
    },
    closeBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
});
