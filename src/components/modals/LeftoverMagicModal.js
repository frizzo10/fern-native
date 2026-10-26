import React, { useEffect } from 'react';
import RecipePhoto from '../RecipePhoto';
import {
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
import { FEATURE_TIERS } from '../../constants/featureAccess';
import UpgradeGateModal from '../UpgradeGateModal';

export default function LeftoverMagicModal({
    visible,
    onClose,
    ingredientsInput,
    setIngredientsInput,
    isSearching,
    onSearch,
    photo,
    onTakePhoto,
    onPickPhotoFromLibrary,
    onRemovePhoto,
    recipes,
    onViewRecipe,
    onSaveRecipe,
    savingRecipeKey,
    isRecipeSaved,
    onAskFern,
}) {
    const { t } = useLanguage();
    const { maybeAutoStart, tourKey, closeTour } = useTour();
    const { hasAccess } = useEntitlement();

    useEffect(() => {
        if (visible && hasAccess(FEATURE_TIERS.leftover_magic)) {
            maybeAutoStart('leftover_magic');
        } else if (!visible && tourKey === 'leftover_magic') {
            closeTour();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    if (visible && !hasAccess(FEATURE_TIERS.leftover_magic)) {
        return <UpgradeGateModal visible={visible} onClose={onClose} tier={FEATURE_TIERS.leftover_magic} />;
    }

    return (
        <Modal
            transparent
            animationType="slide"
            visible={visible}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.leftoverBackdrop}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.leftoverSheet}>
                        <View style={styles.leftoverTopBar}>
                            <Text style={styles.leftoverTitle}>{`📸 ${t('leftover_magic_title')}`}</Text>
                            {/* <TouchableOpacity style={styles.leftoverAskFernBtn} activeOpacity={0.85} onPress={onAskFern}>
                                <Text style={styles.leftoverAskFernText}>{t('leftover_ask_fern_btn')}</Text>
                            </TouchableOpacity> */}
                            <TouchableOpacity style={styles.leftoverCloseBtn} activeOpacity={0.85} onPress={onClose}>
                                <Text style={styles.leftoverCloseText}>×</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={styles.leftoverScrollContent}
                        >
                            {!recipes.length ? (
                                <View>
                                    <Text style={styles.leftoverHeroEmoji}>📸</Text>
                                    <Text style={styles.leftoverHeading}>{t('leftover_whats_in_fridge')}</Text>
                                    <Text style={styles.leftoverSubheading}>{t('leftover_subtitle')}</Text>

                                    {photo ? (
                                        <View style={styles.leftoverPhotoPreviewRow}>
                                            <Image source={{ uri: photo.uri }} style={styles.leftoverPhotoPreview} />
                                            <TouchableOpacity
                                                style={styles.leftoverRemovePhotoBtn}
                                                activeOpacity={0.85}
                                                onPress={onRemovePhoto}
                                            >
                                                <Text style={styles.leftoverRemovePhotoText}>×</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : null}

                                    <TouchableOpacity
                                        style={styles.leftoverPrimaryAction}
                                        activeOpacity={0.85}
                                        onPress={onTakePhoto}
                                        disabled={isSearching}
                                    >
                                        <Text style={styles.leftoverPrimaryActionText}>{t('leftover_take_photo_btn')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.leftoverSecondaryAction}
                                        activeOpacity={0.85}
                                        onPress={onPickPhotoFromLibrary}
                                        disabled={isSearching}
                                    >
                                        <Text style={styles.leftoverSecondaryActionText}>{t('leftover_upload_library_btn')}</Text>
                                    </TouchableOpacity>

                                    <View style={styles.leftoverDividerRow}>
                                        <View style={styles.leftoverDivider} />
                                        <Text style={styles.leftoverDividerText}>{t('leftover_or_tell_fern')}</Text>
                                        <View style={styles.leftoverDivider} />
                                    </View>

                                    <View style={styles.leftoverInputRow}>
                                        <TextInput
                                            value={ingredientsInput}
                                            onChangeText={setIngredientsInput}
                                            placeholder={t('leftover_input_placeholder')}
                                            placeholderTextColor="#9A8D7F"
                                            style={styles.leftoverInput}
                                        />
                                        <TouchableOpacity
                                            style={[styles.leftoverGoBtn, isSearching ? styles.leftoverGoBtnDisabled : null]}
                                            activeOpacity={0.85}
                                            onPress={onSearch}
                                            disabled={isSearching}
                                        >
                                            <Text style={styles.leftoverGoBtnText}>{isSearching ? t('searching_ellipsis') : t('leftover_go_btn')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View>
                                    <Text style={styles.leftoverResultsTitle}>{t('leftover_results_title')}</Text>

                                    {recipes.map((recipe, index) => (
                                        <View key={recipe.id || `leftover-card-${index}`} style={styles.recipeCard}>
                                            <RecipePhoto title={recipe.title} image={recipe.image} style={{ width: '100%', height: 150, borderRadius: 12, marginBottom: 10 }} />
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
                            )}
                        </ScrollView>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    leftoverBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.28)',
        justifyContent: 'flex-end',
    },
    leftoverSheet: {
        maxHeight: '90%',
        backgroundColor: '#FDE8E0',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: '#F3C9BD',
        overflow: 'hidden',
    },
    leftoverTopBar: {
        minHeight: 72,
        paddingHorizontal: 18,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F3C9BD',
        gap: 10,
    },
    leftoverTitle: {
        flex: 1,
        color: '#5A3236',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 18,
    },
    leftoverAskFernBtn: {
        backgroundColor: '#D8607C',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    leftoverAskFernText: {
        color: '#FDE8E0',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
    },
    leftoverCloseBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F3C9BD',
        backgroundColor: '#FDE8E0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    leftoverCloseText: {
        color: '#8A5A5C',
        fontFamily: 'Jost-Bold',
        fontSize: 24,
        lineHeight: 30,
    },
    leftoverScrollContent: {
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 24,
    },
    leftoverHeroEmoji: {
        textAlign: 'center',
        fontSize: 52,
    },
    leftoverHeading: {
        marginTop: 12,
        textAlign: 'center',
        color: '#5A3236',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 24,
        lineHeight: 30,
    },
    leftoverSubheading: {
        marginTop: 8,
        textAlign: 'center',
        color: '#8A5A5C',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
        lineHeight: 18,
    },
    leftoverPhotoPreviewRow: {
        marginTop: 16,
        alignItems: 'center',
    },
    leftoverPhotoPreview: {
        width: 120,
        height: 120,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#F3C9BD',
    },
    leftoverRemovePhotoBtn: {
        position: 'absolute',
        top: -8,
        right: '50%',
        marginRight: -68,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#5A3236',
        alignItems: 'center',
        justifyContent: 'center',
    },
    leftoverRemovePhotoText: {
        color: '#FDE8E0',
        fontFamily: 'Jost-Bold',
        fontSize: 16,
        lineHeight: 16,
    },
    leftoverPrimaryAction: {
        marginTop: 22,
        borderRadius: 14,
        backgroundColor: '#8A4A4E',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    leftoverPrimaryActionText: {
        color: '#FDE8E0',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    leftoverSecondaryAction: {
        marginTop: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#F3C9BD',
        backgroundColor: '#FDE8E0',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
    },
    leftoverSecondaryActionText: {
        color: '#5A3236',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    leftoverDividerRow: {
        marginTop: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    leftoverDivider: {
        flex: 1,
        height: 1,
        backgroundColor: '#F3C9BD',
    },
    leftoverDividerText: {
        color: '#9A7872',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },
    leftoverInputRow: {
        marginTop: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    leftoverInput: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#8A4A4E',
        backgroundColor: '#FFFFFF',
        color: '#5A3236',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    leftoverGoBtn: {
        backgroundColor: '#8A4A4E',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    leftoverGoBtnDisabled: {
        opacity: 0.65,
    },
    leftoverGoBtnText: {
        color: '#FBD9CE',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        lineHeight: 16,
    },
    leftoverResultsTitle: {
        color: '#5A3236',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 22,
        lineHeight: 28,
        marginBottom: 14,
    },
    recipeCard: {
        borderWidth: 1,
        borderColor: '#F3C9BD',
        borderRadius: 16,
        backgroundColor: '#FDE8E0',
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
        color: '#5A3236',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 18,
        lineHeight: 22,
    },
    difficultyPill: {
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    difficultyEasy: {
        backgroundColor: '#C0475F',
    },
    difficultyMedium: {
        backgroundColor: '#C0475F',
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
        color: '#8A5A5C',
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
        backgroundColor: '#8A4A4E',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 10,
    },
    viewRecipeBtnText: {
        color: '#FDE8E0',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
        letterSpacing: 0.3,
    },
    saveRecipeBtn: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F3C9BD',
        backgroundColor: '#FDE8E0',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    saveRecipeBtnSaved: {
        opacity: 0.7,
    },
    saveRecipeBtnText: {
        color: '#5A3236',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
        letterSpacing: 0.3,
    },
});
