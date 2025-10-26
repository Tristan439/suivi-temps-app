import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Button, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getStages, addStage, deleteStage } from '../services/firebase';
import { colors, fontSizes, spacing } from '../styles/global';

interface Stage {
  id: string;
  nom: string;
}

const StagesScreen = () => {
  const [stages, setStages] = useState<Stage[]>([]);
  const [newStageName, setNewStageName] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchStages = async () => {
    setLoading(true);
    try {
      const fetchedStages = await getStages();
      setStages(fetchedStages as Stage[]);
    } catch (error) {
      console.error("Error fetching stages:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchStages();
    }, [])
  );

  const handleAddStage = async () => {
    if (newStageName.trim() === '') {
      Alert.alert('Erreur', 'Le nom du stage ne peut pas être vide.');
      return;
    }
    try {
      await addStage(newStageName);
      setNewStageName('');
      fetchStages(); // Refresh the list
    } catch (error) {
      console.error("Error adding stage:", error);
      Alert.alert('Erreur', 'Impossible d\'ajouter le stage.');
    }
  };

  const handleDeleteStage = (stageId: string) => {
    Alert.alert(
      'Confirmer la suppression',
      'Voulez-vous vraiment supprimer ce stage ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteStage(stageId);
              fetchStages(); // Refresh the list
            } catch (error) {
              console.error("Error deleting stage:", error);
              Alert.alert('Erreur', 'Impossible de supprimer le stage.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Stage }) => (
    <View style={styles.item}>
      <Text style={styles.itemText}>{item.nom}</Text>
      <TouchableOpacity onPress={() => handleDeleteStage(item.id)} style={styles.deleteButton}>
        <Text style={styles.deleteButtonText}>Supprimer</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.addStageContainer}>
        <TextInput
          style={styles.input}
          placeholder="Nom du nouveau stage"
          value={newStageName}
          onChangeText={setNewStageName}
        />
        <Button title="Ajouter Stage" onPress={handleAddStage} color={colors.primary} />
      </View>

      {loading ? (
        <Text>Chargement...</Text>
      ) : (
        <FlatList
          data={stages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.emptyListText}>Aucun stage trouvé.</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.medium,
  },
  addStageContainer: {
    marginBottom: spacing.large,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.secondary,
    padding: spacing.medium,
    marginBottom: spacing.medium,
    borderRadius: 5,
    backgroundColor: colors.white,
    fontSize: fontSizes.body,
  },
  item: {
    backgroundColor: colors.white,
    padding: spacing.medium,
    borderRadius: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.medium,
  },
  itemText: {
    fontSize: fontSizes.body,
    color: colors.text,
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: 5,
  },
  deleteButtonText: {
    color: colors.white,
    fontWeight: 'bold',
  },
  emptyListText: {
    textAlign: 'center',
    marginTop: spacing.large,
    fontSize: fontSizes.subtitle,
    color: colors.secondary,
  },
});

export default StagesScreen;