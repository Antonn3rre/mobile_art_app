import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type LangAwareValue = Record<string, string | string[]> | string | string[] | undefined;

type SearchResultItem = {
  edmPreview?: string | string[];
  title?: string | string[];
  dcDescriptionLangAware?: LangAwareValue;
  year?: string | number | (string | number)[];
  type?: string;
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

function truncateDescription(text: string, limit: number) {
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
}

function getTypeColor(type?: string) {
  switch ((type ?? '').toUpperCase()) {
    case 'IMAGE':
      return '#2F9E44';
    case 'SOUND':
      return '#3B5BDB';
    case 'TEXT':
      return '#F08C00';
    default:
      return '#868E96';
  }
}

export function SearchResultCard({ item }: { item: SearchResultItem }) {
  const title = getTitle(item.title);
  const descriptionRaw = getLangText(item.dcDescriptionLangAware, 'fr');
  const description = truncateDescription(descriptionRaw, 10);
  const year = getFirstValue(item.year);
  const type = item.type ?? '';
  const preview = Array.isArray(item.edmPreview) ? item.edmPreview[0] : item.edmPreview;

  return (
    <ThemedView style={styles.card}>
      <View style={styles.row}>
        {preview ? (
          <Image source={{ uri: preview }} style={styles.preview} contentFit="cover" />
        ) : (
          <View style={styles.previewPlaceholder} />
        )}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <ThemedText type="defaultSemiBold" numberOfLines={2}>
              {title || 'Sans titre'}
            </ThemedText>
            {type ? (
              <View style={[styles.badge, { backgroundColor: getTypeColor(type) }]}> 
                <ThemedText style={styles.badgeText}>{type}</ThemedText>
              </View>
            ) : null}
          </View>
          {description ? (
            <ThemedText style={styles.description}>{description}</ThemedText>
          ) : null}
          {year ? <ThemedText style={styles.meta}>Annee: {year}</ThemedText> : null}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  preview: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: '#E9ECEF',
  },
  previewPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: '#E9ECEF',
  },
  content: {
    flex: 1,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  description: {
    opacity: 0.8,
  },
  meta: {
    opacity: 0.7,
    fontSize: 13,
  },
});
