import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Book } from '../types/book';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface BookCardProps {
  book: Book;
  onPress: (book: Book) => void;
  onLongPress?: (book: Book) => void;
  onToggleFavorite?: (bookId: string, current: boolean) => void;
}

export const BookCard: React.FC<BookCardProps> = ({ book, onPress, onLongPress, onToggleFavorite }) => {
  const { theme } = useTheme();

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

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: theme.bgCard, borderColor: theme.border }]}
      activeOpacity={0.85}
      onPress={() => onPress(book)}
      onLongPress={() => onLongPress && onLongPress(book)}
      delayLongPress={400}
    >
      {/* Cover Image or Real Book First Page Style Container */}
      <View style={[styles.coverWrapper, { backgroundColor: theme.bg }]}>
        {book.coverPath && book.coverPath.length > 50 ? (
          <Image source={{ uri: book.coverPath }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <View style={[styles.bookCoverPage, { backgroundColor: badge.bgGradient }]}>
            {/* Book Spine Overlay Effect */}
            <View style={styles.spineShadow} />

            {/* Document / Cover Header */}
            <View style={styles.coverHeader}>
              <View style={[styles.badge, { backgroundColor: badge.color }]}>
                <Text style={styles.badgeText}>{badge.label}</Text>
              </View>
            </View>

            {/* Book Main Title & Author Preview */}
            <View style={styles.coverBody}>
              <Feather name={badge.iconName} size={36} color={badge.color} style={{ marginBottom: 10 }} />
              <Text style={[styles.coverTitleText, { color: theme.textCard }]} numberOfLines={3}>
                {book.title}
              </Text>
              <View style={[styles.titleUnderline, { backgroundColor: badge.color }]} />
              <Text style={[styles.coverAuthorText, { color: theme.textSecondary }]} numberOfLines={1}>
                {book.author}
              </Text>
            </View>
          </View>
        )}

        {/* Favorite Star */}
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => onToggleFavorite && onToggleFavorite(book.id, book.favorite)}
        >
          <Ionicons
            name={book.favorite ? 'star' : 'star-outline'}
            size={18}
            color={book.favorite ? '#F1C40F' : '#FFFFFF88'}
          />
        </TouchableOpacity>
      </View>

      {/* Book Metadata Footer */}
      <View style={styles.details}>
        <Text style={[styles.title, { color: theme.textCard }]} numberOfLines={1}>
          {book.title}
        </Text>
        <Text style={[styles.author, { color: theme.textSecondary }]} numberOfLines={1}>
          {book.author}
        </Text>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBarBackground, { backgroundColor: theme.bgChip }]}>
            <View style={[styles.progressBarFill, { backgroundColor: theme.accent, width: `${Math.min(100, Math.max(0, book.progressPercentage))}%` }]} />
          </View>
          <Text style={[styles.progressText, { color: theme.textMuted }]}>{Math.round(book.progressPercentage)}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '47%',
    marginBottom: 20,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  coverWrapper: {
    width: '100%',
    height: 190,
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
