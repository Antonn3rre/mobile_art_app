import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { SearchResultCard } from '@/components/search-result-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function HomeScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <SearchResultCard key={`${item?.id ?? 'result'}-${index}`} item={item} />
      ))}
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
});
