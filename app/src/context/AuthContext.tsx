import React, { createContext, useContext, useState, useEffect } from 'react';
import { AnyUser, UserRole, MototaxistaUser, AdminUser } from '../types';
import { getUsers, saveUser, initDatabase, subscribeRealtime } from '../lib/db';
import { firestore } from '../lib/firebase';

export function hashSenha(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return `sec_${Math.abs(hash).toString(16)}_${btoa(str)}`;
}

interface AuthContextType {
  currentUser: AnyUser | null;
  login: (identificador: string, senhaDigitada: string, roleDesejada: UserRole) => Promise<{ sucesso: boolean; erro?: string; precisaCriarSenha?: boolean; userId?: string; cadastroIncompleto?: boolean; motoData?: MototaxistaUser }> | { sucesso: boolean; erro?: string; precisaCriarSenha?: boolean; userId?: string; cadastroIncompleto?: boolean; motoData?: MototaxistaUser };
  criarSenhaPrimeiroAcesso: (userId: string, novaSenha: string) => { sucesso: boolean; erro?: string };
  completarCadastroCliente: (dados: Partial<AnyUser>) => void;
  logout: () => void;
  atualizarUsuarioLogado: (user: AnyUser) => void;
  isSecretAdminUnlocked: boolean;
  setSecretAdminUnlocked: (unlocked: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_KEY = 'mototaxi_logged_session_id';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AnyUser | null>(null);
  const [isSecretAdminUnlocked, setSecretAdminUnlocked] = useState(false);

  useEffect(() => {
    initDatabase();
    const savedId = localStorage.getItem(SESSION_KEY);
    if (savedId) {
      const users = getUsers();
      const found = users.find(u => u.id === savedId);
      if (found && found.status !== 'bloqueado') {
        setCurrentUser(found);
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    }

    const unsubscribe = subscribeRealtime((event, payload) => {
      if (event === 'USER_UPDATED' && payload && currentUser && payload.id === currentUser.id) {
        if (payload.status === 'bloqueado' || payload.status === 'inativo') {
          localStorage.removeItem(SESSION_KEY);
          setCurrentUser(null);
        } else {
          setCurrentUser(payload);
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser?.id]);

  const login = async (identificador: string, senhaDigitada: string, roleDesejada: UserRole) => {
    initDatabase();
    const users = getUsers();
    const idClean = identificador.trim().toLowerCase();

    if (roleDesejada === 'admin') {
      let adminUser = users.find(u => u.role === 'admin' && u.email?.toLowerCase() === idClean);
      
      if (!adminUser && idClean === 'wesleydani72@gmail.com') {
        const novoAdmin = {
          id: 'admin_wesley',
          role: 'admin' as const,
          nome: 'Wesley Pereira Ferreira',
          email: 'wesleydani72@gmail.com',
          telefone: '(11) 99999-0000',
          senha: 'admin',
          status: 'ativo',
          passwordCreated: true,
          foto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
          criadoEm: '2026-06-01',
        };
        
        try {
          saveUser(novoAdmin as unknown as AnyUser);
        } catch (e) {
          console.warn("Erro ao registrar admin Wesley:", e);
        }
        adminUser = novoAdmin as unknown as AnyUser;
      }
      else if (!adminUser && idClean === 'jl6568402@gmail.com') {
        const novoAdmin = {
          id: 'admin_1',
          role: 'admin' as const,
          nome: 'Administrador Geral',
          email: 'jl6568402@gmail.com',
          telefone: '(11) 99999-0000',
          senha: 'admin',
          status: 'ativo',
          passwordCreated: true,
          foto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
          criadoEm: '2026-06-01',
        };
        
        try {
          saveUser(novoAdmin as unknown as AnyUser);
        } catch (e) {
          console.warn("Erro ao registrar admin antigo:", e);
        }
        adminUser = novoAdmin as unknown as AnyUser;
      }
      
      if (!adminUser) {
        return { sucesso: false, erro: 'Administrador não encontrado com este e-mail.' };
      }

      if (adminUser.senha !== senhaDigitada) {
        return { sucesso: false, erro: 'Senha incorreta para o Administrador.' };
      }

      localStorage.setItem(SESSION_KEY, adminUser.id);
      setCurrentUser(adminUser as AnyUser);
      return { sucesso: true };
    }

    if (roleDesejada === 'cliente' && firestore) {
      try {
        const { collection, getDocs, query, where } = await import('firebase/firestore');
        const q = query(
          collection(firestore, 'clientes'),
          where('email', '==', idClean)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          let clientData: Record<string, unknown> | null = null;
          snapshot.forEach(doc => {
            clientData = { ...doc.data(), id: doc.id };
          });
          
          if (clientData) {
            const tempClient = clientData as Record<string, string>;
            if (tempClient.senha !== senhaDigitada) {
              return { sucesso: false, erro: 'Senha incorreta.' };
            }
            if (tempClient.status === 'bloqueado' || tempClient.status === 'inativo') {
              return { sucesso: false, erro: 'Este usuário está bloqueado ou inativo no sistema.' };
            }

            const fullClientObj = {
              id: tempClient.id,
              role: 'cliente' as const,
              nome: tempClient.nome || 'Cliente',
              email: tempClient.email || '',
              telefone: tempClient.telefone || '',
              senha: tempClient.senha || '',
              status: tempClient.status || 'ativo',
              passwordCreated: true,
              cadastroCompleto: true,
              cidade: tempClient.cidade || 'São Caetano de Odivelas - PA',
              bairro: tempClient.bairro || 'Não informado',
              endereco: tempClient.endereco || 'Não informado',
              pontoReferencia: tempClient.pontoReferencia || 'Não informado',
              criadoEm: tempClient.criadoEm || new Date().toISOString().split('T')[0],
              foto: tempClient.foto || ''
            };
            
            saveUser(fullClientObj as unknown as AnyUser);

            localStorage.setItem(SESSION_KEY, tempClient.id);
            setCurrentUser(fullClientObj as unknown as AnyUser);
            return { sucesso: true };
          }
        }
      } catch (err) {
        console.warn("Erro ao buscar cliente no Firestore:", err);
      }
    }

    const user = users.find(u => {
      if (u.role !== roleDesejada) return false;
      if (u.role === 'mototaxista') {
        const placaClean = u.placa.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const idCleanPlaca = idClean.replace(/[^a-zA-Z0-9]/g, '');
        return placaClean === idCleanPlaca;
      } else {
        const uEmail = (u as Record<string, unknown>).email as string | undefined;
        return uEmail?.toLowerCase() === idClean;
      }
    });

    if (!user) {
      if (roleDesejada === 'mototaxista') {
        return { sucesso: false, erro: 'Placa não cadastrada. Clique em "Criar Cadastro" logo abaixo para se registrar.' };
      }
      return { sucesso: false, erro: 'E-mail não encontrado.' };
    }

    if (roleDesejada === 'mototaxista') {
      const moto = user as MototaxistaUser;

      if (!moto.passwordCreated || (!moto.senha && !moto.senha_hash)) {
        return { sucesso: false, precisaCriarSenha: true, userId: moto.id };
      }

      const senhaValida = senhaDigitada === moto.senha || hashSenha(senhaDigitada) === moto.senha_hash;
      if (!senhaValida) {
        return { sucesso: false, erro: 'Senha incorreta.' };
      }

      const stNorm = moto.status_cadastro?.trim().toUpperCase() || '';
      const apNorm = moto.status_aprovacao?.trim().toUpperCase() || '';

      if (moto.status === 'bloqueado' || stNorm === 'BLOQUEADO' || apNorm === 'BLOQUEADO') {
        return { sucesso: false, erro: 'Seu cadastro encontra-se bloqueado. Entre em contato com a administração.' };
      }

      if (stNorm.includes('INCOMPLETO') || stNorm.includes('CORREÇÃO') || apNorm === 'REJEITADO') {
        return { sucesso: false, cadastroIncompleto: true, motoData: moto };
      }

      if (stNorm === 'AGUARDANDO APROVAÇÃO' || apNorm === 'PENDENTE') {
        return { sucesso: false, erro: 'Seu cadastro está em análise pela administração.' };
      }

      localStorage.setItem(SESSION_KEY, moto.id);
      setCurrentUser(moto);
      return { sucesso: true };
    }

    if (user.status === 'bloqueado' || user.status === 'inativo') {
      return { sucesso: false, erro: 'Este usuário está bloqueado ou inativo no sistema.' };
    }

    if (!user.passwordCreated || !user.senha) {
      return { sucesso: false, precisaCriarSenha: true, userId: user.id };
    }

    if (user.senha !== senhaDigitada) {
      return { sucesso: false, erro: 'Senha incorreta.' };
    }

    localStorage.setItem(SESSION_KEY, user.id);
    setCurrentUser(user);
    return { sucesso: true };
  };

  const criarSenhaPrimeiroAcesso = (userId: string, novaSenha: string) => {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return { sucesso: false, erro: 'Usuário não encontrado.' };

    const baseUpdated = {
      ...user,
      senha: novaSenha,
      passwordCreated: true,
    };

    const updated = (
      user.role === 'mototaxista' 
        ? { ...baseUpdated, senha_hash: hashSenha(novaSenha) } 
        : baseUpdated
    ) as AnyUser;

    saveUser(updated);
    localStorage.setItem(SESSION_KEY, updated.id);
    setCurrentUser(updated);
    return { sucesso: true };
  };

  const completarCadastroCliente = (dados: Partial<AnyUser>) => {
    if (!currentUser || currentUser.role !== 'cliente') return;
    const updated = {
      ...currentUser,
      ...dados,
      cadastroCompleto: true,
    } as AnyUser;
    saveUser(updated);
    setCurrentUser(updated);
  };

  const atualizarUsuarioLogado = (user: AnyUser) => {
    saveUser(user);
    setCurrentUser(user);
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
    setSecretAdminUnlocked(false);
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      login,
      criarSenhaPrimeiroAcesso,
      completarCadastroCliente,
      logout,
      atualizarUsuarioLogado,
      isSecretAdminUnlocked,
      setSecretAdminUnlocked
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  return context;
}
