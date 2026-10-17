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

async function pickFromSource(launchFn, requestPermissionFn, { quality = 0.6, onStage } = {}) {
    // onStage (optional) reports each step so a picker that never opens can be located on the phone.
    onStage?.('2. asking permission');
    const { status } = await requestPermissionFn();
    onStage?.(`3. permission answer: ${status}`);
    if (status !== 'granted') {
        return { canceled: true, permissionDenied: true, photo: null };
    }

    onStage?.('4. opening camera/photos');
    const result = await launchFn({
        mediaTypes: ['images'],
        base64: true,
        quality,
        allowsEditing: false,
    });
    onStage?.(`5. picker closed (canceled: ${Boolean(result?.canceled)})`);

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
