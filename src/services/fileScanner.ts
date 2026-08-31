import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { addBook, getExtractedBookText, saveExtractedBookText } from './database';
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

export async function bulkImportBooks(filesToImport: ScannedFile[]): Promise<Book[]> {
  const importedBooks: Book[] = [];

  const docDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
  const booksDir = docDir.endsWith('/') ? docDir + 'books/' : docDir + '/books/';
  
  const dirInfo = await FileSystem.getInfoAsync(booksDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(booksDir, { intermediates: true });
  }

  for (const item of filesToImport) {
    try {
      const cleanFileName = `${Date.now()}_${item.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const targetPath = booksDir + cleanFileName;

      try {
        await FileSystem.copyAsync({
          from: item.uri,
          to: targetPath,
        });
      } catch (e) {
        const base64Data = await FileSystem.readAsStringAsync(item.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await FileSystem.writeAsStringAsync(targetPath, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      const fileStats = await FileSystem.getInfoAsync(targetPath);
      const finalSize = (fileStats.exists && fileStats.size) ? fileStats.size : item.size;

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
        filePath: targetPath,
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

    const docDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
    const booksDir = docDir.endsWith('/') ? docDir + 'books/' : docDir + '/books/';
    
    const dirInfo = await FileSystem.getInfoAsync(booksDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(booksDir, { intermediates: true });
    }

    const cleanFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const targetPath = booksDir + cleanFileName;

    try {
      await FileSystem.copyAsync({
        from: asset.uri,
        to: targetPath,
      });
    } catch (readErr) {
      const base64Data = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.writeAsStringAsync(targetPath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    const fileStats = await FileSystem.getInfoAsync(targetPath);
    const finalSize = (fileStats.exists && fileStats.size) ? fileStats.size : (asset.size || 0);

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
      filePath: targetPath,
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

export async function readBookContent(filePath: string, format: BookFormat): Promise<{ content: string; isBase64: boolean }> {
  try {
    if (filePath.startsWith('sample_')) {
      if (format === 'EPUB') {
        return { content: '', isBase64: false };
      }
      return { content: SAMPLE_PRINCIPITO_TEXT, isBase64: false };
    }

    const normalizedPath = filePath.startsWith('file://') ? filePath : `file://${filePath}`;

    if (format === 'EPUB') {
      const base64Data = await FileSystem.readAsStringAsync(normalizedPath, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return { content: base64Data, isBase64: true };
    } else if (format === 'PDF') {
      try {
        const base64Data = await FileSystem.readAsStringAsync(normalizedPath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return { content: base64Data, isBase64: true };
      } catch (e) {
        return { content: normalizedPath, isBase64: false };
      }
    } else {
      const textContent = await FileSystem.readAsStringAsync(normalizedPath, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (!textContent || textContent.trim().length === 0) {
        return { content: 'El archivo de texto no contiene caracteres legibles.', isBase64: false };
      }
      return { content: textContent, isBase64: false };
    }
  } catch (error) {
    console.error('Error leyendo archivo de libro:', error);
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

    const normalizedPath = book.filePath.startsWith('file://') ? book.filePath : `file://${book.filePath}`;

    if (book.format === 'TXT') {
      const txt = await FileSystem.readAsStringAsync(normalizedPath, { encoding: FileSystem.EncodingType.UTF8 });
      return txt && txt.trim().length > 0 ? txt : `Lectura de ${book.title}.`;
    }

    if (book.format === 'EPUB') {
      try {
        const base64Data = await FileSystem.readAsStringAsync(normalizedPath, {
          encoding: FileSystem.EncodingType.Base64,
        });
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
