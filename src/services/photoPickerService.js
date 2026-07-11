import * as ImagePicker from 'expo-image-picker';

function normalizeAsset(asset) {
    if (!asset) return null;

    return {
        uri: asset.uri,
        base64: asset.base64 || null,
        mimeType: asset.mimeType || 'image/jpeg',
        width: asset.width,
        height: asset.height,
    };
}

async function pickFromSource(launchFn, requestPermissionFn, { quality = 0.6 } = {}) {
    const { status } = await requestPermissionFn();
    if (status !== 'granted') {
        return { canceled: true, permissionDenied: true, photo: null };
    }

    const result = await launchFn({
        mediaTypes: ['images'],
        base64: true,
        quality,
        allowsEditing: false,
    });

    if (result.canceled || !result.assets?.length) {
        return { canceled: true, permissionDenied: false, photo: null };
    }

    return { canceled: false, permissionDenied: false, photo: normalizeAsset(result.assets[0]) };
}

export async function pickPhotoFromCamera(options = {}) {
    return pickFromSource(
        ImagePicker.launchCameraAsync,
        ImagePicker.requestCameraPermissionsAsync,
        options
    );
}

export async function pickPhotoFromLibrary(options = {}) {
    return pickFromSource(
        ImagePicker.launchImageLibraryAsync,
        ImagePicker.requestMediaLibraryPermissionsAsync,
        options
    );
}
