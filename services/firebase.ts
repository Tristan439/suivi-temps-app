
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  deleteDoc,
  updateDoc,
  orderBy,
} from 'firebase/firestore';
import { getAuth, initializeAuth, type Auth, type Persistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// IMPORTANT: Replace with your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDVrUaQsbcmrd3hRoRaollS4hP83x-eeMc",
  authDomain: "suivi-temps-85bec.firebaseapp.com",
  projectId: "suivi-temps-85bec",
  storageBucket: "suivi-temps-85bec.firebasestorage.app",
  messagingSenderId: "512568355781",
  appId: "1:512568355781:web:c26ed4b8a4dbf9a30439ac",
  measurementId: "G-ZM0BYQ84Y1"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
};

let authInstance: Auth;
try {
  if (getReactNativePersistence) {
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } else {
    authInstance = initializeAuth(app);
  }
} catch (_error) {
  authInstance = getAuth(app);
}

export const auth = authInstance;

const entreesTempsCollection = collection(db, 'entreesTemps');
const stagesCollection = collection(db, 'stages');
const taskListsCollection = collection(db, 'taskLists');

interface EntreeTemps {
  stageId: string;
  userId: string;
  date: Date;
  dureeSecondes: number;
  description?: string;
  categorie: string;
  type: 'chrono' | 'pomodoro' | 'manuel' | 'pomodoro-stop';
  taskCardId?: string;
}

interface Stage {
    userId: string;
    nom: string;
}

interface TaskListDoc {
  title: string;
  userId: string;
  createdAt: number;
}

interface TaskCardDoc {
  title: string;
  userId: string;
  createdAt: number;
}

export const addEntreeTemps = async (entree: Omit<EntreeTemps, 'userId'>) => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }

  try {
    const docRef = await addDoc(entreesTempsCollection, {
      ...entree,
      userId: user.uid,
    });
    console.log("Document written with ID: ", docRef.id);
    return docRef;
  } catch (e) {
    console.error("Error adding document: ", e);
    throw e;
  }
};

export const getEntreesParMois = async (year: number, month: number, stageId?: string) => {
  const user = auth.currentUser;
  if (!user) {
    return [];
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  try {
    let q = query(
      entreesTempsCollection,
      where('userId', '==', user.uid),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );

    if (stageId) {
      q = query(q, where('stageId', '==', stageId));
    }

    const querySnapshot = await getDocs(q);
    const entrees = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return entrees;
  } catch (error) {
    console.error("Error getting documents: ", error);
    throw error;
  }
};

export const getEntreesForTaskCard = async (taskCardId: string) => {
  const user = auth.currentUser;
  if (!user) {
    return [];
  }

  try {
    const entriesQuery = query(
      entreesTempsCollection,
      where('userId', '==', user.uid),
      where('taskCardId', '==', taskCardId),
    );
    const snapshot = await getDocs(entriesQuery);
    return snapshot.docs.map((entryDoc) => ({ id: entryDoc.id, ...entryDoc.data() }));
  } catch (error) {
    console.error('Error getting task card entries: ', error);
    throw error;
  }
};

export const updateEntreeTemps = async (
  entreeId: string,
  updates: Partial<Omit<EntreeTemps, 'userId'>>,
) => {
  const entreeRef = doc(db, 'entreesTemps', entreeId);
  try {
    await updateDoc(entreeRef, updates);
    console.log('Time entry updated:', entreeId);
  } catch (error) {
    console.error('Error updating entry:', error);
    throw error;
  }
};

export const deleteEntreeTemps = async (entreeId: string) => {
  try {
    const entreeDoc = doc(db, 'entreesTemps', entreeId);
    await deleteDoc(entreeDoc);
    console.log('Time entry deleted with ID:', entreeId);
  } catch (error) {
    console.error('Error deleting entry:', error);
    throw error;
  }
};

export const getStages = async () => {
    const user = auth.currentUser;
    if (!user) {
        return [];
    }

    try {
        const q = query(stagesCollection, where('userId', '==', user.uid));
        const querySnapshot = await getDocs(q);
        const stages = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return stages;
    } catch (error) {
        console.error("Error getting stages: ", error);
        throw error;
    }
};

export const addStage = async (nom: string) => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("User not authenticated");
    }

    try {
        const docRef = await addDoc(stagesCollection, {
            nom,
            userId: user.uid,
        });
        console.log("Stage written with ID: ", docRef.id);
        return docRef;
    } catch (e) {
        console.error("Error adding stage: ", e);
        throw e;
    }
};

export const getTaskLists = async () => {
  const user = auth.currentUser;
  if (!user) {
    return [];
  }

  try {
    const listQuery = query(taskListsCollection, where('userId', '==', user.uid), orderBy('createdAt', 'asc'));
    const listSnapshot = await getDocs(listQuery);

    const listsWithCards = await Promise.all(
      listSnapshot.docs.map(async (listDoc) => {
        const listData = listDoc.data() as TaskListDoc;
        const cardsCollection = collection(db, 'taskLists', listDoc.id, 'cards');
        const cardsSnapshot = await getDocs(query(cardsCollection, orderBy('createdAt', 'asc')));
        const cards = cardsSnapshot.docs.map((cardDoc) => ({
          id: cardDoc.id,
          ...(cardDoc.data() as TaskCardDoc),
        }));
        return {
          id: listDoc.id,
          ...listData,
          cards,
        };
      }),
    );

    return listsWithCards;
  } catch (error) {
    console.error('Error loading task lists:', error);
    throw error;
  }
};

export const addTaskList = async (title: string) => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    return await addDoc(taskListsCollection, {
      title,
      userId: user.uid,
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error('Error adding task list:', error);
    throw error;
  }
};

export const updateTaskList = async (listId: string, updates: Partial<Pick<TaskListDoc, 'title'>>) => {
  try {
    const listRef = doc(db, 'taskLists', listId);
    await updateDoc(listRef, updates);
  } catch (error) {
    console.error('Error updating task list:', error);
    throw error;
  }
};

export const deleteTaskList = async (listId: string) => {
  try {
    const cardsCollection = collection(db, 'taskLists', listId, 'cards');
    const cardsSnapshot = await getDocs(cardsCollection);
    await Promise.all(cardsSnapshot.docs.map((cardDoc) => deleteDoc(cardDoc.ref)));
    await deleteDoc(doc(db, 'taskLists', listId));
  } catch (error) {
    console.error('Error deleting task list:', error);
    throw error;
  }
};

export const addTaskCard = async (listId: string, title: string) => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    const cardsCollection = collection(db, 'taskLists', listId, 'cards');
    return await addDoc(cardsCollection, {
      title,
      userId: user.uid,
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error('Error adding task card:', error);
    throw error;
  }
};

export const updateTaskCard = async (listId: string, cardId: string, updates: Partial<Pick<TaskCardDoc, 'title'>>) => {
  try {
    const cardRef = doc(db, 'taskLists', listId, 'cards', cardId);
    await updateDoc(cardRef, updates);
  } catch (error) {
    console.error('Error updating task card:', error);
    throw error;
  }
};

export const deleteTaskCard = async (listId: string, cardId: string) => {
  try {
    const cardRef = doc(db, 'taskLists', listId, 'cards', cardId);
    await deleteDoc(cardRef);
  } catch (error) {
    console.error('Error deleting task card:', error);
    throw error;
  }
};

export const getCumulsParCategorie = async (year: number, month: number, stageId?: string) => {
    const user = auth.currentUser;
    if (!user) {
        return {};
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    try {
        let q = query(
            entreesTempsCollection,
            where('userId', '==', user.uid),
            where('date', '>=', startDate),
            where('date', '<=', endDate)
        );

        if (stageId) {
            q = query(q, where('stageId', '==', stageId));
        }

        const querySnapshot = await getDocs(q);
        const cumuls: { [key: string]: number } = {};
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const { categorie, dureeSecondes } = data;
            if (cumuls[categorie]) {
                cumuls[categorie] += dureeSecondes;
            } else {
                cumuls[categorie] = dureeSecondes;
            }
        });
        return cumuls;
    } catch (error) {
        console.error("Error getting cumuls: ", error);
        throw error;
    }
};

export const deleteStage = async (stageId: string) => {
  try {
    const stageDoc = doc(db, 'stages', stageId);
    await deleteDoc(stageDoc);
    console.log("Stage deleted with ID: ", stageId);
  } catch (e) {
    console.error("Error deleting stage: ", e);
    throw e;
  }
};
