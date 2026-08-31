import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Book } from '../types/book';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');
const GRID2_CARD_WIDTH = Math.floor((screenWidth - 44) / 2);
const GRID3_CARD_WIDTH = Math.floor((screenWidth - 48) / 3);

interface BookCardProps {
  book: Book;
  onPress: (book: Book) => void;
  onLongPress?: (book: Book) => void;
  onToggleFavorite?: (bookId: string, current: boolean) => void;
  layoutMode?: 'grid2' | 'grid3' | 'list';
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (bookId: string) => void;
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  onPress,
  onLongPress,
  onToggleFavorite,
  layoutMode = 'grid2',
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
}) => {
  const { theme } = useTheme();

  const handleCardPress = () => {
    if (isSelectMode && onToggleSelect) {
      onToggleSelect(book.id);
    } else {
      onPress(book);
    }
  };

  const handleCardLongPress = () => {
    if (onLongPress) {
      onLongPress(book);
    }
  };

  const getFormatBadge = () => {
    switch (book.format) {
      case 'AUDIOBOOK':
        return { label: 'AUDIO', color: '#8E44AD', bgGradient: theme.mode === 'dark' ? '#2C1A38' : '#F3E5F5', iconName: 'headphones' as const };
      case 'PDF':
        return { label: 'PDF', color: '#E74C3C', bgGradient: theme.mode === 'dark' ? '#3B1A18' : '#FDEDEC', iconName: 'file-text' as const };
      case 'EPUB':
        return { label: 'EPUB', color: '#27AE60', bgGradient: theme.mode === 'dark' ? '#143823' : '#E8F8F5', iconName: 'book' as const };
      default:
        return { label: book.format, color: '#2980B9', bgGradient: theme.mode === 'dark' ? '#142738' : '#EBF5FB', iconName: 'file-text' as const };
    }
  };

  const badge = getFormatBadge();

  // Selection Checkbox Overlay
  const renderSelectionCheck = () => {
    if (!isSelectMode) return null;
    return (
      <View
        style={[
          styles.selectionIndicator,
          isSelected ? { backgroundColor: '#EF4444', borderColor: '#EF4444' } : { backgroundColor: 'rgba(0,0,0,0.3)', borderColor: '#FFFFFF88' },
        ]}
      >
        {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
      </View>
    );
  };

  // Horizontal List Row View
  if (layoutMode === 'list') {
    return (
      <TouchableOpacity
        style={[
          styles.listContainer,
          { backgroundColor: theme.bgCard, borderColor: isSelected ? '#EF4444' : theme.border },
        ]}
        activeOpacity={0.85}
        onPress={handleCardPress}
        onLongPress={handleCardLongPress}
        delayLongPress={300}
      >
        <View style={[styles.listCoverWrapper, { backgroundColor: theme.bg }]}>
          {book.coverPath && book.coverPath.length > 50 ? (
            <Image source={{ uri: book.coverPath }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <View style={[styles.bookCoverPage, { backgroundColor: badge.bgGradient }]}>
              <View style={styles.spineShadow} />
              <Feather name={badge.iconName} size={22} color={badge.color} />
            </View>
          )}
          {renderSelectionCheck()}
        </View>

        <View style={styles.listDetails}>
          <View style={styles.listHeaderRow}>
            <Text style={[styles.listTitle, { color: theme.textCard }]} numberOfLines={1}>
              {book.title}
            </Text>
            {!isSelectMode && (
              <TouchableOpacity
                style={styles.listFavoriteButton}
                onPress={() => onToggleFavorite && onToggleFavorite(book.id, book.favorite)}
              >
                <Ionicons
                  name={book.favorite ? 'star' : 'star-outline'}
                  size={18}
                  color={book.favorite ? '#F1C40F' : theme.textMuted}
                />
              </TouchableOpacity>
            )}
          </View>

          <Text style={[styles.listAuthor, { color: theme.textSecondary }]} numberOfLines={1}>
            {book.author}
          </Text>

          <View style={styles.listFooterRow}>
            <View style={[styles.badge, { backgroundColor: badge.color, marginRight: 8 }]}>
              <Text style={styles.badgeText}>{badge.label}</Text>
            </View>

            <View style={styles.listProgressWrapper}>
              <View style={[styles.progressBarBackground, { backgroundColor: theme.bgChip }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    { backgroundColor: theme.accent, width: `${Math.min(100, Math.max(0, book.progressPercentage))}%` },
                  ]}
                />
              </View>
              <Text style={[styles.listProgressText, { color: theme.textMuted }]} numberOfLines={1} ellipsizeMode="tail">
                {book.currentChapter || `${Math.round(book.progressPercentage)}%`}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // Grid View (2 or 3 Columns)
  const isGrid3 = layoutMode === 'grid3';

  return (
    <TouchableOpacity
      style={[
        isGrid3 ? styles.containerGrid3 : styles.containerGrid2,
        { backgroundColor: theme.bgCard, borderColor: isSelected ? '#EF4444' : theme.border },
      ]}
      activeOpacity={0.85}
      onPress={handleCardPress}
      onLongPress={handleCardLongPress}
      delayLongPress={300}
    >
      <View style={[styles.coverWrapper, { aspectRatio: 0.72, backgroundColor: theme.bg }]}>
        {book.coverPath && book.coverPath.length > 50 ? (
          <Image source={{ uri: book.coverPath }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <View style={[styles.bookCoverPage, { backgroundColor: badge.bgGradient }]}>
            <View style={styles.spineShadow} />
            <View style={styles.coverHeader}>
              <View style={[styles.badge, { backgroundColor: badge.color }]}>
                <Text style={styles.badgeText}>{badge.label}</Text>
              </View>
            </View>
            <View style={styles.coverBody}>
              <Feather name={badge.iconName} size={isGrid3 ? 22 : 34} color={badge.color} style={{ marginBottom: 4 }} />
              <Text style={[styles.coverTitleText, { color: theme.textCard, fontSize: isGrid3 ? 10 : 13 }]} numberOfLines={2}>
                {book.title}
              </Text>
            </View>
          </View>
        )}

        {isSelectMode ? (
          renderSelectionCheck()
        ) : (
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={() => onToggleFavorite && onToggleFavorite(book.id, book.favorite)}
          >
            <Ionicons
              name={book.favorite ? 'star' : 'star-outline'}
              size={16}
              color={book.favorite ? '#F1C40F' : '#FFFFFF88'}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.details, { padding: isGrid3 ? 6 : 10 }]}>
        <Text style={[styles.title, { color: theme.textCard, fontSize: isGrid3 ? 11 : 13 }]} numberOfLines={1}>
          {book.title}
        </Text>
        {!isGrid3 && (
          <Text style={[styles.author, { color: theme.textSecondary }]} numberOfLines={1}>
            {book.author}
          </Text>
        )}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBarBackground, { backgroundColor: theme.bgChip }]}>
            <View
              style={[
                styles.progressBarFill,
                { backgroundColor: theme.accent, width: `${Math.min(100, Math.max(0, book.progressPercentage))}%` },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: theme.textMuted }]} numberOfLines={1}>
            {book.currentChapter || `${Math.round(book.progressPercentage)}%`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  containerGrid2: {
    flex: 1,
    maxWidth: '48.5%',
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  containerGrid3: {
    flex: 1,
    maxWidth: '31.5%',
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  listContainer: {
    width: '100%',
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  listCoverWrapper: {
    width: 62,
    height: 86,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  listDetails: {
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 6,
  },
  listFavoriteButton: {
    padding: 4,
  },
  listAuthor: {
    fontSize: 12,
    marginBottom: 8,
  },
  listFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  listProgressWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  listProgressText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 6,
    maxWidth: 100,
  },
  coverWrapper: {
    width: '100%',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  bookCoverPage: {
    width: '100%',
    height: '100%',
    padding: 12,
    justifyContent: 'space-between',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  spineShadow: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  coverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  coverBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  coverTitleText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 18,
  },
  titleUnderline: {
    width: 24,
    height: 2,
    borderRadius: 1,
    marginVertical: 6,
  },
  coverAuthorText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 14,
    padding: 4,
  },
  selectionIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  details: {
    padding: 10,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  author: {
    fontSize: 11,
    marginBottom: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarBackground: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
