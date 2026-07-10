// V10 sound kit: exactly three mechanical sounds (message received, payment
// success, handover confirm), ring-switch-respecting. All three are
// self-authored (CC0/public domain) synthesized tones — the PAID stamp
// thunk, the both-ticks confirm, and the message tick.
import { createAudioPlayer } from "expo-audio";

const AUDIO_SOURCES: { paymentSuccess?: number; messageReceived?: number; handoverConfirm?: number } =
  {
    paymentSuccess: require("../assets/sounds/payment-success.wav"),
    messageReceived: require("../assets/sounds/message-received.wav"),
    handoverConfirm: require("../assets/sounds/handover-confirm.wav"),
  };

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
