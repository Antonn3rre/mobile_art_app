import * as SQLite from 'expo-sqlite';

// 1. Ouvrir la connexion (synchrone pour plus de simplicité au début)
const db = SQLite.openDatabaseSync('monapp.db');

export const initDb = () => {
  try {
    // 2. On lance la création des tables
    db.execSync(`
      PRAGMA foreign_keys = ON; -- Active la gestion des liens entre tables

      CREATE TABLE IF NOT EXISTS art_pieces (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT,
        imageUrl TEXT,
        year TEXT,
        type TEXT,
        artist TEXT,
        museum TEXT,
        city TEXT,
        technique TEXT
      );

      CREATE TABLE IF NOT EXISTS collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS collection_members (
        collection_id INTEGER,
        art_piece_id TEXT,
        PRIMARY KEY (collection_id, art_piece_id),
        FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE,
        FOREIGN KEY (art_piece_id) REFERENCES art_pieces (id) ON DELETE CASCADE
      );
    `);
    const columns = db.getAllSync<{ name: string }>('PRAGMA table_info(art_pieces)');
    const columnNames = new Set(columns.map((column) => column.name));
    const missingColumns = [
      { name: 'artist', type: 'TEXT' },
      { name: 'museum', type: 'TEXT' },
      { name: 'city', type: 'TEXT' },
      { name: 'technique', type: 'TEXT' },
    ].filter((column) => !columnNames.has(column.name));

    missingColumns.forEach((column) => {
      db.runSync(`ALTER TABLE art_pieces ADD COLUMN ${column.name} ${column.type}`);
    });
    console.log("Base de données initialisée avec succès");
  } catch (error) {
    console.error("Erreur lors de l'initialisation de la DB", error);
  }
};

export type CollectionRow = {
  id: number;
  name: string;
  created_at: string;
  itemCount: number;
};

export type ArtPieceRow = {
  id: string;
  title: string | null;
  imageUrl: string | null;
  year: string | null;
  type: string | null;
  artist: string | null;
  museum: string | null;
  city: string | null;
  technique: string | null;
};

export const getCollections = () => {
  return db.getAllSync<CollectionRow>(
    `
    SELECT
      c.id,
      c.name,
      c.created_at,
      COUNT(cm.art_piece_id) AS itemCount
    FROM collections c
    LEFT JOIN collection_members cm ON cm.collection_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `
  );
};

export const createCollection = (name: string) => {
  const result = db.runSync('INSERT INTO collections (name) VALUES (?)', [name]);
  return Number(result.lastInsertRowId);
};

export const upsertArtPiece = (artPiece: ArtPieceRow) => {
  db.runSync(
    `
    INSERT INTO art_pieces (id, title, imageUrl, year, type, artist, museum, city, technique)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      imageUrl = excluded.imageUrl,
      year = excluded.year,
      type = excluded.type,
      artist = excluded.artist,
      museum = excluded.museum,
      city = excluded.city,
      technique = excluded.technique
  `,
    [
      artPiece.id,
      artPiece.title,
      artPiece.imageUrl,
      artPiece.year,
      artPiece.type,
      artPiece.artist,
      artPiece.museum,
      artPiece.city,
      artPiece.technique,
    ]
  );
};

export const addArtToCollection = (collectionId: number, artPieceId: string) => {
  db.runSync(
    'INSERT OR IGNORE INTO collection_members (collection_id, art_piece_id) VALUES (?, ?)',
    [collectionId, artPieceId]
  );
};

export const removeArtFromCollection = (collectionId: number, artPieceId: string) => {
  db.runSync('DELETE FROM collection_members WHERE collection_id = ? AND art_piece_id = ?', [
    collectionId,
    artPieceId,
  ]);
};

export const getCollectionItems = (collectionId: number) => {
  return db.getAllSync<ArtPieceRow>(
    `
    SELECT
      ap.id,
      ap.title,
      ap.imageUrl,
      ap.year,
      ap.type,
      ap.artist,
      ap.museum,
      ap.city,
      ap.technique
    FROM art_pieces ap
    INNER JOIN collection_members cm ON cm.art_piece_id = ap.id
    WHERE cm.collection_id = ?
    ORDER BY ap.title COLLATE NOCASE ASC
  `,
    [collectionId]
  );
};

export default db;
