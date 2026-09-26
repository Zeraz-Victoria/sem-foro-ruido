/**
 * SpeechDetector: Módulo de reconocimiento de voz y detección de groserías
 * Utiliza Web Speech API nativa (SpeechRecognition / webkitSpeechRecognition)
 */
class SpeechDetector {
  constructor(onProfanityDetectedCallback) {
    this.onProfanityDetected = onProfanityDetectedCallback;
    this.recognition = null;
    this.isListening = false;
    this.isEnabled = true; // El docente puede apagar o prender esta función
    this.restartTimeout = null;

    // Diccionario base exhaustivo de palabras altisonantes, groserías y modismos escolares
    this.defaultWords = [
      // Alta frecuencia en México y Latinoamérica
      'pinche', 'pinches', 'pinchesito', 'pinchurriento',
      'pendejo', 'pendeja', 'pendejos', 'pendejas', 'pendejada', 'pendejadas', 'pendejito', 'pendejita',
      'cabron', 'cabrona', 'cabrones', 'cabronas', 'cabronada', 'cabroncito',
      'mierda', 'mierdas', 'mierdita', 'mierdero', 'mierdoso',
      'puto', 'puta', 'putos', 'putas', 'putiza', 'putamadre', 'hijo de puta', 'hija de puta', 'joputa', 'putazo', 'putazos', 'putero', 'putear',
      'verga', 'vergas', 'vergazo', 'vergazos', 'a la verga', 'alv', 'vrga', 'vrg',
      'chingada', 'chingar', 'chinga', 'chingados', 'chingon', 'chingona', 'chingadera', 'chingaderas', 'chingado', 'chingados', 'chinga tu madre', 'chingue', 'chingues', 'chingale',
      'culero', 'culera', 'culeros', 'culeras', 'culo', 'culos', 'culon', 'culona', 'culazo', 'culiao', 'culiado',
      'wey', 'güey', 'guey', 'buey',
      'no mames', 'nomames', 'mames', 'mamadas', 'mamada', 'mamon', 'mamona', 'mamones',
      'huevon', 'huevona', 'huevones', 'huevos', 'huevonada', 'hueva',
      'desmadre', 'desmadres', 'desmadroso', 'madrazo', 'madrazos', 'madriza', 'romper la madre', 'partir la madre',
      'estupido', 'estupida', 'estupidos', 'estupidas',
      'idiota', 'idiotas', 'imbecil', 'imbeciles', 'tarado', 'tarada', 'tarados', 'taradas',
      'baboso', 'babosa', 'babosos', 'menso', 'mensa', 'retrasado', 'retrasada',
      'pito', 'maldita sea', 'maldito', 'maldita', 'carajo', 'joder', 'coño', 'marica', 'maricon', 'zorra', 'perra',
      'hdp', 'hijo de perra', 'chucha', 'pelotudo', 'boludo', 'concha de tu madre', 'ctm'
    ];

    this.badWords = this.loadCustomWords();
    this.voiceSensitivity = this.loadVoiceSensitivity(); // 'high', 'medium', 'loud'
    this.currentMicVolume = 0; // Se actualiza en tiempo real desde app.js
    this.lastProfanityAlertTime = 0; // Evita duplicados en resultados provisionales (interim)
    this.initRecognition();
  }

  loadVoiceSensitivity() {
    try {
      const saved = localStorage.getItem('school_voice_sensitivity');
      if (saved && ['high', 'medium', 'loud'].includes(saved)) {
        return saved;
      }
    } catch (e) {}
    return 'high'; // Por defecto 'high' para capturar cualquier volumen perceptible
  }

  setVoiceSensitivity(level) {
    if (['high', 'medium', 'loud'].includes(level)) {
      this.voiceSensitivity = level;
      try {
        localStorage.setItem('school_voice_sensitivity', level);
      } catch (e) {}
    }
  }

  // Define el volumen mínimo necesario según el nivel seleccionado
  getRequiredVolumeThreshold() {
    switch (this.voiceSensitivity) {
      case 'high': // Susurros y murmullos (cualquier volumen)
        return 0;
      case 'medium': // Voz habitual
        return 0;
      case 'loud': // Solo si fue con voz proyectada fuerte o grito
        return 20;
      default:
        return 0;
    }
  }

  setCurrentMicVolume(vol) {
    this.currentMicVolume = vol;
  }

  // Carga lista personalizada guardada en localStorage combinada con defaultWords
  loadCustomWords() {
    try {
      const saved = localStorage.getItem('school_bad_words');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Fusionar lista guardada con diccionario base ampliado
        const combined = Array.from(new Set([...this.defaultWords, ...parsed]));
        return combined;
      }
    } catch (e) {
      console.warn("No se pudo leer localStorage:", e);
    }
    return [...this.defaultWords];
  }

  saveCustomWords() {
    try {
      localStorage.setItem('school_bad_words', JSON.stringify(this.badWords));
    } catch (e) {
      console.warn("No se pudo guardar en localStorage:", e);
    }
  }

  addWord(word) {
    const clean = this.normalizeText(word).trim();
    if (clean && !this.badWords.includes(clean)) {
      this.badWords.push(clean);
      this.saveCustomWords();
      return true;
    }
    return false;
  }

  removeWord(word) {
    const clean = this.normalizeText(word).trim();
    const index = this.badWords.indexOf(clean);
    if (index !== -1) {
      this.badWords.splice(index, 1);
      this.saveCustomWords();
      return true;
    }
    return false;
  }

  resetToDefaultWords() {
    this.badWords = [...this.defaultWords];
    this.saveCustomWords();
    return this.badWords;
  }

  // Quitar acentos, diacríticos y caracteres especiales
  normalizeText(str) {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remueve tildes
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"¡¿]/g, ""); // Remueve signos
  }

  // Censura una palabra para proyectores (ej. "p*****o")
  censorWord(word) {
    if (!word || word.length <= 2) return '**';
    return word[0] + '*'.repeat(Math.max(2, word.length - 2)) + word[word.length - 1];
  }

  initRecognition() {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.warn("Web Speech API no está soportada en este navegador.");
      return;
    }

    this.recognition = new SpeechRecognitionClass();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'es-MX'; // Idioma español México
    this.recognition.maxAlternatives = 5; // Evaluar hasta 5 interpretaciones fonéticas de Google

    this.recognition.onresult = (event) => {
      if (!this.isEnabled) return;

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        // Inspeccionar todas las alternativas que Google Cloud reconoció
        for (let alt = 0; alt < result.length; ++alt) {
          const transcript = result[alt].transcript;
          const detected = this.analyzeTranscript(transcript);
          if (detected) {
            break; // Si ya se detectó en esta alternativa, continuar al siguiente resultado
          }
        }
      }
    };

    // Reinicio automático continuo si se detiene por silencio
    this.recognition.onend = () => {
      if (this.isListening && this.isEnabled) {
        clearTimeout(this.restartTimeout);
        this.restartTimeout = setTimeout(() => {
          if (this.isListening && this.isEnabled) {
            try {
              this.recognition.start();
            } catch (e) {
              // Si aún estaba cerrando, reintentar en 250ms
              this.restartTimeout = setTimeout(() => {
                if (this.isListening && this.isEnabled) {
                  try { this.recognition.start(); } catch (err) {}
                }
              }, 250);
            }
          }
        }, 120);
      }
    };

    this.recognition.onerror = (event) => {
      // Ignorar errores benignos como 'no-speech'
      if (event.error !== 'no-speech') {
        console.warn("Evento de voz:", event.error);
      }
    };
  }

  start() {
    this.isListening = true;
    if (this.recognition && this.isEnabled) {
      try {
        this.recognition.start();
      } catch (e) {
        // En caso de que ya estuviese corriendo
      }
    }
  }

  stop() {
    this.isListening = false;
    clearTimeout(this.restartTimeout);
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
  }

  setEnabled(val) {
    this.isEnabled = val;
    if (this.isEnabled && this.isListening) {
      this.start();
    } else if (!this.isEnabled) {
      this.stop();
    }
  }

  // Análisis de texto con coincidencia de palabras completas, censura de asteriscos y filtro de volumen
  analyzeTranscript(rawText) {
    if (!this.isEnabled || !rawText) return false;

    const now = Date.now();
    // Evitar ráfagas repetidas en resultados provisionales (cooldown de 1.0 segundos)
    if (now - this.lastProfanityAlertTime < 1000) {
      return false;
    }

    // Verificar si el nivel de sonido del micrófono cumple con la sensibilidad verbal requerida
    const minRequiredVolume = this.getRequiredVolumeThreshold();
    if (this.currentMicVolume < minRequiredVolume) {
      return false;
    }

    // DETECCIÓN CASO 1: Asteriscos de censura automática del navegador (Google Chrome filtra groserías con *)
    // Ejemplos: "eres un p****", "vete a la m****", "****", "c***", "ch***"
    // Cualquier presencia de asterisco emitida por el motor de voz es censura de grosería
    if (rawText.includes('*')) {
      this.lastProfanityAlertTime = now;
      if (typeof this.onProfanityDetected === 'function') {
        this.onProfanityDetected({
          detectedWord: 'Palabra censurada por navegador',
          censoredWord: 'p*** (grosería)',
          fullPhrase: rawText,
          capturedVolume: this.currentMicVolume,
          sensitivityLevel: this.voiceSensitivity
        });
      }
      return true;
    }

    // DETECCIÓN CASO 2: Comparación con diccionario de términos
    const cleanText = this.normalizeText(rawText);
    const tokenWords = cleanText.split(/\s+/).filter(Boolean);

    for (const badWord of this.badWords) {
      const normalizedBad = this.normalizeText(badWord);
      
      const isMultiWord = normalizedBad.includes(' ');
      let matched = false;

      if (isMultiWord) {
        matched = cleanText.includes(normalizedBad);
      } else {
        matched = tokenWords.includes(normalizedBad) || 
                  (cleanText.includes(normalizedBad) && (
                    normalizedBad.length >= 5 || 
                    new RegExp(`\\b${normalizedBad}\\b`, 'i').test(cleanText)
                  ));
      }

      if (matched) {
        this.lastProfanityAlertTime = now;
        if (typeof this.onProfanityDetected === 'function') {
          this.onProfanityDetected({
            detectedWord: badWord,
            censoredWord: this.censorWord(badWord),
            fullPhrase: rawText,
            capturedVolume: this.currentMicVolume,
            sensitivityLevel: this.voiceSensitivity
          });
        }
        return true;
      }
    }

    return false;
  }
}

window.SpeechDetector = SpeechDetector;
