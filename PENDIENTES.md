# 📋 LISTA DE PENDIENTES - LIBREFREE

> **Estado del Proyecto:** React Native / Expo Go  
> **Última actualización:** 4 de Octubre de 2026  

---

### ✅ Tareas Completadas Recientemente
- [x] **Lectura por Voz desde la página actual (TTS)**: Arreglado el inicio de la síntesis de voz (`startTTSBook`) usando coincidencia de fragmento de texto (`findMatchingChunkIndex`) para que la lectura empiece en la página que estás leyendo (ej. Página 30) y continúe leyendo en voz alta las siguientes páginas sin devolverse a la primera página.
- [x] **Subida y control de versiones Git**: Repositorio en GitHub sincronizado en la rama `master`.
- [x] **Sintetizador de Velocidad Continuo (0.75x a 2.0x)**: Cambio de velocidad de voz dinámico sin reinicio de frase.

---

### 📌 Tareas Pendientes (Roadmap de Desarrollo)

#### 1. 🗣️ Voces y Sintetizador de Voz (TTS)
- [ ] **Selector de Voces de Expo Speech**: Permitir al usuario listar y elegir entre distintas voces instaladas en el sistema (voces masculinas, femeninas, acentos regionalizados de español) desde la pantalla de Ajustes.

#### 2. 🔖 Marcadores y Recortes de Páginas
- [ ] **Mejoras al Marcador de Páginas**: Refinar el sistema de guardado de posición/página, permitiendo agregar notas breves a cada marcador y visualizarlas de forma clara en la pantalla principal y en el lector.

#### 3. 🏷️ Sistema de Etiquetas para Libros
- [ ] **Etiquetas / Categorías Personalizadas**: Permitir crear y asignar etiquetas (*Estudio*, *Ficción*, *Favoritos*, *Por Leer*) a los libros para filtrarlos en la biblioteca.

#### 4. 🗄️ Cuentas de Usuario y Base de Datos
- [ ] **Gestión de Perfiles / Cuentas**: Definir la estructura de la base de datos local SQLite para soportar múltiples perfiles de lectura o sincronización opcional en la nube.

#### 5. ⚙️ Configuraciones Específicas por Formato (PDF vs EPUB)
- [ ] **Ajustes Independientes**: Separar las opciones de tipografía, tamaño de letra y márgenes para EPUB de las opciones de zoom y ajuste de ancho para PDF.

#### 6. 🔘 Botones de Cambio de Página Inferiores
- [ ] **Botones Directos al lado del Contador de Páginas**: Optimizar los botones de navegación previa/siguiente en la barra flotante inferior en PDF y EPUB.
