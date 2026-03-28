import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { SearchResultCard } from '@/components/search-result-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  addArtToCollection,
  createCollection,
  getCollections,
  upsertArtPiece,
  type CollectionRow,
} from '@/database/db';

type SearchResultItem = {
  id?: string;
  edmPreview?: string | string[];
  title?: string | string[];
  dcDescriptionLangAware?: Record<string, string | string[]> | string | string[] | undefined;
  year?: string | number | (string | number)[];
  type?: string;
};

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

export default function HomeScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [selectedItem, setSelectedItem] = useState<SearchResultItem | null>(null);
  const [collectionName, setCollectionName] = useState('');
  const [collectionError, setCollectionError] = useState<string | null>(null);

  const inputBackground = useThemeColor(
    { light: '#F1F3F5', dark: '#1E1F21' },
    'background'
  );
  const inputText = useThemeColor({}, 'text');
  const placeholderText = useThemeColor({ light: '#868E96', dark: '#9BA1A6' }, 'icon');
  const buttonColor = useThemeColor({ light: '#0a7ea4', dark: '#ffffff' }, 'tint');
  const buttonTextColor = useThemeColor({ light: '#ffffff', dark: '#151718' }, 'background');

  const canSearch = useMemo(() => query.trim().length > 0, [query]);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    const apiKey = process.env.EXPO_PUBLIC_API_KEY ?? process.env.API_KEY;
    if (!apiKey) {
      setError("Cle API manquante");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = `https://api.europeana.eu/record/v2/search.json?wskey=${encodeURIComponent(
        apiKey
      )}&query=${encodeURIComponent(
        trimmed
      )}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Request failed');
      }
      const data = await response.json();
      if (Array.isArray(data?.items) && data.items.length > 0) {
        console.log('Europeana first item:', data.items[0]);
      }
      const filteredItems = Array.isArray(data?.items)
        ? data.items.filter((item: any) => {
            const desc = item?.dcDescriptionLangAware?.fr;
            if (!desc) return false;
            if (Array.isArray(desc)) return desc.length > 0 && Boolean(desc[0]);
            return typeof desc === 'string' && desc.length > 0;
          })
        : [];
      setResults(filteredItems);
    } catch (err) {
      setError('Impossible de charger les resultats');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshCollections = () => {
    try {
      setCollections(getCollections());
    } catch (err) {
      setCollections([]);
    }
  };

  const handleOpenModal = (item: SearchResultItem) => {
    setSelectedItem(item);
    setCollectionError(null);
    setIsModalVisible(true);
    refreshCollections();
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setCollectionName('');
    setCollectionError(null);
  };

  const saveArtPiece = (item: SearchResultItem) => {
    const id = item.id;
    if (!id) return;
    const title = getTitle(item.title);
    const year = getFirstValue(item.year);
    const preview = Array.isArray(item.edmPreview) ? item.edmPreview[0] : item.edmPreview;
    upsertArtPiece({
      id,
      title: title || null,
      imageUrl: preview || null,
      year: year || null,
      type: item.type ?? null,
    });
  };

  const handleAddToCollection = (collectionId: number) => {
    if (!selectedItem?.id) return;
    try {
      saveArtPiece(selectedItem);
      addArtToCollection(collectionId, selectedItem.id);
      handleCloseModal();
    } catch (err) {
      setCollectionError("Impossible d'ajouter a la collection");
    }
  };

  const handleCreateCollection = () => {
    const name = collectionName.trim();
    if (!name) {
      setCollectionError('Le nom de collection est requis');
      return;
    }
    if (!selectedItem?.id) return;

    try {
      const collectionId = createCollection(name);
      saveArtPiece(selectedItem);
      addArtToCollection(collectionId, selectedItem.id);
      handleCloseModal();
    } catch (err) {
      setCollectionError('Cette collection existe deja');
    }
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Recherche Europeana</ThemedText>
      </ThemedView>

      <ThemedView style={styles.searchContainer}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher une oeuvre, un artiste..."
          placeholderTextColor={placeholderText}
          style={[styles.searchInput, { backgroundColor: inputBackground, color: inputText }]}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        <Pressable
          onPress={handleSearch}
          disabled={!canSearch || isLoading}
          style={({ pressed }) => [
            styles.searchButton,
            { backgroundColor: buttonColor },
            (!canSearch || isLoading) && styles.searchButtonDisabled,
            pressed && canSearch && !isLoading ? styles.searchButtonPressed : null,
          ]}>
          <ThemedText style={[styles.searchButtonText, { color: buttonTextColor }]}>Rechercher</ThemedText>
        </Pressable>
      </ThemedView>

      {isLoading ? (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" />
          <ThemedText>Chargement...</ThemedText>
        </View>
      ) : null}

      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

      {!isLoading && !error && results.length === 0 ? (
        <ThemedText style={styles.emptyText}>Aucun resultat</ThemedText>
      ) : null}

      {results.map((item, index) => (
        <SearchResultCard
          key={`${item?.id ?? 'result'}-${index}`}
          item={item}
          onAddToCollection={handleOpenModal}
        />
      ))}

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
              value={collectionName}
              onChangeText={setCollectionName}
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
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  searchContainer: {
    gap: 12,
    marginBottom: 16,
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
  },
  searchButtonPressed: {
    opacity: 0.9,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  errorText: {
    marginBottom: 12,
    color: '#E03131',
  },
  emptyText: {
    marginBottom: 12,
    opacity: 0.7,
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
});
