import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { pickPhotoFromCamera, pickPhotoFromLibrary } from '../../services/photoPickerService';

const COVER_COLORS = [
  '#A7481C', '#2B4C7E', '#1F5C3A', '#5B3A82', '#8A1F4A',
  '#5B3A22', '#2E5F8A', '#7A6B3E', '#8A2F1F', '#3E5C4A',
];

export default function NewCookbookModal({ visible, onClose, onCreate, isCreating, book, onSave, isSaving }) {
  const { t } = useLanguage();
  const isEditMode = !!book;
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState(null);
  const [color, setColor] = useState(COVER_COLORS[0]);
  // A cookbook already has a remote cover URL rather than a locally-picked
  // photo when editing — keep it separate from `photo` (which always means
  // "a new photo was just picked") so we know whether to re-upload.
  const [existingCoverUri, setExistingCoverUri] = useState(null);

  useEffect(() => {
    if (visible) {
      setName(book?.title || '');
      setPhoto(null);
      setColor(book?.color || COVER_COLORS[0]);
      setExistingCoverUri(book?.cover || null);
    }
  }, [visible, book]);

  const handleTakePhoto = async () => {
    const result = await pickPhotoFromCamera();
    if (result.photo) {
      setPhoto(result.photo);
      setExistingCoverUri(null);
    }
  };

  const handlePickFromLibrary = async () => {
    const result = await pickPhotoFromLibrary();
    if (result.photo) {
      setPhoto(result.photo);
      setExistingCoverUri(null);
    }
  };

  const isBusy = isEditMode ? isSaving : isCreating;

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed || isBusy) return;
    if (isEditMode) {
      onSave({ name: trimmed, photo, color });
    } else {
      onCreate({ name: trimmed, photo, color });
    }
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.sheet}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{isEditMode ? t('edit_cookbook_modal_title') : t('new_cookbook_modal_title')}</Text>
              <TouchableOpacity style={styles.closeBtn} activeOpacity={0.85} onPress={onClose}>
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('cookbook_name_placeholder')}
                placeholderTextColor="#B0AEA9"
                style={styles.nameInput}
              />

              <Text style={styles.sectionLabel}>{t('cover_image_optional_label')}</Text>
              <View style={styles.coverRow}>
                <View style={styles.coverPreview}>
                  {photo ? (
                    <Image source={{ uri: photo.uri }} style={styles.coverPreviewImage} />
                  ) : existingCoverUri ? (
                    <Image source={{ uri: existingCoverUri }} style={styles.coverPreviewImage} />
                  ) : (
                    <Text style={styles.coverPreviewIcon}>📷</Text>
                  )}
                </View>
                <View style={styles.coverBtnsCol}>
                  <TouchableOpacity style={styles.coverBtn} activeOpacity={0.85} onPress={handleTakePhoto}>
                    <Text style={styles.coverBtnText}>{t('take_photo_btn')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.coverBtn} activeOpacity={0.85} onPress={handlePickFromLibrary}>
                    <Text style={styles.coverBtnText}>{t('upload_image_btn')}</Text>
                  </TouchableOpacity>
                  {photo ? (
                    <TouchableOpacity style={styles.coverBtn} activeOpacity={0.85} onPress={() => setPhoto(null)}>
                      <Text style={styles.coverBtnText}>{t('clear_btn')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              <Text style={styles.sectionLabel}>{t('pick_a_color_label')}</Text>
              <View style={styles.colorGrid}>
                {COVER_COLORS.map((swatch) => (
                  <TouchableOpacity
                    key={swatch}
                    activeOpacity={0.85}
                    onPress={() => setColor(swatch)}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: swatch },
                      color === swatch ? styles.colorSwatchSelected : null,
                    ]}
                  />
                ))}
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.createBtn, (!name.trim() || isBusy) ? styles.createBtnDisabled : null]}
                  activeOpacity={0.85}
                  onPress={handleSubmit}
                  disabled={!name.trim() || isBusy}
                >
                  {isBusy ? (
                    <ActivityIndicator size="small" color="#F3EEE4" />
                  ) : (
                    <Text style={styles.createBtnText}>{isEditMode ? t('save_changes_btn') : t('create_btn')}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.85} onPress={onClose}>
                  <Text style={styles.cancelBtnText}>{t('cancel_btn')}</Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: 'rgba(0,0,0,0.34)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#FBF8F2',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#D9CFBF',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E0D4C4',
  },
  title: {
    color: '#2A1A11',
    fontFamily: 'PlayfairDisplay-Bold',
    fontSize: 20,
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
    paddingTop: 18,
    paddingBottom: 30,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#D9CFBF',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    color: '#2A1A11',
    fontFamily: 'Jost-Regular',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 10,
    color: '#7B5C3A',
    fontFamily: 'Jost-Bold',
    fontSize: 11,
    letterSpacing: 1.2,
  },
  coverRow: {
    flexDirection: 'row',
    gap: 12,
  },
  coverPreview: {
    width: 80,
    height: 100,
    borderRadius: 10,
    backgroundColor: '#EDEAE2',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverPreviewImage: {
    width: '100%',
    height: '100%',
  },
  coverPreviewIcon: {
    fontSize: 26,
    opacity: 0.5,
  },
  coverBtnsCol: {
    flex: 1,
    gap: 8,
  },
  coverBtn: {
    borderWidth: 1,
    borderColor: '#D9CFBF',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  coverBtnText: {
    color: '#2A1A11',
    fontFamily: 'Jost-Bold',
    fontSize: 12,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorSwatch: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: '#E96B1E',
  },
  actionsRow: {
    marginTop: 26,
    flexDirection: 'row',
    gap: 10,
  },
  createBtn: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#1C512A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  createBtnDisabled: {
    opacity: 0.55,
  },
  createBtnText: {
    color: '#F3EEE4',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9CFBF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  cancelBtnText: {
    color: '#2A1A11',
    fontFamily: 'Jost-Bold',
    fontSize: 14,
  },
});
