// useContinuousMic's TTS playback lives inside HomeScreen's hook instance, but
// paywall/upgrade popups (UpgradeGateModal) are rendered from many independent
// feature modals with no access to that instance. This tiny bus lets the mic
// hook register its stop function once, so any UI that needs to cut off a
// Fern voice reply (e.g. an upgrade gate appearing mid-playback) can do so
// without prop-drilling the hook through every gated modal.
let stopFn = null;

export function registerFernAudioStop(fn) {
  stopFn = fn;
}

export function stopFernAudio() {
  stopFn?.();
}
