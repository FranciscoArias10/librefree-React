import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Bookmark } from '../types/book';

export interface BookmarkWithBookInfo extends Bookmark {
  bookTitle: string;
  bookAuthor: string;
  bookFormat: string;
  coverPath?: string;
}

interface BookmarkItemCardProps {
  bookmark: BookmarkWithBookInfo;
  onPress: (bookmark: BookmarkWithBookInfo) => void;
  onDelete: (id: string) => void;
}

export const BookmarkItemCard: React.FC<BookmarkItemCardProps> = ({
  bookmark,
  onPress,
  onDelete,
}) => {
  const { theme } = useTheme();
  const highlightColor = bookmark.color || '#FACC15';

  const formatDate = (timestamp: number) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const getPageDisplay = () => {
    if (bookmark.chapterTitle && bookmark.chapterTitle.toLowerCase().includes('página')) {
      return bookmark.chapterTitle;
    }
    if (bookmark.cfiOrPage) {
      if (!isNaN(Number(bookmark.cfiOrPage))) {
        return `Pág. ${bookmark.cfiOrPage}`;
      }
      return bookmark.chapterTitle || 'Marcador';
    }
    return bookmark.chapterTitle || 'Marcador';
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.bgCard,
          borderColor: theme.border,
        },
      ]}
    >
      {/* Color indicator bar on the left edge */}
      <View style={[styles.colorBar, { backgroundColor: highlightColor }]} />

      <View style={styles.cardContent}>
        {/* Header with book info and delete button */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.bookInfoContainer}
            onPress={() => onPress(bookmark)}
            activeOpacity={0.7}
          >
            {bookmark.coverPath ? (
              <Image source={{ uri: bookmark.coverPath }} style={styles.coverThumbnail} resizeMode="cover" />
            ) : (
              <View style={[styles.coverPlaceholder, { backgroundColor: theme.accent + '20' }]}>
                <Feather name="book" size={14} color={theme.accent} />
              </View>
            )}
            <View style={styles.bookDetails}>
              <Text style={[styles.bookTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                {bookmark.bookTitle || 'Documento'}
              </Text>
              <Text style={[styles.bookAuthor, { color: theme.textSecondary }]} numberOfLines={1}>
                {bookmark.bookAuthor || 'Autor desconocido'} • {bookmark.bookFormat}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerRight}>
            <View style={[styles.pageBadge, { backgroundColor: highlightColor + '25', borderColor: highlightColor + '60' }]}>
              <Text style={[styles.pageBadgeText, { color: theme.textPrimary }]}>
                {getPageDisplay()}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: theme.bg }]}
              onPress={() => onDelete(bookmark.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.6}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Highlighted text snippet & Footer click area */}
        <TouchableOpacity onPress={() => onPress(bookmark)} activeOpacity={0.75}>
          <View
            style={[
              styles.snippetBox,
              {
                backgroundColor: highlightColor + '14',
                borderLeftColor: highlightColor,
              },
            ]}
          >
            <Text style={[styles.snippetText, { color: theme.textPrimary }]} numberOfLines={4}>
              "{bookmark.snippet || bookmark.chapterTitle || 'Sin texto resaltado'}"
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.dateText, { color: theme.textSecondary }]}>
              {formatDate(bookmark.createdAt)}
            </Text>
            <View style={styles.jumpContainer}>
              <Text style={[styles.jumpText, { color: theme.accent }]}>Ir a la lectura</Text>
              <Feather name="arrow-right" size={13} color={theme.accent} />
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    flexDirection: 'row',
  },
  colorBar: {
    width: 6,
    alignSelf: 'stretch',
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bookInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  coverThumbnail: {
    width: 28,
    height: 38,
    borderRadius: 4,
    marginRight: 10,
  },
  coverPlaceholder: {
    width: 28,
    height: 38,
    borderRadius: 4,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookDetails: {
    flex: 1,
  },
  bookTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  bookAuthor: {
    fontSize: 11,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  pageBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  snippetBox: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderLeftWidth: 3.5,
    marginBottom: 10,
  },
  snippetText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  dateText: {
    fontSize: 11,
  },
  jumpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jumpText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
