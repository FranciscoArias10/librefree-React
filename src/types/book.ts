export type BookFormat = 'EPUB' | 'PDF' | 'TXT' | 'AUDIOBOOK' | 'MOBI' | 'FB2';

export type ReadingThemeMode = 'light' | 'sepia' | 'dark' | 'oled';

export interface ReadingSettings {
  fontSize: number; // e.g. 16
  fontFamily: string; // e.g. 'Inter', 'Serif', 'Sans-Serif', 'Georgia', 'Merriweather'
  lineHeight: number; // e.g. 1.5
  marginSize: number; // e.g. 16
  themeMode: ReadingThemeMode; // light, sepia, dark, oled
  textAlignment: 'left' | 'justify' | 'center';
  isContinuousScroll: boolean;
}

export interface Bookmark {
  id: string;
  bookId: string;
  cfiOrPage: string; // CFI string for EPUB or page number for PDF/TXT
  chapterTitle?: string;
  snippet?: string;
  color?: string; // Hex color code for highlight (default: #FACC15)
  createdAt: number;
}

export interface Collection {
  id: string;
  name: string;
  color?: string;
  bookCount?: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  filePath: string;
  coverPath?: string;
  fileSize: number; // in bytes
  addedAt: number; // timestamp
  lastReadAt?: number; // timestamp
  progressPercentage: number; // 0 to 100
  currentLocation?: string; // CFI position or page number
  currentChapter?: string;
  totalPagesOrDuration?: number; // pages for text/pdf or duration in seconds for audio
  genre?: string;
  favorite: boolean;
  collectionId?: string;
  description?: string;
}

export interface AudiobookTrack {
  id: string;
  bookId: string;
  title: string;
  filePath: string;
  durationSeconds: number;
  trackIndex: number;
}
