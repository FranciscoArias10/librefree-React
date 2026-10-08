import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  StatusBar,
  Platform,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import {
  autoScanDeviceDirectories,
  scanDeviceBooks,
  getSavedScanDirectoryName,
  pickMultipleBooksByFormat,
  bulkImportBooks,
  readBookContent,
  extractEpubCoverNative,
  ScannedFile,
} from '../../services/fileScanner';
import { getPdfReaderHTML } from '../../reader/PdfReaderHTML';
import { getEpubReaderHTML } from '../../reader/EpubReaderHTML';
import { getAllBooks, DEFAULT_SETTINGS } from '../../services/database';
import { Book, ReadingSettings } from '../../types/book';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Toast } from '../../components/Toast';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

export default function FileExplorerScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [scannedResults, setScannedResults] = useState<ScannedFile[]>([]);
  const [isResultsModalVisible, setIsResultsModalVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [currentScanningFolder, setCurrentScanningFolder] = useState('');
  const [linkedFolderName, setLinkedFolderName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importedBooks, setImportedBooks] = useState<Book[]>([]);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type?: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  // Thumbnail rendering queue
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(-1);
  const [processingHtml, setProcessingHtml] = useState<string | null>(null);

  const loadBooks = async () => {
    const books = await getAllBooks();
    setImportedBooks(books);
    try {
      const savedFolder = await getSavedScanDirectoryName();
      if (savedFolder) setLinkedFolderName(savedFolder);
    } catch (e) {}
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const handleStartAutoScan = async () => {
    try {
      setIsScanning(true);
      setCurrentScanningFolder('Iniciando escaneo automático...');
      
      const response = await scanDeviceBooks({
        onProgress: (info) => {
          setCurrentScanningFolder(info.includes('/') || info.includes('...') ? info : `Buscando: ${info}`);
        },
      });

      setIsScanning(false);

      if (response.cancelled) {
        setToast({ visible: true, message: 'Escaneo cancelado. Selecciona una carpeta para escanear tus libros.', type: 'info' });
        return;
      }

      if (response.folderName) {
        setLinkedFolderName(response.folderName);
      }

      const results = response.files;

      if (results.length === 0) {
        setToast({
          visible: true,
          message: `No se encontraron libros compatibles en ${response.folderName || 'el dispositivo'}.`,
          type: 'info',
        });
        return;
      }

      // Preparar resultados marcando si ya están en biblioteca
      const preparedResults = results.map((item) => {
        const isAlreadyInLib = importedBooks.some((b) => {
          const normTitle = b.title.trim().toLowerCase();
          const fileTitle = item.name.replace(/\.[^/.]+$/, '').trim().toLowerCase();
          return normTitle === fileTitle || b.filePath === item.uri;
        });
        return {
          ...item,
          selected: !isAlreadyInLib,
        };
      });

      setScannedResults(preparedResults);
      setIsResultsModalVisible(true);

      if (preparedResults.length > 0) {
        processNextThumbnail(0, preparedResults);
      }
    } catch (e) {
      setIsScanning(false);
      console.error('Error durante el escaneo automático:', e);
      setToast({ visible: true, message: 'No se pudo completar el escaneo automático.', type: 'error' });
    }
  };

  const handlePickNewFolder = async () => {
    try {
      setIsScanning(true);
      setCurrentScanningFolder('Selecciona una carpeta para escanear...');

      const response = await scanDeviceBooks({
        forceRequestFolder: true,
        onProgress: (info) => {
          setCurrentScanningFolder(info.includes('/') || info.includes('...') ? info : `Buscando: ${info}`);
        },
      });

      setIsScanning(false);

      if (response.cancelled) {
        setToast({ visible: true, message: 'Selección de carpeta cancelada.', type: 'info' });
        return;
      }

      if (response.folderName) {
        setLinkedFolderName(response.folderName);
      }

      const results = response.files;

      if (results.length === 0) {
        setToast({
          visible: true,
          message: `No se encontraron libros en ${response.folderName || 'la carpeta seleccionada'}.`,
          type: 'info',
        });
        return;
      }

      const preparedResults = results.map((item) => {
        const isAlreadyInLib = importedBooks.some((b) => {
          const normTitle = b.title.trim().toLowerCase();
          const fileTitle = item.name.replace(/\.[^/.]+$/, '').trim().toLowerCase();
          return normTitle === fileTitle || b.filePath === item.uri;
        });
        return {
          ...item,
          selected: !isAlreadyInLib,
        };
      });

      setScannedResults(preparedResults);
      setIsResultsModalVisible(true);
      processNextThumbnail(0, preparedResults);
    } catch (e) {
      setIsScanning(false);
      setToast({ visible: true, message: 'Error al cambiar la carpeta.', type: 'error' });
    }
  };

  const handleManualPick = async () => {
    try {
      const results = await pickMultipleBooksByFormat('ALL');
      if (results.length === 0) return;
      
      const preparedResults = results.map((item) => {
        const isAlreadyInLib = importedBooks.some((b) => {
          const normTitle = b.title.trim().toLowerCase();
          const fileTitle = item.name.replace(/\.[^/.]+$/, '').trim().toLowerCase();
          return normTitle === fileTitle || b.filePath === item.uri;
        });
        return {
          ...item,
          selected: !isAlreadyInLib,
        };
      });

      setScannedResults(preparedResults);
      setIsResultsModalVisible(true);
      processNextThumbnail(0, preparedResults);
    } catch (e) {
      setToast({ visible: true, message: 'No se pudieron seleccionar los archivos manualmente.', type: 'error' });
    }
  };

  const processNextThumbnail = async (index: number, list: ScannedFile[]) => {
    if (index >= list.length || index >= 30) {
      setProcessingHtml(null);
      setCurrentProcessingIndex(-1);
      return;
    }

    const file = list[index];
    if (file.coverPath) {
      processNextThumbnail(index + 1, list);
      return;
    }

    // Para TXT o Audiobooks no se requiere renderizado de portada offscreen
    if (file.format === 'TXT' || file.format === 'AUDIOBOOK') {
      processNextThumbnail(index + 1, list);
      return;
    }

    try {
      setCurrentProcessingIndex(index);
      const data = await readBookContent(file.uri, file.format);
      if (data.content && data.content.length > 5) {
        if (file.format === 'EPUB') {
          // Extracción nativa ultra rápida para EPUB (en milisegundos)
          const nativeCover = await extractEpubCoverNative(data.content);
          if (nativeCover) {
            setScannedResults((prev) =>
              prev.map((item, idx) => (idx === index ? { ...item, coverPath: nativeCover } : item))
            );
            processNextThumbnail(index + 1, list);
            return;
          }
          setProcessingHtml(getEpubReaderHTML(data.content, data.isBase64, undefined, DEFAULT_SETTINGS));
        } else if (file.format === 'PDF') {
          setProcessingHtml(getPdfReaderHTML(data.content, '1', DEFAULT_SETTINGS, true, data.isBase64));
        } else {
          processNextThumbnail(index + 1, list);
        }
      } else {
        processNextThumbnail(index + 1, list);
      }
    } catch (e) {
      processNextThumbnail(index + 1, list);
    }
  };

  const handleThumbnailMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'COVER_GENERATED' && currentProcessingIndex >= 0) {
        const coverDataUrl = data.payload?.coverPath;
        if (coverDataUrl && coverDataUrl.length > 50) {
          setScannedResults((prev) =>
            prev.map((item, idx) => (idx === currentProcessingIndex ? { ...item, coverPath: coverDataUrl } : item))
          );
        }
        const nextIdx = currentProcessingIndex + 1;
        setProcessingHtml(null);
        setTimeout(() => processNextThumbnail(nextIdx, scannedResults), 300);
      }
    } catch (e) {}
  };

  const handleToggleSelectFile = (id: string) => {
    setScannedResults((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setScannedResults((prev) => prev.map((item) => ({ ...item, selected: select })));
  };

  const handleConfirmImport = async () => {
    const selectedFiles = scannedResults.filter((f) => f.selected);
    if (selectedFiles.length === 0) {
      setToast({ visible: true, message: 'Selecciona al menos un libro para guardar.', type: 'info' });
      return;
    }

    try {
      setIsImporting(true);
      const imported = await bulkImportBooks(selectedFiles);
      setIsImporting(false);
      setIsResultsModalVisible(false);

      setToast({ visible: true, message: `✓ Se agregaron ${imported.length} libro(s) a tu biblioteca.`, type: 'success' });
      loadBooks();
      router.push('/(tabs)');
    } catch (err) {
      setIsImporting(false);
      setToast({ visible: true, message: 'Ocurrió un problema durante la importación.', type: 'error' });
    }
  };

  const selectedCount = scannedResults.filter((f) => f.selected).length;
  const androidStatusBarPadding = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 10 : 10;
  const baseUrl = FileSystem.documentDirectory || 'file:///';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg, paddingTop: androidStatusBarPadding }]}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
      {/* Hidden Offscreen Thumbnail Processor */}
      {processingHtml && (
        <View style={styles.hiddenProcessor} pointerEvents="none">
          <WebView
            originWhitelist={['*']}
            source={{ html: processingHtml, baseUrl: baseUrl }}
            onMessage={handleThumbnailMessage}
            style={{ width: 300, height: 400, opacity: 0 }}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess={true}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
          />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Escáner Automático de Libros</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            La app busca sola en tu teléfono todos tus archivos EPUB y PDF
          </Text>
        </View>

        {/* Minimalist Action Card without left icon box */}
        <View style={[styles.actionCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <View style={styles.actionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: theme.textCard }]}>Búsqueda Automática</Text>
              <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>
                Rastrea la memoria de tu dispositivo para encontrar todos tus libros EPUB, PDF y documentos.
              </Text>
            </View>
          </View>

          {linkedFolderName ? (
            <View style={[styles.folderBadgeRow, { backgroundColor: theme.mode === 'dark' ? '#1F2937' : '#F1F5F9' }]}>
              <Feather name="folder" size={15} color={theme.accent} style={{ marginRight: 8 }} />
              <Text style={[styles.folderBadgeText, { color: theme.textSecondary }]}>
                Carpeta vinculada: <Text style={{ fontWeight: '700', color: theme.textCard }}>{linkedFolderName}</Text>
              </Text>
              <TouchableOpacity onPress={handlePickNewFolder} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 'auto' }}>
                <Text style={[styles.folderChangeText, { color: theme.accent }]}>Cambiar</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {isScanning ? (
            <View style={[styles.scanningStatusBox, { backgroundColor: theme.mode === 'dark' ? '#1E3A8A' : '#EBF8FF' }]}>
              <ActivityIndicator size="small" color={theme.accent} style={{ marginRight: 10 }} />
              <Text style={[styles.scanningStatusText, { color: theme.accent }]} numberOfLines={1}>
                {currentScanningFolder}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <TouchableOpacity style={[styles.scanBtn, { backgroundColor: theme.accent }]} onPress={handleStartAutoScan}>
                <Feather name="search" size={18} color={theme.accentText} style={{ marginRight: 8 }} />
                <Text style={[styles.scanBtnText, { color: theme.accentText }]}>Escanear Celular Automáticamente</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.scanBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.accent }]} onPress={handlePickNewFolder}>
                <Feather name="folder-plus" size={18} color={theme.accent} style={{ marginRight: 8 }} />
                <Text style={[styles.scanBtnText, { color: theme.accent }]}>
                  {linkedFolderName ? 'Seleccionar Otra Carpeta para Escanear' : 'Elegir Carpeta de Libros'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.scanBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.border }]} onPress={handleManualPick}>
                <Feather name="file-plus" size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
                <Text style={[styles.scanBtnText, { color: theme.textSecondary }]}>Explorar Archivos Manualmente</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Currently Installed Books List */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Libros en tu Aplicación ({importedBooks.length})</Text>
        {importedBooks.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No has guardado libros aún. Presiona Escanear arriba.</Text>
          </View>
        ) : (
          importedBooks.map((b) => (
            <View key={b.id} style={[styles.bookItem, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
              <Ionicons name="checkmark-circle" size={20} color="#27AE60" style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.bookItemTitle, { color: theme.textCard }]} numberOfLines={1}>
                  {b.title}
                </Text>
                <Text style={[styles.bookItemAuthor, { color: theme.textSecondary }]} numberOfLines={1}>
                  {b.author} • {b.format} ({Math.round(b.fileSize / 1024)} KB)
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Results Screen Modal */}
      <Modal
        visible={isResultsModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsResultsModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: theme.bg }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { backgroundColor: theme.bgCard, borderBottomColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Documentos Encontrados ({scannedResults.length})</Text>
              <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                {currentProcessingIndex >= 0 ? `Generando vista previa (${currentProcessingIndex + 1}/${scannedResults.length})...` : 'Selecciona los libros que deseas conservar'}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setIsResultsModalVisible(false)}>
              <Feather name="x" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Select All / Unselect All Control Bar */}
          <View style={[styles.selectionBar, { backgroundColor: theme.bgCard, borderBottomColor: theme.border }]}>
            <TouchableOpacity style={styles.textSelectBtn} onPress={() => handleSelectAll(true)}>
              <Text style={[styles.textSelectLabel, { color: theme.accent }]}>✓ Seleccionar Todos ({scannedResults.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.textSelectBtn} onPress={() => handleSelectAll(false)}>
              <Text style={[styles.textSelectLabel, { color: theme.accent }]}>✗ Desmarcar Todos</Text>
            </TouchableOpacity>
          </View>

          {/* Grid Layout of Book Cards */}
          <ScrollView contentContainerStyle={styles.gridContainer}>
            <View style={styles.gridRow}>
              {scannedResults.map((item) => {
                const isPdf = item.format === 'PDF';
                const isEpub = item.format === 'EPUB';
                const isAlreadyInLib = importedBooks.some((b) => {
                  const normTitle = b.title.trim().toLowerCase();
                  const fileTitle = item.name.replace(/\.[^/.]+$/, '').trim().toLowerCase();
                  return normTitle === fileTitle || b.filePath === item.uri;
                });

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.gridCard,
                      { backgroundColor: theme.bgCard, borderColor: theme.border },
                      item.selected && { borderColor: theme.accent, borderWidth: 2 },
                    ]}
                    activeOpacity={0.85}
                    onPress={() => handleToggleSelectFile(item.id)}
                  >
                    {/* Cover Preview Container */}
                    <View style={[styles.coverFrame, { backgroundColor: theme.bg }]}>
                      {item.coverPath && item.coverPath.length > 50 ? (
                        <Image source={{ uri: item.coverPath }} style={styles.realCoverImage} resizeMode="cover" />
                      ) : (item.format === 'TXT' || item.format === 'AUDIOBOOK') ? (
                        <View style={[styles.coverPlaceholder, { backgroundColor: theme.bg }]}>
                          <Ionicons
                            name={item.format === 'AUDIOBOOK' ? 'headset' : 'document-text'}
                            size={34}
                            color={theme.accent}
                            style={{ marginBottom: 6 }}
                          />
                          <Text style={[styles.coverPreviewLabel, { color: theme.textSecondary }]}>
                            {item.format}
                          </Text>
                        </View>
                      ) : (
                        <View style={[styles.coverPlaceholder, { backgroundColor: theme.bg }]}>
                          <ActivityIndicator size="small" color={theme.accent} style={{ marginBottom: 6 }} />
                          <Text style={[styles.coverPreviewLabel, { color: theme.textSecondary }]}>
                            Cargando Pág 1...
                          </Text>
                        </View>
                      )}

                      {/* Format Badge Overlay */}
                      <View style={[styles.badgeOverlay, { backgroundColor: isPdf ? '#E74C3C' : isEpub ? '#27AE60' : '#8E44AD' }]}>
                        <Text style={styles.badgeOverlayText}>{item.format}</Text>
                      </View>

                      {/* Checkbox Circle */}
                      <TouchableOpacity
                        style={[
                          styles.checkCircle,
                          item.selected && { backgroundColor: theme.accent, borderColor: theme.accent },
                        ]}
                        onPress={() => handleToggleSelectFile(item.id)}
                      >
                        {item.selected && <Ionicons name="checkmark" size={16} color={theme.accentText} />}
                      </TouchableOpacity>
                    </View>

                    {/* Book Metadata */}
                    <View style={styles.cardInfo}>
                      <Text style={[styles.cardBookTitle, { color: theme.textCard }]} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={[styles.cardBookSize, { color: theme.textSecondary }]} numberOfLines={1}>
                        {Math.round(item.size / 1024)} KB
                      </Text>
                      {isAlreadyInLib && (
                        <View style={styles.alreadyInLibBadge}>
                          <Text style={styles.alreadyInLibText}>✓ En biblioteca</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Footer Import Action Button */}
          <View style={[styles.modalFooter, { backgroundColor: theme.bgCard, borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[
                styles.importConfirmBtn,
                { backgroundColor: theme.accent },
                selectedCount === 0 && styles.btnDisabled,
              ]}
              disabled={selectedCount === 0 || isImporting}
              onPress={handleConfirmImport}
            >
              {isImporting ? (
                <ActivityIndicator size="small" color={theme.accentText} />
              ) : (
                <>
                  <Feather name="plus-circle" size={18} color={theme.accentText} style={{ marginRight: 8 }} />
                  <Text style={[styles.importConfirmText, { color: theme.accentText }]}>
                    Agregar {selectedCount} Libros a la Estantería
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  hiddenProcessor: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  container: {
    padding: 16,
    paddingBottom: 110,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  actionCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  actionHeaderRow: {
    marginBottom: 14,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  actionDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    elevation: 2,
  },
  scanBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  scanningStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  scanningStatusText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyBox: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 13,
  },
  bookItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  bookItemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  bookItemAuthor: {
    fontSize: 12,
    marginTop: 1,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  textSelectBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  textSelectLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  gridContainer: {
    padding: 16,
    paddingBottom: 110,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCard: {
    width: COLUMN_WIDTH,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  coverFrame: {
    width: '100%',
    height: COLUMN_WIDTH * 1.35,
    position: 'relative',
  },
  realCoverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  coverPreviewLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  badgeOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeOverlayText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  checkCircle: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    padding: 12,
  },
  cardBookTitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  cardBookSize: {
    fontSize: 11,
    marginTop: 4,
  },
  modalFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  importConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 3,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  importConfirmText: {
    fontSize: 15,
    fontWeight: '700',
  },
  folderBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    marginBottom: 14,
  },
  folderBadgeText: {
    fontSize: 13,
  },
  folderChangeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  alreadyInLibBadge: {
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  alreadyInLibText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
