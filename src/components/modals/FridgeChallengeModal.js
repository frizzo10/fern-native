import React, { useEffect } from 'react';
import {
    ActionSheetIOS,
    Alert,
    Image,
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

function promptPhotoSource(t, { onTakePhoto, onChooseFromLibrary }) {
    if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
            {
                title: t('add_photo_title'),
                options: [t('cancel_btn'), t('take_photo_option'), t('choose_from_library_option')],
                cancelButtonIndex: 0,
            },
            (buttonIndex) => {
                if (buttonIndex === 1) onTakePhoto();
                if (buttonIndex === 2) onChooseFromLibrary();
            }
        );
        return;
    }

    Alert.alert(t('add_photo_title'), '', [
        { text: t('take_photo_option'), onPress: onTakePhoto },
        { text: t('choose_from_library_option'), onPress: onChooseFromLibrary },
        { text: t('cancel_btn'), style: 'cancel' },
    ]);
}

export default function FridgeChallengeModal({
    visible,
    onClose,
    onAskFern,
    step,
    onGoToPhotos,
    onBackToIntro,
    ingredientsInput,
    setIngredientsInput,
    isSearching,
    onSearch,
    photos,
    onPickPhoto,
    onRemovePhoto,
    hasPlayedToday,
    recipes,
    onViewRecipe,
    onSaveRecipe,
    savingRecipeKey,
    isRecipeSaved,
}) {
    const { t } = useLanguage();
    const { maybeAutoStart } = useTour();
    const { hasAccess } = useEntitlement();

    useEffect(() => {
        if (visible) maybeAutoStart('fridge_challenge');
    }, [visible]);

    if (visible && !hasAccess(TIERS.PRO)) {
        return <UpgradeGateModal visible={visible} onClose={onClose} tier={TIERS.PRO} />;
    }

    const photoCount = photos.filter(Boolean).length;

    const handlePhotoSlotPress = (slotIndex) => {
        if (photos[slotIndex]) {
            onRemovePhoto(slotIndex);
            return;
        }

        promptPhotoSource(t, {
            onTakePhoto: () => onPickPhoto(slotIndex, true),
            onChooseFromLibrary: () => onPickPhoto(slotIndex, false),
        });
    };

    const showResults = recipes.length > 0;

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
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.sheet}>
                        <View style={styles.topBar}>
                            <Text style={styles.title}>{`🧊 ${t('fridge_challenge_title')}`}</Text>
                            <TouchableOpacity style={styles.askFernBtn} activeOpacity={0.85} onPress={onAskFern}>
                                <Text style={styles.askFernText}>{t('leftover_ask_fern_btn')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
                                <Text style={styles.closeText}>×</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={styles.scrollContent}
                        >
                            {showResults ? (
                                <View>
                                    <Text style={styles.resultsTitle}>{t('fridge_challenge_results_title')}</Text>

                                    {recipes.map((recipe, index) => (
                                        <View key={recipe.id || `fridge-card-${index}`} style={styles.recipeCard}>
                                            <View style={styles.recipeHeader}>
                                                <Text style={styles.recipeTitle} numberOfLines={2}>{`${recipe.emoji} ${recipe.title}`}</Text>
                                                <View style={[styles.difficultyPill, recipe.difficulty === 'Easy'
                                                    ? styles.difficultyEasy
                                                    : recipe.difficulty === 'Medium'
                                                        ? styles.difficultyMedium
                                                        : styles.difficultyAmbitious
                                                ]}>
                                                    <Text style={styles.difficultyText}>{recipe.difficulty}</Text>
                                                </View>
                                            </View>

                                            <Text style={styles.recipeDescription}>{recipe.description}</Text>
                                            <Text style={styles.recipeTime}>{`⏱ ${recipe.time}`}</Text>

                                            <View style={styles.recipeActionsRow}>
                                                <TouchableOpacity
                                                    style={styles.viewRecipeBtn}
                                                    activeOpacity={0.85}
                                                    onPress={() => onViewRecipe(recipe)}
                                                >
                                                    <Text style={styles.viewRecipeBtnText}>{t('leftover_view_recipe_btn')}</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={[styles.saveRecipeBtn, isRecipeSaved?.(recipe) ? styles.saveRecipeBtnSaved : null]}
                                                    activeOpacity={0.85}
                                                    onPress={() => onSaveRecipe(recipe)}
                                                    disabled={savingRecipeKey === (recipe.id || recipe.title) || isRecipeSaved?.(recipe)}
                                                >
                                                    <Text style={styles.saveRecipeBtnText}>
                                                        {savingRecipeKey === (recipe.id || recipe.title)
                                                            ? t('saving_ellipsis')
                                                            : isRecipeSaved?.(recipe)
                                                                ? t('results_saved_badge')
                                                                : t('save_short_btn')}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            ) : step === 'photos' ? (
                                <View>
                                    <Text style={styles.photosHeading}>{`📸 ${t('fridge_challenge_photos_heading')}`}</Text>
                                    <Text style={styles.subheading}>{t('fridge_challenge_photos_subtitle')}</Text>

                                    <View style={styles.photoSlotRow}>
                                        {photos.map((photo, index) => (
                                            <TouchableOpacity
                                                key={`photo-slot-${index}`}
                                                style={styles.photoSlot}
                                                activeOpacity={0.85}
                                                onPress={() => handlePhotoSlotPress(index)}
                                            >
                                                {photo ? (
                                                    <Image source={{ uri: photo.uri }} style={styles.photoSlotImage} />
                                                ) : (
                                                    <>
                                                        <Text style={styles.photoSlotEmoji}>📷</Text>
                                                        <Text style={styles.photoSlotLabel}>{t('fridge_challenge_photo_slot_label', { index: index + 1 })}</Text>
                                                        <Text style={styles.photoSlotHint}>{t('fridge_challenge_tap_to_add')}</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.primaryAction, (!photoCount && !ingredientsInput.trim()) ? styles.primaryActionDisabled : null]}
                                        activeOpacity={0.85}
                                        onPress={onSearch}
                                        disabled={isSearching || hasPlayedToday}
                                    >
                                        <Text style={styles.primaryActionText}>
                                            {isSearching
                                                ? t('searching_ellipsis')
                                                : photoCount
                                                    ? t('fridge_challenge_find_recipes_btn')
                                                    : t('fridge_challenge_add_at_least_one_btn')}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.backLink} activeOpacity={0.7} onPress={onBackToIntro}>
                                        <Text style={styles.backLinkText}>{`‹ ${t('fridge_challenge_or_tell_fern')}`}</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View>
                                    <Text style={styles.heroEmoji}>📸</Text>
                                    <Text style={styles.heading}>{t('fridge_challenge_heading')}</Text>
                                    <Text style={styles.subheading}>{t('fridge_challenge_subtitle')}</Text>

                                    {hasPlayedToday ? (
                                        <View style={styles.playedNotice}>
                                            <Text style={styles.playedNoticeText}>{t('fridge_challenge_already_played_desc')}</Text>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            style={styles.primaryAction}
                                            activeOpacity={0.85}
                                            onPress={onGoToPhotos}
                                        >
                                            <Text style={styles.primaryActionText}>{t('fridge_challenge_take_photos_btn')}</Text>
                                        </TouchableOpacity>
                                    )}

                                    <View style={styles.dividerRow}>
                                        <View style={styles.divider} />
                                        <Text style={styles.dividerText}>{t('fridge_challenge_or_tell_fern')}</Text>
                                        <View style={styles.divider} />
                                    </View>

                                    <View style={styles.inputRow}>
                                        <TextInput
                                            value={ingredientsInput}
                                            onChangeText={setIngredientsInput}
                                            placeholder={t('fridge_challenge_input_placeholder')}
                                            placeholderTextColor="#9A8D7F"
                                            style={styles.input}
                                            editable={!hasPlayedToday}
                                        />
                                        <TouchableOpacity
                                            style={[styles.goBtn, (isSearching || hasPlayedToday) ? styles.goBtnDisabled : null]}
                                            activeOpacity={0.85}
                                            onPress={onSearch}
                                            disabled={isSearching || hasPlayedToday}
                                        >
                                            <Text style={styles.goBtnText}>{isSearching ? t('searching_ellipsis') : t('fridge_challenge_go_btn')}</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={styles.onePlayNote}>{t('fridge_challenge_one_play_note')}</Text>
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
        maxHeight: '90%',
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
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#E0D4C4',
        gap: 10,
    },
    title: {
        flex: 1,
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 18,
    },
    askFernBtn: {
        backgroundColor: '#E96B1E',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    askFernText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
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
        paddingBottom: 24,
    },
    heroEmoji: {
        textAlign: 'center',
        fontSize: 52,
    },
    heading: {
        marginTop: 12,
        textAlign: 'center',
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 24,
        lineHeight: 30,
    },
    photosHeading: {
        textAlign: 'center',
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 22,
        lineHeight: 28,
    },
    subheading: {
        marginTop: 8,
        textAlign: 'center',
        color: '#7B5E3E',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
        lineHeight: 18,
    },
    primaryAction: {
        marginTop: 22,
        borderRadius: 14,
        backgroundColor: '#173E20',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    primaryActionDisabled: {
        opacity: 0.55,
    },
    primaryActionText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    playedNotice: {
        marginTop: 22,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E3C48A',
        backgroundColor: '#FBF1DC',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    playedNoticeText: {
        textAlign: 'center',
        color: '#7A5A1E',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
        lineHeight: 18,
    },
    dividerRow: {
        marginTop: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: '#D9CDBD',
    },
    dividerText: {
        color: '#9B7E5F',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },
    inputRow: {
        marginTop: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    input: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#174025',
        backgroundColor: '#FFFFFF',
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    goBtn: {
        backgroundColor: '#174025',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    goBtnDisabled: {
        opacity: 0.65,
    },
    goBtnText: {
        color: '#EDF6EA',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        lineHeight: 16,
    },
    onePlayNote: {
        marginTop: 16,
        textAlign: 'center',
        color: '#B0791E',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
        fontStyle: 'italic',
    },
    photoSlotRow: {
        marginTop: 20,
        flexDirection: 'row',
        gap: 10,
    },
    photoSlot: {
        flex: 1,
        aspectRatio: 0.85,
        borderRadius: 14,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: '#C9B79B',
        backgroundColor: '#EFE6D5',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    photoSlotImage: {
        width: '100%',
        height: '100%',
    },
    photoSlotEmoji: {
        fontSize: 26,
    },
    photoSlotLabel: {
        marginTop: 6,
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    photoSlotHint: {
        marginTop: 2,
        color: '#8C7A5F',
        fontFamily: 'Jost-Regular',
        fontSize: 11,
    },
    backLink: {
        marginTop: 16,
        alignItems: 'center',
    },
    backLinkText: {
        color: '#7B5E3E',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
    },
    resultsTitle: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 22,
        lineHeight: 28,
        marginBottom: 14,
    },
    recipeCard: {
        borderWidth: 1,
        borderColor: '#CFBEA7',
        borderRadius: 16,
        backgroundColor: '#FBF8F2',
        padding: 14,
        marginBottom: 12,
    },
    recipeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    recipeTitle: {
        flex: 1,
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 18,
        lineHeight: 22,
    },
    difficultyPill: {
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    difficultyEasy: {
        backgroundColor: '#2A7A56',
    },
    difficultyMedium: {
        backgroundColor: '#C34B1B',
    },
    difficultyAmbitious: {
        backgroundColor: '#5A2C0F',
    },
    difficultyText: {
        color: '#FFF9ED',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
    },
    recipeDescription: {
        marginTop: 8,
        color: '#7B5E3E',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
        lineHeight: 18,
    },
    recipeTime: {
        marginTop: 4,
        color: '#755A3C',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    recipeActionsRow: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 10,
    },
    viewRecipeBtn: {
        flex: 1,
        borderRadius: 12,
        backgroundColor: '#173E20',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 10,
    },
    viewRecipeBtnText: {
        color: '#F2F8F2',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
        letterSpacing: 0.3,
    },
    saveRecipeBtn: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#CFBEA7',
        backgroundColor: '#F8F5EF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    saveRecipeBtnSaved: {
        opacity: 0.7,
    },
    saveRecipeBtnText: {
        color: '#2B2017',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
        letterSpacing: 0.3,
    },
});
