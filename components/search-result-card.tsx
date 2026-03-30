import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export type SearchResultItem = {
  id?: string;
  title?: string;
  artist?: string;
  imageUrl?: string;
  period?: string;
  museum?: string;
  city?: string;
  technique?: string[] | string;
  domain?: string[] | string;
  typeLabel?: string;
};

const ART_TYPES_MAP: Record<string, string> = {
  Q3305213: 'Peinture',
  Q1028181: 'Dessin',
  Q11634: 'Sculpture',
  Q125191: 'Photo',
  Q11060274: 'Gravure',
  Q93184: 'Installation',
  Q870918: 'Tapisserie',
  Q1117439: 'Lithographie',
  Q219423: 'Manuscrit',
  Q17534: 'Fresque',
  Q18761202: 'Numerique',
  Q327313: "Objet d'art",
};

const TYPE_COLOR_MAP: Record<string, string> = {
  Q3305213: '#2F9E44',
  Q1028181: '#F08C00',
  Q11634: '#3B5BDB',
  Q125191: '#7048E8',
  Q11060274: '#E8590C',
  Q93184: '#1C7ED6',
  Q870918: '#D9480F',
  Q1117439: '#5F3DC4',
  Q219423: '#1864AB',
  Q17534: '#C92A2A',
  Q18761202: '#2B8A3E',
  Q327313: '#868E96',
};

function getTypeColor(type?: string) {
  if (!type) return '#868E96';
  if (TYPE_COLOR_MAP[type]) return TYPE_COLOR_MAP[type];
  const normalized = type.toLowerCase();
  if (normalized.includes('peinture')) return '#2F9E44';
  if (normalized.includes('sculpture')) return '#3B5BDB';
  if (normalized.includes('dessin')) return '#F08C00';
  if (normalized.includes('photo')) return '#7048E8';
  if (normalized.includes('gravure')) return '#E8590C';
  return '#868E96';
}

function normalizeTypeLabel(label?: string) {
  if (!label) return '';
  const normalized = label.toLowerCase();
  if (normalized.includes('bande dessin')) return 'Bande dessinee';
  if (normalized.includes('version')) return 'Version';
  if (normalized.includes('edition') || normalized.includes('édition')) return 'Edition';
  if (normalized.includes('traduction')) return 'Traduction';
  return label;
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
  const title = item.title?.trim() ?? '';
  const artist = item.artist?.trim() ?? '';
  const period = item.period?.trim() ?? '';
  const typeId = Array.isArray(item.domain) ? item.domain[0] : item.domain ?? '';
  const fallbackType = typeId.startsWith('Q') ? "Oeuvre d'art" : typeId;
  const typeLabel = normalizeTypeLabel(item.typeLabel);
  const type = typeLabel || ART_TYPES_MAP[typeId] || fallbackType;
  const badgeColor = getTypeColor(typeId || type);
  const preview = item.imageUrl;
  const museumLine = [item.museum, item.city].filter(Boolean).join(' • ');
  const techniqueLine = Array.isArray(item.technique)
    ? item.technique.join(', ')
    : item.technique ?? '';
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
            <View style={[styles.badge, { backgroundColor: badgeColor }]}>
              <ThemedText style={styles.badgeText}>{type}</ThemedText>
            </View>
          ) : null}
          {artist ? <ThemedText style={styles.meta}>Artiste: {artist}</ThemedText> : null}
          {period ? <ThemedText style={styles.meta}>Periode: {period}</ThemedText> : null}
          {museumLine ? <ThemedText style={styles.meta}>{museumLine}</ThemedText> : null}
          {techniqueLine ? <ThemedText style={styles.meta}>{techniqueLine}</ThemedText> : null}
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
  meta: {
    opacity: 0.7,
    fontSize: 13,
  },
});
