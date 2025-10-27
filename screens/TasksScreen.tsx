import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import HistoryList, { HistoryEntry } from '../components/home/HistoryList';
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
import {
  getCategoryLabel,
  getSubCategoryLabel,
  SUB_CATEGORY_KEYS,
  SubCategoryKey,
} from '../constants/categories';

interface TaskCard {
  id: string;
  title: string;
  completed?: boolean;
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
  subCategorie?: SubCategoryKey;
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

const DOUBLE_TAP_DELAY = 280;

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

  const lastCardPressRef = useRef<{ id: string; time: number } | null>(null);
  const cardPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (cardPressTimeoutRef.current) {
        clearTimeout(cardPressTimeoutRef.current);
      }
    };
  }, []);

  const isAddListDisabled = useMemo(() => newListTitle.trim().length === 0, [newListTitle]);
  const totalTrackedSeconds = useMemo(
    () => cardEntries.reduce((acc, entry) => acc + (entry.dureeSecondes ?? 0), 0),
    [cardEntries],
  );
  const historyEntries = useMemo<HistoryEntry[]>(
    () =>
      cardEntries.map((entry) => {
        const maybeSub = entry.subCategorie;
        const normalizedSubCategorie =
          maybeSub && SUB_CATEGORY_KEYS.has(maybeSub as SubCategoryKey)
            ? (maybeSub as SubCategoryKey)
            : undefined;
        return {
          id: entry.id,
          date: entry.date,
          description: entry.description,
          dureeSecondes: entry.dureeSecondes ?? 0,
          categorie: entry.categorie ?? '',
          subCategorie: normalizedSubCategorie,
        };
      }),
    [cardEntries],
  );
  const handleHistoryEntryPress = useCallback((_entry: HistoryEntry) => {}, []);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const fetched = await getTaskLists();
      setLists(
        fetched.map((list) => ({
          id: list.id,
          title: list.title,
          cards: (list.cards || []).map((card) => ({
            id: card.id,
            title: card.title,
            completed: !!card.completed,
          })),
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

  const openCardDetails = useCallback(
    (list: TaskList, card: TaskCard) => {
      setCardDetails({ listId: list.id, listTitle: list.title, card });
      setCardEntries([]);
      loadCardEntries(card).catch(() => {});
    },
    [loadCardEntries],
  );

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

  const updateLocalCardCompletion = useCallback(
    (listId: string, cardId: string, completed: boolean) => {
      setLists((prev) =>
        prev.map((list) =>
          list.id === listId
            ? {
                ...list,
                cards: list.cards.map((card) =>
                  card.id === cardId ? { ...card, completed } : card,
                ),
              }
            : list,
        ),
      );
      setCardDetails((prev) =>
        prev && prev.card.id === cardId
          ? { ...prev, card: { ...prev.card, completed } }
          : prev,
      );
    },
    [],
  );

  const handleToggleCardCompletion = useCallback(
    async (listId: string, card: TaskCard, nextCompleted: boolean) => {
      updateLocalCardCompletion(listId, card.id, nextCompleted);
      try {
        await updateTaskCard(listId, card.id, { completed: nextCompleted });
      } catch (error) {
        console.error('Error updating card completion:', error);
        Alert.alert('Erreur', "Impossible de mettre à jour l'état de la carte.");
        updateLocalCardCompletion(listId, card.id, !nextCompleted);
      }
    },
    [updateLocalCardCompletion],
  );

  const handleCardPress = useCallback(
    (list: TaskList, card: TaskCard) => {
      const now = Date.now();
      if (
        lastCardPressRef.current &&
        lastCardPressRef.current.id === card.id &&
        now - lastCardPressRef.current.time < DOUBLE_TAP_DELAY
      ) {
        if (cardPressTimeoutRef.current) {
          clearTimeout(cardPressTimeoutRef.current);
          cardPressTimeoutRef.current = null;
        }
        lastCardPressRef.current = null;
        handleToggleCardCompletion(list.id, card, !(card.completed ?? false));
      } else {
        if (cardPressTimeoutRef.current) {
          clearTimeout(cardPressTimeoutRef.current);
        }
        lastCardPressRef.current = { id: card.id, time: now };
        cardPressTimeoutRef.current = setTimeout(() => {
          openCardDetails(list, card);
          cardPressTimeoutRef.current = null;
          lastCardPressRef.current = null;
        }, DOUBLE_TAP_DELAY);
      }
    },
    [handleToggleCardCompletion, openCardDetails],
  );

  const handleModalToggleCompletion = useCallback(() => {
    if (!cardDetails) {
      return;
    }
    const { listId, card } = cardDetails;
    handleToggleCardCompletion(listId, card, !(card.completed ?? false));
  }, [cardDetails, handleToggleCardCompletion]);

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
                      onPress={() => handleCardPress(list, card)}
                    >
                      <View style={[styles.card, card.completed && styles.cardCompleted]}>
                        <View style={styles.cardHeader}>
                          <Text style={[styles.cardTitle, card.completed && styles.cardTitleCompleted]}>
                            {card.title}
                          </Text>
                          <Ionicons
                            name={card.completed ? 'checkmark-circle' : 'information-circle-outline'}
                            size={18}
                            color={card.completed ? '#2F9E44' : colors.secondary}
                          />
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
                <ScrollView
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={false}
                >
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

                  {cardDetails && (
                    <View
                      style={[
                        styles.modalStatusBadge,
                        cardDetails.card.completed
                          ? styles.modalStatusBadgeCompleted
                          : styles.modalStatusBadgePending,
                      ]}
                    >
                      <Ionicons
                        name={cardDetails.card.completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={18}
                        color={cardDetails.card.completed ? '#2F9E44' : colors.secondary}
                      />
                      <Text
                        style={[
                          styles.modalStatusText,
                          cardDetails.card.completed && styles.modalStatusTextCompleted,
                        ]}
                      >
                        {cardDetails.card.completed ? 'Complétée' : 'À faire'}
                      </Text>
                    </View>
                  )}

                  <View style={styles.modalSummaryRow}>
                    <Ionicons name="time-outline" size={18} color={colors.primary} />
                    <Text style={styles.modalSummaryLabel}>Temps suivi</Text>
                    <Text style={styles.modalSummaryValue}>{secondsToHuman(totalTrackedSeconds)}</Text>
                  </View>

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[
                        styles.modalActionButton,
                        cardDetails?.card.completed
                          ? styles.modalMarkIncompleteButton
                          : styles.modalMarkCompleteButton,
                      ]}
                      onPress={handleModalToggleCompletion}
                      activeOpacity={0.85}
                      accessibilityLabel={
                        cardDetails?.card.completed ? 'Marquer la tâche comme incomplète' : 'Marquer la tâche comme complétée'
                      }
                    >
                      <Ionicons
                        name={cardDetails?.card.completed ? 'refresh-circle' : 'checkmark-circle'}
                        size={20}
                        color={colors.white}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalActionButton, styles.modalEditButton]}
                      onPress={handleModalEdit}
                      activeOpacity={0.85}
                      accessibilityLabel="Modifier la tâche"
                    >
                      <Ionicons name="pencil" size={20} color={colors.white} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalActionButton, styles.modalDeleteButton]}
                      onPress={handleModalDelete}
                      activeOpacity={0.85}
                      accessibilityLabel="Supprimer la tâche"
                    >
                      <Ionicons name="trash" size={20} color={colors.white} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalHistorySection}>
                    <View style={styles.modalHistoryHeader}>
                      <Ionicons name="time-outline" size={18} color={colors.secondary} />
                      <Text style={styles.modalHistoryTitle}>Historique</Text>
                    </View>
                    {cardEntriesLoading ? (
                      <View style={styles.modalLoader}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.modalLoaderText}>Chargement des entrées...</Text>
                      </View>
                    ) : (
                      <HistoryList
                        entries={historyEntries}
                        onSelectEntry={handleHistoryEntryPress}
                        formatTimestamp={formatEntryTimestamp}
                        formatDuration={secondsToHuman}
                        resolveCategoryLabel={getCategoryLabel}
                        resolveSubCategoryLabel={getSubCategoryLabel}
                      />
                    )}
                  </View>
                </ScrollView>
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
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    gap: spacing.small,
  },
  cardCompleted: {
    backgroundColor: '#e6f4ea',
    borderColor: '#2F9E44',
    shadowColor: 'rgba(47, 158, 68, 0.35)',
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
  cardTitleCompleted: {
    color: '#2F9E44',
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
  modalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    alignSelf: 'flex-start',
    paddingVertical: spacing.small / 1.5,
    paddingHorizontal: spacing.medium,
    borderRadius: 999,
    borderWidth: 1,
  },
  modalStatusBadgeCompleted: {
    backgroundColor: '#e6f4ea',
    borderColor: '#2F9E44',
  },
  modalStatusBadgePending: {
    backgroundColor: colors.background,
    borderColor: colors.lightGray,
  },
  modalStatusText: {
    fontSize: fontSizes.body,
    fontWeight: '600',
    color: colors.secondary,
  },
  modalStatusTextCompleted: {
    color: '#2F9E44',
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
  modalScrollContent: {
    paddingBottom: spacing.large,
    gap: spacing.medium,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  modalActionButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEditButton: {
    backgroundColor: colors.secondary,
  },
  modalDeleteButton: {
    backgroundColor: '#dc3545',
  },
  modalMarkCompleteButton: {
    backgroundColor: '#2F9E44',
  },
  modalMarkIncompleteButton: {
    backgroundColor: colors.darkGray,
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
  modalHistorySection: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.medium,
    gap: spacing.small,
  },
  modalHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  modalHistoryTitle: {
    fontSize: fontSizes.subtitle,
    fontWeight: '600',
    color: colors.secondary,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default TasksScreen;
