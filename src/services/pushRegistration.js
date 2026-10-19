// Registers this phone for server-sent push notifications (the weekly-circular sale alerts).
// Local notifications (arrival, leaving, shopping day) do not need this and are unaffected.
//
// Never prompts: the permission is asked by LocationSetupModal. If it is not granted yet, or this
// build has no push entitlement (builds before 1.1.9), it quietly does nothing and tries again
// the next time the app opens or comes back to the foreground. The token is re-sent only when the
// signed-in user or the token changes (device-only `fern_push_sent`).
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REGISTER_URL = 'https://app.clickpickandcook.com/.netlify/functions/register-push';
const EAS_PROJECT_ID = 'fca8fa3a-da78-4911-b7c2-df25d4957d54'; // same as app.json extra.eas.projectId
const SENT_KEY = 'fern_push_sent';

export async function registerForPush(user) {
    try {
        if (!user?.id || !user?.token) return 'no-user';
        if (Platform.OS !== 'ios' && Platform.OS !== 'android') return 'unsupported';
        const perm = await Notifications.getPermissionsAsync();
        if (perm?.status !== 'granted') return 'no-permission';

        const { data: expoToken } = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
        if (!expoToken) return 'no-token';

        const mark = `${user.id}|${expoToken}`;
        const already = await AsyncStorage.getItem(SENT_KEY).catch(() => null);
        if (already === mark) return 'unchanged';

        const res = await fetch(REGISTER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'FernApp/1.0 (myaifern.com)' },
            body: JSON.stringify({ token: user.token, expoToken, platform: Platform.OS }),
        });
        if (!res.ok) return 'server-error';
        await AsyncStorage.setItem(SENT_KEY, mark).catch(() => {});
        return 'registered';
    } catch (e) {
        // An older build without the push entitlement throws here; that is expected and harmless.
        console.log('[push] registration skipped:', e?.message || e);
        return 'failed';
    }
}
