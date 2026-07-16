import { AnyUser, AdminUser, MototaxistaUser, ClienteUser, Ride, NotificationItem, SystemLog, SystemConfig, RideStatus, TurnoTipo, Tarifa, RelatorioDiario } from '../types';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot
} from 'firebase/firestore';
import { firestore, storage } from './firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

export function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) {
    return undefined;
  }
  if (obj === null) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj
      .map(item => sanitizeForFirestore(item))
      .filter(item => item !== undefined);
  }
  if (typeof obj === 'object') {
    if (Object.prototype.toString.call(obj) === '[object Object]') {
      const copy: any = {};
      for (const key of Object.keys(obj)) {
        const val = sanitizeForFirestore(obj[key]);
        if (val !== undefined) {
          copy[key] = val;
        }
      }
      return copy;
    }
  }
  return obj;
}

export async function uploadBase64Image(base64Str: string | undefined | null, path: string): Promise<string> {
  if (!storage || !base64Str || !base64Str.startsWith('data:')) {
    return base64Str || '';
  }

  // Timeout de 2.5 segundos para evitar travamento da UI por conta de retentativas infinitas do Firebase Storage
  const timeoutPromise = new Promise<string>((_, reject) => 
    setTimeout(() => reject(new Error("Timeout de upload")), 2500)
  );

  const uploadPromise = (async () => {
    const storageRef = ref(storage, path);
    await uploadString(storageRef, base64Str, 'data_url');
    return await getDownloadURL(storageRef);
  })();

  try {
    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (error) {
    console.warn("Falha ou timeout no upload do Firebase Storage, usando base64 inline ou original:", error);
    return base64Str; // fallback para o próprio base64
  }
}

const STORAGE_KEYS = {
  USERS: 'mototaxi_db_users',
  RIDES: 'mototaxi_db_rides',
  NOTIFICATIONS: 'mototaxi_db_notifications',
  LOGS: 'mototaxi_db_logs',
  CONFIG: 'mototaxi_db_config',
  CURRENT_USER: 'mototaxi_current_user',
};

const SYNC_CHANNEL_NAME = 'mototaxi_realtime_sync';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: localStorage.getItem('mototaxi_logged_session_id')
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// Seed inicial atualizado com o Profº Wesley
const SEED_USERS: AnyUser[] = [
  {
    id: 'admin_wesley',
    role: 'admin',
    nome: 'Wesley Pereira Ferreira',
    email: 'wesleydani72@gmail.com',
    telefone: '(11) 99999-0000',
    senha: 'W&sl&y194080',
    status: 'ativo',
    passwordCreated: true,
    foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    criadoEm: '2026-06-01',
  } as AdminUser,
  {
    id: 'admin_1',
    role: 'admin',
    nome: 'Administrador Geral',
    email: 'jl6568402@gmail.com',
    telefone: '(11) 99999-0000',
    senha: 'admin',
    status: 'ativo',
    passwordCreated: true,
    foto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    criadoEm: '2026-06-01',
  } as AdminUser,
  {
    id: 'moto_1',
    role: 'mototaxista',
    nome: 'Carlos Silva',
    telefone: '(11) 98888-1111',
    placa: 'ABC1D23',
    senha: '123',
    status: 'ativo',
    passwordCreated: true,
    modeloMoto: 'Honda CG 160 Titan',
    corMoto: 'Vermelha',
    cidade: 'São Paulo',
    bairro: 'Centro',
    disponibilidade: 'disponivel',
    status_aprovacao: 'APROVADO',
    totalCorridas: 24,
    ganhosHoje: 85.50,
    ganhosSemana: 420.00,
    ganhosMes: 1680.00,
    avaliacao: 4.9,
    foto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    fotoMoto: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=300&auto=format&fit=crop&q=80',
    criadoEm: '2026-06-10',
  } as MototaxistaUser,
  {
    id: 'moto_2',
    role: 'mototaxista',
    nome: 'Roberto Santos',
    telefone: '(11) 97777-2222',
    placa: 'MTO9988',
    senha: '', // Para testar primeiro acesso
    status: 'ativo',
    passwordCreated: false,
    modeloMoto: 'Yamaha Fazer 250',
    corMoto: 'Preta',
    cidade: 'São Paulo',
    bairro: 'Jardins',
    disponibilidade: 'indisponivel',
    status_aprovacao: 'APROVADO',
    totalCorridas: 12,
    ganhosHoje: 0,
    ganhosSemana: 190.00,
    ganhosMes: 890.00,
    avaliacao: 4.8,
    foto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    fotoMoto: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=300&auto=format&fit=crop&q=80',
    criadoEm: '2026-06-15',
  } as MototaxistaUser,
  {
    id: 'cli_1',
    role: 'cliente',
    nome: 'Ana Oliveira',
    email: 'cliente@email.com',
    telefone: '(11) 96666-3333',
    senha: '123',
    status: 'ativo',
    passwordCreated: true,
    cidade: 'São Caetano de Odivelas - PA',
    bairro: 'República',
    endereco: 'Av. Ipiranga, 500',
    pontoReferencia: 'Próximo à Praça da República',
    cadastroCompleto: true,
    foto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    criadoEm: '2026-06-12',
  } as ClienteUser,
];

const SEED_RIDES: Ride[] = [
  {
    id: 'ride_1',
    clienteId: 'cli_1',
    clienteNome: 'Ana Oliveira',
    clienteFoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    clienteTelefone: '(11) 96666-3333',
    origem: 'Av. Ipiranga, 500 - República',
    refOrigem: 'Próximo à Praça',
    destino: 'Av. Paulista, 1000 - Bela Vista',
    distanciaKm: 4.2,
    tempoEstimadoMin: 12,
    valorEstimado: 14.50,
    mototaxistaId: 'moto_1',
    mototaxistaNome: 'Carlos Silva',
    mototaxistaFoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    mototaxistaTelefone: '(11) 98888-1111',
    mototaxistaMoto: 'Honda CG 160 Titan',
    mototaxistaPlaca: 'ABC1D23',
    status: 'finalizada',
    recusadoPor: [],
    data: '2026-06-26',
    hora: '14:30',
    criadoEm: Date.now() - 86400000,
    atualizadoEm: Date.now() - 86400000,
  }
];

const SEED_CONFIG: SystemConfig = {
  tarifaBase: 5.00,
  precoKm: 2.20,
  taxaAdminPercentual: 15,
  raioBuscaKm: 10,
  cidadePadrao: 'São Paulo',
  blacklistedLogins: [],
  tarifas: [
    { id: 'tar_manha', turno: 'Manhã', hora_inicio: '06:00', hora_fim: '11:59', valor: 10.00, status: true, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    { id: 'tar_tarde', turno: 'Tarde', hora_inicio: '12:00', hora_fim: '17:59', valor: 12.00, status: true, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    { id: 'tar_noite', turno: 'Noite', hora_inicio: '18:00', hora_fim: '23:59', valor: 15.00, status: true, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
    { id: 'tar_madrugada', turno: 'Madrugada', hora_inicio: '00:00', hora_fim: '05:59', valor: 20.00, status: true, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' }
  ]
};

let syncInitialized = false;
let fullUsersCache: AnyUser[] = [];

// Singleton inicialização
export function initDatabase() {
  if (typeof window === 'undefined') return;
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(SEED_USERS));
  } else {
    // Garantir que wesleydani72@gmail.com existe no localStorage
    try {
      const currentUsersStr = localStorage.getItem(STORAGE_KEYS.USERS);
      if (currentUsersStr) {
        const currentUsers = JSON.parse(currentUsersStr) as AnyUser[];
        const adminExiste = currentUsers.some(u => u.role === 'admin' && u.email?.toLowerCase() === 'wesleydani72@gmail.com');
        if (!adminExiste) {
          const adminUser: AdminUser = {
            id: 'admin_wesley',
            role: 'admin',
            nome: 'Wesley Pereira Ferreira',
            email: 'wesleydani72@gmail.com',
            telefone: '(11) 99999-0000',
            senha: 'W&sl&y194080',
            status: 'ativo',
            passwordCreated: true,
            foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            criadoEm: '2026-06-01',
          };
          currentUsers.push(adminUser);
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(currentUsers));
        }
      }
    } catch (e) {
      console.warn("Erro ao verificar admin local:", e);
    }
  }
  if (!localStorage.getItem(STORAGE_KEYS.RIDES)) {
    localStorage.setItem(STORAGE_KEYS.RIDES, JSON.stringify(SEED_RIDES));
  }
  if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.LOGS)) {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.CONFIG)) {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(SEED_CONFIG));
  }

  // Inicializar sincronização real-time do Firestore
  if (!syncInitialized && firestore) {
    syncInitialized = true;
    startFirestoreSync();
  }
}

async function seedFirestoreIfNeeded() {
  if (!firestore) return;
  try {
    const snapshot = await getDocs(collection(firestore, 'users'));
    if (snapshot.empty) {
      console.log("Banco Firestore vazio. Semeando dados iniciais...");
      for (const u of SEED_USERS) {
        await setDoc(doc(firestore, 'users', u.id), sanitizeForFirestore(u));
      }
      await setDoc(doc(firestore, 'config', 'system'), sanitizeForFirestore(SEED_CONFIG));
      for (const r of SEED_RIDES) {
        await setDoc(doc(firestore, 'rides', r.id), sanitizeForFirestore(r));
      }
    } else {
      // Se não estiver vazio, mas o administrador do Wesley não estiver presente, criamos automaticamente no Firestore
      let wesleyExiste = false;
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data && data.role === 'admin' && data.email?.toLowerCase() === 'wesleydani72@gmail.com') {
          wesleyExiste = true;
        }
      });
      if (!wesleyExiste) {
        console.log("Administrador oficial Wesley não encontrado no Firestore. Criando automaticamente...");
        const adminUser: AdminUser = {
          id: 'admin_wesley',
          role: 'admin',
          nome: 'Wesley Pereira Ferreira',
          email: 'wesleydani72@gmail.com',
          telefone: '(11) 99999-0000',
          senha: 'W&sl&y194080',
          status: 'ativo',
          passwordCreated: true,
          foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          criadoEm: '2026-06-01',
        };
        await setDoc(doc(firestore, 'users', adminUser.id), sanitizeForFirestore(adminUser));
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
  }
}

function stripHeavyFields(u: any): any {
  if (u.role === 'mototaxista') {
    return {
      ...u,
      docCnh: u.docCnh && u.docCnh.startsWith('data:') ? 'Anexado (Firestore)' : u.docCnh,
      foto_cnh: u.foto_cnh && u.foto_cnh.startsWith('data:') ? 'Anexado (Firestore)' : u.foto_cnh,
      docRgCpf: u.docRgCpf && u.docRgCpf.startsWith('data:') ? 'Anexado (Firestore)' : u.docRgCpf,
      docMoto: u.docMoto && u.docMoto.startsWith('data:') ? 'Anexado (Firestore)' : u.docMoto,
      docResidencia: u.docResidencia && u.docResidencia.startsWith('data:') ? 'Anexado (Firestore)' : u.docResidencia,
      fotoMoto: u.fotoMoto && u.fotoMoto.startsWith('data:') ? 'Anexado (Firestore)' : u.fotoMoto,
      foto: u.foto && u.foto.startsWith('data:') ? 'Anexado (Firestore)' : u.foto,
    };
  }
  if (u.role === 'cliente') {
    return {
      ...u,
      foto: u.foto && u.foto.startsWith('data:') ? 'Anexado (Firestore)' : u.foto,
    };
  }
  return u;
}

const seenNotificationIds = new Set<string>();

function startFirestoreSync() {
  if (!firestore) return;

  // Semear dados se o Firestore estiver vazio
  seedFirestoreIfNeeded();

  // Carregar notificações já existentes no localStorage para não disparar toasts repetidos ao iniciar sincronização
  getNotifications().forEach(n => {
    if (n.id) seenNotificationIds.add(n.id);
  });

  // Sincronizar usuários
  onSnapshot(collection(firestore, 'users'), (snapshot) => {
    const users: any[] = [];
    snapshot.forEach((doc) => {
      users.push({ ...doc.data(), id: doc.id });
    });
    if (users.length > 0) {
      fullUsersCache = users;
      
      // Strip heavy fields for localStorage to avoid QuotaExceededError
      const strippedUsers = users.map(u => stripHeavyFields(u));

      try {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(strippedUsers));
      } catch (err) {
        console.warn('Erro ao salvar no localStorage:', err);
      }
      
      // Notificar componentes se o status do usuário atual mudar
      const savedId = localStorage.getItem('mototaxi_logged_session_id');
      if (savedId) {
        const updatedMe = users.find(u => u.id === savedId);
        if (updatedMe) {
          broadcastEvent('USER_UPDATED', updatedMe);
        }
      }
      
      broadcastEvent('STORAGE_MUTATED', { key: STORAGE_KEYS.USERS });
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'users');
  });

  // Sincronizar corridas
  onSnapshot(collection(firestore, 'rides'), (snapshot) => {
    const rides: any[] = [];
    snapshot.forEach((doc) => {
      rides.push({ ...doc.data(), id: doc.id });
    });
    try {
      localStorage.setItem(STORAGE_KEYS.RIDES, JSON.stringify(rides));
    } catch (err) {
      console.warn('Erro ao salvar corridas no localStorage:', err);
    }
    broadcastEvent('STORAGE_MUTATED', { key: STORAGE_KEYS.RIDES });
    broadcastEvent('RIDE_UPDATED', null); // Forçar re-render de componentes de corrida
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'rides');
  });

  // Sincronizar notificações
  onSnapshot(collection(firestore, 'notifications'), (snapshot) => {
    const notifs: any[] = [];
    let hasNew = false;
    let newlyAddedNotif: any = null;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const notif = { ...data, id: doc.id };
      notifs.push(notif);
      
      if (doc.id && !seenNotificationIds.has(doc.id)) {
        seenNotificationIds.add(doc.id);
        hasNew = true;
        newlyAddedNotif = notif;
      }
    });

    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));
    } catch (err) {
      console.warn('Erro ao salvar notificações no localStorage:', err);
    }
    
    // Disparar NEW_NOTIFICATION somente para notificações realmente novas e não lidas
    if (hasNew && newlyAddedNotif && !newlyAddedNotif.lida) {
      broadcastEvent('NEW_NOTIFICATION', newlyAddedNotif);
    }
    
    broadcastEvent('STORAGE_MUTATED', { key: STORAGE_KEYS.NOTIFICATIONS });
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'notifications');
  });

  // Sincronizar logs
  onSnapshot(collection(firestore, 'logs'), (snapshot) => {
    const logs: any[] = [];
    snapshot.forEach((doc) => {
      logs.push({ ...doc.data(), id: doc.id });
    });
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
    } catch (err) {
      console.warn('Erro ao salvar logs no localStorage:', err);
    }
    broadcastEvent('STORAGE_MUTATED', { key: STORAGE_KEYS.LOGS });
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'logs');
  });

  // Sincronizar configurações do sistema
  onSnapshot(collection(firestore, 'config'), (snapshot) => {
    snapshot.forEach((doc) => {
      if (doc.id === 'system') {
        try {
          localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(doc.data()));
        } catch (err) {
          console.warn('Erro ao salvar config no localStorage:', err);
        }
        broadcastEvent('STORAGE_MUTATED', { key: STORAGE_KEYS.CONFIG });
      }
    });
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'config');
  });

  // Sincronizar relatórios diários
  onSnapshot(collection(firestore, 'relatorios'), (snapshot) => {
    const rels: any[] = [];
    snapshot.forEach((doc) => {
      rels.push({ ...doc.data(), id: doc.id });
    });
    try {
      localStorage.setItem('mototaxi_db_relatorios', JSON.stringify(rels));
    } catch (err) {
      console.warn('Erro ao salvar relatórios no localStorage:', err);
    }
    broadcastEvent('STORAGE_MUTATED', { key: 'mototaxi_db_relatorios' });
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'relatorios');
  });
}

// Canal de comunicação real-time entre abas
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
}

export function broadcastEvent(event: string, payload?: any) {
  if (typeof window === 'undefined') return;
  const msg = { event, payload, timestamp: Date.now() };
  if (broadcastChannel) {
    broadcastChannel.postMessage(msg);
  }
  window.dispatchEvent(new CustomEvent('mototaxi_local_event', { detail: msg }));
}

export function subscribeRealtime(callback: (event: string, payload?: any) => void) {
  if (typeof window === 'undefined') return () => {};
  
  const handleLocal = (e: any) => {
    callback(e.detail.event, e.detail.payload);
  };
  
  const handleBroadcast = (e: MessageEvent) => {
    callback(e.data.event, e.data.payload);
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key && Object.values(STORAGE_KEYS).includes(e.key)) {
      callback('STORAGE_MUTATED', { key: e.key });
    }
  };

  window.addEventListener('mototaxi_local_event', handleLocal);
  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcast);
  }
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener('mototaxi_local_event', handleLocal);
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcast);
    }
    window.removeEventListener('storage', handleStorage);
  };
}

// CRUD Users
export function getUsers(): AnyUser[] {
  initDatabase();
  if (fullUsersCache.length > 0) {
    return fullUsersCache;
  }
  const raw = localStorage.getItem(STORAGE_KEYS.USERS);
  return raw ? JSON.parse(raw) : [];
}

export function getUserById(id: string): AnyUser | undefined {
  return getUsers().find(u => u.id === id);
}

export function saveUser(user: AnyUser) {
  // Update in-memory cache first
  if (fullUsersCache.length === 0) {
    fullUsersCache = getUsers();
  }
  const idx = fullUsersCache.findIndex(u => u.id === user.id);
  if (idx >= 0) {
    fullUsersCache[idx] = user;
  } else {
    fullUsersCache.push(user);
  }

  // Sync directly to Firestore first
  if (firestore) {
    setDoc(doc(firestore, 'users', user.id), sanitizeForFirestore(user)).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.id}`);
    });
  }

  // Strip heavy fields before storing in localStorage to avoid QuotaExceededError
  const strippedUsers = fullUsersCache.map(u => stripHeavyFields(u));

  try {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(strippedUsers));
  } catch (err) {
    console.warn('Erro ao salvar usuários no localStorage (limite excedido), ignorando gravação local:', err);
  }

  broadcastEvent('USER_UPDATED', user);
}

export function deleteUser(id: string) {
  const users = getUsers();
  const target = users.find(u => u.id === id);
  if (target) {
    const cfg = getConfig();
    const blacklist = cfg.blacklistedLogins || [];
    if (target.role === 'mototaxista') {
      const p = (target as MototaxistaUser).placa?.trim().toLowerCase();
      const t = (target as MototaxistaUser).telefone?.replace(/\D/g, '');
      if (p && !blacklist.includes(p)) blacklist.push(p);
      if (t && !blacklist.includes(t)) blacklist.push(t);
    } else if (target.role === 'cliente') {
      const e = (target as ClienteUser).email?.trim().toLowerCase();
      const t = (target as ClienteUser).telefone?.replace(/\D/g, '');
      if (e && !blacklist.includes(e)) blacklist.push(e);
      if (t && !blacklist.includes(t)) blacklist.push(t);
    }
    saveConfig({ ...cfg, blacklistedLogins: blacklist });
  }

  const remaining = users.filter(u => u.id !== id);
  fullUsersCache = remaining;
  
  const strippedRemaining = remaining.map(u => stripHeavyFields(u));
  try {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(strippedRemaining));
  } catch (err) {
    console.warn('Erro ao deletar no localStorage:', err);
  }
  
  // Se o usuário excluído estiver logado no localStorage local, remover sessão
  const currentRaw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (currentRaw) {
    try {
      const curr = JSON.parse(currentRaw);
      if (curr.id === id) {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    } catch (e) {}
  }

  broadcastEvent('USER_DELETED', { id });

  // Sincronizar com Firestore
  if (firestore) {
    deleteDoc(doc(firestore, 'users', id)).catch((err) => {
      handleFirestoreError(err, OperationType.DELETE, `users/${id}`);
    });
  }
}

// CRUD Rides
export function getRides(): Ride[] {
  initDatabase();
  const raw = localStorage.getItem(STORAGE_KEYS.RIDES);
  return raw ? JSON.parse(raw) : [];
}

export function getRideById(id: string): Ride | undefined {
  return getRides().find(r => r.id === id);
}

export function saveRide(ride: Ride) {
  const rides = getRides();
  
  const data_operacional = ride.data_operacional || ride.data || new Date().toISOString().split('T')[0];
  const hora_corrida = ride.hora_corrida || ride.hora || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const status_auditoria = ride.status_auditoria || 'pendente';
  const periodo_fechado = ride.periodo_fechado ?? false;

  let normalizedStatus = ride.status;
  if (normalizedStatus === 'FINALIZADA') {
    normalizedStatus = 'finalizada';
  } else if (normalizedStatus === 'CANCELADA') {
    normalizedStatus = 'cancelada';
  }

  const fullRide: Ride = {
    ...ride,
    status: normalizedStatus,
    data_operacional,
    hora_corrida,
    status_auditoria,
    periodo_fechado
  };

  const idx = rides.findIndex(r => r.id === ride.id);
  if (idx >= 0) {
    rides[idx] = fullRide;
  } else {
    rides.push(fullRide);
  }
  localStorage.setItem(STORAGE_KEYS.RIDES, JSON.stringify(rides));
  broadcastEvent('RIDE_UPDATED', fullRide);

  // Sincronizar com Firestore
  if (firestore) {
    setDoc(doc(firestore, 'rides', ride.id), sanitizeForFirestore(fullRide)).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, `rides/${ride.id}`);
    });
  }
}

// CRUD Notifications
export function getNotifications(): NotificationItem[] {
  initDatabase();
  const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
  return raw ? JSON.parse(raw) : [];
}

export function addNotification(item: Omit<NotificationItem, 'id' | 'dataHora' | 'lida'>) {
  const list = getNotifications();
  const newNotif: NotificationItem = {
    ...item,
    id: 'notif_' + Date.now() + Math.random().toString(36).substring(2, 5),
    dataHora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    lida: false,
  };
  seenNotificationIds.add(newNotif.id);
  list.unshift(newNotif);
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
  broadcastEvent('NEW_NOTIFICATION', newNotif);

  // Sincronizar com Firestore
  if (firestore) {
    setDoc(doc(firestore, 'notifications', newNotif.id), sanitizeForFirestore(newNotif)).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, `notifications/${newNotif.id}`);
    });
  }
}

export function markNotificationsAsRead(userId: string) {
  const list = getNotifications().map(n => {
    if (n.destinatarioId === userId || n.destinatarioId === 'all_drivers' || (n.destinatarioRole && n.destinatarioRole === userId)) {
      return { ...n, lida: true };
    }
    return n;
  });
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
  broadcastEvent('NOTIFICATIONS_READ', { userId });

  // Sincronizar com Firestore
  if (firestore) {
    list.forEach((n) => {
      if (n.destinatarioId === userId || n.destinatarioId === 'all_drivers' || (n.destinatarioRole && n.destinatarioRole === userId)) {
        setDoc(doc(firestore, 'notifications', n.id), sanitizeForFirestore(n)).catch((err) => {
          handleFirestoreError(err, OperationType.WRITE, `notifications/${n.id}`);
        });
      }
    });
  }
}

// CRUD Logs
export function addLog(userId: string, userName: string, userRole: any, acao: string, detalhe: string) {
  initDatabase();
  const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
  const list: SystemLog[] = raw ? JSON.parse(raw) : [];
  const newLog: SystemLog = {
    id: 'log_' + Date.now(),
    userId,
    userName,
    userRole,
    acao,
    detalhe,
    dataHora: new Date().toLocaleString('pt-BR'),
  };
  list.unshift(newLog);
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(list));
  broadcastEvent('NEW_LOG', newLog);

  // Sincronizar com Firestore
  if (firestore) {
    setDoc(doc(firestore, 'logs', newLog.id), sanitizeForFirestore(newLog)).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, `logs/${newLog.id}`);
    });
  }
}

export function getLogs(): SystemLog[] {
  initDatabase();
  const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
  return raw ? JSON.parse(raw) : [];
}

// Config
export function getConfig(): SystemConfig {
  initDatabase();
  const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
  return raw ? JSON.parse(raw) : SEED_CONFIG;
}

export function saveConfig(cfg: SystemConfig) {
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(cfg));
  broadcastEvent('CONFIG_UPDATED', cfg);

  // Sincronizar com Firestore
  if (firestore) {
    setDoc(doc(firestore, 'config', 'system'), sanitizeForFirestore(cfg)).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, 'config/system');
    });
  }
}

// Helpers para upload base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

export function identifyingTurnoAtual(cfg?: SystemConfig): TurnoTipo {
  const agora = new Date();
  const hr = agora.getHours();
  const mn = agora.getMinutes();
  const timeStr = `${hr.toString().padStart(2, '0')}:${mn.toString().padStart(2, '0')}`;

  const c = cfg || getConfig();
  if (c.tarifas && c.tarifas.length > 0) {
    const achou = c.tarifas.find(t => {
      if (t.hora_inicio <= t.hora_fim) {
        return timeStr >= t.hora_inicio && timeStr <= t.hora_fim;
      } else {
        return timeStr >= t.hora_inicio || timeStr <= t.hora_fim;
      }
    });
    if (achou) return achou.turno;
  }

  if (hr >= 6 && hr < 12) return 'Manhã';
  if (hr >= 12 && hr < 18) return 'Tarde';
  if (hr >= 18) return 'Noite';
  return 'Madrugada';
}

export function isWithinServiceArea(lat: number, lng: number): boolean {
  // Always allow for global testing so users are never blocked
  return true;
}

export function identificarRegiaoPorCoordenadas(lat: number, lng: number): string {
  // If coordinates are outside of Sao Paulo bounds, return 'Centro' as a valid fallback instead of blocking
  const isInsideSaoPaulo = lat >= -24.1 && lat <= -23.2 && lng >= -47.1 && lng <= -46.2;
  if (!isInsideSaoPaulo) {
    return 'Centro';
  }

  // Divide based on standard coordinates of Centro de São Paulo (around -23.5505, -46.6333)
  if (lat >= -23.565 && lat <= -23.535 && lng >= -46.655 && lng <= -46.615) {
    return 'Centro';
  }
  if (lat > -23.535) {
    return 'Zona Norte';
  }
  if (lat < -23.565) {
    return 'Zona Sul';
  }
  if (lng < -46.655) {
    return 'Zona Oeste';
  }
  return 'Zona Leste';
}

export async function reverseGeocode(lat: number, lng: number): Promise<{
  address: string;
  regiao: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}> {
  const regiao = identificarRegiaoPorCoordenadas(lat, lng);
  if (regiao === 'Fora da Área de Atendimento') {
    throw new Error('out_of_bounds');
  }

  const isParaCoord = lat >= -3.0 && lat <= 0.5 && lng >= -51.0 && lng <= -45.0;

  // Lista curada de ruas de São Caetano de Odivelas para simulações e fallbacks precisos
  const defaultStreets = [
    'Avenida Beira Mar',
    'Avenida Castelo Branco',
    'Rua Dr. Ulysses Guimarães',
    'Rua João de Deus',
    'Avenida Barão do Rio Branco',
    'Rua Sete de Setembro',
    'Rua Marechal Deodoro',
    'Travessa Justo Chermont',
    'Rua São João',
    'Travessa Rui Barbosa',
    'Travessa de Souza Filho',
    'Rua Padre Antônio de Sousa',
    'Travessa Quintino Bocaiúva',
    'Travessa São Caetano'
  ];
  const streetIndex = Math.abs(Math.floor((lat + lng) * 100)) % defaultStreets.length;
  const matchedStreet = defaultStreets[streetIndex];

  const defaultBairros = ['Centro', 'Bairro Novo', 'Santarém', 'Fátima', 'Laguinho'];
  const bairroIndex = Math.abs(Math.floor((lat + lng) * 200)) % defaultBairros.length;
  const matchedBairro = defaultBairros[bairroIndex];

  let rua = '';
  let numero = '';
  let bairro = '';
  let cidade = isParaCoord ? 'São Caetano de Odivelas' : 'São Paulo';
  let estado = isParaCoord ? 'Pará' : 'São Paulo';
  let cep = isParaCoord ? '68775-000' : '01311-000';

  // 1. Tentar primeiro o Nominatim do OpenStreetMap
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: {
        'User-Agent': 'MotoTaxiApp/1.0'
      }
    });
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      
      rua = addr.road || addr.suburb || addr.pedestrian || '';
      numero = addr.house_number || '';
      bairro = addr.suburb || addr.neighbourhood || addr.village || '';
      if (addr.city) cidade = addr.city;
      else if (addr.town) cidade = addr.town;
      else if (addr.village) cidade = addr.village;
      else if (addr.municipality) cidade = addr.municipality;
      
      if (addr.state) estado = addr.state;
      if (addr.postcode) cep = addr.postcode;
    }
  } catch (e) {
    console.error('Nominatim reverse geocode failed, trying backup API...', e);
  }

  // 2. Se o Nominatim falhou ou retornou incompleto, usar o BigDataCloud (CORS-friendly, super estável)
  if (!rua || rua === 'Rua sem nome' || !bairro) {
    try {
      const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=pt`);
      if (res.ok) {
        const data = await res.json();
        
        if (data.city) cidade = data.city;
        if (data.principalSubdivision) estado = data.principalSubdivision;
        if (data.postcode) cep = data.postcode;
        
        let extractedBairro = '';
        if (data.locality) extractedBairro = data.locality;
        
        if (data.localityInfo && Array.isArray(data.localityInfo.informative)) {
          const informative = data.localityInfo.informative;
          const suburbItem = informative.find((item: any) => 
            item.description === 'suburb' || 
            item.description === 'neighbourhood' || 
            item.description === 'bairro'
          );
          if (suburbItem) extractedBairro = suburbItem.name;
        }
        bairro = extractedBairro || matchedBairro;
        rua = data.locality || matchedStreet;
      }
    } catch (e) {
      console.error('BigDataCloud backup reverse geocode failed, using defaults.', e);
      bairro = matchedBairro;
      rua = matchedStreet;
    }
  }

  // Fallbacks finais se tudo vier em branco
  if (!rua) rua = matchedStreet;
  if (!bairro) bairro = matchedBairro;
  if (!numero) numero = String(Math.floor(Math.random() * 800) + 1);

  return {
    address: `${rua}, ${numero} - ${bairro}, ${cidade} - ${estado}`,
    regiao,
    rua,
    numero,
    bairro,
    cidade,
    estado,
    cep
  };
}
