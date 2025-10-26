import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { colors, fontSizes, spacing } from '../styles/global';
import {
  addTaskCard,
  addTaskList,
  deleteTaskCard,
  deleteTaskList,
  getTaskLists,
  getEntreesForTaskCard,
  updateTaskCard,
  updateTaskList,
} from '../services/firebase';

interface TaskCard {
  id: string;
  title: string;
}

interface TaskList {
  id: string;
  title: string;
  cards: TaskCard[];
}

interface TaskEntry {
  id: string;
  date: any;
  dureeSecondes?: number;
  description?: string;
  categorie?: string;
  stageId?: string;
  type?: string;
}

const toDate = (value: any) => {
  if (value instanceof Date) {
    return value;
  }
  if (value?.seconds) {
    return new Date(value.seconds * 1000);
  }
  return new Date(value);
};

const formatEntryTimestamp = (value: any) => {
  const date = toDate(value);
  return `${date.toLocaleDateString()} • ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const secondsToHuman = (seconds = 0) => {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${minutes} min`;
  }
  return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
};

const TasksScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [lists, setLists] = useState<TaskList[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddList, setShowAddList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [addingList, setAddingList] = useState(false);

  const [cardInputs, setCardInputs] = useState<Record<string, string>>({});
  const [activeCardListId, setActiveCardListId] = useState<string | null>(null);
  const [addingCardListId, setAddingCardListId] = useState<string | null>(null);

  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListTitle, setEditingListTitle] = useState('');
  const [savingListId, setSavingListId] = useState<string | null>(null);

  const [editingCard, setEditingCard] = useState<{ listId: string; cardId: string } | null>(null);
  const [editingCardTitle, setEditingCardTitle] = useState('');
  const [savingCard, setSavingCard] = useState<{ listId: string; cardId: string } | null>(null);
  const [cardDetails, setCardDetails] = useState<{ listId: string; listTitle: string; card: TaskCard } | null>(null);
  const [cardEntries, setCardEntries] = useState<TaskEntry[]>([]);
  const [cardEntriesLoading, setCardEntriesLoading] = useState(false);

  const isAddListDisabled = useMemo(() => newListTitle.trim().length === 0, [newListTitle]);
  const totalTrackedSeconds = useMemo(
    () => cardEntries.reduce((acc, entry) => acc + (entry.dureeSecondes ?? 0), 0),
    [cardEntries],
  );

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const fetched = await getTaskLists();
      setLists(
        fetched.map((list) => ({
          id: list.id,
          title: list.title,
          cards: (list.cards || []).map((card) => ({ id: card.id, title: card.title })),
        })),
      );
      setCardInputs({});
    } catch (error) {
      console.error('Error loading task lists:', error);
      Alert.alert('Erreur', 'Impossible de charger les listes de tâches.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLists();
    }, [fetchLists]),
  );

  const handleAddList = async () => {
    const trimmed = newListTitle.trim();
    if (trimmed.length === 0) {
      return;
    }
    setAddingList(true);
    try {
      await addTaskList(trimmed);
      setNewListTitle('');
      setShowAddList(false);
      await fetchLists();
    } catch (error) {
      console.error('Error adding list:', error);
      Alert.alert('Erreur', 'Impossible de créer la liste.');
    } finally {
      setAddingList(false);
    }
  };

  const handleCancelAddList = () => {
    setNewListTitle('');
    setShowAddList(false);
  };

  const handleAddCard = async (listId: string) => {
    const value = cardInputs[listId]?.trim() || '';
    if (value.length === 0) {
      return;
    }
    setAddingCardListId(listId);
    try {
      await addTaskCard(listId, value);
      setCardInputs((prev) => ({ ...prev, [listId]: '' }));
      setActiveCardListId(null);
      await fetchLists();
    } catch (error) {
      console.error('Error adding card:', error);
      Alert.alert('Erreur', 'Impossible de créer la carte.');
    } finally {
      setAddingCardListId(null);
    }
  };

  const handleCancelAddCard = () => {
    setActiveCardListId(null);
  };

  const startEditList = (list: TaskList) => {
    setEditingListId(list.id);
    setEditingListTitle(list.title);
  };

  const submitEditList = async () => {
    if (!editingListId) {
      return;
    }
    const trimmed = editingListTitle.trim();
    if (trimmed.length === 0) {
      Alert.alert('Nom requis', 'Veuillez saisir un nom de liste.');
      return;
    }
    setSavingListId(editingListId);
    try {
      await updateTaskList(editingListId, { title: trimmed });
      setEditingListId(null);
      setEditingListTitle('');
      await fetchLists();
    } catch (error) {
      console.error('Error updating list:', error);
      Alert.alert('Erreur', 'Impossible de renommer la liste.');
    } finally {
      setSavingListId(null);
    }
  };

  const confirmDeleteList = (listId: string) => {
    Alert.alert('Supprimer cette liste ?', 'Toutes les cartes de cette liste seront aussi supprimées.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTaskList(listId);
            if (editingListId === listId) {
              setEditingListId(null);
            }
            await fetchLists();
          } catch (error) {
            console.error('Error deleting list:', error);
            Alert.alert('Erreur', 'Impossible de supprimer la liste.');
          }
        },
      },
    ]);
  };

  const startEditCard = (listId: string, card: TaskCard) => {
    setEditingCard({ listId, cardId: card.id });
    setEditingCardTitle(card.title);
  };

  const submitEditCard = async () => {
    if (!editingCard) {
      return;
    }
    const trimmed = editingCardTitle.trim();
    if (trimmed.length === 0) {
      Alert.alert('Titre requis', 'Veuillez saisir un titre de carte.');
      return;
    }
    setSavingCard(editingCard);
    try {
      await updateTaskCard(editingCard.listId, editingCard.cardId, { title: trimmed });
      setEditingCard(null);
      setEditingCardTitle('');
      await fetchLists();
    } catch (error) {
      console.error('Error updating card:', error);
      Alert.alert('Erreur', 'Impossible de modifier la carte.');
    } finally {
      setSavingCard(null);
    }
  };

  const confirmDeleteCard = (listId: string, cardId: string) => {
    Alert.alert('Supprimer cette carte ?', '', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTaskCard(listId, cardId);
            if (editingCard && editingCard.cardId === cardId) {
              setEditingCard(null);
              setEditingCardTitle('');
            }
            await fetchLists();
          } catch (error) {
            console.error('Error deleting card:', error);
            Alert.alert('Erreur', 'Impossible de supprimer la carte.');
          }
        },
      },
    ]);
  };

  const loadCardEntries = useCallback(
    async (card: TaskCard) => {
      setCardEntriesLoading(true);
      try {
        const fetchedEntries = await getEntreesForTaskCard(card.id);
        const normalized = fetchedEntries
          .map((entry: any) => ({
            id: entry.id,
            ...entry,
            date: toDate(entry.date),
          }))
          .sort((a, b) => b.date.getTime() - a.date.getTime());
        setCardEntries(normalized);
      } catch (error) {
        console.error('Error fetching task card entries:', error);
        Alert.alert('Erreur', "Impossible de charger les entrées de temps de cette carte.");
      } finally {
        setCardEntriesLoading(false);
      }
    },
    [],
  );

  const openCardDetails = (list: TaskList, card: TaskCard) => {
    setCardDetails({ listId: list.id, listTitle: list.title, card });
    setCardEntries([]);
    loadCardEntries(card).catch(() => {});
  };

  const closeCardDetails = () => {
    setCardDetails(null);
    setCardEntries([]);
    setCardEntriesLoading(false);
  };

  const handleStartCardPomodoro = (card: TaskCard) => {
    navigation.navigate('Pomodoro', {
      preselectedCategory: 'autres_pomodoro',
      autoStart: true,
      initialDescription: card.title,
      taskCardId: card.id,
    });
  };

  const handleModalEdit = () => {
    if (!cardDetails) {
      return;
    }
    const { listId, card } = cardDetails;
    closeCardDetails();
    setTimeout(() => startEditCard(listId, card), 150);
  };

  const handleModalDelete = () => {
    if (!cardDetails) {
      return;
    }
    const { listId, card } = cardDetails;
    closeCardDetails();
    setTimeout(() => confirmDeleteCard(listId, card.id), 150);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.boardContent,
          { paddingBottom: spacing.large + insets.bottom + spacing.large },
        ]}
      >
        {loading ? (
          <View style={styles.feedbackColumn}>
            <ActivityIndicator size="small" color={colors.white} />
            <Text style={styles.feedbackText}>Chargement...</Text>
          </View>
        ) : lists.length === 0 ? (
          <View style={styles.feedbackColumn}>
            <Ionicons name="sparkles-outline" size={20} color={colors.white} />
            <Text style={styles.feedbackText}>Ajoutez votre première liste pour démarrer.</Text>
          </View>
        ) : null}

        {lists.map((list) => (
          <View key={list.id} style={styles.listColumn}>
            {editingListId === list.id ? (
              <View style={styles.listHeaderEditing}>
                <TextInput
                  style={styles.listEditInput}
                  value={editingListTitle}
                  onChangeText={setEditingListTitle}
                  autoFocus
                />
                <View style={styles.listHeaderActions}>
                  <TouchableOpacity
                    style={[styles.primaryButtonSm, editingListTitle.trim().length === 0 && styles.disabledButton]}
                    onPress={submitEditList}
                    disabled={editingListTitle.trim().length === 0 || savingListId === list.id}
                  >
                    <Text style={styles.primaryButtonText}>OK</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButtonSm}
                    onPress={() => {
                      setEditingListId(null);
                      setEditingListTitle('');
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.listHeader}>
                <Text style={styles.listTitle}>{list.title}</Text>
                <View style={styles.listHeaderIcons}>
                  <TouchableOpacity onPress={() => startEditList(list)} hitSlop={8}>
                    <Ionicons name="pencil" size={18} color={colors.secondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDeleteList(list.id)} hitSlop={8}>
                    <Ionicons name="trash" size={18} color="#dc3545" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.cardsContainer}>
              {list.cards.length === 0 ? (
                <Text style={styles.emptyState}>Aucune carte pour l&apos;instant.</Text>
              ) : (
                list.cards.map((card) => {
                  const isEditing = editingCard && editingCard.cardId === card.id;
                  if (isEditing) {
                    return (
                      <View key={card.id} style={styles.card}>
                        <TextInput
                          style={styles.cardEditInput}
                          value={editingCardTitle}
                          onChangeText={setEditingCardTitle}
                          autoFocus
                        />
                        <View style={styles.addCardActions}>
                          <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={submitEditCard}
                            disabled={savingCard?.cardId === card.id || editingCardTitle.trim().length === 0}
                          >
                            <Text style={styles.primaryButtonText}>Enregistrer</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => {
                              setEditingCard(null);
                              setEditingCardTitle('');
                            }}
                          >
                            <Text style={styles.secondaryButtonText}>Annuler</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <TouchableOpacity
                      key={card.id}
                      style={styles.cardTouchable}
                      activeOpacity={0.9}
                      onPress={() => openCardDetails(list, card)}
                    >
                      <View style={styles.card}>
                        <View style={styles.cardHeader}>
                          <Text style={styles.cardTitle}>{card.title}</Text>
                          <Ionicons name="information-circle-outline" size={18} color={colors.secondary} />
                        </View>
                        <View style={styles.cardQuickActions}>
                          <TouchableOpacity
                            style={styles.cardPomodoroButton}
                            onPress={(event: GestureResponderEvent) => {
                              event.stopPropagation();
                              handleStartCardPomodoro(card);
                            }}
                            hitSlop={8}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="flame-outline" size={18} color={colors.white} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            {activeCardListId === list.id ? (
              <View style={styles.addCardContainer}>
                <TextInput
                  style={styles.cardInput}
                  placeholder="Titre de la carte"
                  value={cardInputs[list.id] ?? ''}
                  onChangeText={(text) =>
                    setCardInputs((prev) => ({
                      ...prev,
                      [list.id]: text,
                    }))
                  }
                />
                <View style={styles.addCardActions}>
                  <TouchableOpacity style={styles.primaryButton} onPress={() => handleAddCard(list.id)}>
                    <Text style={styles.primaryButtonText}>
                      {addingCardListId === list.id ? 'Ajout...' : 'Ajouter'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryButton} onPress={handleCancelAddCard}>
                    <Text style={styles.secondaryButtonText}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addCardButton}
                onPress={() => {
                  setActiveCardListId(list.id);
                  setCardInputs((prev) => ({ ...prev, [list.id]: '' }));
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={styles.addCardText}>Ajouter une carte</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <View style={styles.addListColumn}>
          {showAddList ? (
            <View style={styles.addListContainer}>
              <TextInput
                style={styles.listInput}
                placeholder="Nom de la liste"
                value={newListTitle}
                onChangeText={setNewListTitle}
              />
              <View style={styles.addListActions}>
                <TouchableOpacity
                  style={[styles.primaryButton, (isAddListDisabled || addingList) && styles.disabledButton]}
                  onPress={handleAddList}
                  disabled={isAddListDisabled || addingList}
                >
                  <Text style={styles.primaryButtonText}>{addingList ? 'Création...' : 'Créer'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleCancelAddList}>
                  <Text style={styles.secondaryButtonText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addListButton} onPress={() => setShowAddList(true)}>
              <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
              <Text style={styles.addListText}>Ajouter une liste</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      <Modal
        visible={!!cardDetails}
        transparent
        animationType="fade"
        onRequestClose={closeCardDetails}
      >
        <TouchableWithoutFeedback onPress={closeCardDetails}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>{cardDetails?.card.title}</Text>
                    <Text style={styles.modalSubtitle}>
                      {cardDetails ? `Liste : ${cardDetails.listTitle}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={closeCardDetails} hitSlop={8}>
                    <Ionicons name="close" size={22} color={colors.darkGray} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalSummaryRow}>
                  <Ionicons name="time-outline" size={18} color={colors.primary} />
                  <Text style={styles.modalSummaryLabel}>Temps suivi</Text>
                  <Text style={styles.modalSummaryValue}>{secondsToHuman(totalTrackedSeconds)}</Text>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.modalEditButton]}
                    onPress={handleModalEdit}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="pencil" size={18} color={colors.white} />
                    <Text style={styles.modalActionText}>Modifier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.modalDeleteButton]}
                    onPress={handleModalDelete}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="trash" size={18} color={colors.white} />
                    <Text style={styles.modalActionText}>Supprimer</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.modalRefreshButton}
                  onPress={() => cardDetails && loadCardEntries(cardDetails.card)}
                  activeOpacity={0.85}
                  disabled={cardEntriesLoading}
                >
                  <Ionicons
                    name="refresh"
                    size={16}
                    color={cardEntriesLoading ? 'rgba(255,255,255,0.7)' : colors.white}
                  />
                  <Text style={styles.modalRefreshText}>
                    {cardEntriesLoading ? 'Actualisation...' : 'Actualiser'}
                  </Text>
                </TouchableOpacity>

                {cardEntriesLoading ? (
                  <View style={styles.modalLoader}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.modalLoaderText}>Chargement des entrées...</Text>
                  </View>
                ) : cardEntries.length === 0 ? (
                  <View style={styles.modalEmpty}>
                    <Ionicons name="moon-outline" size={24} color={colors.secondary} />
                    <Text style={styles.modalEmptyText}>
                      Aucune entrée liée à cette carte pour l&apos;instant.
                    </Text>
                  </View>
                ) : (
                  <ScrollView style={styles.modalEntries}>
                    {cardEntries.map((entry) => (
                      <View key={entry.id} style={styles.modalEntryRow}>
                        <View style={styles.modalEntryHeader}>
                          <Text style={styles.modalEntryDate}>{formatEntryTimestamp(entry.date)}</Text>
                          <Text style={styles.modalEntryDuration}>
                            {secondsToHuman(entry.dureeSecondes ?? 0)}
                          </Text>
                        </View>
                        {!!entry.description && (
                          <Text style={styles.modalEntryDescription}>{entry.description}</Text>
                        )}
                        <View style={styles.modalEntryMeta}>
                          <Ionicons name="flame-outline" size={14} color={colors.secondary} />
                          <Text style={styles.modalEntryType}>
                            {(entry.type === 'pomodoro-stop' && 'Pomodoro (arrêt)')
                              || (entry.type === 'pomodoro' && 'Pomodoro')
                              || (entry.type === 'chrono' && 'Chrono')
                              || 'Manuel'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

const columnWidth = 320;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f5ef2',
  },
  boardContent: {
    paddingHorizontal: spacing.large,
    paddingTop: spacing.large,
    paddingBottom: spacing.large,
    gap: spacing.medium,
    alignItems: 'flex-start',
  },
  feedbackColumn: {
    width: columnWidth,
    minHeight: 120,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.medium,
    gap: spacing.small,
  },
  feedbackText: {
    color: colors.white,
    fontSize: fontSizes.body,
    textAlign: 'center',
  },
  listColumn: {
    width: columnWidth,
    backgroundColor: '#f1f5ff',
    borderRadius: 18,
    padding: spacing.medium,
    gap: spacing.small,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listHeaderIcons: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  listHeaderEditing: {
    gap: spacing.small,
  },
  listHeaderActions: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  listEditInput: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: 10,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    backgroundColor: colors.white,
    fontSize: fontSizes.subtitle,
  },
  listTitle: {
    fontSize: fontSizes.subtitle,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
  },
  cardsContainer: {
    gap: spacing.small,
    minHeight: 40,
  },
  cardTouchable: {
    borderRadius: 14,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.medium,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    gap: spacing.small,
  },
  cardQuickActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: fontSizes.subtitle,
    color: colors.text,
    fontWeight: '600',
    flexShrink: 1,
  },
  cardPomodoroButton: {
    backgroundColor: colors.primary,
    padding: spacing.small,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  cardEditInput: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: 10,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    backgroundColor: colors.white,
    fontSize: fontSizes.body,
  },
  emptyState: {
    fontSize: fontSizes.body,
    color: colors.secondary,
  },
  addCardContainer: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.medium,
    gap: spacing.small,
  },
  cardInput: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: 10,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    backgroundColor: colors.white,
    fontSize: fontSizes.body,
  },
  addCardActions: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  addCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small / 2,
    paddingVertical: spacing.small,
  },
  addCardText: {
    fontSize: fontSizes.body,
    color: colors.primary,
    fontWeight: '600',
  },
  addListColumn: {
    width: columnWidth,
  },
  addListButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 18,
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.medium,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  addListText: {
    fontSize: fontSizes.subtitle,
    color: colors.white,
    fontWeight: '600',
  },
  addListContainer: {
    backgroundColor: '#f1f5ff',
    borderRadius: 18,
    padding: spacing.medium,
    gap: spacing.small,
  },
  listInput: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: 10,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    backgroundColor: colors.white,
    fontSize: fontSizes.subtitle,
  },
  addListActions: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.small,
    alignItems: 'center',
  },
  primaryButtonSm: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: fontSizes.body,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.small,
    alignItems: 'center',
  },
  secondaryButtonSm: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: fontSizes.body,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: spacing.large,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.large,
    gap: spacing.medium,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: fontSizes.subtitle + 2,
    fontWeight: '700',
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: fontSizes.body,
    color: colors.secondary,
    marginTop: spacing.small / 2,
  },
  modalSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    justifyContent: 'space-between',
  },
  modalSummaryLabel: {
    flex: 1,
    color: colors.secondary,
    fontSize: fontSizes.body,
  },
  modalSummaryValue: {
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    color: colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  modalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small / 2,
    paddingVertical: spacing.small * 1.25,
    borderRadius: 10,
  },
  modalEditButton: {
    backgroundColor: colors.secondary,
  },
  modalDeleteButton: {
    backgroundColor: '#dc3545',
  },
  modalActionText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSizes.body,
  },
  modalRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: 10,
  },
  modalRefreshText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSizes.body,
  },
  modalLoader: {
    alignItems: 'center',
    gap: spacing.small,
    paddingVertical: spacing.medium,
  },
  modalLoaderText: {
    color: colors.secondary,
    fontSize: fontSizes.body,
  },
  modalEmpty: {
    alignItems: 'center',
    gap: spacing.small,
    paddingVertical: spacing.large,
  },
  modalEmptyText: {
    textAlign: 'center',
    color: colors.secondary,
    fontSize: fontSizes.body,
  },
  modalEntries: {
    maxHeight: 280,
  },
  modalEntryRow: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: 12,
    padding: spacing.medium,
    gap: spacing.small,
    marginBottom: spacing.small,
  },
  modalEntryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalEntryDate: {
    color: colors.secondary,
    fontSize: fontSizes.body,
  },
  modalEntryDuration: {
    color: colors.text,
    fontWeight: '600',
    fontSize: fontSizes.subtitle,
  },
  modalEntryDescription: {
    color: colors.text,
    fontSize: fontSizes.body,
  },
  modalEntryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small / 2,
  },
  modalEntryType: {
    color: colors.secondary,
    fontSize: fontSizes.body,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default TasksScreen;
