import React, { useState } from 'react';
import {
    Alert,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, shadow } from '../constants/tokens';

const bloggers = [
    { name: 'mitten Kitchen', emoji: '🍋', backgroundColor: '#4E8B2F' },
    { name: 'Budget Bytes', emoji: '💰', backgroundColor: '#224E37' },
];

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

function BloggerCard({ item }) {
    return (
        <View style={styles.bloggerCardWrap}>
            <View style={[styles.bloggerCard, { backgroundColor: item.backgroundColor }]}>
                <Text style={styles.bloggerEmoji}>{item.emoji}</Text>
            </View>
            <Text style={styles.bloggerName}>{item.name}</Text>
        </View>
    );
}

export default function SearchScreen() {
    const [searchText, setSearchText] = useState('');
    const [cravingText, setCravingText] = useState('');

    const runSearch = () => {
        const query = searchText.trim();
        Alert.alert('Search', query ? `Searching for ${query}` : 'Type an ingredient to search.');
    };

    const runCraving = () => {
        const query = cravingText.trim();
        Alert.alert('Ask Fern', query ? `Fern will think about ${query}` : 'Tell Fern what you are craving.');
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <LinearGradient colors={['#FBF7EF', '#F7F1E6', '#FBF8F1']} style={styles.background}>
                <View style={styles.glowOne} />
                <View style={styles.glowTwo} />

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
                            <TouchableOpacity activeOpacity={0.85} onPress={() => Alert.alert('Manage', 'Manage your followed bloggers.')}>
                                <Text style={styles.manageLink}>{'>Manage →'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.bloggersRow}>
                        {bloggers.map((item) => (
                            <BloggerCard key={item.name} item={item} />
                        ))}

                        <View style={styles.bloggerCardWrap}>
                            <View style={[styles.bloggerCard, styles.followCard]}>
                                <Text style={styles.followPlus}>+</Text>
                            </View>
                            <Text style={styles.bloggerName}>Follow</Text>
                        </View>
                    </View>
                </ScrollView>
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
        backgroundColor: '#E6DBCA',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        fontFamily: 'Jost-SemiBold',
        fontSize: 10,
        color: '#86725B',
    },
    cravingButton: {
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
});