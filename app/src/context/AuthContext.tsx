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

    // Ouvir atualizações real-time do usuário atual
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

    // Tratamento dinâmico para os Administradores Autorizados
    if (roleDesejada === 'admin') {
      let adminUser = users.find(u => u.role === 'admin' && u.email?.toLowerCase() === idClean);
      
      // Se for o seu novo e-mail e ele ainda não estiver no banco local, criamos o 'admin_wesley'
      if (!adminUser && idClean === 'wesleydani72@gmail.com') {
        const novoAdmin: AdminUser = {
          id: 'admin_wesley',
          role: 'admin',
          nome: 'Wesley Pereira Ferreira',
          email: 'wesleydani72@gmail.com',
          telefone: '(11) 99999-0000',
          senha: 'admin', // Altere para a senha padrão provisória que desejar
          status: 'ativo',
          passwordCreated: true,
          foto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
          criadoEm: '2026-06-01',
        };
        try {
          saveUser(novoAdmin);
        } catch (e) {
          console.warn("Erro ao registrar admin Wesley dinâmico:", e);
        }
        adminUser = novoAdmin;
      }
      // Mantém a compatibilidade com o antigo caso ele ainda precise logar temporariamente
      else if (!adminUser && idClean === 'jl6568402@gmail.com') {
        const novoAdmin: AdminUser = {
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
        };
        try {
          saveUser(novoAdmin);
        } catch (e) {
          console.warn("Erro ao registrar admin antigo dinâmico:", e);
        }
        adminUser = novoAdmin;
      }
      
      if (!adminUser) {
        return { sucesso: false, erro: 'Administrador não encontrado com este e-mail.' };
      }

      if (adminUser.senha !== senhaDigitada) {
        return { sucesso: false, erro: 'Senha incorreta para o Administrador.' };
      }

      localStorage.setItem(SESSION_KEY, adminUser.id);
      setCurrentUser(adminUser as any);
      return { sucesso: true };
    }

    // Busca direta na coleção 'clientes' do Firestore
    if (roleDesejada === 'cliente' && firestore) {
      try {
        const { collection, getDocs, query, where } = await import('firebase/firestore');
        const q = query(
          collection(firestore, 'clientes'),
          where('email', '==', idClean)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          let clientDoc: any = null;
          snapshot.forEach(doc => {
            clientDoc = { ...doc.data(), id: doc.id };
          });
          
          if (clientDoc) {
            if (clientDoc.senha !== senhaDigitada) {
              return { sucesso: false, erro: 'Senha incorreta.' };
            }
            if (clientDoc.status === 'bloqueado' || clientDoc.status === 'inativo') {
              return { sucesso: false, erro: 'Este usuário está bloqueado ou inativo no sistema.' };
            }

            const fullClientObj = {
              ...clientDoc,
              role: 'cliente' as const,
              passwordCreated: true,
              cadastroCompleto: true,
              cidade: clientDoc.cidade || 'São Caetano de Odivelas - PA',
              bairro: clientDoc.bairro || 'Não informado',
              endereco: clientDoc.endereco || 'Não informado',
              pontoReferencia: clientDoc.pontoReferencia || 'Não informado',
              criadoEm: clientDoc.criadoEm || new Date().toISOString().split('T')[0],
              foto: clientDoc.foto || ''
            };
            
            saveUser(fullClientObj);

            localStorage.setItem(SESSION_KEY, clientDoc.id);
            setCurrentUser(fullClientObj);
            return { sucesso: true };
          }
        }
      } catch (err) {
        console.warn("Erro ao buscar diretamente na coleção 'clientes' do Firestore:", err);
      }
    }

    const user = users.find(u => {
      if (u.role !== roleDesejada) return false;
      if (u.role === 'mototaxista') {
        return u.placa.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === idClean.replace(/[^a-zA-Z0-9]/g, '');
      } else {
        return (u as any).email?.toLowerCase() === idClean;
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

    const updated: AnyUser = {
      ...user,
      senha: novaSenha,
      senha_hash: user.role === 'mototaxista' ? hashSenha(novaSenha) : undefined,
      passwordCreated: true,
    };

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
    };
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
