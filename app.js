/**
 * Semáforo de Ruido Escolar - Lógica Principal
 * Control de captura de micrófono, análisis en tiempo real,
 * animación de semáforo y gestión de infracciones (+1).
 */

class NoiseMonitorApp {
  constructor() {
    // Configuración y Umbrales
    this.threshold = 35; // Nivel de corte inicial mucho más sensible (5 - 95%)
    this.micGainMultiplier = 4.0; // Multiplicador de amplificación de micrófono
    this.violationCount = 0;
    this.isListening = false;
    this.isPaused = false;
    
    // Filtro Inteligente de Bullicio Sostenido (Anti-Voz del Maestro)
    this.chatterDurationRequired = 2000; // Requiere 2.0s continuos de bullicio para rojo
    this.chatterAccumulatedTime = 0;
    this.lastLoopTime = performance.now();
    
    // Cooldown para evitar que un solo grito sume 50 puntos seguidos
    this.cooldownDurationMs = 2000;
    this.lastViolationTime = 0;
    this.cooldownInterval = null;

    // Web Audio API
    this.audioContext = null;
    this.analyser = null;
    this.mediaStream = null;
    this.dataArray = null;
    this.animationFrameId = null;

    // Suavizado visual del nivel de volumen
    this.currentSmoothVolume = 0;

    // Elementos DOM
    this.dom = {
      lightRed: document.getElementById('light-red'),
      lightYellow: document.getElementById('light-yellow'),
      lightGreen: document.getElementById('light-green'),
      vuBar: document.getElementById('vu-bar'),
      vuPercentage: document.getElementById('vu-percentage'),
      thresholdMarker: document.getElementById('threshold-marker'),
      chatterBar: document.getElementById('chatter-bar'),
      chatterStatus: document.getElementById('chatter-status'),
      classroomModeBadge: document.getElementById('classroom-mode-badge'),
      btnModes: document.querySelectorAll('.btn-mode'),
      trafficTopCount: document.getElementById('traffic-top-count'),
      controlSection: document.querySelector('.control-section'),
      btnToggleControls: document.getElementById('btn-toggle-controls'),
      violationCount: document.getElementById('violation-count'),
      floatingContainer: document.getElementById('floating-plus-container'),
      cooldownWrapper: document.getElementById('cooldown-wrapper'),
      cooldownProgress: document.getElementById('cooldown-progress'),
      cooldownTimer: document.getElementById('cooldown-timer'),
      statusBadge: document.getElementById('status-badge'),
      statusText: document.getElementById('status-text'),
      liveIndicator: document.getElementById('live-indicator'),
      sensitivitySlider: document.getElementById('sensitivity-slider'),
      sensitivityValue: document.getElementById('sensitivity-value'),
      gainBadge: document.getElementById('gain-badge'),
      gainButtons: document.querySelectorAll('.btn-gain'),
      btnStart: document.getElementById('btn-start'),
      btnPause: document.getElementById('btn-pause'),
      btnReset: document.getElementById('btn-reset'),
      btnFullscreen: document.getElementById('btn-fullscreen'),
      btnSoundToggle: document.getElementById('btn-sound-toggle'),
      btnClearLog: document.getElementById('btn-clear-log'),
      eventsLog: document.getElementById('events-log'),
      micModal: document.getElementById('mic-modal'),
      btnAllowMic: document.getElementById('btn-allow-mic'),
      btnDemoMode: document.getElementById('btn-demo-mode'),
      
      // Elementos de Detección de Groserías
      toggleProfanity: document.getElementById('toggle-profanity'),
      voiceIndicatorDot: document.getElementById('voice-indicator-dot'),
      voiceLevelBadge: document.getElementById('voice-level-badge'),
      btnVoiceLevels: document.querySelectorAll('.btn-voice-level'),
      btnOpenWordlist: document.getElementById('btn-open-wordlist'),
      badWordsCount: document.getElementById('bad-words-count'),
      btnTestProfanity: document.getElementById('btn-test-profanity'),
      wordlistModal: document.getElementById('wordlist-modal'),
      btnCloseWordlist: document.getElementById('btn-close-wordlist'),
      btnSaveWordsClose: document.getElementById('btn-save-words-close'),
      wordsTagsContainer: document.getElementById('words-tags-container'),
      inputNewWord: document.getElementById('input-new-word'),
      btnAddWord: document.getElementById('btn-add-word'),
      btnResetWords: document.getElementById('btn-reset-words')
    };

    this.isDemoActive = false;
    this.demoInterval = null;
    this.profanityHoldTimeout = null;

    // Inicializar detector de voz
    this.speechDetector = new SpeechDetector((data) => this.handleProfanityDetected(data));

    this.initEventListeners();
    this.initWordlistUI();
    this.initVoiceSensitivityUI();
    this.updateThresholdUI(this.threshold);
  }

  // ========================================================
  // INICIALIZACIÓN Y EVENTOS
  // ========================================================
  initEventListeners() {
    this.dom.btnStart.addEventListener('click', () => this.startMonitoring());
    this.dom.btnPause.addEventListener('click', () => this.togglePause());
    this.dom.btnReset.addEventListener('click', () => this.resetCounter());
    this.dom.btnAllowMic.addEventListener('click', () => {
      this.dom.micModal.classList.add('hidden');
      this.startMonitoring();
    });

    // Control Deslizante de Sensibilidad
    this.dom.sensitivitySlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.setThreshold(val);
    });

    // Selector de Dinámica de Clase (Filtro de Voz del Maestro)
    if (this.dom.btnModes) {
      this.dom.btnModes.forEach(btn => {
        btn.addEventListener('click', () => {
          window.audioFeedback.playClickTone();
          this.dom.btnModes.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const time = parseInt(btn.dataset.time, 10);
          this.chatterDurationRequired = time;
          if (this.dom.classroomModeBadge) {
            const label = btn.textContent.trim().split(' ')[1] || 'Activo';
            this.dom.classroomModeBadge.textContent = `${btn.textContent.trim().split(' ')[0]} ${label}`;
          }
        });
      });
    }

    // Botones de Amplificación de Micrófono
    if (this.dom.gainButtons) {
      this.dom.gainButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          window.audioFeedback.playClickTone();
          this.dom.gainButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const gainVal = parseFloat(btn.dataset.gain);
          this.micGainMultiplier = gainVal;
          if (this.dom.gainBadge) {
            this.dom.gainBadge.textContent = `${gainVal}x (${btn.textContent.split(' ')[1] || 'Activa'})`;
          }
        });
      });
    }

    // Pantalla Completa
    this.dom.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());

    // Ocultar / Mostrar Controles Inferiores (Modo Solo Semáforo)
    this.isControlsHidden = false;
    if (this.dom.btnToggleControls && this.dom.controlSection) {
      this.dom.btnToggleControls.addEventListener('click', () => {
        window.audioFeedback.playClickTone();
        this.isControlsHidden = !this.isControlsHidden;
        this.dom.controlSection.classList.toggle('hidden-controls', this.isControlsHidden);
        this.dom.btnToggleControls.classList.toggle('active', this.isControlsHidden);
        this.dom.btnToggleControls.title = this.isControlsHidden ? 'Mostrar Controles' : 'Ocultar Controles (Solo Semáforo)';
      });
    }

    // Sonido
    this.dom.btnSoundToggle.addEventListener('click', () => {
      const isSoundOn = window.audioFeedback.toggleSound();
      this.dom.btnSoundToggle.classList.toggle('active', isSoundOn);
      this.dom.btnSoundToggle.title = isSoundOn ? 'Sonido de alerta activado' : 'Sonido de alerta silenciado';
    });

    // Limpiar Historial
    this.dom.btnClearLog.addEventListener('click', () => this.clearLog());

    // Modo Demo / Prueba Rápida
    if (this.dom.btnDemoMode) {
      this.dom.btnDemoMode.addEventListener('click', () => this.toggleDemoMode());
    }

    // Toggle de Detección de Groserías
    if (this.dom.toggleProfanity) {
      this.dom.toggleProfanity.addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        this.speechDetector.setEnabled(isEnabled);
        this.dom.voiceIndicatorDot.className = `voice-icon-indicator ${isEnabled ? 'active' : 'disabled'}`;
      });
    }

    // Selector de Sensibilidad de Voz (Susurros, Normal, Fuerte)
    if (this.dom.btnVoiceLevels) {
      this.dom.btnVoiceLevels.forEach(btn => {
        btn.addEventListener('click', () => {
          window.audioFeedback.playClickTone();
          this.dom.btnVoiceLevels.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const level = btn.dataset.level;
          this.speechDetector.setVoiceSensitivity(level);
          this.updateVoiceSensitivityBadge(level);
        });
      });
    }

    // Modal de Vocabulario
    if (this.dom.btnOpenWordlist) {
      this.dom.btnOpenWordlist.addEventListener('click', () => {
        window.audioFeedback.playClickTone();
        this.renderWordTags();
        this.dom.wordlistModal.classList.remove('hidden');
      });
    }

    const closeWordlistModal = () => {
      window.audioFeedback.playClickTone();
      this.dom.wordlistModal.classList.add('hidden');
    };

    if (this.dom.btnCloseWordlist) {
      this.dom.btnCloseWordlist.addEventListener('click', closeWordlistModal);
    }
    if (this.dom.btnSaveWordsClose) {
      this.dom.btnSaveWordsClose.addEventListener('click', closeWordlistModal);
    }

    // Agregar nueva palabra prohibida
    const handleAddWord = () => {
      const val = this.dom.inputNewWord.value.trim();
      if (val) {
        if (this.speechDetector.addWord(val)) {
          this.dom.inputNewWord.value = '';
          this.renderWordTags();
        }
      }
    };

    if (this.dom.btnAddWord) {
      this.dom.btnAddWord.addEventListener('click', handleAddWord);
    }
    if (this.dom.inputNewWord) {
      this.dom.inputNewWord.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAddWord();
      });
    }

    // Restablecer palabras por defecto
    if (this.dom.btnResetWords) {
      this.dom.btnResetWords.addEventListener('click', () => {
        this.speechDetector.resetToDefaultWords();
        this.renderWordTags();
      });
    }

    // Botón de prueba rápida de grosería
    if (this.dom.btnTestProfanity) {
      this.dom.btnTestProfanity.addEventListener('click', () => {
        const sampleWords = ['pendejo', 'carajo', 'mierda', 'estupido'];
        const randomWord = sampleWords[Math.floor(Math.random() * sampleWords.length)];
        this.handleProfanityDetected({
          detectedWord: randomWord,
          censoredWord: this.speechDetector.censorWord(randomWord),
          fullPhrase: `Prueba de aula: '${randomWord}'`
        });
      });
    }
  }

  initWordlistUI() {
    this.updateWordsCount();
    if (this.speechDetector.isEnabled) {
      this.dom.voiceIndicatorDot.className = 'voice-icon-indicator active';
    }
  }

  initVoiceSensitivityUI() {
    const currentLevel = this.speechDetector.voiceSensitivity;
    if (this.dom.btnVoiceLevels) {
      this.dom.btnVoiceLevels.forEach(b => {
        b.classList.toggle('active', b.dataset.level === currentLevel);
      });
    }
    this.updateVoiceSensitivityBadge(currentLevel);
  }

  updateVoiceSensitivityBadge(level) {
    if (!this.dom.voiceLevelBadge) return;
    const labels = {
      high: '👂 Susurros',
      medium: '🗣️ Normal',
      loud: '📢 Voz Alta'
    };
    this.dom.voiceLevelBadge.textContent = labels[level] || 'Normal';
  }

  updateWordsCount() {
    if (this.dom.badWordsCount) {
      this.dom.badWordsCount.textContent = this.speechDetector.badWords.length;
    }
  }

  renderWordTags() {
    if (!this.dom.wordsTagsContainer) return;
    this.dom.wordsTagsContainer.innerHTML = '';
    
    this.speechDetector.badWords.forEach(word => {
      const tag = document.createElement('span');
      tag.className = 'word-tag';
      tag.innerHTML = `
        <span>${word}</span>
        <button class="word-tag-remove" title="Eliminar ${word}">✕</button>
      `;

      tag.querySelector('.word-tag-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        this.speechDetector.removeWord(word);
        this.renderWordTags();
      });

      this.dom.wordsTagsContainer.appendChild(tag);
    });

    this.updateWordsCount();
  }

  // ========================================================
  // ACCIÓN AL DETECTAR PALABRA ALTISONANTE
  // ========================================================
  handleProfanityDetected(data) {
    // Si está en pausa o la detección fue apagada, ignorar
    if (this.isPaused || !this.speechDetector.isEnabled) return;

    this.violationCount += 1;
    this.updateViolationDisplay();
    this.dom.violationCount.classList.remove('bump');
    void this.dom.violationCount.offsetWidth;
    this.dom.violationCount.classList.add('bump');

    // Efecto de sonido buzzer distintivo
    window.audioFeedback.playProfanityBuzzer();

    // Efecto flotante +1
    this.spawnFloatingPlus();

    // Activar semáforo en ROJO durante 3 segundos
    this.setTrafficLightState('red');
    document.body.classList.add('alert-active');
    
    // Cambiar estado a alerta verbal
    const prevStatus = this.dom.statusText.textContent;
    this.dom.statusBadge.className = 'status-badge alert';
    this.dom.statusText.textContent = `¡Lenguaje inapropiado: "${data.censoredWord}"!`;

    // Registro especial en el log
    this.addProfanityLogEntry(data);

    // Cancelar cualquier timeout anterior
    if (this.profanityHoldTimeout) {
      clearTimeout(this.profanityHoldTimeout);
    }

    // Regresar al estado regular tras 3 segundos
    this.profanityHoldTimeout = setTimeout(() => {
      if (this.isListening && !this.isPaused) {
        this.dom.statusBadge.className = 'status-badge listening';
        this.dom.statusText.textContent = 'Monitoreando ruido del aula...';
        document.body.classList.remove('alert-active');
      }
    }, 3000);
  }

  addProfanityLogEntry(data) {
    const emptyNotice = this.dom.eventsLog.querySelector('.log-empty');
    if (emptyNotice) emptyNotice.remove();

    const timeStr = new Date().toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });

    const item = document.createElement('div');
    item.className = 'log-item profanity-alert';
    item.innerHTML = `
      <span class="log-time">${timeStr}</span>
      <span class="log-level">🚨 Lenguaje: "${data.censoredWord}" (+1)</span>
    `;

    this.dom.eventsLog.prepend(item);

    const items = this.dom.eventsLog.querySelectorAll('.log-item');
    if (items.length > 15) {
      items[items.length - 1].remove();
    }
  }

  toggleDemoMode() {
    this.isDemoActive = !this.isDemoActive;
    this.dom.btnDemoMode.classList.toggle('active', this.isDemoActive);

    if (this.isDemoActive) {
      // Detener audio real si estaba activo
      if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
      this.isListening = true;
      this.isPaused = false;
      this.updateStateUI('listening');
      this.dom.statusText.textContent = 'Modo Simulación (Generando ruido aleatorio)...';

      let simulatedVol = 20;
      let counter = 0;

      this.demoInterval = setInterval(() => {
        counter++;
        // Variación suave con picos cada 8-10 ticks
        if (counter % 9 === 0) {
          simulatedVol = Math.floor(Math.random() * 25) + 75; // Pico fuerte (75% - 100%)
        } else if (counter % 3 === 0) {
          simulatedVol = Math.floor(Math.random() * 25) + 40; // Nivel medio (40% - 65%)
        } else {
          simulatedVol = Math.floor(Math.random() * 20) + 15; // Silencio (15% - 35%)
        }

        this.updateVisuals(simulatedVol);
      }, 350);
    } else {
      if (this.demoInterval) {
        clearInterval(this.demoInterval);
        this.demoInterval = null;
      }
      this.togglePause();
    }
  }

  setThreshold(val) {
    this.threshold = val;
    this.updateThresholdUI(val);
  }

  updateThresholdUI(val) {
    this.dom.sensitivityValue.textContent = `${val}%`;
    this.dom.thresholdMarker.style.left = `${val}%`;
  }

  // ========================================================
  // CONTROL DEL MICRÓFONO Y AUDIO
  // ========================================================
  async startMonitoring() {
    window.audioFeedback.playClickTone();

    // Si ya estaba pausado, simplemente reanudar
    if (this.isPaused && this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      this.isPaused = false;
      this.isListening = true;
      this.updateStateUI('listening');
      this.speechDetector.start();
      this.loop();
      return;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("El navegador no soporta captura de audio.");
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true // Permite al sistema operativo amplificar micrófonos sordos o lejanos
        },
        video: false
      });

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.4; // Respuesta más rápida a picos de voz

      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      this.isListening = true;
      this.isPaused = false;
      this.updateStateUI('listening');
      this.speechDetector.start();
      this.loop();

    } catch (err) {
      console.warn("Fallo o denegación al acceder al micrófono:", err);
      // Mostrar modal para guiar al usuario
      this.dom.micModal.classList.remove('hidden');
    }
  }

  togglePause() {
    window.audioFeedback.playClickTone();

    if (!this.isListening) return;

    if (!this.isPaused) {
      // Pausar
      this.isPaused = true;
      this.speechDetector.stop();
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
      if (this.audioContext && this.audioContext.state === 'running') {
        this.audioContext.suspend();
      }
      this.updateStateUI('paused');
    } else {
      // Reanudar
      this.startMonitoring();
    }
  }

  resetCounter() {
    window.audioFeedback.playClickTone();
    this.violationCount = 0;
    this.updateViolationDisplay();
    this.dom.violationCount.classList.remove('bump');
  }

  updateViolationDisplay() {
    if (this.dom.violationCount) this.dom.violationCount.textContent = this.violationCount;
    if (this.dom.trafficTopCount) this.dom.trafficTopCount.textContent = this.violationCount;
  }

  // ========================================================
  // ========================================================
  // BUCLE DE ANÁLISIS EN TIEMPO REAL
  // ========================================================
  loop() {
    if (!this.isListening || this.isPaused) return;

    const currentTime = performance.now();
    const deltaTime = Math.min(100, Math.max(10, currentTime - this.lastLoopTime));
    this.lastLoopTime = currentTime;

    this.analyser.getByteTimeDomainData(this.dataArray);

    // Calcular RMS (Root Mean Square) del volumen
    let sum = 0;
    const len = this.dataArray.length;
    for (let i = 0; i < len; i++) {
      const normalized = (this.dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / len);

    // Aplicar amplificación de ganancia de software
    const amplifiedRms = rms * this.micGainMultiplier;

    // Curva de compresión no lineal para máxima sensibilidad:
    let rawVolume = 0;
    if (amplifiedRms > 0.0008) {
      rawVolume = Math.min(100, Math.round(Math.pow(amplifiedRms, 0.65) * 165));
    }

    // Suavizado dinámico: subida rápida para picos de ruido, bajada más suave
    if (rawVolume > this.currentSmoothVolume) {
      this.currentSmoothVolume = (this.currentSmoothVolume * 0.3) + (rawVolume * 0.7);
    } else {
      this.currentSmoothVolume = (this.currentSmoothVolume * 0.75) + (rawVolume * 0.25);
    }
    
    const displayVolume = Math.round(this.currentSmoothVolume);

    // Informar al detector de voz el nivel de volumen actual para el filtro del Canal 2
    if (this.speechDetector) {
      this.speechDetector.setCurrentMicVolume(displayVolume);
    }

    this.updateVisuals(displayVolume, deltaTime);

    this.animationFrameId = requestAnimationFrame(() => this.loop());
  }

  // ========================================================
  // ACTUALIZACIÓN VISUAL Y FILTRO DE BULLICIO INTELIGENTE
  // ========================================================
  updateVisuals(volume, deltaTime = 30) {
    // Actualizar barra y porcentaje VU
    this.dom.vuBar.style.width = `${volume}%`;
    this.dom.vuPercentage.textContent = `${volume}%`;

    const yellowLimit = this.threshold * 0.65;
    const now = Date.now();

    // FILTRO DE PERSISTENCIA TEMPORAL:
    // Si el volumen supera el umbral, acumulamos tiempo de bullicio.
    // Si el volumen baja (pausas de respiración del docente o silencio), se disipa rápidamente.
    if (volume >= this.threshold) {
      this.chatterAccumulatedTime += deltaTime;
    } else {
      // Disipación rápida (2.4x) ante pausas naturales de voz
      this.chatterAccumulatedTime = Math.max(0, this.chatterAccumulatedTime - (deltaTime * 2.4));
    }

    const chatterPercent = Math.min(100, (this.chatterAccumulatedTime / this.chatterDurationRequired) * 100);
    if (this.dom.chatterBar) {
      this.dom.chatterBar.style.width = `${chatterPercent}%`;
    }

    // Actualizar texto de estado de bullicio
    if (this.dom.chatterStatus) {
      if (chatterPercent >= 100) {
        this.dom.chatterStatus.textContent = '¡BULLICIO DETECTADO!';
        this.dom.chatterStatus.style.color = '#ef4444';
      } else if (chatterPercent > 35) {
        this.dom.chatterStatus.textContent = `Acumulando... (${(this.chatterAccumulatedTime / 1000).toFixed(1)}s)`;
        this.dom.chatterStatus.style.color = '#f59e0b';
      } else {
        this.dom.chatterStatus.textContent = 'Tranquilo';
        this.dom.chatterStatus.style.color = '#60a5fa';
      }
    }

    // DETERMINAR ESTADO DEL SEMÁFORO
    // Si hay una alerta de grosería activa en hold, no sobreescribir con ruido
    if (this.profanityHoldTimeout) return;

    if (this.chatterAccumulatedTime >= this.chatterDurationRequired) {
      // ESTADO ROJO: ¡Se confirmó bullicio continuo que superó la tolerancia!
      this.setTrafficLightState('red');
      document.body.classList.add('alert-active');
      this.dom.statusBadge.className = 'status-badge alert';
      this.dom.statusText.textContent = '¡Bullicio excesivo sostenido en el aula!';

      // Procesar registro de falta / punto si pasó el cooldown
      if (now - this.lastViolationTime > this.cooldownDurationMs) {
        this.registerViolation(volume);
      }
    } else if (volume >= this.threshold || volume >= yellowLimit || this.chatterAccumulatedTime > 250) {
      // ESTADO AMARILLO: Voz alta, advertencia previa o docente explicando
      this.setTrafficLightState('yellow');
      document.body.classList.remove('alert-active');
      if (this.isListening && !this.isPaused) {
        this.dom.statusBadge.className = 'status-badge';
        this.dom.statusText.textContent = (volume >= this.threshold) ? 'Voz detectada (verificando si es bullicio...)' : 'Nivel moderado de sonido';
      }
    } else {
      // ESTADO VERDE: Silencio o volumen óptimo
      this.setTrafficLightState('green');
      document.body.classList.remove('alert-active');
      if (this.isListening && !this.isPaused) {
        this.dom.statusBadge.className = 'status-badge listening';
        this.dom.statusText.textContent = 'Monitoreando ruido del aula...';
      }
    }
  }

  setTrafficLightState(state) {
    this.dom.lightRed.classList.toggle('active', state === 'red');
    this.dom.lightYellow.classList.toggle('active', state === 'yellow');
    this.dom.lightGreen.classList.toggle('active', state === 'green');
  }

  // ========================================================
  // REGISTRO DE INFRACCIÓN (+1 PUNTO)
  // ========================================================
  registerViolation(volume) {
    this.lastViolationTime = Date.now();
    this.violationCount += 1;

    // Actualizar ambos contadores
    this.updateViolationDisplay();
    this.dom.violationCount.classList.remove('bump');
    void this.dom.violationCount.offsetWidth; // Reiniciar animación CSS
    this.dom.violationCount.classList.add('bump');

    // Reproducir sonido de alerta
    window.audioFeedback.playAlertChime();

    // Crear efecto flotante de +1
    this.spawnFloatingPlus();

    // Agregar al log
    this.addLogEntry(volume);

    // Iniciar barra de tiempo de enfriamiento (cooldown)
    this.startCooldownTimer();
  }

  spawnFloatingPlus() {
    const el = document.createElement('div');
    el.className = 'floating-plus';
    el.textContent = '+1';
    this.dom.floatingContainer.appendChild(el);

    setTimeout(() => {
      el.remove();
    }, 1200);
  }

  startCooldownTimer() {
    if (this.cooldownInterval) {
      clearInterval(this.cooldownInterval);
    }

    const startTime = Date.now();
    const duration = this.cooldownDurationMs;

    this.cooldownInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      const progressPercent = (remaining / duration) * 100;

      this.dom.cooldownProgress.style.width = `${progressPercent}%`;
      this.dom.cooldownTimer.textContent = `${(remaining / 1000).toFixed(1)}s`;

      if (remaining <= 0) {
        clearInterval(this.cooldownInterval);
        this.cooldownInterval = null;
        this.dom.cooldownProgress.style.width = '0%';
        this.dom.cooldownTimer.textContent = '0.0s';
      }
    }, 50);
  }

  addLogEntry(volume) {
    // Si existe el aviso de "vacío", quitarlo
    const emptyNotice = this.dom.eventsLog.querySelector('.log-empty');
    if (emptyNotice) {
      emptyNotice.remove();
    }

    const timeStr = new Date().toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });

    const item = document.createElement('div');
    item.className = 'log-item';
    item.innerHTML = `
      <span class="log-time">${timeStr}</span>
      <span class="log-level">Nivel Pico: ${volume}% (Umbral: ${this.threshold}%)</span>
    `;

    this.dom.eventsLog.prepend(item);

    // Limitar el historial a las últimas 15 alertas
    const items = this.dom.eventsLog.querySelectorAll('.log-item');
    if (items.length > 15) {
      items[items.length - 1].remove();
    }
  }

  clearLog() {
    window.audioFeedback.playClickTone();
    this.dom.eventsLog.innerHTML = '<div class="log-empty">No hay alertas registradas aún. El aula está en calma.</div>';
  }

  // ========================================================
  // ESTADOS DE LA INTERFAZ
  // ========================================================
  updateStateUI(state) {
    if (state === 'listening') {
      this.dom.statusBadge.className = 'status-badge listening';
      this.dom.statusText.textContent = 'Monitoreando ruido del aula...';
      this.dom.liveIndicator.className = 'live-pill active';
      this.dom.liveIndicator.textContent = 'EN VIVO';
      this.dom.btnStart.disabled = true;
      this.dom.btnPause.disabled = false;
      this.dom.btnPause.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16"/>
          <rect x="14" y="4" width="4" height="16"/>
        </svg>
        <span>Pausar</span>
      `;
    } else if (state === 'paused') {
      this.dom.statusBadge.className = 'status-badge paused';
      this.dom.statusText.textContent = 'Monitoreo pausado';
      this.dom.liveIndicator.className = 'live-pill';
      this.dom.liveIndicator.textContent = 'PAUSADO';
      this.dom.btnStart.disabled = false;
      this.dom.btnPause.disabled = false;
      this.dom.btnPause.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <span>Reanudar</span>
      `;
      this.setTrafficLightState('green');
      document.body.classList.remove('alert-active');
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn("Pantalla completa no disponible:", err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.noiseApp = new NoiseMonitorApp();
});
