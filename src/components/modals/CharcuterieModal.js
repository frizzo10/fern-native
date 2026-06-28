import React from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { colors } from '../../constants/tokens';

const CHARCUTERIE_OCCASIONS = [
    'Date Night',
    'House Party',
    'Wine Tasting',
    'Game Night',
    'Holiday Gathering',
    'Baby Shower',
    'Birthday Party',
    'Corporate Event',
    'Casual Hangout',
    'Movie Night',
];

const CHARCUTERIE_BOARD_STYLES = [
    { id: 'classic', emoji: '🧀', title: 'Classic', subtitle: 'Meats, cheeses & all the classics' },
    { id: 'italian', emoji: '🇮🇹', title: 'Italian', subtitle: 'Prosciutto, parmigiano, olives' },
    { id: 'french', emoji: '🇫🇷', title: 'French', subtitle: 'Brie, pate, cornichons' },
    { id: 'vegan', emoji: '🌱', title: 'Vegan', subtitle: 'Plant-based cheeses & spreads' },
    { id: 'mediterranean', emoji: '🫒', title: 'Mediterranean', subtitle: 'Hummus, pita, feta, olives' },
    { id: 'dessert', emoji: '🍫', title: 'Dessert', subtitle: 'Sweet board with chocolate & fruit' },
];

const CHARCUTERIE_DIETARY_OPTIONS = [
    'None',
    'Vegetarian',
    'Vegan',
    'GF',
    'Halal',
];

export default function CharcuterieModal({
    visible,
    onClose,
    charcuterieOccasion,
    setCharcuterieOccasion,
    charcuterieBoardStyle,
    setCharcuterieBoardStyle,
    charcuteriePeople,
    setCharcuteriePeople,
    charcuterieBudget,
    setCharcuterieBudget,
    charcuterieDietary,
    setCharcuterieDietary,
    isDietaryMenuOpen,
    setIsDietaryMenuOpen,
    onBuild,
    onAskFern,
}) {
    return (
        <Modal
            transparent
            animationType="slide"
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.charcuterieBackdrop}>
                <View style={styles.charcuterieSheet}>
                    <TouchableOpacity style={styles.charcuterieCloseBtn} activeOpacity={0.85} onPress={onClose}>
                        <Text style={styles.charcuterieCloseText}>×</Text>
                    </TouchableOpacity>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.charcuterieContentScroll}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.charcuterieTopRow}>
                            <Text style={styles.charcuterieTopTitle}>🧀 Charcuterie Board Builder</Text>
                        </View>

                        <Text style={styles.charcuterieHero}>🧀</Text>
                        <Text style={styles.charcuterieTitle}>Charcuterie Board Builder</Text>
                        <Text style={styles.charcuterieSubtitle}>Tell us about your gathering and we'll design the perfect board.</Text>

                        <Text style={styles.charcuterieSectionLabel}>OCCASION</Text>
                        <View style={styles.charcuterieOccasionWrap}>
                            {CHARCUTERIE_OCCASIONS.map((occasion) => {
                                const selected = charcuterieOccasion === occasion;
                                return (
                                    <TouchableOpacity
                                        key={occasion}
                                        activeOpacity={0.85}
                                        style={[styles.charcuterieChip, selected ? styles.charcuterieChipActive : null]}
                                        onPress={() => setCharcuterieOccasion(occasion)}
                                    >
                                        <Text style={[styles.charcuterieChipText, selected ? styles.charcuterieChipTextActive : null]}>{occasion}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <Text style={styles.charcuterieSectionLabel}>BOARD STYLE</Text>
                        <View style={styles.charcuterieBoardGrid}>
                            {CHARCUTERIE_BOARD_STYLES.map((styleItem) => {
                                const selected = charcuterieBoardStyle === styleItem.id;
                                return (
                                    <TouchableOpacity
                                        key={styleItem.id}
                                        activeOpacity={0.86}
                                        style={[styles.charcuterieBoardCard, selected ? styles.charcuterieBoardCardActive : null]}
                                        onPress={() => setCharcuterieBoardStyle(styleItem.id)}
                                    >
                                        <Text style={[styles.charcuterieBoardTitle, selected ? styles.charcuterieBoardTitleActive : null]}>
                                            {`${styleItem.emoji} ${styleItem.title}`}
                                        </Text>
                                        <Text style={[styles.charcuterieBoardSub, selected ? styles.charcuterieBoardSubActive : null]}>
                                            {styleItem.subtitle}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={styles.charcuterieInputRow}>
                            <View style={styles.charcuterieInputCol}>
                                <Text style={styles.charcuterieSectionLabel}>PEOPLE</Text>
                                <TextInput
                                    value={charcuteriePeople}
                                    onChangeText={setCharcuteriePeople}
                                    keyboardType="number-pad"
                                    placeholder="6"
                                    placeholderTextColor="#B5AA9B"
                                    style={styles.charcuterieInput}
                                />
                            </View>

                            <View style={styles.charcuterieInputCol}>
                                <Text style={styles.charcuterieSectionLabel}>BUDGET $</Text>
                                <TextInput
                                    value={`${charcuterieBudget}`}
                                    onChangeText={setCharcuterieBudget}
                                    keyboardType="number-pad"
                                    placeholder="60"
                                    placeholderTextColor="#B5AA9B"
                                    style={styles.charcuterieInput}
                                />
                            </View>

                            <View style={styles.charcuterieInputCol}>
                                <Text style={styles.charcuterieSectionLabel}>DIETARY</Text>
                                <View style={styles.charcuteriePickerWrapper}>
                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        style={styles.charcuterieDropdownButton}
                                        onPress={() => setIsDietaryMenuOpen((v) => !v)}
                                    >
                                        <Text style={styles.charcuterieDropdownText}>{charcuterieDietary}</Text>
                                        <Text style={styles.charcuterieDropdownArrow}>⌄</Text>
                                    </TouchableOpacity>

                                    {isDietaryMenuOpen && (
                                        <View style={styles.charcuterieDropdownMenu}>
                                            {CHARCUTERIE_DIETARY_OPTIONS.map((option) => (
                                                <TouchableOpacity
                                                    key={option}
                                                    style={styles.charcuterieDropdownItem}
                                                    activeOpacity={0.8}
                                                    onPress={() => {
                                                        setCharcuterieDietary(option);
                                                        setIsDietaryMenuOpen(false);
                                                    }}
                                                >
                                                    <Text style={styles.charcuterieDropdownItemText}>{option}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.charcuterieBuildBtn} activeOpacity={0.85} onPress={onBuild}>
                            <Text style={styles.charcuterieBuildBtnText}>🧀 Build My Board</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.charcuterieAskFernBtn} activeOpacity={0.85} onPress={onAskFern}>
                            <Text style={styles.charcuterieAskFernText}>🌿 Ask Fern to Walk Me Through It</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    charcuterieBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.28)',
        justifyContent: 'flex-end',
    },
    charcuterieSheet: {
        backgroundColor: '#F5F2ED',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 16,
        height: '86%',
    },
    charcuterieCloseBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 1,
        borderColor: '#C9BAA4',
        backgroundColor: '#EFE9DF',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    charcuterieCloseText: {
        color: '#8C6B46',
        fontFamily: 'Jost-Bold',
        fontSize: 26,
        lineHeight: 32,
    },
    charcuterieContentScroll: {
        paddingTop: 8,
        paddingBottom: 28,
    },
    charcuterieTopRow: {
        borderBottomWidth: 1,
        borderBottomColor: '#D6C8B4',
        marginHorizontal: -16,
        paddingHorizontal: 16,
        paddingBottom: 12,
        marginBottom: 12,
    },
    charcuterieTopTitle: {
        color: '#2A1A11',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 16,
        lineHeight: 24,
        paddingRight: 58,
    },
    charcuterieHero: {
        marginTop: 2,
        textAlign: 'center',
        fontSize: 50,
        lineHeight: 62,
    },
    charcuterieTitle: {
        marginTop: 2,
        textAlign: 'center',
        color: '#2A1A11',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 20,
        lineHeight: 40,
    },
    charcuterieSubtitle: {
        marginTop: 8,
        textAlign: 'center',
        color: '#7B5E3E',
        fontFamily: 'Jost-Regular',
        fontSize: 14,
        lineHeight: 22,
        paddingHorizontal: 4,
    },
    charcuterieSectionLabel: {
        marginTop: 18,
        marginBottom: 8,
        color: '#7B5C3A',
        fontFamily: 'Jost-Bold',
        fontSize: 12,
        letterSpacing: 1,
    },
    charcuterieOccasionWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    charcuterieChip: {
        borderWidth: 1,
        borderColor: '#CFBFA7',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#F5F2ED',
    },
    charcuterieChipActive: {
        backgroundColor: '#1D512A',
        borderColor: '#1D512A',
    },
    charcuterieChipText: {
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 11,
    },
    charcuterieChipTextActive: {
        color: '#F9F3E8',
    },
    charcuterieBoardGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    charcuterieBoardCard: {
        width: '48.5%',
        borderWidth: 2,
        borderColor: '#CEBFA6',
        borderRadius: 16,
        backgroundColor: '#F6F3ED',
        paddingHorizontal: 12,
        paddingVertical: 12,
        minHeight: 92,
    },
    charcuterieBoardCardActive: {
        borderColor: colors.forest,
        backgroundColor: '#EAF2E8',
    },
    charcuterieBoardTitle: {
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        lineHeight: 20,
    },
    charcuterieBoardTitleActive: {
        color: '#1D4A27',
    },
    charcuterieBoardSub: {
        marginTop: 4,
        color: '#665446',
        fontFamily: 'Jost-Medium',
        fontSize: 12,
        lineHeight: 18,
    },
    charcuterieBoardSubActive: {
        color: '#2A5B34',
    },
    charcuterieInputRow: {
        marginTop: 4,
        flexDirection: 'row',
        gap: 10,
    },
    charcuterieInputCol: {
        flex: 1,
    },
    charcuterieInput: {
        borderWidth: 2,
        borderColor: '#CEBFA6',
        borderRadius: 14,
        backgroundColor: '#F6F3ED',
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
        lineHeight: 20,
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    charcuteriePickerWrapper: {
        position: 'relative',
    },
    charcuterieDropdownButton: {
        borderWidth: 2,
        borderColor: '#CEBFA6',
        borderRadius: 14,
        backgroundColor: '#F6F3ED',
        minHeight: 35,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    charcuterieDropdownText: {
        color: '#2A1A11',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    charcuterieDropdownArrow: {
        fontSize: 20,
        color: '#6D563F',
        marginTop: -10,
    },
    charcuterieDropdownMenu: {
        position: 'absolute',
        bottom: 58,
        backgroundColor: '#FFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D9CFBF',
        overflow: 'hidden',
        zIndex: 9999,
        elevation: 10,
        shadowColor: '#181717',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: {
            width: 0,
            height: 2,
        },
    },
    charcuterieDropdownItem: {
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    charcuterieDropdownItemText: {
        color: '#2A1A11',
        fontFamily: 'Jost-Medium',
        fontSize: 15,
    },
    charcuterieBuildBtn: {
        marginTop: 18,
        backgroundColor: '#5A2F16',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    charcuterieBuildBtnText: {
        color: '#FFF5EB',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
    charcuterieAskFernBtn: {
        marginTop: 10,
        backgroundColor: '#EC6518',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    charcuterieAskFernText: {
        color: '#FFF5EC',
        fontFamily: 'Jost-Bold',
        fontSize: 14,
    },
});
