import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import {
  addEntreeTemps,
  deleteEntreeTemps,
  getCumulsParCategorie,
  getEntreesParMois,
  getStages,
  updateEntreeTemps,
} from '../services/firebase';
import SelectInput, { SelectOption } from '../components/SelectInput';
import { colors, fontSizes, spacing } from '../styles/global';

interface Stage {
  id: string;
  nom: string;
}

const categorieOptions: SelectOption[] = [
  { label: 'Travail', value: 'Travail' },
  { label: 'Supervision', value: 'Supervision' },
  { label: 'Contact client', value: 'Contact client' },
  { label: 'Autres', value: 'Autres' },
];

const HomeScreen = () => {
  const [entrees, setEntrees] = useState<any[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedStage, setSelectedStage] = useState<string | undefined>();
  const [cumuls, setCumuls] = useState<{ [key: string]: number }>({});
  const [date, setDate] = useState(new Date());
  const [modalVisible, setModalVisible] = useState(false);
  const [manualDuree, setManualDuree] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualCategorie, setManualCategorie] = useState('Autres');
  const [loading, setLoading] = useState(true);
  const [entryModalVisible, setEntryModalVisible] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [entryDescription, setEntryDescription] = useState('');
  const [entryCategorie, setEntryCategorie] = useState('Autres');
  const [entryDuree, setEntryDuree] = useState('');
  const [entryStage, setEntryStage] = useState<string | undefined>();
  const [entryDateInfo, setEntryDateInfo] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    try {
      const [fetchedEntrees, fetchedCumuls, fetchedStages] = await Promise.all([
        getEntreesParMois(year, month, selectedStage),
        getCumulsParCategorie(year, month, selectedStage),
        getStages(),
      ]);

      setEntrees(fetchedEntrees);
      setCumuls(fetchedCumuls);
      const typedStages = (Array.isArray(fetchedStages) ? fetchedStages : []) as Stage[];
      setStages(typedStages);

      if (typedStages.length > 0) {
        if (!selectedStage) {
          setSelectedStage(typedStages[0].id);
        } else if (!typedStages.some((stage) => stage.id === selectedStage)) {
          setSelectedStage(typedStages[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Erreur', 'Impossible de récupérer les données.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [date, selectedStage]),
  );

  const handleAjoutManuel = async () => {
    const duree = parseInt(manualDuree, 10);
    if (Number.isNaN(duree) || duree <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer une durée valide en minutes.');
      return;
    }
    if (!selectedStage) {
      Alert.alert('Erreur', 'Veuillez sélectionner un stage.');
      return;
    }

    try {
      await addEntreeTemps({
        dureeSecondes: duree * 60,
        description: manualDescription,
        categorie: manualCategorie,
        date: new Date(),
        stageId: selectedStage,
        type: 'manuel',
      });
      setModalVisible(false);
      setManualDuree('');
      setManualDescription('');
      fetchData();
    } catch (error) {
      console.error('Error adding manual entry:', error);
      Alert.alert('Erreur', "Impossible d'ajouter l'entrée manuellement.");
    }
  };

  const changeMonth = (increment: number) => {
    setDate((prevDate) => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() + increment);
      return newDate;
    });
  };

  const closeEntryModal = () => {
    setEntryModalVisible(false);
    setSelectedEntry(null);
    setEntryDescription('');
    setEntryCategorie('Autres');
    setEntryDuree('');
    setEntryStage(undefined);
    setEntryDateInfo('');
  };

  const openEntryModal = (entry: any) => {
    const minutesValue = entry.dureeSecondes ? entry.dureeSecondes / 60 : 0;
    const formattedMinutes = Number.isInteger(minutesValue)
      ? String(minutesValue)
      : minutesValue.toFixed(2);
    const stageValue = entry.stageId || selectedStage;
    const entryDate =
      entry.date instanceof Date
        ? entry.date
        : entry.date?.seconds
        ? new Date(entry.date.seconds * 1000)
        : new Date();

    setSelectedEntry(entry);
    setEntryDescription(entry.description || '');
    setEntryCategorie(entry.categorie || 'Autres');
    setEntryDuree(formattedMinutes);
    setEntryStage(stageValue);
    setEntryDateInfo(entryDate.toLocaleString());
    setEntryModalVisible(true);
  };

  const handleUpdateEntry = async () => {
    if (!selectedEntry) {
      return;
    }

    const parsedMinutes = parseFloat(entryDuree.replace(',', '.'));
    if (Number.isNaN(parsedMinutes) || parsedMinutes <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer une durée valide en minutes.');
      return;
    }

    const stageIdToSave = entryStage || selectedEntry.stageId;
    if (!stageIdToSave) {
      Alert.alert('Erreur', 'Veuillez sélectionner un stage.');
      return;
    }

    try {
      await updateEntreeTemps(selectedEntry.id, {
        description: entryDescription,
        categorie: entryCategorie,
        stageId: stageIdToSave,
        dureeSecondes: Math.round(parsedMinutes * 60),
      });
      closeEntryModal();
      fetchData();
    } catch (error) {
      console.error('Error updating entry:', error);
      Alert.alert('Erreur', "Impossible de mettre à jour l'entrée.");
    }
  };

  const confirmDeleteEntry = () => {
    if (!selectedEntry) {
      return;
    }

    Alert.alert(
      'Supprimer cette entrée ?',
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEntreeTemps(selectedEntry.id);
              closeEntryModal();
              fetchData();
            } catch (error) {
              console.error('Error deleting entry:', error);
              Alert.alert('Erreur', "Impossible de supprimer l'entrée.");
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.item} activeOpacity={0.8} onPress={() => openEntryModal(item)}>
      <View style={styles.itemTextContainer}>
        <Text style={styles.itemDescription}>{item.description || 'N/A'}</Text>
        <Text style={styles.itemDate}>
          {new Date(item.date.seconds * 1000).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.itemDuration}>{Math.floor(item.dureeSecondes / 60)} min</Text>
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyListContainer}>
      <Text style={styles.emptyListText}>Aucune entrée pour ce mois.</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {loading && !modalVisible ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.container}>
          <Modal
            animationType="slide"
            transparent
            visible={modalVisible}
            onRequestClose={() => setModalVisible(false)}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>
                <Text style={styles.modalTitle}>Ajouter une entrée manuellement</Text>
                <TextInput
                  placeholder="Durée en minutes"
                  value={manualDuree}
                  onChangeText={setManualDuree}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  placeholder="Description"
                  value={manualDescription}
                  onChangeText={setManualDescription}
                  style={styles.input}
                />
                <SelectInput
                  value={manualCategorie}
                  options={categorieOptions}
                  onValueChange={setManualCategorie}
                  placeholder="Catégorie"
                  style={styles.modalSelect}
                />
                <TouchableOpacity style={styles.primaryButton} onPress={handleAjoutManuel}>
                  <Text style={styles.primaryButtonText}>Ajouter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, styles.secondaryButton]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={[styles.primaryButtonText, styles.secondaryButtonText]}>
                    Annuler
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal
            animationType="slide"
            transparent
            visible={entryModalVisible}
            onRequestClose={closeEntryModal}
          >
            <View style={styles.centeredView}>
              <View style={styles.modalView}>
                <Text style={styles.modalTitle}>Modifier l'entrée</Text>
                {entryDateInfo || selectedEntry?.type ? (
                  <Text style={styles.modalSubtitle}>
                    {entryDateInfo}
                    {selectedEntry?.type ? ` • ${selectedEntry.type}` : ''}
                  </Text>
                ) : null}
                <SelectInput
                  value={entryStage}
                  onValueChange={setEntryStage}
                  options={stages.map((stage) => ({ label: stage.nom, value: stage.id }))}
                  placeholder="Sélectionner un stage"
                  style={styles.modalSelect}
                />
                <SelectInput
                  value={entryCategorie}
                  options={categorieOptions}
                  onValueChange={setEntryCategorie}
                  placeholder="Catégorie"
                  style={styles.modalSelect}
                />
                <TextInput
                  placeholder="Description"
                  value={entryDescription}
                  onChangeText={setEntryDescription}
                  style={styles.input}
                />
                <TextInput
                  placeholder="Durée en minutes"
                  value={entryDuree}
                  onChangeText={setEntryDuree}
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TouchableOpacity style={styles.primaryButton} onPress={handleUpdateEntry}>
                  <Text style={styles.primaryButtonText}>Enregistrer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, styles.destructiveButton]}
                  onPress={confirmDeleteEntry}
                >
                  <Text style={styles.primaryButtonText}>Supprimer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, styles.secondaryButton]}
                  onPress={closeEntryModal}
                >
                  <Text style={[styles.primaryButtonText, styles.secondaryButtonText]}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <View style={styles.header}>
            <View style={styles.monthSelector}>
              <TouchableOpacity style={styles.monthButton} onPress={() => changeMonth(-1)}>
                <Ionicons name="chevron-back" size={22} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.monthText}>
                {date.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity style={styles.monthButton} onPress={() => changeMonth(1)}>
                <Ionicons name="chevron-forward" size={22} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <SelectInput
              value={selectedStage}
              onValueChange={setSelectedStage}
              options={stages.map((stage) => ({ label: stage.nom, value: stage.id }))}
              placeholder={stages.length === 0 ? 'Aucun stage disponible' : 'Sélectionner un stage'}
              disabled={stages.length === 0}
            />
          </View>

          <View style={styles.cumulsContainer}>
            {Object.keys(cumuls).length === 0 ? (
              <Text style={styles.emptyCumuls}>Aucun cumul pour ce mois.</Text>
            ) : (
              Object.entries(cumuls).map(([categorie, duree]) => (
                <View key={categorie} style={styles.cumulItem}>
                  <Text style={styles.cumulCategorie}>{categorie}</Text>
                  <Text style={styles.cumulDuree}>{Math.floor(duree / 60)} min</Text>
                </View>
              ))
            )}
          </View>

          <FlatList
            data={entrees}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={renderEmptyList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={entrees.length === 0 ? styles.listWithEmptyState : undefined}
          />

          <View style={styles.footer}>
            <TouchableOpacity style={styles.primaryButton} onPress={() => setModalVisible(true)}>
              <Text style={styles.primaryButtonText}>Ajout Manuel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.large,
    paddingTop: spacing.large,
  },
  header: {
    marginBottom: spacing.large,
    gap: spacing.medium,
  },
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  monthText: {
    fontSize: fontSizes.title,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'capitalize',
  },
  cumulsContainer: {
    marginBottom: spacing.large,
    padding: spacing.medium,
    backgroundColor: colors.white,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    gap: spacing.small,
  },
  cumulItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cumulCategorie: {
    fontSize: fontSizes.subtitle,
    color: colors.text,
    fontWeight: '500',
  },
  cumulDuree: {
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    color: colors.primary,
  },
  item: {
    backgroundColor: colors.white,
    padding: spacing.medium,
    borderRadius: 12,
    marginBottom: spacing.small,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  itemTextContainer: {
    flex: 1,
    paddingRight: spacing.medium,
  },
  itemDescription: {
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    color: colors.text,
  },
  itemDate: {
    fontSize: fontSizes.body,
    color: colors.secondary,
    marginTop: 4,
  },
  itemDuration: {
    fontSize: fontSizes.subtitle,
    fontWeight: '700',
    color: colors.primary,
  },
  footer: {
    paddingVertical: spacing.large,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.medium,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: colors.lightGray,
    marginTop: spacing.small,
  },
  secondaryButtonText: {
    color: colors.text,
  },
  destructiveButton: {
    backgroundColor: '#dc3545',
    marginTop: spacing.small,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: spacing.large,
  },
  modalView: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.large,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  modalTitle: {
    fontSize: fontSizes.title,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.large,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: fontSizes.body,
    color: colors.secondary,
    marginBottom: spacing.medium,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    padding: spacing.medium,
    borderRadius: 10,
    marginBottom: spacing.medium,
    backgroundColor: colors.white,
    fontSize: fontSizes.body,
  },
  modalSelect: {
    marginBottom: spacing.medium,
  },
  emptyListContainer: {
    paddingVertical: spacing.large,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: fontSizes.subtitle,
    color: colors.secondary,
  },
  listWithEmptyState: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyCumuls: {
    textAlign: 'center',
    fontSize: fontSizes.body,
    color: colors.secondary,
  },
});

export default HomeScreen;
