import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, shadow } from '../../constants/tokens';
import useLanguage from '../../hooks/useLanguage';
import { useTour } from '../../services/TourContext';

// Each topic jumps into the Home tour at that step (index = step position in tourContent.js TOURS.home).
const TOUR_TOPICS = [
    { step: 0, emoji: '📰', titleKey: 'faq_t_scan', bodyKey: 'tour_home_scan' },
    { step: 1, emoji: '🏪', titleKey: 'faq_t_stores', bodyKey: 'tour_home_stores' },
    { step: 2, emoji: '📅', titleKey: 'faq_t_week', bodyKey: 'tour_home_step1' },
    { step: 3, emoji: '🧰', titleKey: 'faq_t_tools', bodyKey: 'tour_home_tools' },
    { step: 4, emoji: '🌿', titleKey: 'faq_t_leaf', bodyKey: 'tour_home_step2' },
    { step: 5, emoji: '🧭', titleKey: 'faq_t_tabs', bodyKey: 'tour_home_step3' },
    { step: 6, emoji: '💌', titleKey: 'faq_t_share', bodyKey: 'tour_home_share' },
    { step: 7, emoji: '👤', titleKey: 'faq_t_profile', bodyKey: 'tour_home_step4' },
];

const HELP_ITEMS = [
    { key: 'plan_week', emoji: '📅', titleKey: 'help_plan_week_title', bodyKey: 'help_plan_week_body' },
    { key: 'shopping_list', emoji: '🛒', titleKey: 'help_shopping_list_title', bodyKey: 'help_shopping_list_body' },
    { key: 'find_recipes', emoji: '🔎', titleKey: 'help_find_recipes_title', bodyKey: 'help_find_recipes_body' },
    { key: 'cook_mode', emoji: '🍳', titleKey: 'help_cook_mode_title', bodyKey: 'help_cook_mode_body' },
    { key: 'alexa', emoji: '🎙️', titleKey: 'help_alexa_title', bodyKey: 'help_alexa_body' },
    { key: 'cookbooks', emoji: '📖', titleKey: 'help_cookbooks_title', bodyKey: 'help_cookbooks_body' },
];

export default function HelpModal({ visible, onClose }) {
    const { t } = useLanguage();
    const { startTour } = useTour();

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
                            <Text style={styles.tourAllText}>▶  {t('faq_watch_tour')}</Text>
                        </TouchableOpacity>

                        <Text style={styles.sectionLabel}>{t('faq_jump')}</Text>
                        <View style={[styles.list, styles.topicList]}>
                            {TOUR_TOPICS.map((item) => (
                                <View key={item.titleKey} style={styles.helpBlock}>
                                    <Text style={styles.helpHeading}>{item.emoji} {t(item.titleKey)}</Text>
                                    <Text style={styles.helpBody}>{t(item.bodyKey)}</Text>
                                    <TouchableOpacity style={styles.showMeBtn} activeOpacity={0.85} onPress={() => runTour(item.step)}>
                                        <Text style={styles.showMeText}>{t('faq_show_me')}</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>

                        <Text style={styles.sectionLabel}>{t('faq_more')}</Text>
                        <View style={styles.list}>
                            {HELP_ITEMS.map((item) => (
                                <View key={item.key} style={styles.helpBlock}>
                                    <Text style={styles.helpHeading}>{item.emoji} {t(item.titleKey)}</Text>
                                    <Text style={styles.helpBody}>{t(item.bodyKey)}</Text>
                                </View>
                            ))}
                        </View>

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
        backgroundColor: colors.parch,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: '#D9CFBF',
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
        backgroundColor: '#D9CFBF',
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
        color: '#5d361c',
        fontFamily: 'Jost-SemiBold',
        fontSize: 14,
        lineHeight: 21,
    },
    helpBody: {
        color: '#2C241B',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        lineHeight: 18,
    },
    tourAllBtn: {
        backgroundColor: colors.forest,
        borderRadius: 16,
        alignItems: 'center',
        paddingVertical: 14,
        marginBottom: 6,
    },
    tourAllText: { color: '#F5F0E7', fontFamily: 'Jost-Bold', fontSize: 16 },
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
        borderColor: colors.forest,
        borderRadius: 999,
        paddingVertical: 5,
        paddingHorizontal: 12,
    },
    showMeText: { color: colors.forest, fontFamily: 'Jost-SemiBold', fontSize: 12 },
    gotItBtn: {
        marginTop: 30,
        backgroundColor: colors.forest,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    gotItText: {
        color: '#F5F0E7',
        fontFamily: 'Jost-Bold',
        fontSize: 16,
        lineHeight: 20,
    },
});
