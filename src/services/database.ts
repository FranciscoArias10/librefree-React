import * as SQLite from 'expo-sqlite';
import { Book, Bookmark, Collection, ReadingSettings } from '../types/book';

const DB_NAME = 'ereader_library.db';

export const DEFAULT_SETTINGS: ReadingSettings = {
  fontSize: 18,
  fontFamily: 'Serif',
  lineHeight: 1.6,
  marginSize: 20,
  themeMode: 'sepia',
  textAlignment: 'left',
  isContinuousScroll: false,
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbPromise;
}

export async function initDatabase(): Promise<void> {
  const db = await getDB();
  
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      format TEXT NOT NULL,
      filePath TEXT NOT NULL,
      coverPath TEXT,
      fileSize INTEGER DEFAULT 0,
      addedAt INTEGER NOT NULL,
      lastReadAt INTEGER,
      progressPercentage REAL DEFAULT 0,
      currentLocation TEXT,
      currentChapter TEXT,
      totalPagesOrDuration INTEGER DEFAULT 0,
      genre TEXT,
      favorite INTEGER DEFAULT 0,
      collectionId TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS book_texts (
      bookId TEXT PRIMARY KEY NOT NULL,
      extractedText TEXT NOT NULL,
      FOREIGN KEY (bookId) REFERENCES books (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY NOT NULL,
      bookId TEXT NOT NULL,
      cfiOrPage TEXT NOT NULL,
      chapterTitle TEXT,
      snippet TEXT,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (bookId) REFERENCES books (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      color TEXT
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  await removeSampleBooks();
}

async function removeSampleBooks(): Promise<void> {
  const db = await getDB();
  await db.runAsync(`DELETE FROM books WHERE filePath LIKE 'sample_%';`);
}

export async function getAllBooks(): Promise<Book[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>('SELECT * FROM books ORDER BY lastReadAt DESC, addedAt DESC;');
  return rows.map(r => ({
    ...r,
    favorite: Boolean(r.favorite)
  }));
}

export async function getBookById(id: string): Promise<Book | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>('SELECT * FROM books WHERE id = ?;', [id]);
  if (!row) return null;
  return {
    ...row,
    favorite: Boolean(row.favorite)
  };
}

export async function addBook(book: Omit<Book, 'id' | 'addedAt'>): Promise<Book> {
  const db = await getDB();
  const id = 'book_' + Math.random().toString(36).substring(2, 10);
  const addedAt = Date.now();
  
  await db.runAsync(
    `INSERT INTO books (id, title, author, format, filePath, coverPath, fileSize, addedAt, lastReadAt, progressPercentage, currentLocation, currentChapter, totalPagesOrDuration, genre, favorite, collectionId, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      id, book.title, book.author, book.format, book.filePath, book.coverPath || null, book.fileSize, addedAt,
      book.lastReadAt || null, book.progressPercentage || 0, book.currentLocation || null, book.currentChapter || null,
      book.totalPagesOrDuration || 0, book.genre || null, book.favorite ? 1 : 0, book.collectionId || null, book.description || null
    ]
  );

  return {
    ...book,
    id,
    addedAt
  };
}

export async function updateBookProgress(id: string, progressPercentage: number, currentLocation: string, currentChapter?: string): Promise<void> {
  const db = await getDB();
  const now = Date.now();
  await db.runAsync(
    `UPDATE books SET progressPercentage = ?, currentLocation = ?, currentChapter = ?, lastReadAt = ? WHERE id = ?;`,
    [progressPercentage, currentLocation, currentChapter || null, now, id]
  );
}

export async function saveBookCover(id: string, coverPath: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(`UPDATE books SET coverPath = ? WHERE id = ?;`, [coverPath, id]);
}

export async function saveExtractedBookText(bookId: string, extractedText: string): Promise<void> {
  if (!bookId || !extractedText || extractedText.trim().length < 10) return;
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO book_texts (bookId, extractedText) VALUES (?, ?) ON CONFLICT(bookId) DO UPDATE SET extractedText = excluded.extractedText;`,
    [bookId, extractedText.trim()]
  );
}

export async function getExtractedBookText(bookId: string): Promise<string | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ extractedText: string }>('SELECT extractedText FROM book_texts WHERE bookId = ?;', [bookId]);
  return row ? row.extractedText : null;
}

export async function toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
  const db = await getDB();
  await db.runAsync(`UPDATE books SET favorite = ? WHERE id = ?;`, [isFavorite ? 1 : 0, id]);
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(`DELETE FROM books WHERE id = ?;`, [id]);
}

export async function getReadingSettings(): Promise<ReadingSettings> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM user_settings WHERE key = "reading_settings";');
  if (row && row.value) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
}

export async function saveReadingSettings(settings: ReadingSettings): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO user_settings (key, value) VALUES ("reading_settings", ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [JSON.stringify(settings)]
  );
}

export async function getBookmarks(bookId: string): Promise<Bookmark[]> {
  const db = await getDB();
  return db.getAllAsync<Bookmark>('SELECT * FROM bookmarks WHERE bookId = ? ORDER BY createdAt DESC;', [bookId]);
}

export async function addBookmark(bookmark: Omit<Bookmark, 'id' | 'createdAt'>): Promise<Bookmark> {
  const db = await getDB();
  const id = 'bm_' + Math.random().toString(36).substring(2, 10);
  const createdAt = Date.now();
  await db.runAsync(
    `INSERT INTO bookmarks (id, bookId, cfiOrPage, chapterTitle, snippet, createdAt) VALUES (?, ?, ?, ?, ?, ?);`,
    [id, bookmark.bookId, bookmark.cfiOrPage, bookmark.chapterTitle || null, bookmark.snippet || null, createdAt]
  );
  return { ...bookmark, id, createdAt };
}
