# 📋 LISTA DE PENDIENTES - LIBREFREE

> **Estado del Proyecto:** React Native / Expo Go  
> **Última actualización:** 4 de Octubre de 2026  

---

### ✅ Tareas Completadas Recientemente
- [x] **Escaneo Automático de Documentos del Dispositivo (SAF Android)**: Implementación de Storage Access Framework (SAF) para escaneo recurrente y automático de carpetas del celular (`Download`, `Documents`, `Books`, etc.), persistencia de la carpeta seleccionada en `AsyncStorage` para escaneo con 1 toque sin volver a solicitar permisos, detección de libros ya importados en biblioteca, extracción ultra rápida de portadas EPUB e interfaz mejorada en el modal "Documentos Encontrados".
- [x] **Gestión de Perfiles Locales Offline**: Sistema multi-perfil 100% local (sin necesidad de cuentas ni internet) con avance de lectura, marcadores y favoritos independientes por perfil, selector dinámico en Estantería y Ajustes, y creación de perfiles con avatares de emoji y color temático.
- [x] **Sistema de Etiquetas y Categorías Personalizadas**: Creación, asignación múltiple/lote y filtrado dinámico de etiquetas (*Estudio*, *Ficción*, *Favoritos*, *Por Leer*) en la estantería con badges de colores en `BookCard` y modal interactivo `AssignTagsModal`.
- [x] **Generación Automática de Portadas al Importar (EPUB/PDF)**: Solucionada la extracción nativa de portadas EPUB inspeccionando manifiesto OPF en tiempo de importación (<50ms) y la generación en segundo plano para PDF mediante WebView renderizado off-screen sin suspensión de lienzo en Android.
- [x] **Configuraciones Específicas por Formato (PDF vs EPUB)**: Opciones de lectura 100% independientes en `ReaderControlsModal` y Ajustes: Ajuste de vista (`pdfPageFit`: *Página Completa*, *Ajustar al Ancho*, *Ajustar a Altura*), contraste (*Alto Contraste*, *Suave*) e inversión nocturna para PDF; y tipografía, tamaño de letra, interlineado, márgenes y alineación para EPUB/TXT.
- [x] **Catálogo y Selección de Voces (TTS)**: Permite listar, filtrar (español / todos los idiomas), probar muestra en vivo ("Probar Voz") y seleccionar voces específicas instaladas en el dispositivo (masculinas, femeninas, acentos regionalizados) desde Ajustes y guardarlas persistentemente.
- [x] **Lectura por Voz desde la página actual (TTS)**: Arreglado el inicio de la síntesis de voz (`startTTSBook`) usando coincidencia de fragmento de texto (`findMatchingChunkIndex`) para que la lectura empiece en la página que estás leyendo (ej. Página 30) y continúe leyendo en voz alta las siguientes páginas sin devolverse a la primera página.
- [x] **Subida y control de versiones Git**: Repositorio en GitHub sincronizado en la rama `master`.
- [x] **Sintetizador de Velocidad Continuo (0.75x a 2.0x)**: Cambio de velocidad de voz dinámico sin reinicio de frase.

---

### 📌 Tareas Pendientes (Roadmap de Desarrollo)

#### 1. 🗣️ Voces y Sintetizador de Voz (TTS)
- [x] **Selector de Voces de Expo Speech**: Permitir al usuario listar y elegir entre distintas voces instaladas en el sistema (voces masculinas, femeninas, acentos regionalizados de español) desde la pantalla de Ajustes.

#### 2. 🔖 Marcadores y Recortes de Páginas
- [ ] **Mejoras al Marcador de Páginas**: Refinar el sistema de guardado de posición/página, permitiendo agregar notas breves a cada marcador y visualizarlas de forma clara en la pantalla principal y en el lector.

#### 3. 🏷️ Sistema de Etiquetas para Libros
- [x] **Etiquetas / Categorías Personalizadas**: Permitir crear y asignar etiquetas (*Estudio*, *Ficción*, *Favoritos*, *Por Leer*) a los libros para filtrarlos en la biblioteca.

#### 4. 🗄️ Cuentas de Usuario y Base de Datos
- [x] **Gestión de Perfiles Locales Offline**: Estructura de base de datos SQLite con tablas `profiles` y `profile_book_progress` para soportar múltiples perfiles de lectura independientes (avance, marcadores, favoritos) sin registro ni conexión obligatoria.

#### 5. ⚙️ Configuraciones Específicas por Formato (PDF vs EPUB)
- [x] **Ajustes Independientes**: Separar las opciones de tipografía, tamaño de letra y márgenes para EPUB de las opciones de zoom y ajuste de ancho para PDF.

#### 6. 🔘 Botones de Cambio de Página Inferiores
- [ ] **Botones Directos al lado del Contador de Páginas**: Optimizar los botones de navegación previa/siguiente en la barra flotante inferior en PDF y EPUB.
