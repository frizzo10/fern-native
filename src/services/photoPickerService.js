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

// Optional on-phone shrink (expo-image-manipulator, guarded so an older binary just skips it).
async function shrinkAsset(asset, maxWidth) {
    try {
        if (!maxWidth || !asset?.uri || !(asset.width > maxWidth)) return asset;
        const Manipulator = require('expo-image-manipulator');
        const out = await Manipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: maxWidth } }],
            { compress: 0.6, format: Manipulator.SaveFormat.JPEG, base64: true }
        );
        if (!out?.base64) return asset;
        return { ...asset, uri: out.uri, base64: out.base64, width: out.width, height: out.height, mimeType: 'image/jpeg' };
    } catch (e) {
        return asset;
    }
}

async function pickFromSource(launchFn, requestPermissionFn, { quality = 0.6, maxWidth, onStage } = {}) {
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

    return { canceled: false, permissionDenied: false, photo: normalizeAsset(await shrinkAsset(result.assets[0], maxWidth)) };
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
