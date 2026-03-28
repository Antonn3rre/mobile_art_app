import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { SearchResultItem } from '@/components/search-result-card';
import {
  addArtToCollection,
  createCollection,
  getCollections,
  removeArtFromCollection,
  upsertArtPiece,
  type CollectionRow,
} from '@/database/db';
import { getArtCache } from '@/store/art-cache';

type ArtItem = SearchResultItem;

export default function ArtDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const rawData = typeof params.data === 'string' ? params.data : '';
  const cacheKey = Array.isArray(params.id) ? params.id[0] : params.id;
  const cached = getArtCache(cacheKey);
  const collectionId = typeof params.collectionId === 'string' ? Number(params.collectionId) : null;
  const collectionName = typeof params.collectionName === 'string' ? params.collectionName : '';

  let item: ArtItem | null = (cached as ArtItem | null) ?? null;
  if (rawData) {
    try {
      item = item ?? (JSON.parse(rawData) as ArtItem);
    } catch (err) {
      item = null;
    }
  }

  const title = item?.title ?? '';
  const artist = item?.artist ?? '';
  const period = item?.period ?? '';
  const domain = Array.isArray(item?.domain) ? item?.domain?.[0] ?? '' : item?.domain ?? '';
  const museum = item?.museum ?? '';
  const city = item?.city ?? '';
  const technique = Array.isArray(item?.technique)
    ? item?.technique.join(', ')
    : item?.technique ?? '';
  const preview = item?.imageUrl ?? '';

  const inputBackground = useThemeColor(
    { light: '#F1F3F5', dark: '#1E1F21' },
    'background'
  );
  const inputText = useThemeColor({}, 'text');
  const placeholderText = useThemeColor({ light: '#868E96', dark: '#9BA1A6' }, 'icon');
  const buttonColor = useThemeColor({ light: '#0a7ea4', dark: '#ffffff' }, 'tint');
  const buttonTextColor = useThemeColor({ light: '#ffffff', dark: '#151718' }, 'background');

  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [collectionNameInput, setCollectionNameInput] = useState('');
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [isRemoveModalVisible, setIsRemoveModalVisible] = useState(false);

  const refreshCollections = () => {
    try {
      setCollections(getCollections());
    } catch (err) {
      setCollections([]);
    }
  };

  const saveArtPiece = () => {
    if (!item?.id) return;
    upsertArtPiece({
      id: item.id,
      title: title || null,
      imageUrl: preview || null,
      year: period || null,
      type: domain || null,
      artist: artist || null,
      museum: museum || null,
      city: city || null,
      technique: technique || null,
    });
  };

  const handleOpenModal = () => {
    setCollectionError(null);
    setIsModalVisible(true);
    refreshCollections();
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setCollectionNameInput('');
    setCollectionError(null);
  };

  const handleAddToCollection = (targetCollectionId: number) => {
    if (!item?.id) return;
    try {
      saveArtPiece();
      addArtToCollection(targetCollectionId, item.id);
      handleCloseModal();
    } catch (err) {
      setCollectionError("Impossible d'ajouter a la collection");
    }
  };

  const handleCreateCollection = () => {
    const name = collectionNameInput.trim();
    if (!name) {
      setCollectionError('Le nom de collection est requis');
      return;
    }
    if (!item?.id) return;

    try {
      const newId = createCollection(name);
      saveArtPiece();
      addArtToCollection(newId, item.id);
      handleCloseModal();
    } catch (err) {
      setCollectionError('Cette collection existe deja');
    }
  };

  const handleConfirmRemove = () => {
    if (!item?.id || !collectionId) return;
    try {
      removeArtFromCollection(collectionId, item.id);
      setIsRemoveModalVisible(false);
      router.back();
    } catch (err) {
      setIsRemoveModalVisible(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {preview ? (
          <Image source={{ uri: preview }} style={styles.hero} contentFit="cover" />
        ) : null}

        <View style={styles.actionsRow}>
          <Pressable onPress={handleOpenModal} style={({ pressed }) => [
            styles.actionButton,
            pressed ? styles.actionButtonPressed : null,
          ]}>
            <ThemedText style={styles.actionButtonText}>Ajouter a une collection</ThemedText>
          </Pressable>
          {collectionId ? (
            <Pressable onPress={() => setIsRemoveModalVisible(true)} style={({ pressed }) => [
              styles.removeButton,
              pressed ? styles.removeButtonPressed : null,
            ]}>
              <ThemedText style={styles.removeButtonText}>Retirer</ThemedText>
            </Pressable>
          ) : null}
        </View>

        <ThemedText type="title" style={styles.title}>
          {title || 'Sans titre'}
        </ThemedText>

        {artist ? (
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Artiste</ThemedText>
            <ThemedText>{artist}</ThemedText>
          </View>
        ) : null}

        {period ? (
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Periode</ThemedText>
            <ThemedText>{period}</ThemedText>
          </View>
        ) : null}

        {domain ? (
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Domaine</ThemedText>
            <ThemedText>{domain}</ThemedText>
          </View>
        ) : null}

        {museum ? (
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Musee</ThemedText>
            <ThemedText>{museum}</ThemedText>
          </View>
        ) : null}

        {city ? (
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Ville</ThemedText>
            <ThemedText>{city}</ThemedText>
          </View>
        ) : null}

        {technique ? (
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Technique</ThemedText>
            <ThemedText>{technique}</ThemedText>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleCloseModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: inputBackground }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="title">Ajouter a une collection</ThemedText>
              <Pressable onPress={handleCloseModal} style={styles.closeButton}>
                <ThemedText style={styles.closeButtonText}>Fermer</ThemedText>
              </Pressable>
            </View>

            {collectionError ? (
              <ThemedText style={styles.errorText}>{collectionError}</ThemedText>
            ) : null}

            <ThemedText style={styles.sectionTitle}>Collections</ThemedText>
            <ScrollView style={styles.collectionList} contentContainerStyle={styles.collectionListContent}>
              {collections.length === 0 ? (
                <ThemedText style={styles.emptyText}>Aucune collection</ThemedText>
              ) : (
                collections.map((collection) => (
                  <Pressable
                    key={collection.id}
                    onPress={() => handleAddToCollection(collection.id)}
                    style={({ pressed }) => [
                      styles.collectionRow,
                      pressed ? styles.collectionRowPressed : null,
                    ]}>
                    <ThemedText>{collection.name}</ThemedText>
                    <ThemedText style={styles.collectionCount}>{collection.itemCount}</ThemedText>
                  </Pressable>
                ))
              )}
            </ScrollView>

            <ThemedText style={styles.sectionTitle}>Nouvelle collection</ThemedText>
            <TextInput
              value={collectionNameInput}
              onChangeText={setCollectionNameInput}
              placeholder="Nom de la collection"
              placeholderTextColor={placeholderText}
              style={[styles.searchInput, { backgroundColor: '#ffffff', color: inputText }]}
            />
            <Pressable
              onPress={handleCreateCollection}
              style={({ pressed }) => [
                styles.searchButton,
                { backgroundColor: buttonColor },
                pressed ? styles.searchButtonPressed : null,
              ]}>
              <ThemedText style={[styles.searchButtonText, { color: buttonTextColor }]}>Creer</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isRemoveModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsRemoveModalVisible(false)}>
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmCard, { backgroundColor: inputBackground }]}>
            <ThemedText type="defaultSemiBold" style={styles.confirmTitle}>
              Etes vous certain de vouloir supprimer l'oeuvre de {collectionName || 'cette collection'} ?
            </ThemedText>
            <View style={styles.confirmActions}>
              <Pressable onPress={() => setIsRemoveModalVisible(false)} style={styles.confirmButton}>
                <ThemedText style={styles.confirmButtonText}>Annuler</ThemedText>
              </Pressable>
              <Pressable onPress={handleConfirmRemove} style={styles.deleteButton}>
                <ThemedText style={styles.deleteButtonText}>Supprimer</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  hero: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    backgroundColor: '#E9ECEF',
    marginBottom: 16,
  },
  title: {
    marginBottom: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0a7ea4',
  },
  actionButtonPressed: {
    opacity: 0.8,
  },
  actionButtonText: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  removeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#E03131',
  },
  removeButtonPressed: {
    opacity: 0.85,
  },
  removeButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  metaRow: {
    marginBottom: 12,
  },
  emptyText: {
    opacity: 0.7,
  },
  metaLabel: {
    opacity: 0.6,
    marginBottom: 4,
  },
  descriptionBlock: {
    marginTop: 8,
  },
  descriptionText: {
    opacity: 0.85,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  closeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  closeButtonText: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  sectionTitle: {
    marginTop: 12,
    marginBottom: 8,
    fontWeight: '700',
  },
  collectionList: {
    maxHeight: 180,
  },
  collectionListContent: {
    gap: 8,
    paddingBottom: 8,
  },
  collectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  collectionRowPressed: {
    opacity: 0.8,
  },
  collectionCount: {
    opacity: 0.6,
  },
  searchInput: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  searchButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  searchButtonPressed: {
    opacity: 0.9,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    marginBottom: 12,
    color: '#E03131',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmCard: {
    borderRadius: 16,
    padding: 20,
    width: '100%',
  },
  confirmTitle: {
    marginBottom: 16,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  confirmButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#adb5bd',
  },
  confirmButtonText: {
    color: '#495057',
    fontWeight: '600',
  },
  deleteButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#E03131',
  },
  deleteButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
