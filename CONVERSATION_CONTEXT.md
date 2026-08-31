# 📚 CONTEXTO COMPLETO DEL PROYECTO LIBREFREE REACT

> **Documento de Contexto y Registro Histórico de Desarrollo**  
> **Proyecto:** LibreFree React Native (Lector de Libros EPUB/PDF y Reproductor de Audiolibros)  
> **Fecha de Actualización:** 26 de Agosto de 2026  
> **Entorno:** Expo SDK v54 / React Native / SQLite / React Native WebView / Expo Speech

---

## 📄 1. RESUMEN EJECUTIVO

**LibreFree** es una aplicación móvil de lectura de libros electrónicos (EPUB, PDF, TXT) y audiolibros construida con Expo y React Native. Permite rastrear automáticamente el teléfono en busca de libros guardados, generar vistas previas de la primera página, leer en modos HD con personalización visual (Sepia, Noche, OLED), escuchar audiolibros con síntesis de voz en español (TTS) a través de una interfaz estilo Spotify, y alternar entre **Modo Claro** y **Modo Oscuro** en toda la app.

---

## 🛠️ 2. HISTORIAL COMPLETO DE REQUERIMIENTOS Y SOLUCIONES

### 🎨 A. Sistema Global de Modo Claro y Modo Oscuro
- **Requerimiento:** Permitir al usuario cambiar libremente entre Tema Claro y Tema Oscuro desde la pantalla de Ajustes.
- **Implementación:**
  - `src/context/ThemeContext.tsx`: Creado contexto global con las paletas `LightTheme` y `DarkTheme` de alto contraste y persistencia de preferencia mediante `@react-native-async-storage/async-storage`.
  - `src/app/_layout.tsx`: Envoltorio con `ThemeProvider` para abastecer a todas las pestañas y lectores.
  - Ajuste de visibilidad nítida en los encabezados superiores y tarjetas adaptables (`#0F172A` / `#F8FAFC`).

---

### 🔍 B. Escáner Automático de Almacenamiento Local (1 Solo Toque)
- **Requerimiento:** Que la app busque sola en todo el celular sin obligar al usuario a navegar carpetas manualmente, y presente los resultados en una cuadrícula idéntica a la pantalla principal con la vista previa de la primera página.
- **Implementación:**
  - `src/services/fileScanner.ts` (`autoScanDeviceDirectories`): Rastrega autónomamente carpetas del almacenamiento local (`/Download`, `/Documents`, `/Books`, almacenamiento de la app) filtrando archivos `.epub`, `.pdf`, `.txt` y `.mp3`.
  - `src/app/(tabs)/explorer.tsx`: Cuadrícula de 2 columnas de tarjetas de libros (Book Cards) con distintivo de formato, casillas de selección táctiles (`checkmarks`) e importación masiva en 1 toque.
  - Generación de vista previa de la **Página 1 real** mediante procesador en segundo plano con `PdfReaderHTML` / `EpubReaderHTML`.
  - Removidos íconos sobrantes y filas de formato no funcionales para una experiencia ultra minimalista.

---

### 🎧 C. Sección de Audiolibros y Sintetizador de Voz TTS (Estilo Spotify)
- **Requerimiento:** Poder escuchar cualquier libro en formato audiolibro con una interfaz de reproductor de música, cambiar la velocidad de lectura sin que se devuelva al principio del libro, y arrastrar el dedo en la línea de tiempo para saltar de página.
- **Implementación:**
  - `src/app/(tabs)/audiobooks.tsx`:
    - Interfaz con lista de libros, **Mini Reproductor Flotante en la parte inferior** al deslizar hacia abajo y **Modal a Pantalla Completa**.
    - **Línea de tiempo interactiva (`Seekbar Slider`)**: Permite arrastrar el dedo suavemente o tocar en cualquier punto de la barra de progreso para saltar instantáneamente de página o fragmento.
    - **Controlador de velocidad fluido (`0.75x`, `1.0x`, `1.25x`, `1.5x`, `2.0x`)**: Implementado seguro `isManualChange` en `ttsService.ts` para evitar condiciones de carrera con `Speech.stop()` en Android. Al tocar el botón de velocidad, la voz cambia de ritmo e **inmediatamente retoma la lectura desde el mismo texto y página exacta sin devolverse al principio**.

---

### 📖 D. Motor de Lectura EPUB & PDF Ultra-HD Retina
- **Requerimiento:** Que los archivos EPUB carguen completos (sin límite de 4 páginas) y funcionen igual de fluidos que los PDF, permitiendo zoom táctil y cambio de página horizontal.
- **Implementación:**
  - `src/reader/PdfReaderHTML.ts` & `src/reader/EpubReaderHTML.ts`:
    - Escalado Retina de Alta Definición (`devicePixelRatio 2.5x-3.0x`).
    - Carga de EPUB mediante `ArrayBuffer` en Base64 para eludir restricciones CORS de Android WebView.
    - `rendition.hooks.content.register` para capturar gestos de deslice horizontal de página e iframe.
    - `JSZip` nativo en `fileScanner.ts` (`extractEpubTextNative`) para extraer el 100% del texto de todos los capítulos XHTML sin símbolos basura ni límites de truncamiento.
    - Extracción e inserción de portadas JPEG Base64 generadas con HTML5 Canvas e integradas en la base de datos SQLite (`books` y `book_texts`).

---

## 📁 3. ARCHIVERO DE CÓDIGO Y ESTRUCTURA DEL PROYECTO

```
src/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Barra de pestañas (Estantería, Explorador, Audiolibros, Ajustes)
│   │   ├── index.tsx        # Pantalla Principal (Estantería "LibreFree")
│   │   ├── explorer.tsx     # Escáner Automático de Libros + Vistas Previas pág 1
│   │   ├── audiobooks.tsx   # Reproductor Estilo Spotify + Timeline Deslizable + TTS
│   │   └── settings.tsx     # Selector de Apariencia (Modo Claro / Modo Oscuro)
│   ├── reader/
│   │   └── [id].tsx         # Pantalla Lector de Libros (PDF, EPUB, TXT)
│   └── _layout.tsx          # Layout Raíz con ThemeProvider e Init SQLite
├── components/
│   ├── BookCard.tsx                 # Tarjeta de Libro adaptable al tema
│   ├── BackgroundCoverProcessor.tsx # Procesador de portadas en segundo plano
│   ├── ReaderControlsModal.tsx     # Ajustes visuales de lectura
│   └── TTSControlBar.tsx           # Barra de lectura por voz en el lector
├── context/
│   └── ThemeContext.tsx      # Contexto Global de Modo Claro / Modo Oscuro + AsyncStorage
├── reader/
│   ├── PdfReaderHTML.ts      # Motor PDF.js con Retina scaling
│   ├── EpubReaderHTML.ts     # Motor ePub.js con Canvas Cover Generator
│   └── TxtReaderHTML.ts      # Motor Lector TXT
├── services/
│   ├── database.ts           # SQLite (Tablas: books, book_texts)
│   ├── fileScanner.ts        # Rastreador automático + Extractor nativo JSZip
│   ├── ttsService.ts         # Motor de Voz expo-speech + Control de cambio de velocidad
│   └── audioService.ts       # Reproductor de archivos MP3/M4B
└── types/
    └── book.ts               # Tipos de datos TypeScript (Book, BookFormat, ScannedFile)
```

---

## 📌 4. INSTRUCCIONES PARA DESARROLLO FUTURO Y EAS BUILD

Actualmente la app corre en **Expo Go**. Si en el futuro deseas acelerar la generación de portadas PDF a velocidad nativa (~50ms como *eReader Prestigio*), se recomienda crear un **EAS Development Build**:

```bash
# 1. Instalar cliente de desarrollo de Expo
npx expo install expo-dev-client

# 2. Iniciar compilación del APK de desarrollo para Android
npx eas build --profile development --platform android
```

---

*Este archivo contiene el 100% del contexto del proyecto y servirá de referencia inmediata para cualquier ajuste futuro.*



cosas por hacer 

ver que hacer con lo de las voces 
arreglar el marcador de paginas 
agregar la etiqueta a los libros 
ver que hacer con las cuentas y la base de datos 
definir las configuraciones por los diferentes archivos pdf y ebup 
funcionamiento de cambio de pagina con los botones de al lado del contador de paginas en los pdf y ebup

