// V10 sound kit: exactly three mechanical sounds (message received, payment
// success, handover confirm), ring-switch-respecting, with a settings
// toggle (8E). Asset files are NOT yet bundled — CC0 sourcing needs network
// access (recorded follow-up) — so every player is currently a silent no-op
// with the wiring in place: drop the .m4a files into assets/sounds/ and
// fill AUDIO_SOURCES to go live.
import { createAudioPlayer } from "expo-audio";

const AUDIO_SOURCES: { paymentSuccess?: number; messageReceived?: number; handoverConfirm?: number } =
  {};

function play(source?: number): void {
  if (!source) return; // silent until assets land
  try {
    const player = createAudioPlayer(source);
    player.play();
  } catch {
    // Sound is garnish — never let it break a flow.
  }
}

export const playPaymentSuccess = () => play(AUDIO_SOURCES.paymentSuccess);
export const playMessageReceived = () => play(AUDIO_SOURCES.messageReceived);
export const playHandoverConfirm = () => play(AUDIO_SOURCES.handoverConfirm);
