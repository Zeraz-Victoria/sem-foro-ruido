/**
 * AudioFeedback: Generador de efectos de sonido usando Web Audio API
 * No requiere archivos externos de audio y funciona 100% offline.
 */
class AudioFeedback {
  constructor() {
    this.audioCtx = null;
    this.enabled = true;
  }

  init() {
    if (window.noiseApp && window.noiseApp.audioContext && window.noiseApp.audioContext.state !== 'closed') {
      this.audioCtx = window.noiseApp.audioContext;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return;
    }
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  toggleSound(forceState) {
    if (typeof forceState === 'boolean') {
      this.enabled = forceState;
    } else {
      this.enabled = !this.enabled;
    }
    return this.enabled;
  }

  // Tono de advertencia suave al superar el umbral de ruido
  playAlertChime() {
    if (!this.enabled) return;
    try {
      this.init();
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      // Sonido de doble tono armónico (tipo campana de aviso escolar suave)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      // Frecuencias: Nota La (880Hz) y Mi (1320Hz)
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(440, now + 0.4);

      osc2.frequency.setValueAtTime(1320, now);
      osc2.frequency.exponentialRampToValueAtTime(660, now + 0.4);

      // Envolvente de volumen (ataque rápido, decaimiento suave)
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.2, now + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.5);
      osc2.stop(now + 0.5);
    } catch (e) {
      console.warn("No se pudo reproducir el sonido de aviso:", e);
    }
  }

  // Tono de buzzer grave para faltas de palabras altisonantes
  playProfanityBuzzer() {
    if (!this.enabled) return;
    try {
      this.init();
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      // Dos pulsos de buzzer grave estilo advertencia
      const playPulse = (startTime) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, startTime);
        osc.frequency.linearRampToValueAtTime(100, startTime + 0.15);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.18);
      };

      playPulse(now);
      playPulse(now + 0.22);
    } catch (e) {
      console.warn("No se pudo reproducir buzzer:", e);
    }
  }

  // Sonido de clic / interacción suave
  playClickTone() {
    if (!this.enabled) return;
    try {
      this.init();
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {
      // Ignorar fallos de audio menores
    }
  }
}

window.audioFeedback = new AudioFeedback();
