import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

type LangAwareValue = Record<string, string | string[]> | string | string[] | undefined;

type SearchResultItem = {
  id?: string;
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

export function SearchResultCard({
  item,
  onAddToCollection,
  onRemoveFromCollection,
  onPress,
}: {
  item: SearchResultItem;
  onAddToCollection?: (item: SearchResultItem) => void;
  onRemoveFromCollection?: (item: SearchResultItem) => void;
  onPress?: (item: SearchResultItem) => void;
}) {
  const title = getTitle(item.title);
  const descriptionRaw = getLangText(item.dcDescriptionLangAware, 'fr');
  const description = truncateDescription(descriptionRaw, 10);
  const year = getFirstValue(item.year);
  const type = item.type ?? '';
  const preview = Array.isArray(item.edmPreview) ? item.edmPreview[0] : item.edmPreview;
  const canAdd = Boolean(onAddToCollection && item.id);

  const cardContent = (
    <ThemedView style={styles.card}>
      <View style={styles.row}>
        {preview ? (
          <Image source={{ uri: preview }} style={styles.preview} contentFit="cover" />
        ) : (
          <View style={styles.previewPlaceholder} />
        )}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <ThemedText type="defaultSemiBold" numberOfLines={2} style={styles.titleText}>
              {title || 'Sans titre'}
            </ThemedText>
            <View style={styles.actions}>
              {onAddToCollection ? (
                <Pressable
                  disabled={!canAdd}
                  onPress={() => {
                    if (canAdd) {
                      onAddToCollection(item);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.addButton,
                    pressed && canAdd ? styles.addButtonPressed : null,
                    !canAdd ? styles.addButtonDisabled : null,
                  ]}>
                  <ThemedText style={styles.addButtonText}>+</ThemedText>
                </Pressable>
              ) : null}
              {onRemoveFromCollection ? (
                <Pressable
                  onPress={() => onRemoveFromCollection(item)}
                  style={({ pressed }) => [
                    styles.removeButton,
                    pressed ? styles.removeButtonPressed : null,
                  ]}>
                  <ThemedText style={styles.removeButtonText}>-</ThemedText>
                </Pressable>
              ) : null}
            </View>
          </View>
          {type ? (
            <View style={[styles.badge, { backgroundColor: getTypeColor(type) }]}>
              <ThemedText style={styles.badgeText}>{type}</ThemedText>
            </View>
          ) : null}
          {description ? (
            <ThemedText style={styles.description}>{description}</ThemedText>
          ) : null}
          {year ? <ThemedText style={styles.meta}>Annee: {year}</ThemedText> : null}
        </View>
      </View>
    </ThemedView>
  );

  if (onPress) {
    return (
      <Pressable onPress={() => onPress(item)} style={({ pressed }) => [pressed ? styles.cardPressed : null]}>
        {cardContent}
      </Pressable>
    );
  }

  return cardContent;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  cardPressed: {
    opacity: 0.9,
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
  titleText: {
    flex: 1,
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#0a7ea4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressed: {
    opacity: 0.7,
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  addButtonText: {
    color: '#0a7ea4',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E03131',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonPressed: {
    opacity: 0.7,
  },
  removeButtonText: {
    color: '#E03131',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  description: {
    opacity: 0.8,
  },
  meta: {
    opacity: 0.7,
    fontSize: 13,
  },
});
