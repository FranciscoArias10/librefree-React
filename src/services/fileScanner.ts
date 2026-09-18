import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { addBook, getBookById, getExtractedBookText, saveExtractedBookText, updateBookFilePath } from './database';
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
      const dirInfo = await FileSystem.getInfoAsync(dirUri);
      if (!dirInfo.exists || !dirInfo.isDirectory) return;

      const items = await FileSystem.readDirectoryAsync(dirUri);
      for (const item of items) {
        if (item.startsWith('.')) continue;

        const itemUri = dirUri.endsWith('/') ? `${dirUri}${item}` : `${dirUri}/${item}`;
        if (scannedPathsSet.has(itemUri)) continue;
        scannedPathsSet.add(itemUri);

        try {
          const itemInfo = await FileSystem.getInfoAsync(itemUri);
          if (!itemInfo.exists) continue;
          if (itemInfo.isDirectory) {
            await scanFolder(itemUri, depth + 1);
          } else {
            const ext = item.split('.').pop()?.toLowerCase();
            let format: BookFormat | null = null;
            if (ext === 'epub') format = 'EPUB';
            else if (ext === 'pdf') format = 'PDF';
            else if (ext === 'txt') format = 'TXT';
            else if (ext === 'mp3' || ext === 'm4b') format = 'AUDIOBOOK';

            if (format) {
              if (onProgress) onProgress(item);
              foundFiles.push({
                id: `auto_${Date.now()}_${Math.random()}`,
                name: item,
                uri: itemUri,
                size: itemInfo.size || 0,
                format,
                selected: true,
                path: itemUri,
              });
            }
          }
        } catch (eItem) {}
      }
    } catch (eDir) {}
  };

  for (const dir of baseDirectories) {
    await scanFolder(dir, 0);
  }

  return foundFiles;
}

export async function copyFileToPermanentStorage(fromUri: string, targetPath: string): Promise<boolean> {
  if (!fromUri || !targetPath) return false;
  const rawUri = normalizePath(fromUri);
  const isBinary = /\.(pdf|epub|mp3|m4b|zip)$/i.test(targetPath);

  // Asegurar que el directorio de destino existe
  try {
    const lastSlash = targetPath.lastIndexOf('/');
    if (lastSlash !== -1) {
      const parentDir = targetPath.substring(0, lastSlash + 1);
      const pInfo = await FileSystem.getInfoAsync(parentDir);
      if (!pInfo.exists) {
        await FileSystem.makeDirectoryAsync(parentDir, { intermediates: true });
      }
    }
  } catch (dirErr) {}

  const fromVariants = Array.from(new Set([
    rawUri,
    rawUri.replace(/%2540/g, '%40').replace(/%252F/g, '%2F'),
    rawUri.replace(/^file:\/\//, ''),
    decodeURI(rawUri),
  ])).filter(Boolean);

  const targetVariants = Array.from(new Set([
    targetPath,
    targetPath.replace(/%2540/g, '%40').replace(/%252F/g, '%2F'),
  ])).filter(Boolean);

  // 1. Intentar FileSystem.copyAsync entre variantes
  for (const fUri of fromVariants) {
    for (const tUri of targetVariants) {
      try {
        await FileSystem.copyAsync({ from: fUri, to: tUri });
        const stats = await FileSystem.getInfoAsync(tUri);
        if (stats.exists) return true;
      } catch (e1) {}
    }
  }

  // 2. Intentar FileSystem.downloadAsync (solo para URLs http/https)
  if (rawUri.startsWith('http://') || rawUri.startsWith('https://')) {
    try {
      await FileSystem.downloadAsync(rawUri, targetPath);
      const stats = await FileSystem.getInfoAsync(targetPath);
      if (stats.exists) return true;
    } catch (e1c) {}
  }

  // 3. Intentar lectura en Base64 y escritura permanente
  try {
    const base64Data = await readUriAsBase64(rawUri);
    if (base64Data && base64Data.length > 0) {
      for (const tUri of targetVariants) {
        try {
          await FileSystem.writeAsStringAsync(tUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const stats = await FileSystem.getInfoAsync(tUri);
          if (stats.exists) return true;
        } catch (wErr) {}
      }
    }
  } catch (e2) {}

  // 4. Fallback con lectura de texto UTF-8 (SOLO para texto plano, NUNCA para binarios PDF/EPUB)
  if (!isBinary) {
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
  }

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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;
    base64 += chars[b1 >> 2];
    base64 += chars[((b1 & 3) << 4) | (b2 >> 4)];
    base64 += i + 1 < len ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    base64 += i + 2 < len ? chars[b3 & 63] : '=';
  }
  return base64;
}

async function readUriViaFetch(uri: string): Promise<string> {
  try {
    if (typeof fetch === 'undefined') return '';
    const response = await fetch(uri);
    if (!response.ok && response.status !== 0 && response.status !== 200) {
      return '';
    }

    try {
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer && arrayBuffer.byteLength > 0) {
        return arrayBufferToBase64(arrayBuffer);
      }
    } catch (eBuf) {}

    try {
      const blob = await response.blob();
      if (blob && typeof FileReader !== 'undefined') {
        const b64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result;
            if (typeof res === 'string') {
              resolve(res.includes(',') ? res.split(',')[1] : res);
            } else {
              resolve('');
            }
          };
          reader.onerror = () => resolve('');
          reader.readAsDataURL(blob);
        });
        if (b64 && b64.length > 0) return b64;
      }
    } catch (eBlob) {}

    return '';
  } catch (e) {
    return '';
  }
}

function readUriWithXHR(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        if (xhr.status === 200 || xhr.status === 0) {
          const arrayBuffer = xhr.response;
          if (arrayBuffer && arrayBuffer.byteLength > 0) {
            resolve(arrayBufferToBase64(arrayBuffer));
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

  const candidates = Array.from(new Set([
    normalized,
    uri,
    decodeURI(normalized),
    decodeURIComponent(normalized),
    normalized.replace(/%2540/g, '%40').replace(/%252F/g, '%2F'),
    normalized.replace(/%2540/g, '@').replace(/%252F/g, '/'),
    normalized.replace(/%40/g, '@').replace(/%2F/g, '/'),
    normalized.replace(/^file:\/\//, ''),
    decodeURI(normalized).replace(/^file:\/\//, ''),
  ])).filter(Boolean);

  let lastError: any = null;

  // 1. Intentar FileSystem.readAsStringAsync con todas las variantes
  for (const cUri of candidates) {
    try {
      const data = await FileSystem.readAsStringAsync(cUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (data && data.length > 0) return data;
    } catch (e: any) {
      lastError = e;
    }
  }

  // 2. Intentar fetch (soporta URIs fuera del sandbox de Expo Go, DocumentPicker y content://)
  for (const cUri of [normalized, uri, decodeURI(normalized)]) {
    try {
      const data = await readUriViaFetch(cUri);
      if (data && data.length > 0) return data;
    } catch (fetchErr: any) {
      lastError = fetchErr;
    }
  }

  // 3. Fallback con XMLHttpRequest
  for (const cUri of [normalized, uri, decodeURI(normalized)]) {
    try {
      const data = await readUriWithXHR(cUri);
      if (data && data.length > 0) return data;
    } catch (xhrErr: any) {
      lastError = xhrErr;
    }
  }

  const errDetail = lastError?.message || (typeof lastError === 'object' ? JSON.stringify(lastError) : String(lastError));
  throw new Error(`No se pudo leer URI como Base64: ${errDetail || uri}`);
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
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
  if (!baseDir) return '';

  const candidates = Array.from(new Set([
    baseDir.endsWith('/') ? baseDir + 'books/' : baseDir + '/books/',
    (baseDir.endsWith('/') ? baseDir + 'books/' : baseDir + '/books/').replace(/%2540/g, '%40').replace(/%252F/g, '%2F'),
  ]));

  for (const bDir of candidates) {
    try {
      const dirInfo = await FileSystem.getInfoAsync(bDir);
      if (dirInfo.exists) return bDir;
      await FileSystem.makeDirectoryAsync(bDir, { intermediates: true });
      const verify = await FileSystem.getInfoAsync(bDir);
      if (verify.exists) return bDir;
    } catch (e) {}
  }

  return candidates[0];
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

async function isValidFileOnDisk(uri: string, isBinary?: boolean): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return !!info.exists;
  } catch {
    return false;
  }
}

export async function resolveAndHealBookPath(filePath: string, bookId?: string): Promise<string> {
  if (!filePath) return '';
  const normalized = normalizePath(filePath);
  const isBinary = /\.(pdf|epub|mp3|m4b)$/i.test(filePath);

  // 1. Probar ruta directa y variantes decodificadas de Expo
  const pathVariants = Array.from(new Set([
    normalized,
    decodeURI(normalized),
    decodeURIComponent(normalized),
    normalized.replace(/%2540/g, '%40').replace(/%252F/g, '%2F'),
    normalized.replace(/%2540/g, '@').replace(/%252F/g, '/'),
    normalized.replace(/%40/g, '@').replace(/%2F/g, '/'),
    normalized.replace(/^file:\/\//, ''),
  ])).filter(Boolean);

  for (const variant of pathVariants) {
    try {
      const valid = await isValidFileOnDisk(variant, isBinary);
      if (valid) {
        if (bookId && variant !== filePath) {
          try { await updateBookFilePath(bookId, variant); } catch (eDb) {}
        }
        return variant;
      }
    } catch (e) {}
  }

  // 2. Extraer el nombre base del archivo y palabras clave del título
  const rawFileName = filePath.split('/').pop() || '';
  const cleanFileName = rawFileName.replace(/^(\d+_)+/, ''); // Remover TODOS los prefijos timestamp repetidos

  let bookTitle = '';
  if (bookId) {
    try {
      const b = await getBookById(bookId);
      if (b && b.title) {
        bookTitle = b.title.trim();
      }
    } catch (e) {}
  }

  const wordsFromTitle = bookTitle
    ? bookTitle.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3)
    : [];
  const wordsFromFile = (cleanFileName || rawFileName)
    .replace(/\.[^.]+$/, '')
    .split(/[-_.\s]+/)
    .filter(w => w.length >= 3 && !/^[0-9a-fA-F-]{8,}$/.test(w));

  const targetWords = Array.from(new Set([...wordsFromTitle, ...wordsFromFile]));

  try {
    const booksDir = await ensureBooksDirectoryExists();
    const candidate = booksDir + rawFileName;
    const cleanCandidate = booksDir + cleanFileName;

    for (const cPath of [candidate, cleanCandidate]) {
      const valid = await isValidFileOnDisk(cPath, isBinary);
      if (valid) {
        if (bookId) {
          try { await updateBookFilePath(bookId, cPath); } catch (dbErr) {}
        }
        return cPath;
      }
    }

    // Buscar si el archivo fue renombrado o guardado con timestamp en booksDir
    const dirItems = await FileSystem.readDirectoryAsync(booksDir);

    for (const item of dirItems) {
      const cleanItem = item.toLowerCase();
      const cleanTarget = (cleanFileName || rawFileName).toLowerCase();
      const matchesTargetWords = targetWords.length > 0 && targetWords.slice(0, 3).some(w => cleanItem.includes(w.toLowerCase()));
      if (cleanItem.includes(cleanTarget) || cleanTarget.includes(cleanItem) || matchesTargetWords) {
        const matchedPath = booksDir + item;
        const valid = await isValidFileOnDisk(matchedPath, isBinary);
        if (valid) {
          if (bookId) {
            try { await updateBookFilePath(bookId, matchedPath); } catch (dbErr) {}
          }
          return matchedPath;
        }
      }
    }
  } catch (e2) {}

  // 3. Búsqueda profunda en directorios externos comunes de Android (Download, Documents, Books, Cache)
  const searchDirs = [
    'file:///storage/emulated/0/Download/',
    'file:///storage/emulated/0/Documents/',
    'file:///storage/emulated/0/Books/',
    FileSystem.cacheDirectory || '',
  ];

  for (const sDir of searchDirs) {
    if (!sDir) continue;
    try {
      const dInfo = await FileSystem.getInfoAsync(sDir);
      if (!dInfo.exists || !dInfo.isDirectory) continue;
      const sItems = await FileSystem.readDirectoryAsync(sDir);
      for (const sItem of sItems) {
        const lowerItem = sItem.toLowerCase();
        const matchesWords = targetWords.length > 0 && targetWords.slice(0, 3).some(w => lowerItem.includes(w.toLowerCase()));
        if (matchesWords || lowerItem.includes((cleanFileName || rawFileName).toLowerCase())) {
          const externalPath = sDir.endsWith('/') ? `${sDir}${sItem}` : `${sDir}/${sItem}`;
          const valid = await isValidFileOnDisk(externalPath, isBinary);
          if (valid) {
            // Copiar a booksDir permanente para que nunca más se pierda
            try {
              const booksDir = await ensureBooksDirectoryExists();
              const cleanItemName = sItem.replace(/^(\d+_)+/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
              const permPath = `${booksDir}${Date.now()}_${cleanItemName}`;
              const copied = await copyFileToPermanentStorage(externalPath, permPath);
              if (copied) {
                if (bookId) {
                  try { await updateBookFilePath(bookId, permPath); } catch (dbErr) {}
                }
                return permPath;
              }
            } catch (copyErr) {}

            if (bookId) {
              try { await updateBookFilePath(bookId, externalPath); } catch (dbErr) {}
            }
            return externalPath;
          }
        }
      }
    } catch (eSearch) {}
  }

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
    console.log(`[readBookContent] Iniciando lectura para formato ${format}:`, { filePath, healedPath, bookId });

    if (format === 'EPUB' || format === 'PDF') {
      // 1. Intentar leer desde healedPath
      try {
        const base64Data = await readUriAsBase64(healedPath);
        if (base64Data && base64Data.length > 20) {
          console.log(`[readBookContent] Éxito leyendo Base64 desde healedPath (${Math.round(base64Data.length / 1024)} KB)`);
          if (healedPath.includes('/cache/') || healedPath.includes('DocumentPicker')) {
            ensureBooksDirectoryExists().then(async (booksDir) => {
              if (booksDir) {
                const cleanBase = healedPath.split('/').pop()?.replace(/^(\d+_)+/, '') || 'book.pdf';
                const permPath = `${booksDir}${Date.now()}_${cleanBase.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                await FileSystem.writeAsStringAsync(permPath, base64Data, { encoding: FileSystem.EncodingType.Base64 });
                if (bookId) {
                  await updateBookFilePath(bookId, permPath);
                }
              }
            }).catch(() => {});
          }
          return { content: base64Data, isBase64: true };
        }
      } catch (err: any) {
        console.warn(`[readBookContent] Fallo al leer Base64 de healedPath:`, err?.message || err);
      }

      // 2. Intentar leer desde filePath original si era diferente
      if (healedPath !== filePath && filePath) {
        try {
          const base64Original = await readUriAsBase64(filePath);
          if (base64Original && base64Original.length > 20) {
            console.log(`[readBookContent] Éxito leyendo Base64 desde filePath original (${Math.round(base64Original.length / 1024)} KB)`);
            if (filePath.includes('/cache/') || filePath.includes('DocumentPicker')) {
              ensureBooksDirectoryExists().then(async (booksDir) => {
                if (booksDir) {
                  const cleanBase = filePath.split('/').pop()?.replace(/^(\d+_)+/, '') || 'book.pdf';
                  const permPath = `${booksDir}${Date.now()}_${cleanBase.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                  await FileSystem.writeAsStringAsync(permPath, base64Original, { encoding: FileSystem.EncodingType.Base64 });
                  if (bookId) {
                    await updateBookFilePath(bookId, permPath);
                  }
                }
              }).catch(() => {});
            }
            return { content: base64Original, isBase64: true };
          }
        } catch (err2: any) {
          console.warn(`[readBookContent] Fallo al leer Base64 de filePath original:`, err2?.message || err2);
        }
      }

      // 3. Auto-heal: Copiar a booksDir si está fuera de booksDir
      try {
        const booksDir = await ensureBooksDirectoryExists();
        const sourcePath = healedPath || filePath;
        const isInBooksDir = sourcePath && sourcePath.includes('/books/');
        if (!isInBooksDir) {
          const baseName = sourcePath.split('/').pop() || 'book.pdf';
          const cleanBase = baseName.replace(/^(\d+_)+/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
          const permPath = `${booksDir}${Date.now()}_${cleanBase}`;
          const copied = await copyFileToPermanentStorage(sourcePath, permPath);
          if (copied) {
            if (bookId) {
              try { await updateBookFilePath(bookId, permPath); } catch (eDb) {}
            }
            const base64Perm = await readUriAsBase64(permPath);
            if (base64Perm && base64Perm.length > 20) {
              return { content: base64Perm, isBase64: true };
            }
          }
        }
      } catch (errCopy: any) {}

      console.warn(`[readBookContent] No se pudo leer contenido del libro en disco:`, { filePath, healedPath });
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
