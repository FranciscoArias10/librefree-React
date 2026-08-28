# 📚 LibreFree — Lector de Libros & Audiolibros

<p align="center">
  <b>Una aplicación móvil libre, privada, moderna y 100% gratuita para leer libros (EPUB, PDF) y escuchar audiolibros.</b>
</p>

---

## 🌟 Características Principales

* 📖 **Motor de Lectura Ultra-HD (EPUB & PDF):**
  * Soporte completo de archivos **EPUB** y **PDF** con escalado Retina de alta definición.
  * Cálculo dinámico de páginas reales (`Página X de Y`) y barra de progreso integrada.
  * Modos visuales adaptables: **Claro**, **Sepia**, **Modo Noche** y **Modo OLED (Negro Puro)**.
  * Ajustes personalizados de tipografía, tamaño de letra, interlineado y márgenes.
  * Gestos táctiles para cambio de página horizontal y zoom fluido.

* 🔍 **Importación & Explorador de Archivos:**
  * **Selección múltiple masiva:** Importa decenas de libros guardados en tu celular de una sola vez.
  * **Vistas previas instantáneas:** Generación automática de la portada de la página 1.
  * Búsqueda por título o autor y filtros rápidos (**EPUB**, **PDF**, **★ Favoritos**).

* 🎧 **Síntesis de Voz TTS (Lectura en Voz Alta):**
  * Escucha cualquier libro en voz alta gracias al sintetizador de voz integrado.
  * Extrae automáticamente el texto de la página actual.
  * Controles de reproducción fluidos con cambio de velocidad (`0.75x`, `1.0x`, `1.25x`, `1.5x`, `2.0x`).
  * Desconexión limpia de audio al salir de la pantalla de lectura.

* 🎨 **Interfaz Futurista & Estética Premium:**
  * **Barra de navegación cápsula flotante:** Diseño minimalista basado en íconos centrados, esquinas redondeadas y efecto de cristal.
  * **Tema Claro y Tema Oscuro Global:** Cambio instantáneo de paleta de colores.

* 🔒 **100% Privado, Local & Offline:**
  * Toda la base de datos (progreso de lectura, marcadores e historial) se almacena localmente en **SQLite**.
  * **Sin anuncios, sin cuentas obligatorias, sin cargos ocultos y sin recopilación de datos.**

---

## 🛠️ Tecnologías Utilizadas

* **Framework:** [Expo](https://expo.dev/) (SDK v54) / [React Native](https://reactnative.dev/)
* **Lenguaje:** TypeScript
* **Base de Datos Local:** SQLite (`expo-sqlite` con modo WAL)
* **Motores de Lectura Web:** PDF.js / ePub.js dentro de `react-native-webview`
* **Voz & Audio:** `expo-speech`
* **Navegación:** `expo-router`

---

## 🚀 Cómo Ejecutar el Proyecto

1. **Clonar el repositorio e instalar dependencias:**
   ```bash
   git clone https://github.com/FranciscoArias10/librefree-React.git
   cd librefree-React
   npm install
   ```

2. **Iniciar el servidor de desarrollo:**
   ```bash
   npx expo start --go -c
   ```

3. **Probar en tu dispositivo:**
   * Abre la app **Expo Go** en tu celular Android o iOS.
   * Escanea el código QR que aparece en tu terminal.

---

## 📝 Licencia

Este proyecto es de código abierto y está diseñado para ser accesible libremente por cualquier usuario sin costo alguno.
