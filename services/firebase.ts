
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where, doc, deleteDoc, updateDoc } from 'firebase/firestore';
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

interface EntreeTemps {
  stageId: string;
  userId: string;
  date: Date;
  dureeSecondes: number;
  description?: string;
  categorie: string;
  type: 'chrono' | 'pomodoro' | 'manuel';
}

interface Stage {
    userId: string;
    nom: string;
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
