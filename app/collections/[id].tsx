import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { SearchResultCard, type SearchResultItem } from '@/components/search-result-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  addArtToCollection,
  createCollection,
  getCollectionItems,
  getCollections,
  removeArtFromCollection,
  upsertArtPiece,
  type ArtPieceRow,
  type CollectionRow,
} from '@/database/db';
import { useFocusEffect } from '@react-navigation/native';
import { setArtCache } from '@/store/art-cache';

function toSearchItem(row: ArtPieceRow): SearchResultItem {
  return {
    id: row.id,
    title: row.title ?? '',
    imageUrl: row.imageUrl ?? undefined,
    period: row.year ?? undefined,
    domain: row.type ?? undefined,
    artist: row.artist ?? undefined,
    museum: row.museum ?? undefined,
    city: row.city ?? undefined,
    technique: row.technique ?? undefined,
  };
}

export default function CollectionDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const collectionId = useMemo(() => Number(params.id), [params.id]);
  const collectionName = typeof params.name === 'string' ? params.name : 'Collection';

  const inputBackground = useThemeColor(
    { light: '#F1F3F5', dark: '#1E1F21' },
    'background'
  );
  const inputText = useThemeColor({}, 'text');
  const placeholderText = useThemeColor({ light: '#868E96', dark: '#9BA1A6' }, 'icon');
  const buttonColor = useThemeColor({ light: '#0a7ea4', dark: '#ffffff' }, 'tint');
  const buttonTextColor = useThemeColor({ light: '#ffffff', dark: '#151718' }, 'background');

  const [items, setItems] = useState<ArtPieceRow[]>([]);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [selectedItem, setSelectedItem] = useState<SearchResultItem | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [collectionNameInput, setCollectionNameInput] = useState('');
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<SearchResultItem | null>(null);
  const [isRemoveModalVisible, setIsRemoveModalVisible] = useState(false);

  const refreshCollections = useCallback(() => {
    try {
      setCollections(getCollections());
    } catch (err) {
      setCollections([]);
    }
  }, []);

  const refreshItems = useCallback(() => {
    if (!collectionId) return;
    try {
      setItems(getCollectionItems(collectionId));
    } catch (err) {
      setItems([]);
    }
  }, [collectionId]);

  useFocusEffect(
    useCallback(() => {
      refreshItems();
      refreshCollections();
    }, [refreshItems, refreshCollections])
  );

  const handleOpenModal = (item: SearchResultItem) => {
    setSelectedItem(item);
    setCollectionError(null);
    setIsModalVisible(true);
    refreshCollections();
  };

  const handleOpenRemoveModal = (item: SearchResultItem) => {
    setRemoveTarget(item);
    setIsRemoveModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setCollectionNameInput('');
    setCollectionError(null);
  };

  const handleCloseRemoveModal = () => {
    setIsRemoveModalVisible(false);
    setRemoveTarget(null);
  };

  const handleAddToCollection = (targetCollectionId: number) => {
    if (!selectedItem?.id) return;
    try {
      upsertArtPiece({
        id: selectedItem.id,
        title: selectedItem.title ?? null,
        imageUrl: selectedItem.imageUrl ?? null,
        year: selectedItem.period ?? null,
        type: Array.isArray(selectedItem.domain) ? selectedItem.domain[0] : selectedItem.domain ?? null,
        artist: selectedItem.artist ?? null,
        museum: selectedItem.museum ?? null,
        city: selectedItem.city ?? null,
        technique: Array.isArray(selectedItem.technique)
          ? selectedItem.technique.join(', ')
          : selectedItem.technique ?? null,
      });
      addArtToCollection(targetCollectionId, selectedItem.id);
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
    if (!selectedItem?.id) return;

    try {
      const newId = createCollection(name);
      handleAddToCollection(newId);
    } catch (err) {
      setCollectionError('Cette collection existe deja');
    }
  };

  const handleConfirmRemove = () => {
    if (!removeTarget?.id || !collectionId) return;
    try {
      removeArtFromCollection(collectionId, removeTarget.id);
      handleCloseRemoveModal();
      refreshItems();
    } catch (err) {
      handleCloseRemoveModal();
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>
          {collectionName}
        </ThemedText>

        {items.length === 0 ? (
          <ThemedText style={styles.emptyText}>Aucune oeuvre dans cette collection.</ThemedText>
        ) : (
          items.map((item) => (
            <SearchResultCard
              key={item.id}
              item={toSearchItem(item)}
              onAddToCollection={handleOpenModal}
              onRemoveFromCollection={handleOpenRemoveModal}
              onPress={() =>
                (() => {
                  const cachedItem = toSearchItem(item);
                  setArtCache(cachedItem);
                  router.push({
                    pathname: '/art/[id]',
                    params: {
                      id: String(item.id),
                      collectionId: String(collectionId),
                      collectionName,
                    },
                  } as any);
                })()
              }
            />
          ))
        )}
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
        onRequestClose={handleCloseRemoveModal}>
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmCard, { backgroundColor: inputBackground }]}>
            <ThemedText type="defaultSemiBold" style={styles.confirmTitle}>
              Etes vous certain de vouloir supprimer l'oeuvre de {collectionName} ?
            </ThemedText>
            <View style={styles.confirmActions}>
              <Pressable onPress={handleCloseRemoveModal} style={styles.confirmButton}>
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
  title: {
    marginBottom: 12,
  },
  emptyText: {
    opacity: 0.7,
    marginBottom: 12,
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
