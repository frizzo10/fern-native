import React from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { StyleSheet } from 'react-native';
import { colors } from '../../constants/tokens';
import useLanguage from '../../hooks/useLanguage';

export default function LoyaltyCardModal({
    visible,
    onClose,
    phoneInput,
    setPhoneInput,
    isLinking,
    error,
    linkedCard,
    onLinkCard,
    onRelink,
}) {
    const { t } = useLanguage();

    return (
        <Modal
            transparent
            animationType="slide"
            visible={visible}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.backdrop}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.sheet}>
                    <View style={styles.topBar}>
                        <Text style={styles.headerEmoji}>🛒</Text>
                        <View style={styles.headerTextWrap}>
                            <Text style={styles.title}>{t('loyalty_modal_title')}</Text>
                            <Text style={styles.subtitle}>{t('loyalty_modal_subtitle')}</Text>
                        </View>
                        <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
                            <Text style={styles.closeText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        {linkedCard ? (
                            <View>
                                <View style={styles.successCard}>
                                    <Text style={styles.successEmoji}>✅</Text>
                                    <Text style={styles.successTitle}>{t('loyalty_modal_success_title')}</Text>
                                    <View style={styles.statsRow}>
                                        <View style={styles.statBox}>
                                            <Text style={styles.statValue}>{linkedCard.points}</Text>
                                            <Text style={styles.statLabel}>{t('loyalty_modal_points_label')}</Text>
                                        </View>
                                        {linkedCard.tier ? (
                                            <View style={styles.statBox}>
                                                <Text style={styles.statValue}>{linkedCard.tier}</Text>
                                                <Text style={styles.statLabel}>{t('loyalty_modal_tier_label')}</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                </View>

                                <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.85} onPress={onRelink}>
                                    <Text style={styles.secondaryBtnText}>{t('loyalty_modal_relink_btn')}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={onClose}>
                                    <Text style={styles.primaryBtnText}>{t('loyalty_modal_done_btn')}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                                <Text style={styles.instructions}>{t('loyalty_modal_instructions')}</Text>

                                <Text style={styles.label}>{t('loyalty_modal_phone_label')}</Text>
                                <TextInput
                                    value={phoneInput}
                                    onChangeText={setPhoneInput}
                                    placeholder={t('loyalty_modal_phone_placeholder')}
                                    placeholderTextColor="#9A8D7F"
                                    keyboardType="phone-pad"
                                    style={styles.input}
                                    editable={!isLinking}
                                />
                                <Text style={styles.hashDisclaimer}>{t('loyalty_modal_hash_disclaimer')}</Text>

                                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                                <View style={styles.actionsRow}>
                                    <TouchableOpacity
                                        style={styles.cancelBtn}
                                        activeOpacity={0.85}
                                        onPress={onClose}
                                        disabled={isLinking}
                                    >
                                        <Text style={styles.cancelBtnText}>{t('loyalty_modal_cancel_btn')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.linkBtn, isLinking ? styles.linkBtnDisabled : null]}
                                        activeOpacity={0.85}
                                        onPress={onLinkCard}
                                        disabled={isLinking}
                                    >
                                        {isLinking ? (
                                            <ActivityIndicator color="#F1F7F1" />
                                        ) : (
                                            <Text style={styles.linkBtnText}>{t('loyalty_modal_link_btn')}</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
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
        backgroundColor: '#FBF8F2',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        overflow: 'hidden',
        paddingBottom: 24,
    },
    topBar: {
        minHeight: 84,
        paddingHorizontal: 18,
        paddingTop: 18,
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: '#E0D4C4',
        gap: 12,
    },
    headerEmoji: {
        fontSize: 28,
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
        color: '#7B5E3E',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#D6C8B4',
        backgroundColor: '#F2ECE3',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeText: {
        color: '#8C6B46',
        fontFamily: 'Jost-Bold',
        fontSize: 22,
        lineHeight: 28,
    },
    content: {
        paddingHorizontal: 18,
        paddingTop: 20,
    },
    instructions: {
        color: '#6B5A47',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 20,
    },
    label: {
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
        marginBottom: 8,
    },
    input: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        backgroundColor: '#FFFFFF',
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    hashDisclaimer: {
        marginTop: 8,
        color: '#9B7E5F',
        fontFamily: 'Jost-Italic',
        fontStyle: 'italic',
        fontSize: 11,
        textAlign: 'center',
    },
    errorText: {
        marginTop: 14,
        color: '#B3261E',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
        textAlign: 'center',
    },
    actionsRow: {
        marginTop: 22,
        flexDirection: 'row',
        gap: 10,
    },
    cancelBtn: {
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#CFBEA7',
        backgroundColor: '#F8F5EF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    cancelBtnText: {
        color: '#2B2017',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    linkBtn: {
        flex: 1.4,
        borderRadius: 14,
        backgroundColor: colors.forest,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    linkBtnDisabled: {
        opacity: 0.6,
    },
    linkBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    successCard: {
        borderRadius: 18,
        backgroundColor: colors.forest,
        paddingHorizontal: 18,
        paddingVertical: 22,
        alignItems: 'center',
    },
    successEmoji: {
        fontSize: 32,
    },
    successTitle: {
        marginTop: 8,
        color: '#F1F7F1',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 18,
    },
    statsRow: {
        marginTop: 16,
        flexDirection: 'row',
        gap: 24,
    },
    statBox: {
        alignItems: 'center',
    },
    statValue: {
        color: '#F1F7F1',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 22,
    },
    statLabel: {
        marginTop: 2,
        color: '#CFE4CB',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
        letterSpacing: 1,
    },
    secondaryBtn: {
        marginTop: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#CFBEA7',
        backgroundColor: '#F8F5EF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
    },
    secondaryBtnText: {
        color: '#2B2017',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    primaryBtn: {
        marginTop: 10,
        borderRadius: 14,
        backgroundColor: colors.forest,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
    },
    primaryBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
});
