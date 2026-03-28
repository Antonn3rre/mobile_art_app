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
        type TEXT
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
    INSERT INTO art_pieces (id, title, imageUrl, year, type)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      imageUrl = excluded.imageUrl,
      year = excluded.year,
      type = excluded.type
  `,
    [
      artPiece.id,
      artPiece.title,
      artPiece.imageUrl,
      artPiece.year,
      artPiece.type,
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
      ap.type
    FROM art_pieces ap
    INNER JOIN collection_members cm ON cm.art_piece_id = ap.id
    WHERE cm.collection_id = ?
    ORDER BY ap.title COLLATE NOCASE ASC
  `,
    [collectionId]
  );
};

export default db;
