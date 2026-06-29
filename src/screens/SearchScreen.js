import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Image,
    Linking,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { FEATURED_BLOGGERS } from '../constants/featuredBloggers';
import { colors, radius, shadow } from '../constants/tokens';
import { useSync } from '../hooks/useSync';

function ActionButton({ label, icon, dark, onPress, style }) {
    return (
        <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.actionButton, dark ? styles.actionButtonDark : styles.actionButtonLight, style]}>
            <Text
                numberOfLines={1}
                style={[styles.actionButtonText, dark ? styles.actionButtonTextDark : styles.actionButtonTextLight]}
            >
                {icon ? `${icon} ` : ''}{label}
            </Text>
        </TouchableOpacity>
    );
}

function BloggerCard({ item, onPress }) {
    return (
        <TouchableOpacity style={styles.bloggerCardWrap} activeOpacity={0.85} onPress={onPress}>
            <View style={[styles.bloggerCard, { backgroundColor: item.color }]}>
                <Text style={styles.bloggerEmoji}>{item.emoji}</Text>
            </View>
            <Text style={styles.bloggerName}>{item.name}</Text>
        </TouchableOpacity>
    );
}

export default function SearchScreen({ user }) {
    const navigation = useNavigation();
    const route = useRoute();
    const { data, pull, pushAllFromStorage } = useSync(user);
    const [searchText, setSearchText] = useState('');
    const [cravingText, setCravingText] = useState('');
    const [isBloggersModalOpen, setIsBloggersModalOpen] = useState(false);
    const [bloggerQuery, setBloggerQuery] = useState('');
    const [followingBloggersLocal, setFollowingBloggersLocal] = useState([]);
    const syncTimerRef = useRef(null);
    const isSyncingRef = useRef(false);
    const scrollRef = useRef(null);
    useEffect(() => {
        if (route?.params?.openBloggers) {
            setIsBloggersModalOpen(true);
            navigation.setParams({ openBloggers: false });
        }
    }, [route?.params?.openBloggers, navigation]);

    useEffect(() => {
        if (isBloggersModalOpen) {
            pull();
        }
    }, [isBloggersModalOpen, pull]);

    useFocusEffect(
        useMemo(() => () => {
            pull();
        }, [pull])
    );

    useEffect(() => {
        return () => {
            if (syncTimerRef.current) {
                clearTimeout(syncTimerRef.current);
            }
        };
    }, []);

    const normalizeBlogger = (item) => {
        const featured = FEATURED_BLOGGERS.find((b) => b.id === item?.id || b.name === item?.name);
        return {
            id: item?.id || featured?.id,
            url: item?.url || featured?.url || '',
            name: item?.name || featured?.name || 'Unknown blogger',
            color: item?.color || featured?.color || '#4A7C2F',
            emoji: item?.emoji || featured?.emoji || '🍽',
            specialty: item?.specialty || featured?.specialty || 'Food recipes',
        };
    };

    useEffect(() => {
        const source = Array.isArray(data.followers) ? data.followers : [];
        const hasPendingSync = Boolean(syncTimerRef.current);
        if (hasPendingSync || isSyncingRef.current) {
            console.log('[bloggers-sync] ignoring remote update while local sync is pending', {
                remoteCount: source.length,
                pending: hasPendingSync,
                syncing: isSyncingRef.current,
            });
            return;
        }

        console.log('[bloggers-sync] applying remote followers', {
            count: source.length,
            ids: source.map((b) => b?.id).filter(Boolean),
        });
        setFollowingBloggersLocal(source.map(normalizeBlogger));
    }, [data.followers]);

    const persistFollowedBloggersLocal = async (nextFollowed) => {
        setFollowingBloggersLocal(nextFollowed);

        await AsyncStorage.setItem('cpc_followed_bloggers', JSON.stringify(nextFollowed));
        const cache = JSON.parse(await AsyncStorage.getItem('fern_sync_cache') || '{}');
        await AsyncStorage.setItem('fern_sync_cache', JSON.stringify({
            ...cache,
            followers: nextFollowed,
        }));
    };

    const scheduleBloggersSync = (nextFollowed, reason) => {
        if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
        }

        console.log('[bloggers-sync] queued sync in 2000ms', {
            reason,
            count: nextFollowed.length,
            ids: nextFollowed.map((b) => b.id),
        });

        syncTimerRef.current = setTimeout(async () => {
            syncTimerRef.current = null;
            isSyncingRef.current = true;

            try {
                console.log('[bloggers-sync] uploading followed_bloggers', {
                    count: nextFollowed.length,
                    ids: nextFollowed.map((b) => b.id),
                });
                await pushAllFromStorage();

                console.log('[bloggers-sync] upload complete, pulling latest from backend');
                await pull();
                console.log('[bloggers-sync] pull complete after upload');
            } catch (e) {
                console.log('[bloggers-sync] upload/pull failed', e?.message || e);
                Alert.alert('Sync error', 'Could not sync followed bloggers. Please try again.');
            } finally {
                isSyncingRef.current = false;
            }
        }, 2000);
    };

    const followingBloggers = followingBloggersLocal;
    const followingIds = useMemo(
        () => new Set(followingBloggers.map((b) => b.id)),
        [followingBloggers]
    );

    const visibleBloggers = FEATURED_BLOGGERS.filter((blogger) => {
        const q = bloggerQuery.trim().toLowerCase();
        if (!q) return true;
        return blogger.name.toLowerCase().includes(q) || blogger.specialty.toLowerCase().includes(q);
    });

    const runSearch = () => {
        const query = searchText.trim();
        Alert.alert('Search', query ? `Searching for ${query}` : 'Type an ingredient to search.');
    };

    const runCraving = () => {
        const query = cravingText.trim();
        Alert.alert('Ask Fern', query ? `Fern will think about ${query}` : 'Tell Fern what you are craving.');
    };

    const toggleFollow = async (blogger) => {
        const bloggerId = blogger.id;
        const removing = followingIds.has(bloggerId);
        const next = removing
            ? followingBloggers.filter((item) => item.id !== bloggerId)
            : [...followingBloggers, blogger];

        try {
            console.log('[bloggers-sync] local change', {
                action: removing ? 'delete' : 'add',
                bloggerId,
                bloggerName: blogger.name,
                nextCount: next.length,
            });
            await persistFollowedBloggersLocal(next);
            scheduleBloggersSync(next, removing ? 'delete' : 'add');
        } catch {
            Alert.alert('Sync error', 'Could not update followed bloggers. Please try again.');
        }
    };

    const openBloggerRecipes = async (blogger) => {
        try {
            await Linking.openURL(blogger.url);
        } catch {
            Alert.alert('Recipes', `Could not open ${blogger.url}`);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <LinearGradient colors={['#FBF7EF', '#F7F1E6', '#FBF8F1']} style={styles.background}>
                <View style={styles.glowOne} />
                <View style={styles.glowTwo} />

                <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <View style={styles.hero}>
                        <View style={styles.wordmarkRow}>
                            <Image source={require('../../assets/icon.png')} style={styles.heroIcon} resizeMode="contain" />
                            <Text style={styles.wordmark}>fern</Text>
                        </View>
                        <Text style={styles.tagline}>WEEKLY AD TO DINNER TABLE • PATENT PENDING</Text>
                    </View>

                    <Text style={styles.title}>
                        <Text style={styles.titleMain}>What are you </Text>
                        <Text style={styles.titleAccent}>cooking</Text>
                        <Text style={styles.titleMain}>{'\n'}</Text>
                        <Text style={styles.titleAccent}>tonight?</Text>
                    </Text>

                    <Text style={styles.subtitle}>
                        Search by ingredient, scan your grocery circular, or let AI surprise you.
                    </Text>

                    <View style={styles.searchCard}>
                        <TextInput
                            value={searchText}
                            onChangeText={setSearchText}
                            placeholder="e.g. chicken thighs, ground beef, salmon..."
                            placeholderTextColor="#C7B59E"
                            style={styles.searchInput}
                            returnKeyType="search"
                            onSubmitEditing={runSearch}
                        />
                        <TouchableOpacity activeOpacity={0.9} onPress={runSearch} style={styles.searchButton}>
                            <Text style={styles.searchButtonText}>{'>SEARCH ✦'}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.quickActionsRow}>
                        <ActionButton
                            label="Circular Scanner"
                            icon="📸"
                            onPress={() => Alert.alert('Circular Scanner', 'Open the grocery circular scanner.')}
                            style={styles.quickActionLeft}
                        />
                        <ActionButton
                            label="Suggest Something"
                            icon="🤔"
                            dark
                            onPress={() => Alert.alert('Suggest Something', 'Let Fern suggest a dinner idea.')}
                            style={styles.quickActionRight}
                        />
                    </View>

                    <View style={styles.cravingCard}>
                        <Text style={styles.cravingLabel}>I Am Craving</Text>
                        <TextInput
                            value={cravingText}
                            onChangeText={setCravingText}
                            placeholder="an ingredient, a mood, a cuisine..."
                            placeholderTextColor="#9F9E99"
                            style={styles.cravingInput}
                            returnKeyType="done"
                            onSubmitEditing={runCraving}
                            onFocus={() => {
                                scrollRef.current?.scrollTo({
                                    y: 120,
                                    animated: true,
                                });
                            }}
                        />
                        <TouchableOpacity activeOpacity={0.9} onPress={runCraving} style={styles.cravingButton}>
                            <Text style={styles.cravingButtonText}>{'>✦ Go'}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>👨‍🍳 FOOD BLOGGERS</Text>
                        <View style={styles.sectionHeaderActions}>
                            <ActionButton
                                label="Ask Fern"
                                icon="🌿"
                                dark={false}
                                onPress={() => Alert.alert('Ask Fern', 'Ask Fern about a recipe or ingredient.')}
                                style={styles.askFernButton}
                            />
                            <TouchableOpacity activeOpacity={0.85} onPress={() => setIsBloggersModalOpen(true)}>
                                <Text style={styles.manageLink}>{'>Manage →'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.bloggersRow}>
                        {followingBloggers.map((item) => (
                            <BloggerCard key={item.id} item={item} onPress={() => setIsBloggersModalOpen(true)} />
                        ))}

                        <TouchableOpacity style={styles.bloggerCardWrap} activeOpacity={0.85} onPress={() => setIsBloggersModalOpen(true)}>
                            <View style={[styles.bloggerCard, styles.followCard]}>
                                <Text style={styles.followPlus}>+</Text>
                            </View>
                            <Text style={styles.bloggerName}>Follow</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>

                <Modal
                    animationType="fade"
                    transparent
                    visible={isBloggersModalOpen}
                    onRequestClose={() => setIsBloggersModalOpen(false)}
                >
                    <View style={styles.modalBackdrop}>
                        <SafeAreaView style={styles.modalSafeArea}>
                            <View style={styles.modalCard}>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>👨‍🍳 Food Bloggers</Text>
                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        onPress={() => setIsBloggersModalOpen(false)}
                                        style={styles.modalCloseBtn}
                                    >
                                        <Text style={styles.modalCloseText}>×</Text>
                                    </TouchableOpacity>
                                </View>

                                <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                                    <Text style={styles.followingTitle}>FOLLOWING ({followingBloggers.length})</Text>

                                    {followingBloggers.map((blogger) => (
                                        <View key={`following-${blogger.id}`} style={styles.manageRowCard}>
                                            <View style={[styles.manageAvatar, { backgroundColor: blogger.color }]}>
                                                <Text style={styles.manageAvatarEmoji}>{blogger.emoji}</Text>
                                            </View>

                                            <View style={styles.manageMeta}>
                                                <Text style={styles.manageName}>{blogger.name}</Text>
                                                <Text style={styles.manageSpecialty}>{blogger.specialty}</Text>
                                            </View>

                                            <View style={styles.followingActions}>
                                                <TouchableOpacity activeOpacity={0.85} style={styles.followingActionBtn}>
                                                    <Text style={styles.followingActionText}>New</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity activeOpacity={0.85} style={styles.followingActionBtn} onPress={() => openBloggerRecipes(blogger)}>
                                                    <Text style={styles.followingRecipesText}>Recipes</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity activeOpacity={0.85} style={styles.followingRemoveBtn} onPress={() => toggleFollow(blogger)}>
                                                    <Text style={styles.followingRemoveText}>×</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}

                                    <View style={styles.modalSearchWrap}>
                                        <TextInput
                                            value={bloggerQuery}
                                            onChangeText={setBloggerQuery}
                                            placeholder="Search 50+ food bloggers..."
                                            placeholderTextColor="#AAA39A"
                                            style={styles.modalSearchInput}
                                        />
                                    </View>

                                    {visibleBloggers.map((blogger) => {
                                        const isFollowing = followingIds.has(blogger.id);

                                        return (
                                            <View key={`discover-${blogger.id}`} style={styles.manageRowCard}>
                                                <View style={[styles.manageAvatar, { backgroundColor: blogger.color }]}>
                                                    <Text style={styles.manageAvatarEmoji}>{blogger.emoji}</Text>
                                                </View>

                                                <View style={styles.manageMeta}>
                                                    <Text style={styles.manageName}>{blogger.name}</Text>
                                                    <Text style={styles.manageSpecialty}>{blogger.specialty}</Text>
                                                </View>

                                                <TouchableOpacity
                                                    activeOpacity={0.85}
                                                    onPress={() => toggleFollow(blogger)}
                                                    style={isFollowing ? styles.followingPill : styles.followPill}
                                                >
                                                    <Text style={isFollowing ? styles.followingPillText : styles.followPillText}>
                                                        {isFollowing ? '✓ Following' : '+ Follow'}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        </SafeAreaView>
                    </View>
                </Modal>
            </LinearGradient>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.parch,
    },
    background: {
        flex: 1,
        position: 'relative',
    },
    glowOne: {
        position: 'absolute',
        top: 70,
        left: -50,
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: 'rgba(28,58,26,0.06)',
    },
    glowTwo: {
        position: 'absolute',
        top: 140,
        right: -30,
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(232,101,26,0.05)',
    },
    content: {
        paddingHorizontal: 22,
        paddingTop: 14,
        paddingBottom: 130,
    },
    hero: {
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 10,
    },
    wordmarkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    heroIcon: {
        width: 0,
        height: 0,
        tintColor: '#4D823D',
    },
    wordmark: {
        fontFamily: 'PlayfairDisplay-Regular',
        fontSize: 52,
        lineHeight: 72,
        color: '#204421',
    },
    tagline: {
        marginTop: 6,
        fontFamily: 'Jost-SemiBold',
        fontSize: 10,
        letterSpacing: 1.6,
        color: '#5B8F3D',
        textAlign: 'center',
    },
    title: {
        textAlign: 'center',
        marginTop: 6,
        marginBottom: 10,
    },
    titleMain: {
        fontFamily: 'Playfair-Regular',
        fontSize: 28,
        color: '#4B2412',
    },
    titleAccent: {
        fontFamily: 'Playfair-Italic',
        fontSize: 28,
        color: '#3F7A34'
    },
    subtitle: {
        textAlign: 'center',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
        marginTop: -5,
        color: '#8B6840',
        marginBottom: 22,
    },
    searchCard: {
        backgroundColor: '#FFFDF8',
        borderColor: '#E2CFB0',
        borderWidth: 2,
        borderRadius: 18,
        padding: 14,
        ...shadow.card,
        marginBottom: 22,
    },
    searchInput: {
        borderRadius: 14,
        backgroundColor: '#FFFDF8',
        color: '#7B5D3B',
        fontFamily: 'PlayfairDisplay-Italic',
        fontSize: 14,
        paddingHorizontal: 10,
        paddingVertical: 10,
        marginBottom: 12,
    },
    searchButton: {
        backgroundColor: colors.forest,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    searchButtonText: {
        color: '#FFF8EE',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 2.2,
    },
    quickActionsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 15,
    },
    actionButton: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadow.card,
    },
    actionButtonDark: {
        backgroundColor: '#3C2414',
    },
    actionButtonLight: {
        backgroundColor: colors.forest,
    },
    actionButtonText: {
        fontSize: 13,
    },
    actionButtonTextDark: {
        color: '#F3E5D5',
        fontFamily: 'Jost-SemiBold',
    },
    actionButtonTextLight: {
        color: '#F5F0E3',
        fontFamily: 'Jost-SemiBold',
    },
    quickActionLeft: {
        flex: 1,
    },
    quickActionRight: {
        flex: 1,
    },
    cravingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#9F804E',
        borderRadius: 12,
        padding: 5,
        marginBottom: 20,
    },
    cravingLabel: {
        color: '#F4E7CC',
        fontFamily: 'PlayfairDisplay-MediumItalic',
        fontSize: 12,
        flexShrink: 0,
        marginHorizontal: 12,
    },
    cravingInput: {
        flex: 1,
        minWidth: 0,
        backgroundColor: '#E6DBCA',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontFamily: 'Jost-SemiBold',
        fontSize: 10,
        color: '#86725B',
    },
    cravingButton: {
        width: 60,
        backgroundColor: '#3F2412',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginLeft: 10,
    },
    cravingButtonText: {
        color: '#F8ECDB',
        fontFamily: 'Jost-SemiBold',
        fontSize: 10,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    sectionTitle: {
        fontFamily: 'Jost-Bold',
        color: '#7A5A36',
        fontSize: 12,
        letterSpacing: 1.2,
        flexShrink: 1,
    },
    sectionHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginLeft: 8,
    },
    askFernButton: {
        flex: 0,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: '#F17821',
    },
    manageLink: {
        fontFamily: 'Jost-SemiBold',
        color: '#D43C6E',
        fontSize: 10,
    },
    bloggersRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        alignItems: 'flex-start',
    },
    bloggerCardWrap: {
        alignItems: 'center',
        width: 96,
    },
    bloggerCard: {
        width: 92,
        height: 92,
        borderRadius: 46,
        borderWidth: 4,
        borderColor: '#F8F4EC',
        alignItems: 'center',
        justifyContent: 'center',
        ...shadow.card,
    },
    bloggerEmoji: {
        fontSize: 34,
    },
    bloggerName: {
        marginTop: 10,
        fontFamily: 'Jost-SemiBold',
        color: '#7E5C31',
        fontSize: 12,
        textAlign: 'center',
    },
    followCard: {
        borderStyle: 'dashed',
        borderColor: '#DAC7AA',
        backgroundColor: '#F6EFE4',
    },
    followPlus: {
        fontSize: 22,
        color: '#2E1C10',
        marginTop: -2,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(16, 12, 8, 0.45)',
        paddingHorizontal: 12,
        paddingVertical: 18,
    },
    modalSafeArea: {
        flex: 1,
        justifyContent: 'center',
    },
    modalCard: {
        backgroundColor: '#F7F4EE',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#DDD0BB',
        maxHeight: '90%',
        overflow: 'hidden',
    },
    modalHeader: {
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#DDD0BB',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    modalTitle: {
        fontFamily: 'Playfair-Bold',
        color: '#2F1C10',
        fontSize: 18,
        lineHeight: 24,
    },
    modalCloseBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#CEBFA8',
        backgroundColor: '#EFE8DB',
    },
    modalCloseText: {
        fontSize: 28,
        color: '#8A6B47',
        marginTop: -2,
    },
    modalContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    followingTitle: {
        marginTop: 14,
        marginBottom: 12,
        fontFamily: 'Jost-Bold',
        fontSize: 16,
        letterSpacing: 1.8,
        color: '#7E5D3A',
    },
    manageRowCard: {
        backgroundColor: '#F9F7F3',
        borderWidth: 1,
        borderColor: '#D3C3AB',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 14,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
    },
    manageAvatar: {
        width: 34,
        height: 34,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },
    manageAvatarEmoji: {
        fontSize: 20,
    },
    manageMeta: {
        flex: 1,
        marginLeft: 8,
    },
    manageName: {
        fontFamily: 'Jost-Bold',
        fontSize: 18,
        lineHeight: 22,
        color: '#2E1A0F',
    },
    manageSpecialty: {
        marginTop: 2,
        fontFamily: 'Jost-Regular',
        fontSize: 10,
        lineHeight: 12,
        color: '#7D6040',
    },
    followingActions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
        gap: 8,
    },
    followingActionBtn: {
        borderWidth: 1,
        borderColor: '#D1C0A6',
        backgroundColor: '#F4EEE4',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    followingActionText: {
        color: '#8A6C4B',
        fontFamily: 'Jost-SemiBold',
        fontSize: 8,
    },
    followingRecipesText: {
        color: '#2E92F4',
        fontFamily: 'Jost-SemiBold',
        fontSize: 8,
    },
    followingRemoveBtn: {
        backgroundColor: '#F5DDE1',
        borderRadius: 6,
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    followingRemoveText: {
        fontSize: 12,
        color: '#D5464E',
        lineHeight: 14,
        marginTop: -1,
    },
    modalSearchWrap: {
        marginTop: 6,
        marginBottom: 10,
    },
    modalSearchInput: {
        borderWidth: 1,
        borderColor: '#D6C7B2',
        borderRadius: 14,
        backgroundColor: '#FCF9F4',
        paddingHorizontal: 16,
        paddingVertical: 13,
        fontFamily: 'Jost-Regular',
        color: '#624A31',
        fontSize: 12,
    },
    followPill: {
        backgroundColor: '#CB1B6D',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 9,
    },
    followPillText: {
        color: '#FFF5FB',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
    },
    followingPill: {
        borderWidth: 2,
        borderColor: '#A4D6B0',
        backgroundColor: '#E7F5E9',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 10,
    },
    followingPillText: {
        color: '#2F8550',
        fontFamily: 'Jost-Bold',
        fontSize: 10,
    },
});