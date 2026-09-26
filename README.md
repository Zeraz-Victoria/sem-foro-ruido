# 🚦 Detector de Ruido Escolar con Doble Canal y Filtro de Groserías

Aplicación web diseñada específicamente para docentes y aulas de clase. Permite medir el nivel de ruido ambiental del salón en tiempo real mediante un semáforo monumental y detectar de manera independiente palabras altisonantes (groserías) con conteo automático de infracciones y tolerancia a la voz del maestro.

---

## 🚀 Inicio Rápido en Mac

1. Haz doble clic sobre el archivo ejecutable:
   ```bash
   Iniciar_Detector_Ruido.command
   ```
2. Se abrirá automáticamente tu navegador en:
   ```
   http://localhost:4321/
   ```
3. Otorga permiso de micrófono cuando el navegador lo solicite.

---

## 📱 Conexión desde otra Computadora, iPad o Celular (Misma Red Wi-Fi)

Para abrir el detector en otra pantalla, proyector o tablet en el salón:
1. Asegúrate de que el otro dispositivo esté en la misma red Wi-Fi.
2. Abre el navegador e ingresa la dirección segura:
   ```
   https://192.168.110.32:4322/
   ```
3. El navegador mostrará un aviso de certificado local ("La conexión no es privada"):
   - Haz clic en **"Configuración avanzada"** o **"Detalles"**.
   - Haz clic en **"Continuar a 192.168.110.32 (no seguro)"**.
4. ¡Listo! El navegador permitirá habilitar el micrófono sin restricciones.

---

## 🧠 ¿Por qué el oído humano a veces escucha groserías que el micrófono no registra?

1. **El efecto "Cocktail Party" del oído humano**:
   El cerebro humano tiene dos oídos (audición binaural) y un potente filtro espacial que le permite concentrarse en un murmullo lejano de un alumno al final del aula, ignorando el eco y las reflexiones de las paredes.
2. **Censura automática de Google Chrome**:
   Cuando un alumno pronuncia una grosería, el motor de reconocimiento de voz de Google a menudo la transcribe con asteriscos (`p***`, `m****`, `****`). Nuestro sistema ahora incluye un detector específico de máscaras de censura que reconoce de inmediato estos asteriscos como infracción.
3. **Alternativas fonéticas (Pronunciación rápida o distante)**:
   Al estar lejos del micrófono, Google a menudo coloca la grosería como una interpretación secundaria (alternativa fonética). El sistema ahora examina hasta 5 alternativas simultáneas por cada frase dicha.
4. **Filtros de cancelación de ruido del sistema operativo**:
   Las computadoras portátiles tienen algoritmos de "Voice Isolation" diseñados para reuniones que silencian sonidos que no vienen justo enfrente de la pantalla. Para compensar esto:
   - Activa el modo **"👂 Susurros (Alta)"** en el Canal 2 (Groserías).
   - Usa la **Amplificación de Entrada** en **7x Super** o **12x Ultra** en salones grandes.
   - En aulas muy grandes, colocar un micrófono USB o manos libres apuntando hacia las bancas mejora drásticamente la captación.

---

## 🎛️ Características Principales

- **Semáforo Monumental**: Luces gigantes de 175px visibles desde cualquier rincón del salón.
- **Canal 1: Bullicio y Nivel de Ruido**:
  - Filtro dinámico de clase:
    - 👨‍🏫 **Explicación (2.0s)**: Tolera que el docente hable o los alumnos participen; solo pasa a rojo si hay 2 segundos continuos de bullicio.
    - 👥 **Grupos (2.8s)**: Permite trabajo en equipo y murmullos entre bancas.
    - 🤫 **Examen (0.8s)**: Silencio estricto.
  - Amplificación de ganancia software (1x, 4x, 7x, 12x) para micrófonos lejanos.
- **Canal 2: Detección de Palabras Altisonantes**:
  - Diccionario escolar mexicano y latinoamericano con más de 70 términos frecuentes.
  - Editor interactivo para agregar o quitar palabras personalizadas.
  - Detección de máscaras de asteriscos emitidas por Google Chrome.
  - Sensibilidad regulable independiente (Susurros, Voz Normal, Voz Alta).
- **Contador de Infracciones (+1)**:
  - Registro sincronizado en la parte superior e inferior.
  - Botón de Pausa / Continuar y Reinicio a 0.
- **Modo Solo Semáforo**:
  - Botón para ocultar todos los controles inferiores y dejar únicamente el semáforo limpio en proyectores o pantallas públicas.
