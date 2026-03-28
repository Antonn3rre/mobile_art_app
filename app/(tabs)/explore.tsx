import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { createCollection, getCollections, type CollectionRow } from '@/database/db';
import { useFocusEffect } from '@react-navigation/native';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function CollectionsScreen() {
  const router = useRouter();
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
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

  const loadCollections = useCallback(() => {
    try {
      setCollections(getCollections());
    } catch (err) {
      setCollections([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCollections();
    }, [loadCollections])
  );

  const handleOpenModal = () => {
    setCollectionName('');
    setCollectionError(null);
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setCollectionName('');
    setCollectionError(null);
  };

  const handleCreateCollection = () => {
    const name = collectionName.trim();
    if (!name) {
      setCollectionError('Le nom de collection est requis');
      return;
    }

    try {
      createCollection(name);
      handleCloseModal();
      loadCollections();
    } catch (err) {
      setCollectionError('Cette collection existe deja');
    }
  };

  return (
      <ParallaxScrollView
        headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
        headerImage={
          <Image
            source={require('@/assets/images/Galerie_de_vues_de_la_Rome_antique_-_Giovanni_Paolo_Pannini_-_Musée_du_Louvre_Peintures_RF_1944_21.jpg')}
            style={styles.headerArtwork}
            contentFit="cover"
          />
        }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Collections</ThemedText>
        <Pressable
          onPress={handleOpenModal}
          style={({ pressed }) => [styles.addCollectionButton, pressed ? styles.addCollectionButtonPressed : null]}>
          <ThemedText style={styles.addCollectionButtonText}>+</ThemedText>
        </Pressable>
      </ThemedView>

      {collections.length === 0 ? (
        <ThemedText style={styles.emptyText}>Aucune collection pour le moment.</ThemedText>
      ) : (
        <View style={styles.list}>
          {collections.map((collection) => (
            <Pressable
              key={collection.id}
              onPress={() =>
                router.push({
                  pathname: '/collections/[id]',
                  params: { id: String(collection.id), name: collection.name },
                } as any)
              }
              style={({ pressed }) => [
                styles.collectionCard,
                pressed ? styles.collectionCardPressed : null,
              ]}>
              <ThemedText type="defaultSemiBold">{collection.name}</ThemedText>
              <ThemedText style={styles.collectionMeta}>{collection.itemCount} oeuvre(s)</ThemedText>
            </Pressable>
          ))}
        </View>
      )}

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleCloseModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: inputBackground }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="title">Nouvelle collection</ThemedText>
              <Pressable onPress={handleCloseModal} style={styles.closeButton}>
                <ThemedText style={styles.closeButtonText}>Fermer</ThemedText>
              </Pressable>
            </View>

            {collectionError ? (
              <ThemedText style={styles.errorText}>{collectionError}</ThemedText>
            ) : null}

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
  headerArtwork: {
    height: '100%',
    width: '100%',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addCollectionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0a7ea4',
  },
  addCollectionButtonPressed: {
    opacity: 0.8,
  },
  addCollectionButtonText: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  list: {
    gap: 12,
  },
  collectionCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: '#ffffff',
  },
  collectionCardPressed: {
    opacity: 0.85,
  },
  collectionMeta: {
    opacity: 0.7,
    marginTop: 6,
  },
  emptyText: {
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
});
