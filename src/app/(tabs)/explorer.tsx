import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
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
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import {
  autoScanDeviceDirectories,
  pickMultipleBooksByFormat,
  bulkImportBooks,
  readBookContent,
  ScannedFile,
} from '../../services/fileScanner';
import { getPdfReaderHTML } from '../../reader/PdfReaderHTML';
import { getEpubReaderHTML } from '../../reader/EpubReaderHTML';
import { getAllBooks } from '../../services/database';
import { Book, ReadingSettings } from '../../types/book';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

const DEFAULT_SETTINGS: ReadingSettings = {
  fontSize: 18,
  fontFamily: 'Serif',
  lineHeight: 1.6,
  marginSize: 20,
  themeMode: 'light',
  textAlignment: 'left',
  isContinuousScroll: false,
};

export default function FileExplorerScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  const [scannedResults, setScannedResults] = useState<ScannedFile[]>([]);
  const [isResultsModalVisible, setIsResultsModalVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [currentScanningFolder, setCurrentScanningFolder] = useState('Analizando almacenamiento...');
  const [isImporting, setIsImporting] = useState(false);
  const [importedBooks, setImportedBooks] = useState<Book[]>([]);

  // Thumbnail rendering queue
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(-1);
  const [processingHtml, setProcessingHtml] = useState<string | null>(null);

  const loadBooks = async () => {
    const books = await getAllBooks();
    setImportedBooks(books);
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const handleStartAutoScan = async () => {
    try {
      setIsScanning(true);
      setCurrentScanningFolder('Escaneando carpetas de Descargas y Documentos...');
      
      let results = await autoScanDeviceDirectories((folder) => {
        setCurrentScanningFolder(`Buscando en ${folder}...`);
      });

      if (results.length === 0) {
        results = await pickMultipleBooksByFormat('ALL');
      }

      setIsScanning(false);

      if (results.length === 0) {
        Alert.alert('Escaneo Finalizado', 'No se encontraron nuevos archivos EPUB o PDF en el almacenamiento.');
        return;
      }

      setScannedResults(results);
      setIsResultsModalVisible(true);

      if (results.length > 0) {
        processNextThumbnail(0, results);
      }
    } catch (e) {
      setIsScanning(false);
      Alert.alert('Error', 'No se pudo completar el escaneo automático.');
    }
  };

  const handleManualPick = async () => {
    try {
      const results = await pickMultipleBooksByFormat('ALL');
      if (results.length === 0) return;
      
      setScannedResults(results);
      setIsResultsModalVisible(true);
      processNextThumbnail(0, results);
    } catch (e) {
      Alert.alert('Error', 'No se pudieron seleccionar los archivos manualmente.');
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

    try {
      setCurrentProcessingIndex(index);
      const data = await readBookContent(file.uri, file.format);
      if (data.content && data.content.length > 5) {
        if (file.format === 'PDF') {
          setProcessingHtml(getPdfReaderHTML(data.content, '1', DEFAULT_SETTINGS, true));
        } else if (file.format === 'EPUB') {
          setProcessingHtml(getEpubReaderHTML(data.content, data.isBase64, undefined, DEFAULT_SETTINGS));
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
      Alert.alert('Atención', 'Selecciona al menos un libro para guardar en la aplicación.');
      return;
    }

    try {
      setIsImporting(true);
      const imported = await bulkImportBooks(selectedFiles);
      setIsImporting(false);
      setIsResultsModalVisible(false);

      Alert.alert(
        '¡Libros Agregados!',
        `Se agregaron ${imported.length} libros a tu biblioteca.`
      );
      loadBooks();
      router.push('/(tabs)');
    } catch (err) {
      setIsImporting(false);
      Alert.alert('Error', 'Ocurrió un problema durante la importación.');
    }
  };

  const selectedCount = scannedResults.filter((f) => f.selected).length;
  const androidStatusBarPadding = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 10 : 10;
  const baseUrl = FileSystem.documentDirectory || 'file:///';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg, paddingTop: androidStatusBarPadding }]}>
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
                Presiona el botón para rastrear la memoria de tu celular en busca de archivos EPUB y PDF.
              </Text>
            </View>
          </View>

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
              
              <TouchableOpacity style={[styles.scanBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.accent }]} onPress={handleManualPick}>
                <Feather name="folder" size={18} color={theme.accent} style={{ marginRight: 8 }} />
                <Text style={[styles.scanBtnText, { color: theme.accent }]}>Explorar Archivos Manualmente</Text>
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
    paddingBottom: 95,
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
});
