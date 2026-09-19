import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { getAllBooks, toggleFavorite, deleteBook, getAllBookmarks, deleteBookmark } from '../../services/database';
import { pickMultipleBooksByFormat, bulkImportBooks } from '../../services/fileScanner';
import { BookCard } from '../../components/BookCard';
import { BookmarkItemCard, BookmarkWithBookInfo } from '../../components/BookmarkItemCard';
import { BackgroundCoverProcessor } from '../../components/BackgroundCoverProcessor';
import { Toast } from '../../components/Toast';
import { ConfirmDeleteModal } from '../../components/ConfirmDeleteModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Book } from '../../types/book';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export default function BookshelfScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [books, setBooks] = useState<Book[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkWithBookInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'FAVORITES' | 'BOOKMARKS' | 'EPUB' | 'PDF' | 'TXT'>('ALL');
  const [layoutMode, setLayoutMode] = useState<'grid2' | 'grid3' | 'list'>('grid2');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type?: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'success',
  });
  const [coverTrigger, setCoverTrigger] = useState<number>(0);

  useEffect(() => {
    async function loadLayout() {
      try {
        const saved = await AsyncStorage.getItem('librefree_layout_mode');
        if (saved && (saved === 'grid2' || saved === 'grid3' || saved === 'list')) {
          setLayoutMode(saved as any);
        }
      } catch (e) {}
    }
    loadLayout();
  }, []);

  const handleToggleLayoutMode = async () => {
    const nextMode = layoutMode === 'grid2' ? 'grid3' : layoutMode === 'grid3' ? 'list' : 'grid2';
    setLayoutMode(nextMode);
    try {
      await AsyncStorage.setItem('librefree_layout_mode', nextMode);
    } catch (e) {}
  };

  const [refreshing, setRefreshing] = useState(false);

  const fetchBooks = async (isInitialLoad: boolean = false) => {
    try {
      if (isInitialLoad) setLoading(true);
      const data = await getAllBooks();
      setBooks(data);
    } catch (err) {
      console.error('Error cargando libros:', err);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  };

  const fetchBookmarks = async () => {
    try {
      setLoadingBookmarks(true);
      const data = await getAllBookmarks();
      setBookmarks(data);
    } catch (err) {
      console.error('Error cargando marcadores:', err);
    } finally {
      setLoadingBookmarks(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (selectedFilter === 'BOOKMARKS') {
        await fetchBookmarks();
        setToast({
          visible: true,
          message: '✓ Marcadores actualizados.',
          type: 'info',
        });
      } else {
        const data = await getAllBooks();
        setBooks(data);
        await fetchBookmarks();
        setToast({
          visible: true,
          message: '✓ Estantería actualizada.',
          type: 'info',
        });
      }
    } catch (err) {
      console.error('Error al refrescar estantería:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchBooks(books.length === 0);
      fetchBookmarks();
    }, [books.length])
  );

  const handleDeleteBookmark = async (id: string) => {
    try {
      await deleteBookmark(id);
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
      setToast({
        visible: true,
        message: '✓ Marcador eliminado.',
        type: 'info',
      });
    } catch (e) {
      setToast({
        visible: true,
        message: 'No se pudo eliminar el marcador.',
        type: 'error',
      });
    }
  };

  const handleOpenBookmark = (bm: BookmarkWithBookInfo) => {
    router.push({
      pathname: '/reader/[id]',
      params: { id: bm.bookId, page: bm.cfiOrPage },
    });
  };

  const handleToggleFavorite = async (bookId: string, currentFav: boolean) => {
    await toggleFavorite(bookId, !currentFav);
    fetchBooks();
  };

  const handleLongPressBook = (book: Book) => {
    setIsSelectMode(true);
    if (!selectedBookIds.includes(book.id)) {
      setSelectedBookIds([book.id]);
    }
  };

  const handleToggleSelectBook = (bookId: string) => {
    setSelectedBookIds((prev) =>
      prev.includes(bookId) ? prev.filter((id) => id !== bookId) : [...prev, bookId]
    );
  };

  const handleSelectAllBooks = () => {
    if (selectedBookIds.length === filteredBooks.length) {
      setSelectedBookIds([]);
    } else {
      setSelectedBookIds(filteredBooks.map((b) => b.id));
    }
  };

  const handleCancelSelectMode = () => {
    setIsSelectMode(false);
    setSelectedBookIds([]);
  };

  const handleRequestDelete = () => {
    if (selectedBookIds.length === 0) return;
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setDeleteModalVisible(false);
      const count = selectedBookIds.length;
      for (const id of selectedBookIds) {
        await deleteBook(id);
      }
      setIsSelectMode(false);
      setSelectedBookIds([]);
      fetchBooks();
      setToast({
        visible: true,
        message: count > 1 ? `✓ Se eliminaron ${count} libros de tu estantería.` : '✓ Libro eliminado de tu estantería.',
        type: 'success',
      });
    } catch (e) {
      setToast({
        visible: true,
        message: 'No se pudo eliminar el libro.',
        type: 'error',
      });
    }
  };

  const handleImportBook = async () => {
    try {
      const results = await pickMultipleBooksByFormat('ALL');
      if (results.length === 0) return;
      
      const imported = await bulkImportBooks(results);
      if (imported.length > 0) {
        setToast({
          visible: true,
          message: `✓ Se agregaron ${imported.length} libro(s) a tu estantería.`,
          type: 'success',
        });
        fetchBooks();
        setCoverTrigger((prev) => prev + 1);
      }
    } catch (err) {
      setToast({
        visible: true,
        message: 'No se pudo completar la importación.',
        type: 'error',
      });
    }
  };

  const handleOpenBook = (book: Book) => {
    if (book.format === 'AUDIOBOOK') {
      router.push('/(tabs)/audiobooks');
    } else {
      router.push({
        pathname: '/reader/[id]',
        params: { id: book.id },
      });
    }
  };

  const filteredBooks = books.filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (selectedFilter === 'FAVORITES') return b.favorite;
    if (selectedFilter === 'EPUB') return b.format === 'EPUB';
    if (selectedFilter === 'PDF') return b.format === 'PDF';
    if (selectedFilter === 'TXT') return b.format === 'TXT';
    return true;
  });

  const filteredBookmarks = bookmarks.filter((bm) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (bm.snippet && bm.snippet.toLowerCase().includes(q)) ||
      (bm.bookTitle && bm.bookTitle.toLowerCase().includes(q)) ||
      (bm.chapterTitle && bm.chapterTitle.toLowerCase().includes(q))
    );
  });

  const androidStatusBarPadding = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 10 : 10;

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: theme.bg }, { paddingTop: androidStatusBarPadding }]}>
      {/* Background Cover Processor Component */}
      <BackgroundCoverProcessor onCoverGenerated={fetchBooks} triggerKey={coverTrigger} />

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
      />

      {/* Header Bar */}
      {isSelectMode ? (
        <View style={[styles.header, { backgroundColor: theme.bg }]}>
          <TouchableOpacity style={styles.selectionCancelBtn} onPress={handleCancelSelectMode}>
            <Feather name="x" size={20} color={theme.textPrimary} />
            <Text style={[styles.selectionCancelText, { color: theme.textPrimary }]}>Cancelar</Text>
          </TouchableOpacity>

          <Text style={[styles.selectionCountText, { color: theme.textPrimary }]}>
            {selectedBookIds.length} seleccionados
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity style={styles.selectAllBtn} onPress={handleSelectAllBooks}>
              <Text style={[styles.selectAllText, { color: theme.accent }]}>
                {selectedBookIds.length === filteredBooks.length ? 'Ninguno' : 'Todos'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.deleteSelectionBtn,
                { backgroundColor: selectedBookIds.length > 0 ? '#EF4444' : theme.bgChip },
              ]}
              onPress={handleRequestDelete}
              disabled={selectedBookIds.length === 0}
            >
              <Feather name="trash-2" size={16} color={selectedBookIds.length > 0 ? '#FFFFFF' : theme.textMuted} />
              <Text
                style={[
                  styles.deleteSelectionText,
                  { color: selectedBookIds.length > 0 ? '#FFFFFF' : theme.textMuted },
                ]}
              >
                ({selectedBookIds.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={[styles.header, { backgroundColor: theme.bg }]}>
          <View style={styles.titleRow}>
            <View style={[styles.logoBadge, { backgroundColor: theme.accent }]}>
              <Feather name="book-open" size={20} color="#FFFFFF" />
            </View>
            <View>
              <Text style={[styles.appTitle, { color: theme.textPrimary }]}>LibreFree</Text>
              <Text style={[styles.appSubtitle, { color: theme.textSecondary }]}>Mi Estantería Virtual</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={[styles.refreshHeaderBtn, { backgroundColor: theme.bgInput, borderColor: theme.border }]}
              onPress={handleRefresh}
              activeOpacity={0.7}
            >
              <Feather name="refresh-cw" size={16} color={theme.accent} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: theme.accent }]}
              onPress={handleImportBook}
              activeOpacity={0.8}
            >
              <Feather name="plus" size={18} color="#FFFFFF" />
              <Text style={styles.importBtnText}>Importar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Search Bar & View Mode Toggle */}
      <View style={styles.searchAndLayoutRow}>
        <View style={[styles.searchContainer, { backgroundColor: theme.bgInput, borderColor: theme.border }]}>
          <Feather name="search" size={18} color={theme.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder={selectedFilter === 'BOOKMARKS' ? 'Buscar en citas y marcadores...' : 'Buscar por título o autor...'}
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {selectedFilter !== 'BOOKMARKS' && (
          <TouchableOpacity
            style={[styles.layoutToggleBtn, { backgroundColor: theme.bgInput, borderColor: theme.border }]}
            onPress={handleToggleLayoutMode}
            activeOpacity={0.7}
          >
            <Feather
              name={layoutMode === 'grid2' ? 'grid' : layoutMode === 'grid3' ? 'columns' : 'list'}
              size={18}
              color={theme.accent}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter Chips */}
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          {[
            { key: 'ALL', label: 'Todos' },
            { key: 'BOOKMARKS', label: `🔖 Marcadores${bookmarks.length > 0 ? ` (${bookmarks.length})` : ''}` },
            { key: 'FAVORITES', label: '★ Favoritos' },
            { key: 'EPUB', label: 'EPUB' },
            { key: 'PDF', label: 'PDF' },
          ].map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterChip,
                { backgroundColor: selectedFilter === f.key ? theme.bgChipSelected : theme.bgChip },
              ]}
              onPress={() => setSelectedFilter(f.key as any)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: selectedFilter === f.key ? theme.textChipSelected : theme.textChip },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main Bookshelf or Bookmarks Content */}
      {selectedFilter === 'BOOKMARKS' ? (
        loadingBookmarks ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Cargando tus marcadores...</Text>
          </View>
        ) : filteredBookmarks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.bookmarkEmptyCircle, { backgroundColor: theme.accent + '18' }]}>
              <Feather name="bookmark" size={44} color={theme.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No hay marcadores aún</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Abre cualquier libro o documento PDF, selecciona texto con pulsación larga y toca "Resaltar" para guardarlo con color fluorescente.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredBookmarks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.bookmarkListContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[theme.accent]}
                tintColor={theme.accent}
              />
            }
            renderItem={({ item }) => (
              <BookmarkItemCard
                bookmark={item}
                onPress={handleOpenBookmark}
                onDelete={handleDeleteBookmark}
              />
            )}
          />
        )
      ) : loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Cargando estantería...</Text>
        </View>
      ) : filteredBooks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="book-open" size={56} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.textCard }]}>No hay libros en tu estantería</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Pulsa "+ Importar" para seleccionar libros EPUB, PDF o TXT guardados en tu teléfono.
          </Text>
          <TouchableOpacity style={[styles.emptyActionBtn, { backgroundColor: theme.accent }]} onPress={handleImportBook}>
            <Feather name="plus" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.emptyActionText}>Seleccionar Libro Local</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          key={layoutMode}
          data={filteredBooks}
          keyExtractor={(item) => item.id}
          numColumns={layoutMode === 'list' ? 1 : layoutMode === 'grid3' ? 3 : 2}
          columnWrapperStyle={layoutMode !== 'list' ? styles.shelfColumnWrapper : undefined}
          contentContainerStyle={styles.shelfListContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.accent]}
              tintColor={theme.accent}
            />
          }
          renderItem={({ item }) => (
            <BookCard
              book={item}
              layoutMode={layoutMode}
              isSelectMode={isSelectMode}
              isSelected={selectedBookIds.includes(item.id)}
              onToggleSelect={handleToggleSelectBook}
              onPress={handleOpenBook}
              onLongPress={handleLongPressBook}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
        />
      )}
      <ConfirmDeleteModal
        visible={deleteModalVisible}
        count={selectedBookIds.length}
        bookTitle={selectedBookIds.length === 1 ? books.find((b) => b.id === selectedBookIds[0])?.title : undefined}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    elevation: 3,
    shadowColor: '#3182CE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  appSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  refreshHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#3182CE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  importBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
  selectionCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 8,
  },
  selectionCancelText: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
  selectionCountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  selectAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
  deleteSelectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    elevation: 2,
  },
  deleteSelectionText: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 4,
  },
  searchAndLayoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    marginRight: 10,
    elevation: 1,
  },
  layoutToggleBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  filtersContainer: {
    marginBottom: 14,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bookmarkListContainer: {
    paddingBottom: 110,
  },
  bookmarkEmptyCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  shelfListContainer: {
    paddingHorizontal: 16,
    paddingBottom: 110,
  },
  shelfColumnWrapper: {
    justifyContent: 'space-between',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
    lineHeight: 19,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 3,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
