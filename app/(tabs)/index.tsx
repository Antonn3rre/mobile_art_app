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
import { SearchResultCard, type SearchResultItem } from '@/components/search-result-card';
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

type WikidataSearchItem = {
  id: string;
  label?: string;
  description?: string;
};

type WikidataEntity = {
  id: string;
  labels?: Record<string, string>;
  descriptions?: Record<string, string>;
  statements?: Record<string, Array<{ value?: { content?: unknown } }>>;
};

const entityCache = new Map<string, WikidataEntity | null>();
const labelCache = new Map<string, string>();

function getString(value: string | undefined | null) {
  return value?.trim() ?? '';
}

function getLabel(labels?: Record<string, string>) {
  if (!labels) return '';
  return labels.fr || labels.en || Object.values(labels)[0] || '';
}

function getStatementValues(entity: WikidataEntity, property: string) {
  const statements = entity.statements?.[property] ?? [];
  return statements
    .map((statement) => statement.value?.content)
    .filter((value): value is NonNullable<unknown> => Boolean(value));
}

function formatTimeValue(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'time' in value) {
    const timeValue = String((value as { time?: string }).time ?? '');
    const match = timeValue.match(/-?\d{4}/);
    return match ? match[0] : timeValue;
  }
  return '';
}

function buildImageUrl(filename?: string) {
  if (!filename) return undefined;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}`;
}

async function fetchEntity(id: string) {
  if (entityCache.has(id)) {
    return entityCache.get(id) ?? null;
  }
  try {
    const response = await fetch(
      `https://www.wikidata.org/w/rest.php/wikibase/v1/entities/items/${id}`,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'ArtApp/1.0 (contact@example.com)',
          Accept: 'application/json',
        },
      }
    );
    if (!response.ok) {
      entityCache.set(id, null);
      return null;
    }
    const data = (await response.json()) as WikidataEntity;
    entityCache.set(id, data);
    return data;
  } catch (err) {
    entityCache.set(id, null);
    return null;
  }
}

async function getEntityLabel(id: string) {
  if (labelCache.has(id)) {
    return labelCache.get(id) ?? '';
  }
  const entity = await fetchEntity(id);
  const label = getLabel(entity?.labels) || id;
  labelCache.set(id, label);
  return label;
}

async function resolveValueToLabel(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') {
    if (value.startsWith('Q')) {
      return await getEntityLabel(value);
    }
    return value;
  }
  return '';
}

async function resolveValuesToLabels(values: unknown[]) {
  const labels = await Promise.all(values.map((value) => resolveValueToLabel(value)));
  return labels.filter(Boolean);
}

function extractYear(value?: string) {
  if (!value) return null;
  const match = value.match(/\b(\d{4})\b/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isNaN(parsed) ? null : parsed;
}

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
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
    const authorValue = author.trim();
    const titleValue = title.trim();

    if (showAdvanced) {
      const yearFromValue = yearFrom.trim();
      const yearToValue = yearTo.trim();
      const mediaTypeValue = mediaType.trim().toUpperCase();

      if (authorValue) filters.push(`author:${authorValue}`);
      if (titleValue) filters.push(`title:${titleValue}`);
      if (yearFromValue) filters.push(`yearFrom:${yearFromValue}`);
      if (yearToValue) filters.push(`yearTo:${yearToValue}`);
      if (mediaTypeValue) filters.push(`media:${mediaTypeValue}`);
    }

    const searchTerm = trimmed || authorValue || titleValue;

    if (!searchTerm && filters.length === 0) {
      setResults([]);
      return;
    }

    if (!searchTerm) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        action: 'wbsearchentities',
        search: searchTerm,
        language: 'fr',
        format: 'json',
        limit: '30',
        origin: '*',
      });
      const requestUrl = `https://www.wikidata.org/w/api.php?${params.toString()}`;
      console.log('Wikidata search URL:', requestUrl);
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'ArtApp/1.0 (contact@example.com)',
          Accept: 'application/json',
        },
      });
      console.log('Wikidata search status:', response.status);
      if (!response.ok) {
        throw new Error('Request failed');
      }
      const data = await response.json();
      const items = Array.isArray(data?.search) ? data.search : [];
      console.log('Wikidata search count:', items.length);

      const normalized = (await Promise.all(
        items.map(async (item: WikidataSearchItem) => {
          const entity = await fetchEntity(item.id);
          if (!entity) return null;

          const title = getLabel(entity.labels) || item.label || 'Sans titre';
          labelCache.set(entity.id, title);

          const imageValue = getStatementValues(entity, 'P18')[0];
          const imageUrl = buildImageUrl(
            typeof imageValue === 'string' ? imageValue : undefined
          );

          const artistLabels = await resolveValuesToLabels([
            ...getStatementValues(entity, 'P170'),
            ...getStatementValues(entity, 'P50'),
          ]);
          const artist = artistLabels[0] || 'Artiste inconnu';

          const periodValue = getStatementValues(entity, 'P571')[0];
          const period = formatTimeValue(periodValue) || undefined;

          const museumLabels = await resolveValuesToLabels([
            ...getStatementValues(entity, 'P195'),
            ...getStatementValues(entity, 'P276'),
          ]);
          const museum = museumLabels[0] || undefined;

          const cityLabels = await resolveValuesToLabels(
            getStatementValues(entity, 'P131')
          );
          const city = cityLabels[0] || undefined;

          const techniqueLabels = await resolveValuesToLabels([
            ...getStatementValues(entity, 'P186'),
            ...getStatementValues(entity, 'P2079'),
          ]);

          const domainLabels = await resolveValuesToLabels(
            getStatementValues(entity, 'P31')
          );

          return {
            id: entity.id,
            title,
            artist,
            imageUrl,
            period,
            museum,
            city,
            technique: techniqueLabels.length ? techniqueLabels : undefined,
            domain: domainLabels.length ? domainLabels : undefined,
          } satisfies SearchResultItem;
        })
      )) as Array<SearchResultItem | null>;

      const filteredNormalized = normalized.filter(
        (item): item is SearchResultItem => Boolean(item)
      );

      const filtered = showAdvanced
        ? filteredNormalized.filter((item: SearchResultItem) => {
            const authorValue = author.trim().toLowerCase();
            const titleValue = title.trim().toLowerCase();
            const mediaValue = mediaType.trim().toLowerCase();
            const yearFromValue = yearFrom.trim();
            const yearToValue = yearTo.trim();

          const artistValue = (item.artist ?? '').toLowerCase();
          const titleText = (item.title ?? '').toLowerCase();

          if (authorValue && !artistValue.includes(authorValue)) {
            return false;
          }
          if (titleValue && !titleText.includes(titleValue)) {
            return false;
          }

          const itemYear = extractYear(item.period ?? '') ?? null;
          if (yearFromValue) {
            const from = Number(yearFromValue);
            if (!Number.isNaN(from) && (!itemYear || itemYear < from)) {
              return false;
            }
          }
          if (yearToValue) {
            const to = Number(yearToValue);
            if (!Number.isNaN(to) && (!itemYear || itemYear > to)) {
              return false;
            }
          }

          if (mediaValue) {
            const domainValues = Array.isArray(item.domain)
              ? item.domain
              : item.domain
                ? [item.domain]
                : [];
            const techniqueValues = Array.isArray(item.technique)
              ? item.technique
              : item.technique
                ? [item.technique]
                : [];
            const haystack = [...domainValues, ...techniqueValues].join(' ').toLowerCase();
            if (!haystack.includes(mediaValue)) {
              return false;
            }
          }

          return true;
        })
        : filteredNormalized;

      setResults(filtered);
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
    const domainValue = Array.isArray(item.domain) ? item.domain[0] : item.domain;
    upsertArtPiece({
      id,
      title: item.title || null,
      imageUrl: item.imageUrl ?? null,
      year: item.period ?? null,
      type: domainValue ?? null,
      artist: item.artist ?? null,
      museum: item.museum ?? null,
      city: item.city ?? null,
      technique: Array.isArray(item.technique)
        ? item.technique.join(', ')
        : item.technique ?? null,
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
        <ThemedText type="title">Recherche Wikidata</ThemedText>
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
              {['PEINTURE', 'SCULPTURE', 'DESSIN', 'OBJET'].map((typeValue) => (
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
