import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import useLanguage from '../../hooks/useLanguage';
import { useTour } from '../../services/TourContext';
import useEntitlement from '../../hooks/useEntitlement';
import { FEATURE_TIERS } from '../../constants/featureAccess';
import UpgradeGateModal from '../UpgradeGateModal';
import { useAiRecipeCollection } from '../../hooks/useAiRecipeCollection';
import { useFernVoice } from '../../hooks/useFernVoice';
import { pickPhotoFromCamera, pickPhotoFromLibrary } from '../../services/photoPickerService';
import { tellRecipeStory, importRecipeFromUrl, scanRecipeCard } from '../../services/familyVaultService';
import ChatSheetModal from './ChatSheetModal';

const VAULT_KEY = 'rv4_family_vault';

const FAMILY_VAULT_SYSTEM_PROMPT = 'You are Fern, helping someone preserve and cook their family recipes. Be warm and brief.';
const FAMILY_VAULT_AUTO_OPENER = "Hi! I'm here to help with your Family Recipe Vault — ask me anything about preserving or writing up a family recipe.";

function listToText(list) {
    return Array.isArray(list) ? list.join('\n') : '';
}

function textToList(text) {
    return String(text || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

export default function FamilyRecipeVaultModal({ visible, onClose, user, data, pushAllFromStorage, pull }) {
    const { t, locale } = useLanguage();
    const { maybeAutoStart, tourKey, closeTour } = useTour();
    const { hasAccess } = useEntitlement();
    const collection = useAiRecipeCollection({ source: 'family_vault', data, pushAllFromStorage, pull, t, token: user?.token });

    const [screen, setScreen] = useState('list'); // 'list' | 'add' | 'detail'
    const [addMode, setAddMode] = useState('type'); // 'type' | 'url' | 'scan'
    const [vaultRecipes, setVaultRecipes] = useState([]);
    const [selectedVaultRecipe, setSelectedVaultRecipe] = useState(null);
    const [isAskFernOpen, setIsAskFernOpen] = useState(false);

    const [formTitle, setFormTitle] = useState('');
    const [formOrigin, setFormOrigin] = useState('');
    const [formStory, setFormStory] = useState('');
    const [formIngredients, setFormIngredients] = useState('');
    const [formInstructions, setFormInstructions] = useState('');
    const [formUrl, setFormUrl] = useState('');

    const [isTellingStory, setIsTellingStory] = useState(false);
    const [isImportingUrl, setIsImportingUrl] = useState(false);
    const [isScanningMode, setIsScanningMode] = useState(null); // null | 'full' | 'ingredients' | 'instructions'
    const [isSavingRecipe, setIsSavingRecipe] = useState(false);

    const { isSpeaking, speakText, stopSpeaking } = useFernVoice({
        onError: (message) => console.log('[family-vault] voice error', message),
        token: user?.token,
        enabled: visible,
    });

    useEffect(() => {
        if (visible && hasAccess(FEATURE_TIERS.family_vault)) {
            maybeAutoStart('family_vault');
        } else if (!visible && tourKey === 'family_vault') {
            closeTour();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    useEffect(() => {
        if (!visible) return;
        AsyncStorage.getItem(VAULT_KEY)
            .then((raw) => {
                const parsed = JSON.parse(raw || '[]');
                setVaultRecipes(Array.isArray(parsed) ? parsed : []);
            })
            .catch((e) => console.log('[family-vault] failed to load vault', e?.message || e));
    }, [visible]);

    useEffect(() => {
        if (!visible) {
            setScreen('list');
            setSelectedVaultRecipe(null);
            stopSpeaking();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const persistVault = (next) => {
        setVaultRecipes(next);
        AsyncStorage.setItem(VAULT_KEY, JSON.stringify(next))
            .catch((e) => console.log('[family-vault] failed to persist vault', e?.message || e));
    };

    const resetForm = () => {
        setFormTitle('');
        setFormOrigin('');
        setFormStory('');
        setFormIngredients('');
        setFormInstructions('');
        setFormUrl('');
    };

    const openAddScreen = (mode) => {
        resetForm();
        setAddMode(mode);
        setScreen('add');
    };

    const openDetailScreen = (recipe) => {
        setSelectedVaultRecipe(recipe);
        setScreen('detail');
    };

    const backToList = () => {
        stopSpeaking();
        setScreen('list');
        setSelectedVaultRecipe(null);
    };

    const handleLetFernTellStory = async () => {
        if (isTellingStory) return;
        setIsTellingStory(true);
        try {
            const story = await tellRecipeStory({ title: formTitle, origin: formOrigin, locale, token: user?.token });
            if (story) setFormStory(story);
        } catch (e) {
            console.log('[family-vault] tell story failed', e?.message || e);
            Alert.alert(t('save_failed'), t('save_error_desc'));
        } finally {
            setIsTellingStory(false);
        }
    };

    const applyImportedRecipe = (imported) => {
        if (imported.title) setFormTitle(imported.title);
        if (imported.origin) setFormOrigin(imported.origin);
        if (imported.story) setFormStory(imported.story);
        if (imported.ingredients.length) setFormIngredients(listToText(imported.ingredients));
        if (imported.instructions.length) setFormInstructions(listToText(imported.instructions));
    };

    const handleImportUrl = async () => {
        const url = formUrl.trim();
        if (!url || isImportingUrl) {
            if (!url) Alert.alert(t('family_vault_url_required_title'), t('family_vault_url_required_desc'));
            return;
        }

        setIsImportingUrl(true);
        try {
            const imported = await importRecipeFromUrl({ url, locale, token: user?.token });
            if (!imported.ingredients.length && !imported.instructions.length && !imported.title) {
                Alert.alert(t('family_vault_import_failed_title'), t('family_vault_import_failed_desc'));
                return;
            }
            applyImportedRecipe(imported);
        } catch (e) {
            console.log('[family-vault] import url failed', e?.message || e);
            Alert.alert(t('family_vault_import_failed_title'), t('family_vault_import_failed_desc'));
        } finally {
            setIsImportingUrl(false);
        }
    };

    const runScan = async (photo, mode) => {
        setIsScanningMode(mode);
        try {
            const scanned = await scanRecipeCard({ photo, mode, locale, token: user?.token });
            if (!scanned.ingredients.length && !scanned.instructions.length && !scanned.title) {
                Alert.alert(t('family_vault_scan_failed_title'), t('family_vault_scan_failed_desc'));
                return;
            }
            applyImportedRecipe(scanned);
        } catch (e) {
            console.log('[family-vault] scan card failed', e?.message || e);
            Alert.alert(t('family_vault_scan_failed_title'), t('family_vault_scan_failed_desc'));
        } finally {
            setIsScanningMode(null);
        }
    };

    const handleScanFromCamera = async (mode) => {
        const result = await pickPhotoFromCamera();
        if (result.permissionDenied) {
            Alert.alert(t('permission_needed_title'), t('photo_permission_denied_desc'));
            return;
        }
        if (!result.photo) return;
        runScan(result.photo, mode);
    };

    const handleUploadFromLibrary = async () => {
        const result = await pickPhotoFromLibrary();
        if (result.permissionDenied) {
            Alert.alert(t('permission_needed_title'), t('photo_permission_denied_desc'));
            return;
        }
        if (!result.photo) return;
        runScan(result.photo, 'full');
    };

    const handleSaveToVault = () => {
        const title = formTitle.trim();
        if (!title) {
            Alert.alert(t('dish_required'), t('family_vault_name_required_desc'));
            return;
        }

        setIsSavingRecipe(true);
        const recipe = {
            id: `family-vault-${Date.now()}`,
            title,
            origin: formOrigin.trim(),
            story: formStory.trim(),
            ingredients: textToList(formIngredients),
            instructions: textToList(formInstructions),
            createdAt: new Date().toISOString(),
        };

        persistVault([recipe, ...vaultRecipes]);
        setIsSavingRecipe(false);
        resetForm();
        setScreen('list');
    };

    const handleDeleteVaultRecipe = (recipe) => {
        Alert.alert(
            t('delete_recipe_title'),
            t('delete_recipe_desc', { title: recipe.title }),
            [
                { text: t('cancel_btn'), style: 'cancel' },
                {
                    text: t('delete_recipe_confirm'),
                    style: 'destructive',
                    onPress: () => {
                        persistVault(vaultRecipes.filter((item) => item.id !== recipe.id));
                        backToList();
                    },
                },
            ],
        );
    };

    const handleToggleSpeakStory = () => {
        if (!selectedVaultRecipe) return;
        if (isSpeaking) {
            stopSpeaking();
            return;
        }
        const textToSpeak = selectedVaultRecipe.story || selectedVaultRecipe.title;
        speakText(textToSpeak);
    };

    const buildDetailRecipeForLibrary = (recipe) => ({
        title: recipe.title,
        category: t('tool_family_vault'),
        meal: 'Dinner',
        time: '',
        difficulty: 'Medium',
        emoji: '📖',
        image: null,
        description: recipe.story || '',
        servings: '4',
        ingredients: recipe.ingredients.length ? recipe.ingredients : ['No ingredients listed yet'],
        methodSteps: recipe.instructions.length ? recipe.instructions : ['No method steps listed yet'],
    });

    const handleSaveToMyRecipes = async () => {
        if (!selectedVaultRecipe || collection.isSaving) return;
        try {
            await collection.saveToLibrary(buildDetailRecipeForLibrary(selectedVaultRecipe));
            Alert.alert(t('added_title'), t('family_vault_saved_to_recipes_desc'));
        } catch (e) {
            console.log('[family-vault] save to my recipes failed', e?.message || e);
            Alert.alert(t('save_failed'), t('save_recipe_failed_desc'));
        }
    };

    const handleAddToShoppingList = () => {
        if (!selectedVaultRecipe) return;
        collection.addIngredientsToShoppingList({ title: selectedVaultRecipe.title, ingredients: selectedVaultRecipe.ingredients });
    };

    if (visible && !hasAccess(FEATURE_TIERS.family_vault)) {
        return <UpgradeGateModal visible={visible} onClose={onClose} tier={FEATURE_TIERS.family_vault} />;
    }

    const isBusyImportOrScan = isImportingUrl || Boolean(isScanningMode);

    return (
        <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
            <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.sheet}>
                        <View style={styles.topBar}>
                            <Text style={styles.topBarTitle}>{`📖 ${t('family_vault_title')}`}</Text>
                            <View style={styles.topBarActions}>
                                <TouchableOpacity style={styles.askFernBtn} activeOpacity={0.85} onPress={() => setIsAskFernOpen(true)}>
                                    <Text style={styles.askFernText}>{t('leftover_ask_fern_btn')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
                                    <Text style={styles.closeText}>×</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={styles.scrollContent}
                        >
                            {screen === 'list' ? (
                                <>
                                    <View style={styles.heroIconWrap}>
                                        <Text style={styles.heroIcon}>📖</Text>
                                    </View>
                                    <Text style={styles.heroTitle}>{t('family_vault_title')}</Text>
                                    <Text style={styles.heroSubtitle}>{t('family_vault_subtitle')}</Text>

                                    {vaultRecipes.length ? (
                                        <View style={styles.recipeList}>
                                            {vaultRecipes.map((recipe) => (
                                                <TouchableOpacity
                                                    key={recipe.id}
                                                    style={styles.recipeRow}
                                                    activeOpacity={0.85}
                                                    onPress={() => openDetailScreen(recipe)}
                                                >
                                                    <View style={styles.recipeRowIconWrap}>
                                                        <Text style={styles.recipeRowIcon}>📖</Text>
                                                    </View>
                                                    <View style={styles.recipeRowInfo}>
                                                        <Text style={styles.recipeRowTitle} numberOfLines={1}>{recipe.title}</Text>
                                                        {recipe.origin ? (
                                                            <Text style={styles.recipeRowOrigin} numberOfLines={1}>{recipe.origin}</Text>
                                                        ) : null}
                                                        {recipe.story ? (
                                                            <Text style={styles.recipeRowStory} numberOfLines={1}>{recipe.story}</Text>
                                                        ) : null}
                                                    </View>
                                                    <Text style={styles.recipeRowChevron}>›</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    ) : (
                                        <Text style={styles.emptyText}>{t('family_vault_empty_desc')}</Text>
                                    )}

                                    <View style={styles.launchRow}>
                                        <TouchableOpacity style={styles.launchPrimaryBtn} activeOpacity={0.85} onPress={() => openAddScreen('type')}>
                                            <Text style={styles.launchPrimaryText}>{t('family_vault_type_recipe_btn')}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.launchOutlineBtn} activeOpacity={0.85} onPress={() => openAddScreen('url')}>
                                            <Text style={styles.launchOutlineText}>{t('family_vault_import_url_btn')}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.launchOutlineBtn} activeOpacity={0.85} onPress={() => openAddScreen('scan')}>
                                            <Text style={styles.launchOutlineText}>{t('family_vault_scan_card_btn')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : null}

                            {screen === 'add' ? (
                                <>
                                    <TouchableOpacity style={styles.backRow} activeOpacity={0.7} onPress={() => setScreen('list')}>
                                        <Text style={styles.backArrow}>←</Text>
                                        <Text style={styles.backLabel}>{t('family_vault_add_title')}</Text>
                                    </TouchableOpacity>

                                    <View style={styles.nameRow}>
                                        <View style={styles.nameIconWrap}>
                                            <Text style={styles.nameIcon}>📖</Text>
                                        </View>
                                        <TextInput
                                            value={formTitle}
                                            onChangeText={setFormTitle}
                                            placeholder={t('family_vault_name_placeholder')}
                                            placeholderTextColor="#B0AEA9"
                                            style={styles.nameInput}
                                        />
                                    </View>

                                    <Text style={styles.fieldLabel}>{t('family_vault_origin_label')}</Text>
                                    <TextInput
                                        value={formOrigin}
                                        onChangeText={setFormOrigin}
                                        placeholder={t('family_vault_origin_placeholder')}
                                        placeholderTextColor="#B0AEA9"
                                        style={styles.textInput}
                                    />

                                    <Text style={styles.fieldLabel}>{t('family_vault_story_label')}</Text>
                                    <TextInput
                                        value={formStory}
                                        onChangeText={setFormStory}
                                        placeholder={t('family_vault_story_placeholder')}
                                        placeholderTextColor="#B0AEA9"
                                        style={[styles.textInput, styles.textArea]}
                                        multiline
                                    />

                                    <TouchableOpacity
                                        style={[styles.fernStoryBtn, isTellingStory ? styles.btnDisabled : null]}
                                        activeOpacity={0.85}
                                        onPress={handleLetFernTellStory}
                                        disabled={isTellingStory}
                                    >
                                        {isTellingStory ? (
                                            <ActivityIndicator size="small" color="#F1F7F1" />
                                        ) : (
                                            <Text style={styles.fernStoryBtnText}>{t('family_vault_let_fern_tell_story_btn')}</Text>
                                        )}
                                    </TouchableOpacity>

                                    {addMode === 'url' ? (
                                        <>
                                            <Text style={styles.fieldLabel}>{t('family_vault_url_label')}</Text>
                                            <TextInput
                                                value={formUrl}
                                                onChangeText={setFormUrl}
                                                placeholder={t('family_vault_url_placeholder')}
                                                placeholderTextColor="#B0AEA9"
                                                style={styles.textInput}
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                keyboardType="url"
                                            />
                                            <TouchableOpacity
                                                style={[styles.importBtn, isBusyImportOrScan ? styles.btnDisabled : null]}
                                                activeOpacity={0.85}
                                                onPress={handleImportUrl}
                                                disabled={isBusyImportOrScan}
                                            >
                                                {isImportingUrl ? (
                                                    <ActivityIndicator size="small" color="#FFF5EC" />
                                                ) : (
                                                    <Text style={styles.importBtnText}>{t('family_vault_import_recipe_btn')}</Text>
                                                )}
                                            </TouchableOpacity>
                                        </>
                                    ) : null}

                                    {addMode === 'scan' ? (
                                        <>
                                            <Text style={styles.scanSectionLabel}>{t('family_vault_scan_section_label')}</Text>
                                            <TouchableOpacity
                                                style={[styles.scanBtnPrimary, isBusyImportOrScan ? styles.btnDisabled : null]}
                                                activeOpacity={0.85}
                                                onPress={() => handleScanFromCamera('full')}
                                                disabled={isBusyImportOrScan}
                                            >
                                                {isScanningMode === 'full' ? (
                                                    <ActivityIndicator size="small" color="#FFF5EC" />
                                                ) : (
                                                    <Text style={styles.scanBtnPrimaryText}>{t('family_vault_scan_full_btn')}</Text>
                                                )}
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.scanBtnGreen, isBusyImportOrScan ? styles.btnDisabled : null]}
                                                activeOpacity={0.85}
                                                onPress={() => handleScanFromCamera('ingredients')}
                                                disabled={isBusyImportOrScan}
                                            >
                                                {isScanningMode === 'ingredients' ? (
                                                    <ActivityIndicator size="small" color="#F1F7F1" />
                                                ) : (
                                                    <Text style={styles.scanBtnGreenText}>{t('family_vault_scan_ingredients_btn')}</Text>
                                                )}
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.scanBtnForest, isBusyImportOrScan ? styles.btnDisabled : null]}
                                                activeOpacity={0.85}
                                                onPress={() => handleScanFromCamera('instructions')}
                                                disabled={isBusyImportOrScan}
                                            >
                                                {isScanningMode === 'instructions' ? (
                                                    <ActivityIndicator size="small" color="#F1F7F1" />
                                                ) : (
                                                    <Text style={styles.scanBtnForestText}>{t('family_vault_scan_instructions_btn')}</Text>
                                                )}
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.launchOutlineBtn, isBusyImportOrScan ? styles.btnDisabled : null]}
                                                activeOpacity={0.85}
                                                onPress={handleUploadFromLibrary}
                                                disabled={isBusyImportOrScan}
                                            >
                                                <Text style={styles.launchOutlineText}>{t('family_vault_upload_library_btn')}</Text>
                                            </TouchableOpacity>
                                        </>
                                    ) : null}

                                    {(addMode === 'type' || formIngredients || formInstructions) ? (
                                        <>
                                            <Text style={styles.fieldLabel}>{t('family_vault_ingredients_label')}</Text>
                                            <TextInput
                                                value={formIngredients}
                                                onChangeText={setFormIngredients}
                                                placeholder={t('family_vault_ingredients_placeholder')}
                                                placeholderTextColor="#B0AEA9"
                                                style={[styles.textInput, styles.textArea]}
                                                multiline
                                            />

                                            <Text style={styles.fieldLabel}>{t('family_vault_instructions_label')}</Text>
                                            <TextInput
                                                value={formInstructions}
                                                onChangeText={setFormInstructions}
                                                placeholder={t('family_vault_instructions_placeholder')}
                                                placeholderTextColor="#B0AEA9"
                                                style={[styles.textInput, styles.textArea]}
                                                multiline
                                            />
                                        </>
                                    ) : null}

                                    <TouchableOpacity
                                        style={[styles.saveVaultBtn, isSavingRecipe ? styles.btnDisabled : null]}
                                        activeOpacity={0.85}
                                        onPress={handleSaveToVault}
                                        disabled={isSavingRecipe}
                                    >
                                        <Text style={styles.saveVaultBtnText}>{t('family_vault_save_btn')}</Text>
                                    </TouchableOpacity>
                                </>
                            ) : null}

                            {screen === 'detail' && selectedVaultRecipe ? (
                                <>
                                    <View style={styles.detailHeaderRow}>
                                        <TouchableOpacity style={styles.detailBackBtn} activeOpacity={0.7} onPress={backToList}>
                                            <Text style={styles.backArrow}>←</Text>
                                        </TouchableOpacity>
                                        <View style={styles.detailIconWrap}>
                                            <Text style={styles.detailIcon}>📖</Text>
                                        </View>
                                        <View style={styles.detailTitleWrap}>
                                            <Text style={styles.detailTitle} numberOfLines={2}>{selectedVaultRecipe.title}</Text>
                                            {selectedVaultRecipe.origin ? (
                                                <Text style={styles.detailOrigin} numberOfLines={1}>{selectedVaultRecipe.origin}</Text>
                                            ) : null}
                                        </View>
                                        <TouchableOpacity
                                            style={styles.detailStopBtn}
                                            activeOpacity={0.85}
                                            onPress={handleToggleSpeakStory}
                                        >
                                            <Text style={styles.detailStopBtnText}>{isSpeaking ? t('family_vault_stop_btn') : t('family_vault_play_btn')}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.detailDeleteBtn}
                                            activeOpacity={0.85}
                                            onPress={() => handleDeleteVaultRecipe(selectedVaultRecipe)}
                                        >
                                            <Text style={styles.detailDeleteText}>🗑</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.storyBox}>
                                        <Text style={styles.storyIcon}>📜</Text>
                                        <Text style={styles.storyText}>
                                            {selectedVaultRecipe.story || t('family_vault_no_story_desc')}
                                        </Text>
                                    </View>

                                    {selectedVaultRecipe.ingredients.length ? (
                                        <View style={styles.detailCard}>
                                            <Text style={styles.detailCardLabel}>{`🛒 ${t('family_vault_ingredients_label')}`}</Text>
                                            {selectedVaultRecipe.ingredients.map((item, idx) => (
                                                <View key={`ing-${idx}`} style={styles.detailListRow}>
                                                    <Text style={styles.detailListBullet}>•</Text>
                                                    <Text style={styles.detailListText}>{item}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : null}

                                    {selectedVaultRecipe.instructions.length ? (
                                        <View style={styles.detailCard}>
                                            <Text style={styles.detailCardLabel}>{`📋 ${t('family_vault_instructions_label')}`}</Text>
                                            {selectedVaultRecipe.instructions.map((step, idx) => (
                                                <View key={`step-${idx}`} style={styles.detailListRow}>
                                                    <Text style={styles.detailListBullet}>{idx + 1}.</Text>
                                                    <Text style={styles.detailListText}>{step}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : null}

                                    <View style={styles.detailActionsRow}>
                                        <TouchableOpacity
                                            style={[styles.detailSaveBtn, collection.isSaving ? styles.btnDisabled : null]}
                                            activeOpacity={0.85}
                                            onPress={handleSaveToMyRecipes}
                                            disabled={collection.isSaving}
                                        >
                                            {collection.isSaving ? (
                                                <ActivityIndicator size="small" color="#FFF5EC" />
                                            ) : (
                                                <Text style={styles.detailSaveBtnText}>{t('family_vault_save_to_recipes_btn')}</Text>
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.detailShopBtn} activeOpacity={0.85} onPress={handleAddToShoppingList}>
                                            <Text style={styles.detailShopBtnText}>{t('family_vault_shopping_list_btn')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            ) : null}
                        </ScrollView>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>

            <ChatSheetModal
                visible={isAskFernOpen}
                onClose={() => setIsAskFernOpen(false)}
                user={user}
                systemPrompt={FAMILY_VAULT_SYSTEM_PROMPT}
                autoOpenerPrompt={FAMILY_VAULT_AUTO_OPENER}
                title={t('family_vault_title')}
            />
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.34)',
        justifyContent: 'flex-end',
    },
    sheet: {
        maxHeight: '92%',
        backgroundColor: '#FBF8F2',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        overflow: 'hidden',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#E0D4C4',
        gap: 10,
    },
    topBarTitle: {
        flex: 1,
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 19,
    },
    topBarActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    askFernBtn: {
        backgroundColor: 'rgb(216, 109, 51)',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    askFernText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
    },
    closeBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#E5E4DD',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeText: {
        color: '#2A1A11',
        fontSize: 20,
        lineHeight: 22,
        fontFamily: 'Jost-Regular',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 34,
    },
    heroIconWrap: {
        alignSelf: 'center',
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: '#F1EEE7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroIcon: {
        fontSize: 30,
    },
    heroTitle: {
        marginTop: 14,
        textAlign: 'center',
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 22,
    },
    heroSubtitle: {
        marginTop: 6,
        textAlign: 'center',
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
    },
    emptyText: {
        marginTop: 24,
        marginBottom: 6,
        textAlign: 'center',
        fontStyle: 'italic',
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
    },
    recipeList: {
        marginTop: 22,
        gap: 12,
    },
    recipeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: '#CFE3C8',
        backgroundColor: '#EAF3E6',
        borderRadius: 14,
        padding: 14,
    },
    recipeRowIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    recipeRowIcon: {
        fontSize: 18,
    },
    recipeRowInfo: {
        flex: 1,
    },
    recipeRowTitle: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 16,
    },
    recipeRowOrigin: {
        marginTop: 2,
        color: '#5D4F42',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },
    recipeRowStory: {
        marginTop: 2,
        fontStyle: 'italic',
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },
    recipeRowChevron: {
        color: '#8C7A5F',
        fontFamily: 'Jost-Bold',
        fontSize: 20,
    },
    launchRow: {
        marginTop: 26,
        flexDirection: 'row',
        gap: 10,
    },
    launchPrimaryBtn: {
        flex: 1,
        backgroundColor: '#8B4A1F',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 6,
    },
    launchPrimaryText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        textAlign: 'center',
    },
    launchOutlineBtn: {
        flex: 1,
        backgroundColor: '#F1EEE7',
        borderWidth: 1,
        borderColor: '#D9CFBF',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 6,
        marginTop: 0,
    },
    launchOutlineText: {
        color: '#5D4F42',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        textAlign: 'center',
    },
    backRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 18,
    },
    backArrow: {
        color: '#8B4A1F',
        fontFamily: 'Jost-Bold',
        fontSize: 18,
    },
    backLabel: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 19,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    nameIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    nameIcon: {
        fontSize: 20,
    },
    nameInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    fieldLabel: {
        marginTop: 18,
        marginBottom: 8,
        color: '#7B5C3A',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
        letterSpacing: 1,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#D9CFBF',
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    textArea: {
        minHeight: 90,
        textAlignVertical: 'top',
    },
    fernStoryBtn: {
        marginTop: 16,
        backgroundColor: '#1C3A1A',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    fernStoryBtnText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    importBtn: {
        marginTop: 12,
        backgroundColor: '#8B4A1F',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    importBtnText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    scanSectionLabel: {
        marginTop: 20,
        marginBottom: 10,
        color: '#7B5C3A',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
        letterSpacing: 1,
    },
    scanBtnPrimary: {
        backgroundColor: '#8B4A1F',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        marginBottom: 10,
    },
    scanBtnPrimaryText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    scanBtnGreen: {
        backgroundColor: '#4A7A3E',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        marginBottom: 10,
    },
    scanBtnGreenText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    scanBtnForest: {
        backgroundColor: '#1C3A1A',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        marginBottom: 10,
    },
    scanBtnForestText: {
        color: '#F1F7F1',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    saveVaultBtn: {
        marginTop: 22,
        backgroundColor: '#8B4A1F',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 17,
    },
    saveVaultBtnText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        letterSpacing: 0.3,
    },
    btnDisabled: {
        opacity: 0.6,
    },
    detailHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    detailBackBtn: {
        width: 30,
        alignItems: 'flex-start',
    },
    detailIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#F1EEE7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailIcon: {
        fontSize: 18,
    },
    detailTitleWrap: {
        flex: 1,
    },
    detailTitle: {
        color: '#2A1A11',
        fontFamily: 'Playfair-Bold',
        fontSize: 17,
    },
    detailOrigin: {
        marginTop: 2,
        color: '#8C7A5F',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
    },
    detailStopBtn: {
        backgroundColor: '#FBEAE6',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    detailStopBtnText: {
        color: '#C73E2E',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
    },
    detailDeleteBtn: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: '#FBEAE6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailDeleteText: {
        fontSize: 15,
    },
    storyBox: {
        marginTop: 18,
        flexDirection: 'row',
        gap: 10,
        backgroundColor: '#F1EEE7',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E5DCCB',
        padding: 16,
    },
    storyIcon: {
        fontSize: 18,
    },
    storyText: {
        flex: 1,
        fontStyle: 'italic',
        color: '#5D4F42',
        fontFamily: 'Jost-Medium',
        fontSize: 13,
        lineHeight: 20,
    },
    detailCard: {
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#E5DCCB',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
    },
    detailCardLabel: {
        color: '#7B5C3A',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
        letterSpacing: 1,
        marginBottom: 10,
    },
    detailListRow: {
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#F0EBE0',
        borderStyle: 'dashed',
    },
    detailListBullet: {
        color: '#8C7A5F',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
        width: 18,
    },
    detailListText: {
        flex: 1,
        color: '#2A1A11',
        fontFamily: 'Jost-Regular',
        fontSize: 13,
        lineHeight: 19,
    },
    detailActionsRow: {
        marginTop: 22,
        flexDirection: 'row',
        gap: 10,
    },
    detailSaveBtn: {
        flex: 1,
        backgroundColor: '#8B4A1F',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    detailSaveBtnText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
    detailShopBtn: {
        flex: 1,
        backgroundColor: '#F1EEE7',
        borderWidth: 1,
        borderColor: '#D9CFBF',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    detailShopBtnText: {
        color: '#5D4F42',
        fontFamily: 'Jost-Bold',
        fontSize: 13,
    },
});
