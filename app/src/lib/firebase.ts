import { initializeApp, getApps } from 'firebase/app';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  Firestore,
  doc,
  getDocFromServer
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";

let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let storageInstance: FirebaseStorage | null = null;

try {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  
  // Inicialização robusta do Firestore com cache local persistente para suporte PWA/offline impecável
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalForceLongPolling: true
  }, databaseId);
  
  authInstance = getAuth(app);
  storageInstance = getStorage(app);
} catch (error) {
  console.warn("Falha ao inicializar Firebase Firestore/Auth/Storage com persistência:", error);
}

export const firestore = dbInstance;
export const auth = authInstance;
export const storage = storageInstance;

// Validação de conexão conforme as diretrizes do Firebase Integration Skill
if (dbInstance) {
  getDocFromServer(doc(dbInstance, 'test', 'connection'))
    .then(() => {
      console.log("Conexão com o Firebase Firestore validada com sucesso.");
    })
    .catch((error: any) => {
      const isOfflineOrUnavailable = 
        (error instanceof Error && (error.message.includes('offline') || error.message.includes('unavailable'))) ||
        (error && (error.code === 'unavailable' || error.code === 'permission-denied' || error.code === 'failed-precondition'));
      
      if (isOfflineOrUnavailable) {
        console.warn("O Firestore está operando em modo offline ou com restrição temporária. O cache local persistente está ativo.");
      } else {
        console.warn("Aviso na verificação de conexão com o Firestore (operando em cache local):", error);
      }
    });
}


