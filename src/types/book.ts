export type BookFormat = 'EPUB' | 'PDF' | 'TXT' | 'AUDIOBOOK' | 'MOBI' | 'FB2';

export type ReadingThemeMode = 'light' | 'sepia' | 'dark' | 'oled';
export type PdfPageFit = 'fitPage' | 'fitWidth' | 'fitHeight';
export type PdfContrastMode = 'normal' | 'high' | 'soft';
export type TextAlignmentMode = 'left' | 'justify' | 'center';

export interface ReadingSettings {
  // Shared
  themeMode: ReadingThemeMode; // light, sepia, dark, oled
  selectedVoiceIdentifier?: string;

  // EPUB / TXT Settings (Reflowable Text)
  fontSize: number; // e.g. 16
  fontFamily: string; // e.g. 'Serif', 'Sans-Serif', 'Monospace', 'Georgia', 'Merriweather'
  lineHeight: number; // e.g. 1.6
  marginSize: number; // e.g. 20 (px)
  textAlignment: TextAlignmentMode; // 'left' | 'justify' | 'center'
  isContinuousScroll: boolean;

  // PDF Specific Settings (Fixed Layout)
  pdfPageFit: PdfPageFit; // 'fitPage' | 'fitWidth' | 'fitHeight'
  pdfContrast: PdfContrastMode; // 'normal' | 'high' | 'soft'
  pdfInvertColors?: boolean;
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
