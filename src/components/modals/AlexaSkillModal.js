import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../constants/tokens';
import useLanguage from '../../hooks/useLanguage';

export default function AlexaSkillModal({ visible, onClose }) {
    const { t } = useLanguage();
    return (
        <Modal
            transparent
            animationType="slide"
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.alexaBackdrop}>
                <View style={styles.alexaSheet}>
                    <TouchableOpacity style={styles.alexaCloseBtn} activeOpacity={0.85} onPress={onClose}>
                        <Text style={styles.alexaCloseText}>×</Text>
                    </TouchableOpacity>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.alexaContentScroll}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.alexaHeaderRow}>
                            <View style={styles.alexaIconWrap}>
                                <Text style={styles.alexaIcon}>🔊</Text>
                            </View>
                            <View style={styles.alexaHeaderTextWrap}>
                                <Text style={styles.alexaTitle}>{t('alexa_title')}</Text>
                                <Text style={styles.alexaSubtitle}>{t('alexa_subtitle')}</Text>
                            </View>
                        </View>

                        <View style={styles.alexaHeroCard}>
                            <Text style={styles.alexaHeroLeaf}>🌿</Text>
                            <Text style={styles.alexaHeroTitle}>{t('alexa_hero_title')}</Text>
                            <Text style={styles.alexaHeroSubtitle}>{t('alexa_hero_sub')}</Text>
                        </View>

                        <Text style={styles.alexaHowTitle}>{t('how_to_connect')}</Text>

                        {[
                            { step: '1', emoji: '📱', title: t('alexa_step_1'), sub: t('alexa_step_1_sub') },
                            { step: '2', emoji: '🔎', title: t('alexa_step_2'), sub: t('alexa_step_2_sub') },
                            { step: '3', emoji: '🔗', title: t('alexa_step_3'), sub: t('alexa_step_3_sub') },
                            { step: '4', emoji: '🔊', title: t('alexa_step_4'), sub: t('alexa_step_4_sub') },
                        ].map((item, idx) => (
                            <View key={`alexa-step-${item.step}`}>
                                <View style={styles.alexaStepRow}>
                                    <View style={styles.alexaStepBadge}>
                                        <Text style={styles.alexaStepBadgeText}>{item.step}</Text>
                                    </View>
                                    <Text style={styles.alexaStepEmoji}>{item.emoji}</Text>
                                    <View style={styles.alexaStepTextWrap}>
                                        <Text style={styles.alexaStepTitle}>{item.title}</Text>
                                        <Text style={styles.alexaStepSub}>{item.sub}</Text>
                                    </View>
                                </View>
                                {idx < 3 ? <View style={styles.alexaStepDivider} /> : null}
                            </View>
                        ))}

                        <View style={styles.alexaSkillIdCard}>
                            <Text style={styles.alexaSkillIdLabel}>{t('skill_id_label')}</Text>
                            <Text style={styles.alexaSkillIdText}>amzn1.ask.skill.76006692-3bd6-42c3-9d38-348501ea9099</Text>
                        </View>

                        <TouchableOpacity style={styles.alexaConnectBtn} activeOpacity={0.85} onPress={onClose}>
                            <Text style={styles.alexaConnectBtnText}>{t('got_it_btn')}</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    alexaBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.28)',
        justifyContent: 'flex-end',
    },
    alexaSheet: {
        backgroundColor: '#F5F2ED',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 16,
        height: '80%',
    },
    alexaCloseBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 1,
        borderColor: '#D4C3AD',
        backgroundColor: '#EFE9DF',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    alexaCloseText: {
        fontSize: 26,
        lineHeight: 28,
        color: '#8C6B46',
        marginTop: -1,
    },
    alexaContentScroll: {
        paddingTop: 10,
        paddingBottom: 30,
    },
    alexaHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        paddingRight: 54,
    },
    alexaIconWrap: {
        width: 45,
        height: 45,
        borderRadius: 12,
        backgroundColor: '#174B22',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    alexaIcon: {
        fontSize: 20,
    },
    alexaHeaderTextWrap: {
        flex: 1,
    },
    alexaTitle: {
        color: '#20140B',
        fontFamily: 'Jost-Bold',
        fontSize: 18,
        lineHeight: 24,
    },
    alexaSubtitle: {
        color: '#8D6D48',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },
    alexaHeroCard: {
        marginTop: 8,
        borderRadius: 22,
        backgroundColor: colors.forest,
        paddingVertical: 26,
        paddingHorizontal: 22,
        alignItems: 'center',
    },
    alexaHeroLeaf: {
        fontSize: 38,
        lineHeight: 48,
    },
    alexaHeroTitle: {
        marginTop: 10,
        color: '#F0EBDD',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 22,
        lineHeight: 30,
        textAlign: 'center',
    },
    alexaHeroSubtitle: {
        marginTop: 10,
        color: '#C6D5C3',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        lineHeight: 20,
        textAlign: 'center',
    },
    alexaHowTitle: {
        marginTop: 22,
        marginBottom: 8,
        color: '#8D734E',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 1.2,
    },
    alexaStepRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
    },
    alexaStepBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#174B22',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    alexaStepBadgeText: {
        color: '#EAF3E7',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    alexaStepEmoji: {
        fontSize: 26,
        marginRight: 8,
    },
    alexaStepTextWrap: {
        flex: 1,
    },
    alexaStepTitle: {
        color: '#20140B',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        lineHeight: 22,
    },
    alexaStepSub: {
        marginTop: 4,
        color: '#8D734E',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },
    alexaStepDivider: {
        height: 1,
        backgroundColor: '#D6C7B1',
    },
    alexaSkillIdCard: {
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#D4C3AD',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 14,
        backgroundColor: '#F1ECE3',
    },
    alexaSkillIdLabel: {
        color: '#a49379',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
    },
    alexaSkillIdText: {
        marginTop: 8,
        color: '#907353',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        lineHeight: 20,
    },
    alexaConnectBtn: {
        marginTop: 16,
        backgroundColor: '#EC6518',
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    alexaConnectBtnText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 16,
    },
});
