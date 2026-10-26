import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadow } from '../../constants/tokens';
import useLanguage from '../../hooks/useLanguage';
import { useTour } from '../../services/TourContext';
import { openChat } from '../../services/chatBus';


export default function HelpModal({ visible, onClose }) {
    const { t } = useLanguage();
    const { startTour } = useTour();

    const askFern = () => {
        onClose();
        setTimeout(() => openChat(), 450);
    };

    // Close the sheet first; iOS drops a Modal opened while another is still dismissing.
    const runTour = (step) => {
        onClose();
        setTimeout(() => startTour('home', step), 450);
    };

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.sheet, shadow.strong]}>
                    <View style={styles.handle} />

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                        <View style={styles.titleRow}>
                            <Text style={styles.titleMark}>?</Text>
                            <Text style={styles.title}>{t('help_title')}</Text>
                        </View>

                        <TouchableOpacity style={styles.tourAllBtn} activeOpacity={0.88} onPress={() => runTour(0)}>
                            <Text style={styles.tourAllText}>▶  {t('faq_replay_tour')}</Text>
                        </TouchableOpacity>
                        <Text style={styles.helpBody}>{t('faq_replay_desc')}</Text>

                        <TouchableOpacity style={[styles.tourAllBtn, styles.askBtn]} activeOpacity={0.88} onPress={askFern}>
                            <Text style={styles.tourAllText}>🌿  {t('faq_ask_fern')}</Text>
                        </TouchableOpacity>
                        <Text style={styles.helpBody}>{t('faq_ask_desc')}</Text>

                        <TouchableOpacity style={styles.gotItBtn} activeOpacity={0.88} onPress={onClose}>
                            <Text style={styles.gotItText}>{t('help_got_it_btn')}</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.62)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#FFFAF6',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: '#F3C9BD',
        paddingHorizontal: 18,
        paddingTop: 20,
        paddingBottom: 10,
        height: '74%',
    },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 999,
        backgroundColor: '#F3C9BD',
    },
    scrollContent: {
        paddingBottom: 4,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 30,
        marginBottom: 18,
        paddingRight: 18,
    },
    titleMark: {
        color: '#D61A0D',
        fontFamily: 'Jost-Bold',
        fontSize: 24,
        lineHeight: 26,
        marginRight: 12,
    },
    title: {
        color: '#6b4228',
        fontFamily: 'Jost-Regular',
        fontSize: 22,
        lineHeight: 26,
    },
    list: {
        gap: 12,
    },
    helpBlock: {
        gap: 4,
    },
    helpHeading: {
        color: '#5A3236',
        fontFamily: 'Jost-SemiBold',
        fontSize: 14,
        lineHeight: 21,
    },
    helpBody: {
        color: '#5A3236',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        lineHeight: 18,
    },
    askBtn: { marginTop: 22 },
    tourAllBtn: {
        backgroundColor: '#8A4A4E',
        borderRadius: 16,
        alignItems: 'center',
        paddingVertical: 14,
        marginBottom: 8,
    },
    tourAllText: { color: '#FDE8E0', fontFamily: 'Jost-Bold', fontSize: 16 },
    sectionLabel: {
        color: '#6b4228',
        fontFamily: 'Jost-SemiBold',
        fontSize: 12,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginTop: 18,
        marginBottom: 10,
    },
    topicList: { gap: 16 },
    showMeBtn: {
        alignSelf: 'flex-start',
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#8A4A4E',
        borderRadius: 999,
        paddingVertical: 5,
        paddingHorizontal: 12,
    },
    showMeText: { color: '#8A4A4E', fontFamily: 'Jost-SemiBold', fontSize: 12 },
    gotItBtn: {
        marginTop: 30,
        backgroundColor: '#8A4A4E',
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    gotItText: {
        color: '#FDE8E0',
        fontFamily: 'Jost-Bold',
        fontSize: 16,
        lineHeight: 20,
    },
});
