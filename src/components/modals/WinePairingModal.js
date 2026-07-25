import React, { useEffect } from 'react';
import {
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import useLanguage from '../../hooks/useLanguage';
import { useTour } from '../../services/TourContext';
import useEntitlement from '../../hooks/useEntitlement';
import { TIERS } from '../../constants/tiers';
import UpgradeGateModal from '../UpgradeGateModal';

export default function WinePairingModal({
    visible,
    onClose,
    wineDishInput,
    setWineDishInput,
    isWineSearching,
    onFindWinePairings,
    wineSummary,
    winePairings,
    selectedWinePairing,
    setSelectedWinePairing,
    onCloseWineDetail,
    getPairingIcon,
    getPairingTitle,
    isAddingWineToList,
    onAddWineToShoppingList,
}) {
    const { t } = useLanguage();
    const { maybeAutoStart } = useTour();
    const { hasAccess } = useEntitlement();

    useEffect(() => {
        if (visible) maybeAutoStart('wine_pairing');
    }, [visible]);

    if (visible && !hasAccess(TIERS.PRO_MAX)) {
        return <UpgradeGateModal visible={visible} onClose={onClose} tier={TIERS.PRO_MAX} />;
    }

    return (
        <Modal
            transparent
            animationType="slide"
            visible={visible}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.wineBackdrop}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.wineSheet}>
                    <TouchableOpacity style={styles.wineCloseBtn} activeOpacity={0.85} onPress={onClose}>
                        <Text style={styles.wineCloseText}>×</Text>
                    </TouchableOpacity>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.wineContentScroll}
                        keyboardShouldPersistTaps="handled"
                    >
                        <Text style={styles.wineHero}>🍷</Text>
                        <Text style={styles.wineTitle}>{t('wine_pairing_title')}</Text>
                        <Text style={styles.wineSubtitle}>{t('wine_form_subtitle')}</Text>

                        <Text style={styles.wineFieldLabel}>{t('dish_or_meal_label')}</Text>
                        <TextInput
                            value={wineDishInput}
                            onChangeText={setWineDishInput}
                            placeholder={t('wine_dish_placeholder')}
                            placeholderTextColor="#B0AEA9"
                            style={styles.wineInput}
                        />

                        <TouchableOpacity
                            style={[styles.wineFindBtn, isWineSearching ? styles.wineFindBtnDisabled : null]}
                            activeOpacity={0.85}
                            onPress={onFindWinePairings}
                            disabled={isWineSearching}
                        >
                            <Text style={styles.wineFindBtnText}>{isWineSearching ? t('searching_ellipsis') : t('find_my_pairings_btn')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.wineAskFernBtn} activeOpacity={0.85}>
                            <Text style={styles.wineAskFernText}>{t('ask_fern_walkthrough_btn')}</Text>
                        </TouchableOpacity>

                        {(wineSummary || winePairings.length) ? (
                            <View style={styles.wineResultsContent}>
                                {wineSummary ? <Text style={styles.wineSummaryText}>"{wineSummary}"</Text> : null}
                                {winePairings.map((item, index) => (
                                    <TouchableOpacity
                                        key={`wine-pairing-${index}`}
                                        activeOpacity={0.86}
                                        style={styles.wineCard}
                                        onPress={() => setSelectedWinePairing(item)}
                                    >
                                        <View style={styles.wineCardTopRow}>
                                            <Text style={styles.wineCardTitle} numberOfLines={2}>
                                                {getPairingTitle(item, index)}
                                            </Text>
                                            <Text style={styles.wineCardChevron}>›</Text>
                                        </View>
                                        <Text style={styles.wineCardMeta}>{item.type.toUpperCase()}{item.price ? ` · ${item.price}` : ''}</Text>
                                        {item.description ? <Text style={styles.wineCardDescription}>{item.description}</Text> : null}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : null}
                    </ScrollView>

                    {selectedWinePairing ? (
                        <View style={styles.wineDetailOverlay}>
                            <TouchableOpacity style={styles.wineDetailScrim} activeOpacity={1} onPress={onCloseWineDetail} />
                            <View style={styles.wineDetailSheet}>
                                <View style={styles.wineDetailHeader}>
                                    <View style={styles.wineDetailHeaderTextWrap}>
                                        <Text style={styles.wineDetailTitle}>
                                            {`${getPairingIcon(selectedWinePairing)} ${selectedWinePairing.name}${selectedWinePairing.region ? ` • ${selectedWinePairing.region}` : ''}`}
                                        </Text>
                                        <Text style={styles.wineDetailMeta}>
                                            {selectedWinePairing.type?.toUpperCase() || t('pairing_fallback_label')}{selectedWinePairing.price ? ` · ${selectedWinePairing.price}` : ''}
                                        </Text>
                                    </View>

                                    <TouchableOpacity style={styles.wineDetailCloseBtn} activeOpacity={0.85} onPress={onCloseWineDetail}>
                                        <Text style={styles.wineDetailCloseText}>×</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.wineDetailBody}>
                                    <Text style={styles.wineDetailSectionLabel}>{t('why_it_works_label')}</Text>
                                    <Text style={styles.wineDetailDescription}>
                                        {selectedWinePairing.description || t('no_tasting_notes')}
                                    </Text>
                                </View>

                                <View style={styles.wineDetailActions}>
                                    <TouchableOpacity
                                        style={[styles.wineDetailAddBtn, isAddingWineToList ? styles.wineDetailBtnDisabled : null]}
                                        activeOpacity={0.85}
                                        onPress={onAddWineToShoppingList}
                                        disabled={isAddingWineToList}
                                    >
                                        <Text style={styles.wineDetailAddBtnText}>{isAddingWineToList ? t('adding_ellipsis') : t('add_to_list_btn')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.wineDetailDoneBtn} activeOpacity={0.85} onPress={onCloseWineDetail}>
                                        <Text style={styles.wineDetailDoneBtnText}>{t('done_btn')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    ) : null}
                </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    wineBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.28)',
        justifyContent: 'flex-end',
    },
    wineSheet: {
        backgroundColor: '#F5F2ED',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 16,
        height: '78%',
    },
    wineCloseBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#D8D8D8',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    wineCloseText: {
        fontSize: 26,
        lineHeight: 28,
        color: '#F4F4F4',
        marginTop: -1,
    },
    wineHero: {
        marginTop: 24,
        textAlign: 'center',
        fontSize: 50,
        lineHeight: 64,
    },
    wineTitle: {
        marginTop: 4,
        textAlign: 'center',
        color: '#2A1A11',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 24,
        lineHeight: 40,
    },
    wineSubtitle: {
        marginTop: 6,
        textAlign: 'center',
        color: '#7B5E3E',
        fontFamily: 'Jost-Regular',
        fontSize: 12,
    },
    wineFieldLabel: {
        marginTop: 18,
        marginBottom: 8,
        color: '#7B5C3A',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 1.2,
    },
    wineInput: {
        borderWidth: 2,
        borderColor: '#CEBFA6',
        borderRadius: 14,
        backgroundColor: '#F6F3ED',
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
        paddingHorizontal: 12,
        paddingVertical: 12,
    },
    wineFindBtn: {
        marginTop: 14,
        backgroundColor: '#184D22',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    wineFindBtnDisabled: {
        opacity: 0.65,
    },
    wineFindBtnText: {
        color: '#EAF3E7',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 0.5,
    },
    wineAskFernBtn: {
        marginTop: 10,
        backgroundColor: '#EC6518',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    wineAskFernText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    wineContentScroll: {
        paddingTop: 6,
        paddingBottom: 30,
    },
    wineResultsContent: {
        marginTop: 12,
        paddingBottom: 8,
    },
    wineSummaryText: {
        color: '#2E2117',
        fontFamily: 'Jost-Italic',
        fontStyle: 'italic',
        fontSize: 12,
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 20,
        paddingHorizontal: 12,
    },
    wineCard: {
        borderWidth: 2,
        borderColor: '#D0C0A7',
        borderRadius: 18,
        backgroundColor: '#F8F6F2',
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
    },
    wineCardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    wineCardTitle: {
        flex: 1,
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 15,
        lineHeight: 22,
    },
    wineCardMeta: {
        marginTop: 2,
        color: '#7B1E3A',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 0.7,
    },
    wineCardChevron: {
        marginLeft: 12,
        color: '#B4AA9C',
        fontSize: 20,
        lineHeight: 20,
        fontFamily: 'Jost-Bold',
    },
    wineCardDescription: {
        marginTop: 4,
        color: '#7B5E3E',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
        lineHeight: 20,
        fontStyle: 'italic',
    },
    wineDetailOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
    },
    wineDetailScrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(33,25,18,0.48)',
    },
    wineDetailSheet: {
        backgroundColor: '#F8F5F0',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingTop: 18,
        paddingHorizontal: 20,
        paddingBottom: 18,
    },
    wineDetailHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#D8CAB5',
    },
    wineDetailHeaderTextWrap: {
        flex: 1,
        paddingRight: 12,
    },
    wineDetailTitle: {
        color: '#7B1E3A',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 18,
        lineHeight: 30,
    },
    wineDetailMeta: {
        marginTop: 2,
        color: '#7B5E3E',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 0.7,
    },
    wineDetailCloseBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    wineDetailCloseText: {
        color: '#B8B0A6',
        fontSize: 28,
        lineHeight: 28,
    },
    wineDetailBody: {
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#D8CAB5',
    },
    wineDetailSectionLabel: {
        color: '#7B5C3A',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 1.2,
        marginBottom: 10,
    },
    wineDetailDescription: {
        color: '#2E2117',
        fontFamily: 'Jost-Italic',
        fontStyle: 'italic',
        fontSize: 15,
        lineHeight: 28,
    },
    wineDetailActions: {
        flexDirection: 'row',
        gap: 10,
        paddingTop: 18,
    },
    wineDetailAddBtn: {
        flex: 1,
        backgroundColor: '#194D22',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
    },
    wineDetailBtnDisabled: {
        opacity: 0.7,
    },
    wineDetailAddBtnText: {
        color: '#F6F3EE',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    wineDetailDoneBtn: {
        flex: 1,
        backgroundColor: '#F3EBDD',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#D8CAB5',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
    },
    wineDetailDoneBtnText: {
        color: '#2E2117',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
});
