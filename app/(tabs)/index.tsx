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
import { useRouter } from 'expo-router';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { SearchResultCard } from '@/components/search-result-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { setArtCache } from '@/store/art-cache';
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

function buildFieldQuery(field: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const tokens = trimmed
    .split(/\s+/)
    .map((token) => token.replace(/"/g, ''))
    .filter(Boolean);
  if (tokens.length === 0) return null;
  const exact = `${field}:"${tokens.join(' ')}"`;
  const wildcard = tokens.map((token) => `${field}:${token}*`).join(' AND ');
  return `(${exact} OR (${wildcard}))`;
}

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [selectedItem, setSelectedItem] = useState<SearchResultItem | null>(null);
  const [collectionName, setCollectionName] = useState('');
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [author, setAuthor] = useState('');
  const [title, setTitle] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [mediaType, setMediaType] = useState('');

  const inputBackground = useThemeColor(
    { light: '#F1F3F5', dark: '#1E1F21' },
    'background'
  );
  const inputText = useThemeColor({}, 'text');
  const placeholderText = useThemeColor({ light: '#868E96', dark: '#9BA1A6' }, 'icon');
  const buttonColor = useThemeColor({ light: '#0a7ea4', dark: '#ffffff' }, 'tint');
  const buttonTextColor = useThemeColor({ light: '#ffffff', dark: '#151718' }, 'background');

  const canSearch = useMemo(() => {
    if (!showAdvanced) {
      return query.trim().length > 0;
    }

    return (
      query.trim().length > 0 ||
      author.trim().length > 0 ||
      title.trim().length > 0 ||
      yearFrom.trim().length > 0 ||
      yearTo.trim().length > 0 ||
      mediaType.trim().length > 0
    );
  }, [author, mediaType, query, showAdvanced, title, yearFrom, yearTo]);

  const handleSearch = async () => {
    const trimmed = query.trim();
    const filters: string[] = [];
    const queryParts: string[] = [];

    if (trimmed) {
      queryParts.push(trimmed);
    }

    if (showAdvanced) {
      const authorValue = author.trim();
      const titleValue = title.trim();
      const yearFromValue = yearFrom.trim();
      const yearToValue = yearTo.trim();
      const mediaTypeValue = mediaType.trim().toUpperCase();

      const authorQuery = buildFieldQuery('who', authorValue);
      const titleQuery = buildFieldQuery('title', titleValue);
      if (authorQuery) {
        queryParts.push(authorQuery);
      }
      if (titleQuery) {
        queryParts.push(titleQuery);
      }
      if (yearFromValue && yearToValue) {
        filters.push(`YEAR:[${yearFromValue} TO ${yearToValue}]`);
      } else if (yearFromValue) {
        filters.push(`YEAR:${yearFromValue}`);
      } else if (yearToValue) {
        filters.push(`YEAR:${yearToValue}`);
      }
      if (mediaTypeValue) {
        filters.push(`TYPE:${mediaTypeValue}`);
      }
    }

    if (queryParts.length === 0 && filters.length === 0) {
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
      const params = new URLSearchParams({
        wskey: apiKey,
        query: queryParts.length > 0 ? queryParts.join(' AND ') : '*',
        thumbnail: 'true',
        rows: '15',
        profile: 'minimal',
      });
      filters.forEach((filter) => {
        params.append('qf', filter);
      });
      const response = await fetch(`https://api.europeana.eu/record/v2/search.json?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Request failed');
      }
      const data = await response.json();
      if (Array.isArray(data?.items) && data.items.length > 0) {
        console.log('Europeana first item:', data.items[0]);
      }
      const items = Array.isArray(data?.items) ? data.items : [];
      setResults(items);
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
            source={require('@/assets/images/L_etang_aux_nympheas_de_Claude_Monet_copie.jpg')}
            style={styles.headerArtwork}
            contentFit="cover"
          />
        }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Recherche Europeana</ThemedText>
      </ThemedView>

      <ThemedView style={styles.searchContainer}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Mot-cle (ex: Monet, paysage...)"
          placeholderTextColor={placeholderText}
          style={[styles.searchInput, { backgroundColor: inputBackground, color: inputText }]}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        <Pressable
          onPress={() => {
            setShowAdvanced((prev) => {
              const next = !prev;
              if (!next) {
                setAuthor('');
                setTitle('');
                setYearFrom('');
                setYearTo('');
                setMediaType('');
              }
              return next;
            });
          }}
          style={({ pressed }) => [
            styles.advancedToggle,
            pressed ? styles.advancedTogglePressed : null,
          ]}>
          <ThemedText style={styles.advancedToggleText}>
            {showAdvanced ? 'Masquer recherche avancee' : 'Recherche avancee'}
          </ThemedText>
        </Pressable>
        {showAdvanced ? (
          <View style={styles.advancedSection}>
            <TextInput
              value={author}
              onChangeText={setAuthor}
              placeholder="Auteur / createur"
              placeholderTextColor={placeholderText}
              style={[styles.searchInput, { backgroundColor: inputBackground, color: inputText }]}
            />
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Titre"
              placeholderTextColor={placeholderText}
              style={[styles.searchInput, { backgroundColor: inputBackground, color: inputText }]}
            />
            <View style={styles.yearRow}>
              <TextInput
                value={yearFrom}
                onChangeText={setYearFrom}
                placeholder="Annee de"
                placeholderTextColor={placeholderText}
                keyboardType="number-pad"
                style={[styles.searchInput, styles.yearInput, { backgroundColor: inputBackground, color: inputText }]}
              />
              <TextInput
                value={yearTo}
                onChangeText={setYearTo}
                placeholder="Annee a"
                placeholderTextColor={placeholderText}
                keyboardType="number-pad"
                style={[styles.searchInput, styles.yearInput, { backgroundColor: inputBackground, color: inputText }]}
              />
            </View>
            <View style={styles.typeRow}>
              {['IMAGE', 'VIDEO', 'SOUND', 'TEXT'].map((typeValue) => (
                <Pressable
                  key={typeValue}
                  onPress={() =>
                    setMediaType((prev) => (prev === typeValue ? '' : typeValue))
                  }
                  style={({ pressed }) => [
                    styles.typeChip,
                    mediaType === typeValue ? styles.typeChipActive : null,
                    pressed ? styles.typeChipPressed : null,
                  ]}>
                  <ThemedText
                    style={
                      mediaType === typeValue
                        ? styles.typeChipTextActive
                        : styles.typeChipText
                    }>
                    {typeValue}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
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
          onPress={(selected) => {
            if (!selected?.id) return;
            setArtCache(selected);
            router.push({
              pathname: '/art/[id]',
              params: {
                id: String(selected.id),
              },
            } as any);
          }}
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
  headerArtwork: {
    height: '100%',
    width: '100%',
  },
  searchContainer: {
    gap: 12,
    marginBottom: 16,
  },
  advancedToggle: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0a7ea4',
  },
  advancedTogglePressed: {
    opacity: 0.8,
  },
  advancedToggleText: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  advancedSection: {
    gap: 10,
  },
  yearRow: {
    flexDirection: 'row',
    gap: 10,
  },
  yearInput: {
    flex: 1,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#0a7ea4',
  },
  typeChipActive: {
    backgroundColor: '#0a7ea4',
  },
  typeChipPressed: {
    opacity: 0.8,
  },
  typeChipText: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
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
