import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { getAllBooks, toggleFavorite, deleteBook } from '../../services/database';
import { pickMultipleBooksByFormat, bulkImportBooks } from '../../services/fileScanner';
import { BookCard } from '../../components/BookCard';
import { BackgroundCoverProcessor } from '../../components/BackgroundCoverProcessor';
import { Book } from '../../types/book';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export default function BookshelfScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'FAVORITES' | 'EPUB' | 'PDF' | 'TXT'>('ALL');

  const fetchBooks = async () => {
    try {
      setLoading(true);
      const data = await getAllBooks();
      setBooks(data);
    } catch (err) {
      console.error('Error cargando libros:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchBooks();
    }, [])
  );

  const handleToggleFavorite = async (bookId: string, currentFav: boolean) => {
    await toggleFavorite(bookId, !currentFav);
    fetchBooks();
  };

  const handleLongPressBook = (book: Book) => {
    Alert.alert(
      'Eliminar de la App',
      `¿Deseas quitar "${book.title}" de tu estantería?\n\n(El archivo original guardado en tu celular no será borrado).`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteBook(book.id);
            fetchBooks();
          },
        },
      ]
    );
  };

  const handleImportBook = async () => {
    try {
      const results = await pickMultipleBooksByFormat('ALL');
      if (results.length === 0) return;
      
      const imported = await bulkImportBooks(results);
      if (imported.length > 0) {
        Alert.alert(
          '¡Libros Importados!',
          `Se agregaron ${imported.length} libros a tu estantería.`
        );
        fetchBooks();
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo completar la importación.');
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

  const androidStatusBarPadding = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 10 : 10;

  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: theme.bg }, { paddingTop: androidStatusBarPadding }]}>
      {/* Background Cover Processor Component */}
      <BackgroundCoverProcessor onCoverGenerated={fetchBooks} />

      {/* Header */}
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

        <TouchableOpacity
          style={[styles.importBtn, { backgroundColor: theme.accent }]}
          onPress={handleImportBook}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.importBtnText}>Importar</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.bgInput, borderColor: theme.border }]}>
        <Feather name="search" size={18} color={theme.textMuted} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.textPrimary }]}
          placeholder="Buscar por título o autor..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Category Filter Chips */}
      <View style={styles.filtersContainer}>
        {[
          { key: 'ALL', label: 'Todos' },
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
      </View>

      {/* Main Bookshelf Content */}
      {loading ? (
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
          data={filteredBooks}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.shelfColumnWrapper}
          contentContainerStyle={styles.shelfListContainer}
          renderItem={({ item }) => (
            <BookCard
              book={item}
              onPress={handleOpenBook}
              onLongPress={handleLongPressBook}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
        />
      )}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    marginBottom: 12,
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
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 14,
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
  shelfListContainer: {
    paddingHorizontal: 16,
    paddingBottom: 95,
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
