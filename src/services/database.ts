import * as SQLite from 'expo-sqlite';
import { Book, Bookmark, Collection, ReadingSettings, Tag, Profile } from '../types/book';

const DB_NAME = 'ereader_library.db';

export const DEFAULT_SETTINGS: ReadingSettings = {
  themeMode: 'sepia',

  // EPUB / TXT Defaults
  fontSize: 18,
  fontFamily: 'Serif',
  lineHeight: 1.6,
  marginSize: 20,
  textAlignment: 'left',
  isContinuousScroll: false,

  // PDF Specific Defaults
  pdfPageFit: 'fitPage',
  pdfContrast: 'normal',
  pdfInvertColors: false,
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
      profileId TEXT,
      cfiOrPage TEXT NOT NULL,
      chapterTitle TEXT,
      snippet TEXT,
      color TEXT DEFAULT '#FACC15',
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

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      color TEXT
    );

    CREATE TABLE IF NOT EXISTS book_tags (
      bookId TEXT NOT NULL,
      tagId TEXT NOT NULL,
      PRIMARY KEY (bookId, tagId),
      FOREIGN KEY (bookId) REFERENCES books (id) ON DELETE CASCADE,
      FOREIGN KEY (tagId) REFERENCES tags (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT DEFAULT '👤',
      color TEXT DEFAULT '#3B82F6',
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profile_book_progress (
      profileId TEXT NOT NULL,
      bookId TEXT NOT NULL,
      progressPercentage REAL DEFAULT 0,
      currentLocation TEXT,
      currentChapter TEXT,
      lastReadAt INTEGER,
      favorite INTEGER DEFAULT 0,
      PRIMARY KEY (profileId, bookId),
      FOREIGN KEY (profileId) REFERENCES profiles (id) ON DELETE CASCADE,
      FOREIGN KEY (bookId) REFERENCES books (id) ON DELETE CASCADE
    );
  `);

  try {
    await db.execAsync(`ALTER TABLE bookmarks ADD COLUMN color TEXT DEFAULT '#FACC15';`);
  } catch (e) {}

  try {
    await db.execAsync(`ALTER TABLE bookmarks ADD COLUMN profileId TEXT;`);
  } catch (e) {}

  await seedDefaultProfile();
  await seedDefaultTags();
  await removeSampleBooks();
}

async function seedDefaultProfile(): Promise<void> {
  const db = await getDB();
  const existing = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM profiles;');
  if (!existing || !existing[0] || existing[0].count === 0) {
    await db.runAsync(
      `INSERT INTO profiles (id, name, avatar, color, createdAt) VALUES (?, ?, ?, ?, ?);`,
      ['profile_default', 'Principal', '👤', '#3B82F6', Date.now()]
    );
  }

  const activeSetting = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM user_settings WHERE key = 'active_profile_id';`
  );
  if (!activeSetting) {
    await db.runAsync(
      `INSERT OR REPLACE INTO user_settings (key, value) VALUES ('active_profile_id', 'profile_default');`
    );
  }
}

async function seedDefaultTags(): Promise<void> {
  const db = await getDB();
  const existing = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM tags;');
  if (existing && existing[0] && existing[0].count > 0) return;

  const defaultTags = [
    { id: 'tag_estudio', name: 'Estudio', color: '#3B82F6' },
    { id: 'tag_ficcion', name: 'Ficción', color: '#8B5CF6' },
    { id: 'tag_favoritos', name: 'Favoritos', color: '#EF4444' },
    { id: 'tag_por_leer', name: 'Por Leer', color: '#F59E0B' },
  ];

  for (const tag of defaultTags) {
    await db.runAsync(
      `INSERT OR IGNORE INTO tags (id, name, color) VALUES (?, ?, ?);`,
      [tag.id, tag.name, tag.color]
    );
  }
}

async function removeSampleBooks(): Promise<void> {
  const db = await getDB();
  await db.runAsync(`DELETE FROM books WHERE filePath LIKE 'sample_%';`);
}

export async function getAllBooks(): Promise<Book[]> {
  const db = await getDB();
  const activeProfileId = await getActiveProfileId();

  const rows = await db.getAllAsync<any>(
    `SELECT 
       b.id, b.title, b.author, b.format, b.filePath, b.coverPath, b.fileSize, b.addedAt,
       b.totalPagesOrDuration, b.genre, b.collectionId, b.description,
       COALESCE(pbp.progressPercentage, b.progressPercentage, 0) as progressPercentage,
       COALESCE(pbp.currentLocation, b.currentLocation) as currentLocation,
       COALESCE(pbp.currentChapter, b.currentChapter) as currentChapter,
       COALESCE(pbp.lastReadAt, b.lastReadAt) as lastReadAt,
       COALESCE(pbp.favorite, b.favorite, 0) as favorite
     FROM books b
     LEFT JOIN profile_book_progress pbp ON pbp.bookId = b.id AND pbp.profileId = ?
     ORDER BY COALESCE(pbp.lastReadAt, b.lastReadAt) DESC, b.addedAt DESC;`,
    [activeProfileId]
  );
  
  // Get all book tags in one query
  const tagRows = await db.getAllAsync<{ bookId: string; id: string; name: string; color: string }>(
    `SELECT bt.bookId, t.id, t.name, t.color 
     FROM book_tags bt 
     JOIN tags t ON bt.tagId = t.id;`
  );

  const tagsByBook: Record<string, any[]> = {};
  for (const tr of tagRows) {
    if (!tagsByBook[tr.bookId]) tagsByBook[tr.bookId] = [];
    tagsByBook[tr.bookId].push({ id: tr.id, name: tr.name, color: tr.color });
  }

  return rows.map(r => ({
    ...r,
    favorite: Boolean(r.favorite),
    tags: tagsByBook[r.id] || []
  }));
}

export async function getBookById(id: string): Promise<Book | null> {
  const db = await getDB();
  const activeProfileId = await getActiveProfileId();

  const row = await db.getFirstAsync<any>(
    `SELECT 
       b.id, b.title, b.author, b.format, b.filePath, b.coverPath, b.fileSize, b.addedAt,
       b.totalPagesOrDuration, b.genre, b.collectionId, b.description,
       COALESCE(pbp.progressPercentage, b.progressPercentage, 0) as progressPercentage,
       COALESCE(pbp.currentLocation, b.currentLocation) as currentLocation,
       COALESCE(pbp.currentChapter, b.currentChapter) as currentChapter,
       COALESCE(pbp.lastReadAt, b.lastReadAt) as lastReadAt,
       COALESCE(pbp.favorite, b.favorite, 0) as favorite
     FROM books b
     LEFT JOIN profile_book_progress pbp ON pbp.bookId = b.id AND pbp.profileId = ?
     WHERE b.id = ?;`,
    [activeProfileId, id]
  );
  if (!row) return null;

  const tagRows = await db.getAllAsync<{ id: string; name: string; color: string }>(
    `SELECT t.id, t.name, t.color 
     FROM book_tags bt 
     JOIN tags t ON bt.tagId = t.id 
     WHERE bt.bookId = ?;`,
    [id]
  );

  return {
    ...row,
    favorite: Boolean(row.favorite),
    tags: tagRows
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
  const activeProfileId = await getActiveProfileId();

  // Save to active profile's progress
  await db.runAsync(
    `INSERT INTO profile_book_progress (profileId, bookId, progressPercentage, currentLocation, currentChapter, lastReadAt)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(profileId, bookId) DO UPDATE SET 
       progressPercentage = excluded.progressPercentage,
       currentLocation = excluded.currentLocation,
       currentChapter = excluded.currentChapter,
       lastReadAt = excluded.lastReadAt;`,
    [activeProfileId, id, progressPercentage, currentLocation, currentChapter || null, now]
  );

  // Fallback / legacy cache in books table
  await db.runAsync(
    `UPDATE books SET progressPercentage = ?, currentLocation = ?, currentChapter = ?, lastReadAt = ? WHERE id = ?;`,
    [progressPercentage, currentLocation, currentChapter || null, now, id]
  );
}

export async function updateBookFilePath(id: string, newFilePath: string): Promise<void> {
  if (!id || !newFilePath) return;
  const db = await getDB();
  await db.runAsync(`UPDATE books SET filePath = ? WHERE id = ?;`, [newFilePath, id]);
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
  const activeProfileId = await getActiveProfileId();

  await db.runAsync(
    `INSERT INTO profile_book_progress (profileId, bookId, favorite)
     VALUES (?, ?, ?)
     ON CONFLICT(profileId, bookId) DO UPDATE SET favorite = excluded.favorite;`,
    [activeProfileId, id, isFavorite ? 1 : 0]
  );

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
  const activeProfileId = await getActiveProfileId();
  return db.getAllAsync<Bookmark>(
    `SELECT * FROM bookmarks 
     WHERE bookId = ? AND (profileId = ? OR profileId IS NULL)
     ORDER BY createdAt DESC;`,
    [bookId, activeProfileId]
  );
}

export async function getAllBookmarks(): Promise<(Bookmark & { bookTitle: string; bookAuthor: string; bookFormat: string; coverPath?: string })[]> {
  const db = await getDB();
  const activeProfileId = await getActiveProfileId();
  return db.getAllAsync<Bookmark & { bookTitle: string; bookAuthor: string; bookFormat: string; coverPath?: string }>(
    `SELECT b.*, k.title as bookTitle, k.author as bookAuthor, k.format as bookFormat, k.coverPath
     FROM bookmarks b
     JOIN books k ON b.bookId = k.id
     WHERE (b.profileId = ? OR b.profileId IS NULL)
     ORDER BY b.createdAt DESC;`,
    [activeProfileId]
  );
}

export async function addBookmark(bookmark: Omit<Bookmark, 'id' | 'createdAt'>): Promise<Bookmark> {
  const db = await getDB();
  const id = 'bm_' + Math.random().toString(36).substring(2, 10);
  const createdAt = Date.now();
  const color = bookmark.color || '#FACC15';
  const activeProfileId = bookmark.profileId || await getActiveProfileId();
  await db.runAsync(
    `INSERT INTO bookmarks (id, bookId, profileId, cfiOrPage, chapterTitle, snippet, color, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [id, bookmark.bookId, activeProfileId, bookmark.cfiOrPage, bookmark.chapterTitle || null, bookmark.snippet || null, color, createdAt]
  );
  return { ...bookmark, id, profileId: activeProfileId, color, createdAt };
}

export async function deleteBookmark(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM bookmarks WHERE id = ?;', [id]);
}

// --- Profile Management ---

export async function getActiveProfileId(): Promise<string> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM user_settings WHERE key = 'active_profile_id';`
  );
  return row?.value || 'profile_default';
}

export async function getActiveProfile(): Promise<Profile> {
  const db = await getDB();
  const profileId = await getActiveProfileId();
  let row = await db.getFirstAsync<Profile>(`SELECT * FROM profiles WHERE id = ?;`, [profileId]);
  if (!row) {
    row = await db.getFirstAsync<Profile>(`SELECT * FROM profiles ORDER BY createdAt ASC LIMIT 1;`);
  }
  if (!row) {
    return { id: 'profile_default', name: 'Principal', avatar: '👤', color: '#3B82F6', createdAt: Date.now() };
  }
  return row;
}

export async function setActiveProfile(profileId: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO user_settings (key, value) VALUES ('active_profile_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [profileId]
  );
}

export async function getAllProfiles(): Promise<Profile[]> {
  const db = await getDB();
  return db.getAllAsync<Profile>('SELECT * FROM profiles ORDER BY createdAt ASC;');
}

export async function createProfile(name: string, avatar: string = '👤', color: string = '#3B82F6'): Promise<Profile> {
  const db = await getDB();
  const id = 'profile_' + Math.random().toString(36).substring(2, 10);
  const trimmed = name.trim();
  const createdAt = Date.now();
  await db.runAsync(
    `INSERT INTO profiles (id, name, avatar, color, createdAt) VALUES (?, ?, ?, ?, ?);`,
    [id, trimmed, avatar, color, createdAt]
  );
  return { id, name: trimmed, avatar, color, createdAt };
}

export async function updateProfile(id: string, name: string, avatar: string = '👤', color: string = '#3B82F6'): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE profiles SET name = ?, avatar = ?, color = ? WHERE id = ?;`,
    [name.trim(), avatar, color, id]
  );
}

export async function deleteProfile(id: string): Promise<void> {
  const db = await getDB();
  const all = await getAllProfiles();
  if (all.length <= 1) {
    throw new Error('No puedes eliminar el único perfil existente.');
  }
  const activeId = await getActiveProfileId();
  if (activeId === id) {
    const next = all.find((p) => p.id !== id);
    if (next) {
      await setActiveProfile(next.id);
    }
  }
  await db.runAsync(`DELETE FROM profile_book_progress WHERE profileId = ?;`, [id]);
  await db.runAsync(`DELETE FROM bookmarks WHERE profileId = ?;`, [id]);
  await db.runAsync(`DELETE FROM profiles WHERE id = ?;`, [id]);
}

// --- Tag Management ---

export async function getAllTags(): Promise<Tag[]> {
  const db = await getDB();
  return db.getAllAsync<Tag>('SELECT * FROM tags ORDER BY name ASC;');
}

export async function createTag(name: string, color: string = '#3B82F6'): Promise<Tag> {
  const db = await getDB();
  const id = 'tag_' + Math.random().toString(36).substring(2, 10);
  const trimmedName = name.trim();

  await db.runAsync(
    `INSERT INTO tags (id, name, color) VALUES (?, ?, ?);`,
    [id, trimmedName, color]
  );

  return { id, name: trimmedName, color };
}

export async function deleteTag(tagId: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(`DELETE FROM book_tags WHERE tagId = ?;`, [tagId]);
  await db.runAsync(`DELETE FROM tags WHERE id = ?;`, [tagId]);
}

export async function getBookTags(bookId: string): Promise<Tag[]> {
  const db = await getDB();
  return db.getAllAsync<Tag>(
    `SELECT t.id, t.name, t.color 
     FROM book_tags bt 
     JOIN tags t ON bt.tagId = t.id 
     WHERE bt.bookId = ? 
     ORDER BY t.name ASC;`,
    [bookId]
  );
}

export async function setBookTags(bookId: string, tagIds: string[]): Promise<void> {
  const db = await getDB();
  await db.runAsync(`DELETE FROM book_tags WHERE bookId = ?;`, [bookId]);
  for (const tagId of tagIds) {
    await db.runAsync(`INSERT OR IGNORE INTO book_tags (bookId, tagId) VALUES (?, ?);`, [bookId, tagId]);
  }
}

export async function addTagToBooks(bookIds: string[], tagId: string): Promise<void> {
  const db = await getDB();
  for (const bookId of bookIds) {
    await db.runAsync(`INSERT OR IGNORE INTO book_tags (bookId, tagId) VALUES (?, ?);`, [bookId, tagId]);
  }
}

export async function removeTagFromBooks(bookIds: string[], tagId: string): Promise<void> {
  const db = await getDB();
  for (const bookId of bookIds) {
    await db.runAsync(`DELETE FROM book_tags WHERE bookId = ? AND tagId = ?;`, [bookId, tagId]);
  }
}
