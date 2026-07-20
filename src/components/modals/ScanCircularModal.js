import React, { useEffect, useRef } from 'react';
import {
    ActivityIndicator,
    Animated,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import useLanguage from '../../hooks/useLanguage';

const CATEGORY_EMOJI = [
    [/produce/i, '🥬'],
    [/meat|poultry|seafood|butcher/i, '🥩'],
    [/dairy|cheese/i, '🧀'],
    [/bakery|bread/i, '🍞'],
    [/frozen/i, '❄️'],
    [/pantry|dry goods|canned/i, '🥫'],
    [/beverage|drink/i, '🥤'],
    [/deli/i, '🥪'],
    [/snack/i, '🍿'],
];

function getCategoryEmoji(category) {
    const match = CATEGORY_EMOJI.find(([pattern]) => pattern.test(String(category || '')));
    return match ? match[1] : '🛍️';
}

function LoadingProgressBar() {
    const widthAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(widthAnim, { toValue: 1, duration: 2200, useNativeDriver: false }),
                Animated.timing(widthAnim, { toValue: 0, duration: 0, useNativeDriver: false }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [widthAnim]);

    return (
        <View style={styles.progressTrack}>
            <Animated.View
                style={[
                    styles.progressFill,
                    {
                        width: widthAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                        }),
                    },
                ]}
            />
        </View>
    );
}

function ItemRow({ item, t, onFindRecipes }) {
    return (
        <View style={[styles.itemRow, item.isBogo ? styles.itemRowBogo : null]}>
            <Text style={styles.itemEmoji}>{item.emoji}</Text>
            <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>


            {/* <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                {item.unit ? <Text style={styles.itemUnit}>{item.unit}</Text> : null}
                {item.savings ? <Text style={styles.itemSavings} numberOfLines={1}>{item.savings}</Text> : null}
            </View> */}

            <View style={styles.itemPriceWrap}>
                {item.isBogo ? (
                    <View style={styles.bogoRow}>
                        <Text style={styles.bogoText}>{t('scan_circular_bogo_label')}</Text>
                        <View style={styles.dealBadge}>
                            <Text style={styles.dealBadgeText}>{t('scan_circular_deal_badge')}</Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.priceRow}>
                        {item.salePrice ? <Text style={styles.salePriceText}>{item.salePrice}</Text> : null}
                        {item.originalPrice ? (
                            <Text style={styles.originalPriceText}>{item.originalPrice}</Text>
                        ) : null}
                    </View>
                )}
            </View>

            <TouchableOpacity
                style={styles.recipesPill}
                activeOpacity={0.85}
                onPress={() => onFindRecipes?.(item)}
            >
                <Text style={styles.recipesPillText}>{t('scan_circular_recipes_pill')}</Text>
            </TouchableOpacity>
        </View >
    );
}

export default function ScanCircularModal({
    visible,
    onClose,
    step,
    photo,
    onTakePhoto,
    onPickFromLibrary,
    onRemovePhoto,
    onSubmit,
    result,
    onScanAnother,
    onAskFern,
    onFindRecipes,
    selectedItem,
    dealIdeas,
    isLoadingDealIdeas,
    onBackToDeals,
    onAddItemToList,
    isAddingItemToList,
    onChooseIdea,
    onRegenerateIdeas,
}) {
    const { t } = useLanguage();

    const itemCount = result?.items?.length || 0;
    const savingsLabel = result?.totalSavings != null
        ? `$${result.totalSavings.toFixed(2)} off`
        : itemCount === 1
            ? t('scan_circular_sale_items_singular', { count: itemCount })
            : t('scan_circular_sale_items_plural', { count: itemCount });
    const itemsFoundLabel = itemCount === 1
        ? t('scan_circular_items_found_singular', { count: itemCount })
        : t('scan_circular_items_found_plural', { count: itemCount });

    return (
        <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.topBar}>
                        <View style={styles.topBarTextWrap}>
                            <Text style={styles.title}>{`📷 ${t('scan_circular_modal_title')}`}</Text>
                            <Text style={styles.subtitle}>{t('scan_circular_modal_subtitle')}</Text>
                        </View>
                        <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
                            <Text style={styles.closeText}>×</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {step === 'loading' ? (
                            <View style={styles.loadingWrap}>
                                <ActivityIndicator size="large" color="#173E20" />
                                <Text style={styles.loadingTitle}>{t('scan_circular_loading_title')}</Text>
                                <Text style={styles.loadingTip}>{t('scan_circular_loading_tip')}</Text>
                                <LoadingProgressBar />
                                <Text style={styles.loadingCaption}>{t('scan_circular_loading_caption')}</Text>
                            </View>
                        ) : step === 'results' && result && itemCount === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyStateEmoji}>😕</Text>
                                <Text style={styles.emptyStateTitle}>{t('scan_circular_no_items_title')}</Text>
                                <Text style={styles.emptyStateDesc}>{t('scan_circular_no_items_desc')}</Text>
                                <TouchableOpacity style={styles.tryAgainBtn} activeOpacity={0.85} onPress={onScanAnother}>
                                    <Text style={styles.tryAgainBtnText}>{t('scan_circular_try_again_btn')}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : step === 'results' && result ? (
                            <View>
                                <View style={styles.savingsCard}>
                                    <View>
                                        <Text style={styles.savingsLabel}>{t('scan_circular_savings_label')}</Text>
                                        <Text style={styles.savingsValue}>{savingsLabel}</Text>
                                    </View>
                                    <View style={styles.savingsRight}>
                                        <Text style={styles.savingsSubLabel}>{t('scan_circular_vs_full_price')}</Text>
                                        <Text style={styles.savingsItemsFound}>{itemsFoundLabel}</Text>
                                    </View>
                                </View>

                                <Text style={styles.foundOnSaleLabel}>{t('scan_circular_found_on_sale')}</Text>

                                {result.sections.map((section) => (
                                    <View key={section.category} style={styles.sectionBlock}>
                                        <Text style={styles.sectionHeader}>
                                            {`${getCategoryEmoji(section.category)} ${section.category.toUpperCase()}`}
                                        </Text>
                                        {section.items.map((item) => (
                                            <ItemRow key={item.id} item={item} t={t} onFindRecipes={onFindRecipes} />
                                        ))}
                                    </View>
                                ))}

                                <View style={styles.actionsRow}>
                                    <TouchableOpacity style={styles.askFernBtn} activeOpacity={0.85} onPress={onAskFern}>
                                        <Text style={styles.askFernBtnText}>{t('scan_circular_ask_fern_btn')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.scanAnotherBtn} activeOpacity={0.85} onPress={onScanAnother}>
                                        <Text style={styles.scanAnotherBtnText}>{t('scan_circular_scan_another_btn')}</Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={styles.recipesUsingDealsLabel}>{t('scan_circular_recipes_using_deals')}</Text>

                                <TouchableOpacity style={styles.scanAnotherPlaceholder} activeOpacity={0.85} onPress={onScanAnother}>
                                    <Text style={styles.scanAnotherPlaceholderText}>{t('scan_circular_scan_another_placeholder')}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : step === 'item-detail' && selectedItem ? (
                            <View>
                                <TouchableOpacity activeOpacity={0.7} onPress={onBackToDeals}>
                                    <Text style={styles.backToDealsLink}>{t('scan_circular_back_to_deals')}</Text>
                                </TouchableOpacity>

                                <Text style={styles.itemDetailTitle}>{selectedItem.name}</Text>
                                {selectedItem.salePrice ? (
                                    <Text style={styles.itemDetailPrice}>{selectedItem.salePrice}</Text>
                                ) : null}

                                <TouchableOpacity
                                    style={[styles.addToListBtn, isAddingItemToList ? styles.addToListBtnDisabled : null]}
                                    activeOpacity={0.85}
                                    onPress={onAddItemToList}
                                    disabled={isAddingItemToList}
                                >
                                    <Text style={styles.addToListBtnText}>
                                        {isAddingItemToList ? t('adding_ellipsis') : t('scan_circular_add_to_list_btn')}
                                    </Text>
                                </TouchableOpacity>

                                <Text style={styles.recipeIdeasLabel}>{t('scan_circular_recipe_ideas_using_deal')}</Text>

                                {isLoadingDealIdeas ? (
                                    <ActivityIndicator style={styles.ideasLoading} size="small" color="#173E20" />
                                ) : (
                                    <>
                                        {dealIdeas.map((idea) => (
                                            <TouchableOpacity
                                                key={idea.id}
                                                style={styles.ideaCard}
                                                activeOpacity={0.85}
                                                onPress={() => onChooseIdea(idea)}
                                            >
                                                {idea.image ? (
                                                    <Image source={{ uri: idea.image }} style={styles.ideaImage} />
                                                ) : (
                                                    <View style={styles.ideaEmojiWrap}>
                                                        <Text style={styles.ideaEmoji}>{idea.emoji}</Text>
                                                    </View>
                                                )}
                                                <View style={styles.ideaInfo}>
                                                    <Text style={styles.ideaTitle} numberOfLines={2}>{idea.title}</Text>
                                                    <Text style={styles.ideaMeta} numberOfLines={2}>
                                                        {[idea.time, idea.why].filter(Boolean).join(' · ')}
                                                    </Text>
                                                </View>
                                                <Text style={styles.ideaArrow}>→</Text>
                                            </TouchableOpacity>
                                        ))}

                                        <TouchableOpacity style={styles.chooseAgainBtn} activeOpacity={0.85} onPress={onRegenerateIdeas}>
                                            <Text style={styles.chooseAgainBtnText}>
                                                {t('scan_circular_choose_again_btn', { count: dealIdeas.length || 3 })}
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        ) : (
                            <View>
                                <View style={styles.tipBanner}>
                                    <Text style={styles.tipBannerIcon}>📄</Text>
                                    <Text style={styles.tipBannerText}>{t('scan_circular_tip_desc')}</Text>
                                </View>

                                <View style={styles.sourceRow}>
                                    <TouchableOpacity
                                        style={styles.takePhotoBtn}
                                        activeOpacity={0.85}
                                        onPress={onTakePhoto}
                                    >
                                        <Text style={styles.sourceBtnEmoji}>📷</Text>
                                        <Text style={styles.takePhotoBtnText}>{t('scan_circular_take_photo_btn')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.chooseImageBtn}
                                        activeOpacity={0.85}
                                        onPress={onPickFromLibrary}
                                    >
                                        <Text style={styles.sourceBtnEmoji}>🖼️</Text>
                                        <Text style={styles.chooseImageBtnText}>{t('scan_circular_choose_image_btn')}</Text>
                                    </TouchableOpacity>
                                </View>

                                {photo ? (
                                    <View style={styles.photoPreviewWrap}>
                                        <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
                                        <TouchableOpacity
                                            style={styles.removePhotoBtn}
                                            activeOpacity={0.85}
                                            onPress={onRemovePhoto}
                                        >
                                            <Text style={styles.removePhotoText}>×</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : null}

                                {photo ? (
                                    <TouchableOpacity
                                        style={styles.findDealsBtn}
                                        activeOpacity={0.85}
                                        onPress={onSubmit}
                                    >
                                        <Text style={styles.findDealsBtnText}>{t('scan_circular_find_deals_btn')}</Text>
                                    </TouchableOpacity>
                                ) : null}

                                <View style={styles.tipsRowWrap}>
                                    <Text style={styles.tipsRowText}>{t('scan_circular_tips_row')}</Text>
                                </View>

                                <Text style={styles.privacyNote}>{t('scan_circular_privacy_note')}</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
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
        maxHeight: '92%',
        backgroundColor: '#FBF8F2',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        overflow: 'hidden',
    },
    topBar: {
        minHeight: 72,
        paddingHorizontal: 18,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#E0D4C4',
        gap: 10,
    },
    topBarTextWrap: {
        flex: 1,
    },
    title: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 18,
    },
    subtitle: {
        marginTop: 2,
        color: '#8C7355',
        fontFamily: 'Jost-Regular',
        fontSize: 12,
        fontStyle: 'italic',
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#D6C8B4',
        backgroundColor: '#F2ECE3',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeText: {
        color: '#8C6B46',
        fontFamily: 'Jost-Bold',
        fontSize: 24,
        lineHeight: 30,
    },
    scrollContent: {
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 28,
    },

    // Select step
    tipBanner: {
        flexDirection: 'row',
        gap: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E6C9A8',
        backgroundColor: '#FBEADA',
        padding: 14,
    },
    tipBannerIcon: {
        fontSize: 18,
    },
    tipBannerText: {
        flex: 1,
        color: '#6B4A26',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        lineHeight: 18,
    },
    sourceRow: {
        marginTop: 16,
        flexDirection: 'row',
        gap: 10,
    },
    takePhotoBtn: {
        flex: 1,
        aspectRatio: 1.5,
        borderRadius: 16,
        backgroundColor: '#173E20',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    sourceBtnEmoji: {
        fontSize: 30,
    },
    takePhotoBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    chooseImageBtn: {
        flex: 1,
        aspectRatio: 1.5,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#CFBEA7',
        backgroundColor: '#F8F5EF',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    chooseImageBtnText: {
        color: '#2B2017',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    photoPreviewWrap: {
        marginTop: 16,
    },
    photoPreview: {
        width: '100%',
        aspectRatio: 1.15,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#CFBEA7',
    },
    removePhotoBtn: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(20,20,20,0.65)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    removePhotoText: {
        color: '#FFFFFF',
        fontFamily: 'Jost-Bold',
        fontSize: 20,
        lineHeight: 25,
    },
    findDealsBtn: {
        marginTop: 14,
        borderRadius: 14,
        backgroundColor: '#173E20',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    findDealsBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 15,
    },
    tipsRowWrap: {
        marginTop: 18,
        borderRadius: 12,
        backgroundColor: '#F1E9DA',
        paddingVertical: 14,
        paddingHorizontal: 14,
    },
    tipsRowText: {
        textAlign: 'center',
        color: '#8C7355',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
        lineHeight: 18,
    },
    privacyNote: {
        marginTop: 14,
        textAlign: 'center',
        color: '#9A8D7F',
        fontFamily: 'Jost-Regular',
        fontSize: 11,
    },

    // Loading step
    loadingWrap: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    loadingTitle: {
        marginTop: 18,
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 20,
    },
    loadingTip: {
        marginTop: 14,
        textAlign: 'center',
        color: '#7B5E3E',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        fontStyle: 'italic',
        paddingHorizontal: 12,
    },
    progressTrack: {
        marginTop: 20,
        width: '90%',
        height: 6,
        borderRadius: 3,
        backgroundColor: '#E3DACB',
        overflow: 'hidden',
    },
    progressFill: {
        height: 6,
        borderRadius: 3,
        backgroundColor: '#173E20',
    },
    loadingCaption: {
        marginTop: 12,
        color: '#8C7355',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },

    // Results step
    savingsCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: 16,
        backgroundColor: '#173E20',
        paddingHorizontal: 18,
        paddingVertical: 18,
    },
    savingsLabel: {
        color: '#B9D8B7',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
        letterSpacing: 0.5,
    },
    savingsValue: {
        marginTop: 4,
        color: '#F5F9F0',
        fontFamily: 'Playfair-Bold',
        fontSize: 22,
    },
    savingsRight: {
        alignItems: 'flex-end',
    },
    savingsSubLabel: {
        color: '#B9D8B7',
        fontFamily: 'Jost-Regular',
        fontSize: 11,
    },
    savingsItemsFound: {
        marginTop: 4,
        color: '#F5F9F0',
        fontFamily: 'Jost-Bold',
        fontSize: 15,
    },
    foundOnSaleLabel: {
        marginTop: 22,
        color: '#9A8D7F',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
        letterSpacing: 0.8,
    },
    sectionBlock: {
        marginTop: 14,
    },
    sectionHeader: {
        color: '#8C6B46',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E3D9C6',
        backgroundColor: '#F8F5EF',
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 10,
    },
    itemRowBogo: {
        borderColor: '#E7B9AE',
        backgroundColor: '#FBEDEA',
    },
    itemEmoji: {
        fontSize: 18,
    },
    itemInfo: {
        flex: 1,
    },
    itemName: {
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
        lineHeight: 18,
    },
    itemUnit: {
        marginTop: 2,
        color: '#9A8D7F',
        fontFamily: 'Jost-Regular',
        fontSize: 11,
    },
    itemSavings: {
        marginTop: 2,
        color: '#2A7A56',
        fontFamily: 'Jost-Medium',
        fontSize: 11,
    },
    itemPriceWrap: {
        alignItems: 'flex-end',
    },
    priceRow: {
        alignItems: 'flex-end',
    },
    salePriceText: {
        color: '#2A7A56',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    originalPriceText: {
        marginTop: 2,
        color: '#B0A28D',
        fontFamily: 'Jost-Regular',
        fontSize: 11,
        textDecorationLine: 'line-through',
    },
    bogoRow: {
        alignItems: 'flex-end',
        gap: 4,
    },
    bogoText: {
        color: '#C34B1B',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    dealBadge: {
        borderRadius: 6,
        backgroundColor: '#2A1A11',
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    dealBadgeText: {
        color: '#FBF8F2',
        fontFamily: 'Jost-Bold',
        fontSize: 9,
        letterSpacing: 0.5,
    },
    recipesPill: {
        borderRadius: 10,
        backgroundColor: '#E96B1E',
        paddingHorizontal: 8,
        paddingVertical: 5,
    },
    recipesPillText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
    },
    emptyState: {
        marginTop: 36,
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 24,
    },
    emptyStateEmoji: {
        fontSize: 40,
    },
    emptyStateTitle: {
        marginTop: 20,
        textAlign: 'center',
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 17,
        lineHeight: 24,
    },
    emptyStateDesc: {
        marginTop: 14,
        textAlign: 'center',
        color: '#8C7355',
        fontFamily: 'Jost-Regular',
        fontStyle: 'italic',
        fontSize: 13,
        lineHeight: 19,
    },
    tryAgainBtn: {
        marginTop: 24,
        alignSelf: 'stretch',
        borderRadius: 14,
        backgroundColor: '#173E20',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    tryAgainBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        letterSpacing: 1,
    },
    actionsRow: {
        marginTop: 20,
        flexDirection: 'row',
        gap: 10,
    },
    askFernBtn: {
        flex: 1,
        borderRadius: 14,
        backgroundColor: '#173E20',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    askFernBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
    },
    scanAnotherBtn: {
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#CFBEA7',
        backgroundColor: '#F8F5EF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    scanAnotherBtnText: {
        color: '#2B2017',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
    },
    recipesUsingDealsLabel: {
        marginTop: 26,
        color: '#9A8D7F',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
        letterSpacing: 0.8,
    },
    scanAnotherPlaceholder: {
        marginTop: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#CFBEA7',
        backgroundColor: '#F8F5EF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    scanAnotherPlaceholderText: {
        color: '#8C7355',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
        letterSpacing: 0.5,
    },

    // Item detail step
    backToDealsLink: {
        color: '#8C6B46',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    itemDetailTitle: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 18,
        lineHeight: 30,
    },
    itemDetailPrice: {
        color: '#2A7A56',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    addToListBtn: {
        marginTop: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#CFE0CC',
        backgroundColor: '#EAF2E8',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    addToListBtnDisabled: {
        opacity: 0.6,
    },
    addToListBtnText: {
        color: '#2A7A56',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    recipeIdeasLabel: {
        marginTop: 16,
        color: '#baafa3',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 0.8,
    },
    ideasLoading: {
        marginTop: 20,
    },
    ideaCard: {
        borderWidth: 1,
        borderColor: '#CFBEA7',
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 14,
        backgroundColor: '#F8F0E5',
        padding: 10,
    },
    ideaImage: {
        width: 46,
        height: 46,
        borderRadius: 8,
    },
    ideaEmojiWrap: {
        width: 56,
        height: 56,
        borderRadius: 10,
        backgroundColor: '#EFE6D5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ideaEmoji: {
        fontSize: 26,
    },
    ideaInfo: {
        flex: 1,
    },
    ideaTitle: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 15,
        lineHeight: 19,
    },
    ideaMeta: {
        marginTop: 3,
        color: '#8C7355',
        fontFamily: 'Jost-Regular',
        fontSize: 12,
        lineHeight: 16,
    },
    ideaArrow: {
        color: '#8C7355',
        fontFamily: 'Jost-Bold',
        fontSize: 16,
    },
    chooseAgainBtn: {
        marginTop: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#CFBEA7',
        backgroundColor: '#F8F5EF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    chooseAgainBtnText: {
        color: '#a48771',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
});
