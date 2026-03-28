import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  addArtToCollection,
  createCollection,
  getCollections,
  removeArtFromCollection,
  upsertArtPiece,
  type CollectionRow,
} from '@/database/db';
import { getArtCache } from '@/store/art-cache';

type LangAwareValue = Record<string, string | string[]> | string | string[] | undefined;

type ArtItem = {
  id?: string;
  edmPreview?: string | string[];
  edmIsShownBy?: string | string[];
  edmIsShownAt?: string | string[];
  edmObject?: string | string[];
  title?: string | string[];
  dcDescriptionLangAware?: LangAwareValue;
  dcCreator?: string | string[];
  dcCreatorLangAware?: LangAwareValue;
  year?: string | number | (string | number)[];
  type?: string;
  country?: string | string[];
  dataProvider?: string | string[];
  provider?: string | string[];
};

function getLangText(value: LangAwareValue, lang: string) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? '';
  const langValue = value[lang];
  if (!langValue) return '';
  return Array.isArray(langValue) ? langValue[0] ?? '' : langValue;
}

function getFirstValue(value: string | number | (string | number)[] | undefined) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return String(value[0] ?? '');
  return String(value);
}

function getTitle(value: string | string[] | undefined) {
  if (!value) return '';
  if (Array.isArray(value)) return value[0] ?? '';
  return value;
}

function getText(value: string | string[] | undefined) {
  if (!value) return '';
  if (Array.isArray(value)) return value[0] ?? '';
  return value;
}

function getPreviewUrl(item: ArtItem | null) {
  if (!item) return '';
  const candidates = [
    item.edmPreview,
    item.edmIsShownBy,
    item.edmIsShownAt,
    item.edmObject,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (Array.isArray(candidate)) return candidate[0] ?? '';
    return candidate;
  }
  return '';
}

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

  const title = getTitle(item?.title);
  const description =
    getLangText(item?.dcDescriptionLangAware, 'fr') ||
    getLangText(item?.dcDescriptionLangAware, 'en');
  const creator =
    getLangText(item?.dcCreatorLangAware, 'fr') ||
    getLangText(item?.dcCreatorLangAware, 'en') ||
    getText(item?.dcCreator);
  const year = getFirstValue(item?.year);
  const type = item?.type ?? '';
  const country = getText(item?.country);
  const dataProvider = getText(item?.dataProvider);
  const provider = getText(item?.provider);
  const preview = getPreviewUrl(item);

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
      year: year || null,
      type: item.type ?? null,
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

        {creator ? (
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Createur</ThemedText>
            <ThemedText>{creator}</ThemedText>
          </View>
        ) : null}

        {year ? (
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Annee</ThemedText>
            <ThemedText>{year}</ThemedText>
          </View>
        ) : null}

        {type ? (
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Type</ThemedText>
            <ThemedText>{type}</ThemedText>
          </View>
        ) : null}

        {country ? (
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Pays</ThemedText>
            <ThemedText>{country}</ThemedText>
          </View>
        ) : null}

        {dataProvider ? (
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Institution</ThemedText>
            <ThemedText>{dataProvider}</ThemedText>
          </View>
        ) : null}

        {provider ? (
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaLabel}>Fournisseur</ThemedText>
            <ThemedText>{provider}</ThemedText>
          </View>
        ) : null}

        {description ? (
          <View style={styles.descriptionBlock}>
            <ThemedText type="defaultSemiBold" style={styles.metaLabel}>
              Description
            </ThemedText>
            <ThemedText style={styles.descriptionText}>{description}</ThemedText>
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
