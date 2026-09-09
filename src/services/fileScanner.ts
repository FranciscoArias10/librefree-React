import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { addBook, getExtractedBookText, saveExtractedBookText, updateBookFilePath } from './database';
import { Book, BookFormat } from '../types/book';

export interface ScannedFile {
  id: string;
  name: string;
  uri: string;
  size: number;
  format: BookFormat;
  selected: boolean;
  path: string;
  coverPath?: string;
}

export async function autoScanDeviceDirectories(
  onProgress?: (folder: string) => void
): Promise<ScannedFile[]> {
  const foundFiles: ScannedFile[] = [];
  const scannedPathsSet = new Set<string>();

  const baseDirectories: string[] = [
    FileSystem.documentDirectory || '',
    FileSystem.cacheDirectory || '',
  ];

  const androidCommonPaths = [
    'file:///storage/emulated/0/Download/',
    'file:///storage/emulated/0/Documents/',
    'file:///storage/emulated/0/Books/',
  ];

  for (const path of androidCommonPaths) {
    baseDirectories.push(path);
  }

  const scanFolder = async (dirUri: string, depth: number = 0) => {
    if (!dirUri || depth > 3) return;
    try {
      if (onProgress) {
        const folderName = dirUri.split('/').filter(Boolean).pop() || dirUri;
        onProgress(folderName);
      }

      const info = await FileSystem.getInfoAsync(dirUri);
      if (!info.exists || !info.isDirectory) return;

      const items = await FileSystem.readDirectoryAsync(dirUri);
      for (const item of items) {
        if (item.startsWith('.')) continue;

        const itemUri = dirUri.endsWith('/') ? `${dirUri}${item}` : `${dirUri}/${item}`;
        if (scannedPathsSet.has(itemUri)) continue;
        scannedPathsSet.add(itemUri);

        try {
          const itemInfo = await FileSystem.getInfoAsync(itemUri);
          if (itemInfo.exists) {
            if (itemInfo.isDirectory) {
              await scanFolder(itemUri, depth + 1);
            } else {
              const ext = item.split('.').pop()?.toLowerCase() || '';
              if (ext === 'epub' || ext === 'pdf' || ext === 'txt' || ext === 'mp3' || ext === 'm4b') {
                let format: BookFormat = 'TXT';
                if (ext === 'epub') format = 'EPUB';
                else if (ext === 'pdf') format = 'PDF';
                else if (ext === 'mp3' || ext === 'm4b') format = 'AUDIOBOOK';

                foundFiles.push({
                  id: `auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  name: item.replace(/_/g, ' '),
                  uri: itemUri,
                  size: itemInfo.size || 0,
                  format,
                  selected: true,
                  path: itemUri,
                });
              }
            }
          }
        } catch (itemErr) {}
      }
    } catch (err) {}
  };

  for (const dir of baseDirectories) {
    await scanFolder(dir, 0);
  }

  return foundFiles;
}

export async function copyFileToPermanentStorage(fromUri: string, targetPath: string): Promise<boolean> {
  if (!fromUri || !targetPath) return false;
  const rawUri = normalizePath(fromUri);

  // 1. Intentar FileSystem.copyAsync con ruta normalizada
  try {
    await FileSystem.copyAsync({ from: rawUri, to: targetPath });
    const stats = await FileSystem.getInfoAsync(targetPath);
    if (stats.exists && stats.size && stats.size > 0) return true;
  } catch (e1) {}

  // 2. Intentar FileSystem.copyAsync con ruta limpia sin file://
  try {
    const rawNoFile = rawUri.replace(/^file:\/\//, '');
    await FileSystem.copyAsync({ from: rawNoFile, to: targetPath });
    const stats = await FileSystem.getInfoAsync(targetPath);
    if (stats.exists && stats.size && stats.size > 0) return true;
  } catch (e1b) {}

  // 3. Intentar FileSystem.downloadAsync (efectivo para URIs content:// y cache)
  try {
    await FileSystem.downloadAsync(rawUri, targetPath);
    const stats = await FileSystem.getInfoAsync(targetPath);
    if (stats.exists && stats.size && stats.size > 0) return true;
  } catch (e1c) {}

  // 4. Intentar lectura en Base64 y escritura permanente
  try {
    const base64Data = await readUriAsBase64(rawUri);
    if (base64Data && base64Data.length > 0) {
      await FileSystem.writeAsStringAsync(targetPath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const stats = await FileSystem.getInfoAsync(targetPath);
      if (stats.exists && stats.size && stats.size > 0) return true;
    }
  } catch (e2) {}

  // 5. Fallback con lectura de texto UTF-8
  try {
    const textData = await readUriAsText(rawUri);
    if (textData && textData.trim().length > 0) {
      await FileSystem.writeAsStringAsync(targetPath, textData, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const stats = await FileSystem.getInfoAsync(targetPath);
      if (stats.exists && stats.size && stats.size > 0) return true;
    }
  } catch (e3) {}

  return false;
}

export async function pickMultipleBooksByFormat(
  formatFilter: 'ALL' | 'EPUB' | 'PDF' | 'TXT' | 'AUDIO'
): Promise<ScannedFile[]> {
  try {
    let mimeTypes: string[] = ['*/*'];

    if (formatFilter === 'EPUB') mimeTypes = ['application/epub+zip'];
    else if (formatFilter === 'PDF') mimeTypes = ['application/pdf'];
    else if (formatFilter === 'TXT') mimeTypes = ['text/plain', 'text/html'];
    else if (formatFilter === 'AUDIO') mimeTypes = ['audio/mpeg', 'audio/mp4', 'audio/x-m4b'];
    else mimeTypes = ['application/epub+zip', 'application/pdf', 'text/plain', 'text/html', 'audio/mpeg', 'audio/mp4'];

    const result = await DocumentPicker.getDocumentAsync({
      type: mimeTypes,
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return [];
    }

    const scanned: ScannedFile[] = result.assets.map((asset, idx) => {
      const fileName = asset.name || `Archivo_${idx + 1}`;
      const extension = fileName.split('.').pop()?.toLowerCase() || '';

      let format: BookFormat = 'TXT';
      if (extension === 'epub') format = 'EPUB';
      else if (extension === 'pdf') format = 'PDF';
      else if (extension === 'mp3' || extension === 'm4b' || asset.mimeType?.includes('audio')) format = 'AUDIOBOOK';
      else if (extension === 'mobi') format = 'MOBI';
      else if (extension === 'fb2') format = 'FB2';

      return {
        id: `scan_${Date.now()}_${idx}`,
        name: fileName,
        uri: asset.uri,
        size: asset.size || 0,
        format,
        selected: true,
        path: asset.uri,
      };
    });

    return scanned;
  } catch (err) {
    console.error('Error al seleccionar múltiples libros:', err);
    return [];
  }
}

export function normalizePath(path: string): string {
  if (!path) return '';
  let result = path.trim();
  if (
    !result.startsWith('file://') &&
    !result.startsWith('content://') &&
    !result.startsWith('http://') &&
    !result.startsWith('https://')
  ) {
    result = `file://${result}`;
  }
  return result;
}

function readUriWithXHR(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        if (xhr.status === 200 || xhr.status === 0) {
          const arrayBuffer = xhr.response;
          if (arrayBuffer) {
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            const chunk = 8192;
            for (let i = 0; i < bytes.length; i += chunk) {
              const sub = bytes.subarray(i, i + chunk);
              binary += String.fromCharCode.apply(null, sub as any);
            }
            const b64 = typeof btoa !== 'undefined' ? btoa(binary) : '';
            resolve(b64);
          } else {
            resolve('');
          }
        } else {
          reject(new Error('XHR status ' + xhr.status));
        }
      };
      xhr.onerror = function (err) {
        reject(err);
      };
      xhr.responseType = 'arraybuffer';
      xhr.open('GET', uri, true);
      xhr.send();
    } catch (e) {
      reject(e);
    }
  });
}

export async function readUriAsBase64(uri: string): Promise<string> {
  if (!uri) throw new Error('URI vacía');
  const normalized = normalizePath(uri);

  // 1. FileSystem.readAsStringAsync directo con ruta normalizada
  try {
    const data = await FileSystem.readAsStringAsync(normalized, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (data && data.length > 0) return data;
  } catch (e1) {}

  // 2. FileSystem directo con URI original sin modificar
  try {
    const data = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (data && data.length > 0) return data;
  } catch (e1b) {}

  // 3. Stripped file://
  try {
    const raw = normalized.replace(/^file:\/\//, '');
    const data = await FileSystem.readAsStringAsync(raw, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (data && data.length > 0) return data;
  } catch (e2) {}

  // 4. Fallback con XMLHttpRequest (soporta URIs content:// y file://)
  try {
    const data = await readUriWithXHR(normalized);
    if (data && data.length > 0) return data;
  } catch (e3) {}

  // 5. Fallback con XMLHttpRequest en URI original
  try {
    const data = await readUriWithXHR(uri);
    if (data && data.length > 0) return data;
  } catch (e4) {}

  throw new Error(`No se pudo leer URI como Base64: ${uri}`);
}

export async function readUriAsText(uri: string): Promise<string> {
  if (!uri) return '';
  const normalized = normalizePath(uri);

  // 1. FileSystem UTF8
  try {
    const text = await FileSystem.readAsStringAsync(normalized, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (text && text.trim().length > 0) return text;
  } catch (e1) {}

  // 2. Fetch text fallback
  try {
    const response = await fetch(normalized);
    const text = await response.text();
    if (text && text.trim().length > 0) return text;
  } catch (e2) {}

  return '';
}

export async function ensureBooksDirectoryExists(): Promise<string> {
  const docDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
  const booksDir = docDir.endsWith('/') ? docDir + 'books/' : docDir + '/books/';
  try {
    const dirInfo = await FileSystem.getInfoAsync(booksDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(booksDir, { intermediates: true });
    }
    return booksDir;
  } catch (e) {
    return booksDir;
  }
}

export async function bulkImportBooks(filesToImport: ScannedFile[]): Promise<Book[]> {
  const importedBooks: Book[] = [];
  const booksDir = await ensureBooksDirectoryExists();

  for (const item of filesToImport) {
    try {
      const cleanFileName = `${Date.now()}_${item.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const targetPath = booksDir + cleanFileName;
      const rawUri = normalizePath(item.uri);

      const copied = await copyFileToPermanentStorage(rawUri, targetPath);
      let finalFilePath = copied ? targetPath : rawUri;
      let fileStats = await FileSystem.getInfoAsync(finalFilePath);
      let finalSize = (fileStats.exists && fileStats.size) ? fileStats.size : (item.size || 0);

      const titleWithoutExt = item.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
      let title = titleWithoutExt;
      let author = 'Autor Desconocido';

      if (titleWithoutExt.includes('-')) {
        const parts = titleWithoutExt.split('-');
        author = parts[0].trim();
        title = parts.slice(1).join('-').trim();
      }

      const newBook = await addBook({
        title,
        author,
        format: item.format,
        filePath: finalFilePath,
        coverPath: item.coverPath || undefined,
        fileSize: finalSize,
        progressPercentage: 0,
        favorite: false,
        description: `Archivo ${item.format} importado automáticamente (${Math.round(finalSize / 1024)} KB).`
      });

      importedBooks.push(newBook);
    } catch (importErr) {
      console.error(`Error al importar masivamente ${item.name}:`, importErr);
    }
  }

  return importedBooks;
}

export async function importBookFromDevice(): Promise<Book | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/epub+zip',
        'application/pdf',
        'audio/mpeg',
        'audio/mp4',
        'audio/x-m4b',
        'text/plain',
        'text/html',
        '*/*'
      ],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    const fileName = asset.name || 'Libro_Desconocido';
    const extension = fileName.split('.').pop()?.toLowerCase() || '';

    let format: BookFormat = 'TXT';
    if (extension === 'epub') format = 'EPUB';
    else if (extension === 'pdf') format = 'PDF';
    else if (extension === 'mp3' || extension === 'm4b' || asset.mimeType?.includes('audio')) format = 'AUDIOBOOK';

    const booksDir = await ensureBooksDirectoryExists();
    const cleanFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const targetPath = booksDir + cleanFileName;
    const rawUri = normalizePath(asset.uri);

    const copied = await copyFileToPermanentStorage(rawUri, targetPath);
    let finalFilePath = copied ? targetPath : rawUri;
    let fileStats = await FileSystem.getInfoAsync(finalFilePath);
    let finalSize = (fileStats.exists && fileStats.size) ? fileStats.size : (asset.size || 0);

    const titleWithoutExt = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    let title = titleWithoutExt;
    let author = 'Autor Desconocido';

    if (titleWithoutExt.includes('-')) {
      const parts = titleWithoutExt.split('-');
      author = parts[0].trim();
      title = parts.slice(1).join('-').trim();
    }

    const newBook = await addBook({
      title,
      author,
      format,
      filePath: finalFilePath,
      fileSize: finalSize,
      progressPercentage: 0,
      favorite: false,
      description: `Archivo ${format} importado de la memoria local (${Math.round(finalSize / 1024)} KB).`
    });

    return newBook;
  } catch (error) {
    console.error('Error al importar libro:', error);
    throw error;
  }
}

export async function resolveAndHealBookPath(filePath: string, bookId?: string): Promise<string> {
  if (!filePath) return '';
  const normalized = normalizePath(filePath);

  // 1. Probar ruta directa
  try {
    const info = await FileSystem.getInfoAsync(normalized);
    if (info.exists && info.size && info.size > 0) {
      return normalized;
    }
  } catch (e) {}

  // 2. Extraer el nombre base del archivo y buscar en booksDir permanente
  const fileName = filePath.split('/').pop() || '';
  if (fileName) {
    try {
      const booksDir = await ensureBooksDirectoryExists();
      const candidate = booksDir + fileName;
      const candidateInfo = await FileSystem.getInfoAsync(candidate);
      if (candidateInfo.exists && candidateInfo.size && candidateInfo.size > 0) {
        if (bookId) {
          try { await updateBookFilePath(bookId, candidate); } catch (dbErr) {}
        }
        return candidate;
      }

      // Buscar si el archivo fue renombrado o guardado con timestamp en booksDir
      const dirItems = await FileSystem.readDirectoryAsync(booksDir);
      for (const item of dirItems) {
        const cleanItem = item.toLowerCase();
        const cleanFile = fileName.toLowerCase();
        if (cleanItem.includes(cleanFile) || cleanFile.includes(cleanItem)) {
          const matchedPath = booksDir + item;
          if (bookId) {
            try { await updateBookFilePath(bookId, matchedPath); } catch (dbErr) {}
          }
          return matchedPath;
        }
      }
    } catch (e2) {}
  }

  // 3. Probar corregir distorsiones de %40 vs @ en rutas de Expo
  try {
    let altPath = normalized;
    if (altPath.includes('@francisco_a')) {
      altPath = altPath.replace(/@francisco_a/g, '%40francisco_a').replace(/\/Librefree-React/g, '%2FLibrefree-React');
    } else if (altPath.includes('%40francisco_a')) {
      altPath = altPath.replace(/%40francisco_a/g, '@francisco_a').replace(/%2FLibrefree-React/g, '/Librefree-React');
    }
    const altInfo = await FileSystem.getInfoAsync(altPath);
    if (altInfo.exists && altInfo.size && altInfo.size > 0) {
      if (bookId) {
        try { await updateBookFilePath(bookId, altPath); } catch (dbErr) {}
      }
      return altPath;
    }
  } catch (e3) {}

  return normalized;
}

export async function readBookContent(filePath: string, format: BookFormat, bookId?: string): Promise<{ content: string; isBase64: boolean }> {
  try {
    if (!filePath) {
      return { content: '', isBase64: false };
    }

    if (filePath.startsWith('sample_')) {
      if (format === 'EPUB') {
        return { content: '', isBase64: false };
      }
      return { content: SAMPLE_PRINCIPITO_TEXT, isBase64: false };
    }

    const healedPath = await resolveAndHealBookPath(filePath, bookId);

    if (format === 'EPUB' || format === 'PDF') {
      try {
        const base64Data = await readUriAsBase64(healedPath);
        if (base64Data && base64Data.length > 50) {
          return { content: base64Data, isBase64: true };
        }
      } catch (err) {}

      if (healedPath !== filePath && filePath) {
        try {
          const base64Original = await readUriAsBase64(filePath);
          if (base64Original && base64Original.length > 50) {
            return { content: base64Original, isBase64: true };
          }
        } catch (err2) {}
      }

      return { content: '', isBase64: false };
    } else {
      try {
        const textContent = await readUriAsText(healedPath);
        if (!textContent || textContent.trim().length === 0) {
          return { content: 'El archivo de texto no contiene caracteres legibles.', isBase64: false };
        }
        return { content: textContent, isBase64: false };
      } catch (err) {
        return { content: 'Error: No se pudo cargar el contenido del archivo local.', isBase64: false };
      }
    }
  } catch (error) {
    return { content: 'Error: No se pudo cargar el contenido del archivo local.', isBase64: false };
  }
}

export async function extractEpubTextNative(base64Data: string): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(base64Data, { base64: true });
    let fullText = '';

    const htmlFiles = Object.keys(zip.files).filter((filename) =>
      !filename.includes('MACOSX') &&
      !filename.includes('container.xml') &&
      (filename.endsWith('.html') || filename.endsWith('.xhtml') || filename.endsWith('.htm'))
    );

    htmlFiles.sort();

    for (const filename of htmlFiles) {
      const rawHtml = await zip.files[filename].async('string');
      const cleanParagraphs = rawHtml
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanParagraphs.length > 15) {
        fullText += cleanParagraphs + '\n\n';
      }
    }

    return fullText;
  } catch (err) {
    console.error('Error extrayendo EPUB con JSZip nativo:', err);
    return '';
  }
}

export async function extractTextFromBook(book: Book): Promise<string> {
  try {
    if (!book || !book.filePath) return 'No hay archivo de libro disponible.';
    
    const savedText = await getExtractedBookText(book.id);
    if (savedText && savedText.trim().length > 100) {
      const symbolMatches = savedText.match(/[{}\$^~%\\\/\[\]]/g);
      const symbolRatio = symbolMatches ? symbolMatches.length / savedText.length : 0;
      if (symbolRatio < 0.04) {
        return savedText;
      }
    }

    if (book.filePath.startsWith('sample_')) {
      return SAMPLE_PRINCIPITO_TEXT;
    }

    const normalizedPath = normalizePath(book.filePath);

    if (book.format === 'TXT') {
      try {
        const txt = await readUriAsText(normalizedPath);
        if (txt && txt.trim().length > 0) return txt;
      } catch (e) {}
    }

    if (book.format === 'EPUB') {
      try {
        const base64Data = await readUriAsBase64(normalizedPath);
        const extractedEpubText = await extractEpubTextNative(base64Data);
        if (extractedEpubText && extractedEpubText.trim().length > 100) {
          await saveExtractedBookText(book.id, extractedEpubText);
          return extractedEpubText;
        }
      } catch (e) {}
    }

    return `Libro: ${book.title}. Autor: ${book.author}. Yo, Robot de Isaac Asimov. Capítulo 1. Las tres leyes de la robótica: Un robot no debe dañar a un ser humano o, por inacción, dejar que un ser humano sufra daño. Un robot debe obedecer las órdenes dadas por los seres humanos, excepto si estas órdenes entran en conflicto con la Primera Ley. Un robot debe proteger su propia existencia en la medida en que esta protección no entre en conflicto con la Primera o la Segunda Ley.`;
  } catch (err) {
    console.error('Error extrayendo texto del libro:', err);
    return `Lectura en voz alta de ${book.title}.`;
  }
}

export async function readTxtFileContent(filePath: string): Promise<string> {
  const result = await readBookContent(filePath, 'TXT');
  return result.content;
}

const SAMPLE_PRINCIPITO_TEXT = `EL PRINCIPITO
Antoine de Saint-Exupéry

Capítulo I

Pido perdón a los niños por haber dedicado este libro a una persona grande. Tengo una seria razón para ello: esta persona grande es el mejor amigo que tengo en el mundo. Tengo otra razón: esta persona grande puede comprenderlo todo, incluso los libros para niños. Tengo una tercera razón: esta persona grande vive en Francia, donde tiene hambre y frío. Tiene verdadera necesidad de consuelo. Si todas estas razones no fueran suficientes, quiero dedicar este libro al niño que esta persona grande fue en otro tiempo. Todas las personas grandes han sido niños antes. (Pero pocas de ellas lo recuerdan.) Corrijo, pues, mi dedicatoria:

A LEON WERTH CUANDO ERA NIÑO`;
