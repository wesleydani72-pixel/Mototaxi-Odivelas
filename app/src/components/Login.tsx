import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { Shield, Bike, User, ArrowRight, Key, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { DriverSignupModal } from './driver/DriverSignupModal';
import { ClientSignupModal } from './client/ClientSignupModal';
import { auth } from '../lib/firebase';
import { getUsers, saveUser } from '../lib/db';

export function Login() {
  const { login, criarSenhaPrimeiroAcesso } = useAuth();
  const [activeTab, setActiveTab] = useState<UserRole>('cliente');
  const [abrirCriarCadastro, setAbrirCriarCadastro] = useState(false);
  const [abrirCriarCadastroCliente, setAbrirCriarCadastroCliente] = useState(() => {
    try {
      return localStorage.getItem('signup_client_active') === 'true';
    } catch {
      return false;
    }
  });
  const [mototaxistaPendente, setMototaxistaPendente] = useState<any>(undefined);

  React.useEffect(() => {
    try {
      localStorage.setItem('signup_client_active', abrirCriarCadastroCliente ? 'true' : 'false');
    } catch (e) {
      console.warn('Erro ao salvar estado ativo do cadastro de cliente:', e);
    }
  }, [abrirCriarCadastroCliente]);

  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  // Estados de Primeiro Acesso (Criar Senha)
  const [etapaCriarSenha, setEtapaCriarSenha] = useState(false);
  const [userIdPrimeiroAcesso, setUserIdPrimeiroAcesso] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  // Estados de Recuperação/Atualização de Senha Direta
  const [recuperandoSenha, setRecuperandoSenha] = useState(false);
  const [identificadorRecuperacao, setIdentificadorRecuperacao] = useState(''); // E-mail ou Placa
  const [novaSenhaRecuperacao, setNovaSenhaRecuperacao] = useState('');
  const [confirmarSenhaRecuperacao, setConfirmarSenhaRecuperacao] = useState('');
  const [atualizandoSenhaRecuperacao, setAtualizandoSenhaRecuperacao] = useState(false);
  const [sucessoRecuperacao, setSucessoRecuperacao] = useState('');

  const handleAtualizarSenhaDireto = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setSucessoRecuperacao('');

    const idLimpo = identificadorRecuperacao.trim();
    if (!idLimpo) {
      setErro(`Por favor, informe o seu ${activeTab === 'mototaxista' ? 'número da placa' : 'e-mail'}.`);
      return;
    }

    if (novaSenhaRecuperacao.length < 4) {
      setErro('A nova senha deve ter pelo menos 4 caracteres.');
      return;
    }

    if (novaSenhaRecuperacao !== confirmarSenhaRecuperacao) {
      setErro('As senhas digitadas não coincidem.');
      return;
    }

    setAtualizandoSenhaRecuperacao(true);

    try {
      const users = getUsers();
      let foundUser = users.find(u => {
        if (u.role !== activeTab) return false;
        if (activeTab === 'mototaxista') {
          return ((u as any).placa || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === idLimpo.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        } else {
          return (u as any).email?.trim().toLowerCase() === idLimpo.toLowerCase();
        }
      });

      // Se for administrador e não existir ainda localmente, criamos na hora (como o login faz)
      if (!foundUser && activeTab === 'admin') {
        const emailClean = idLimpo.toLowerCase().trim();
        if (emailClean === 'jl6568402@gmail.com') {
          const { hashSenha } = await import('../context/AuthContext');
          const novoAdmin: any = {
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
          saveUser(novoAdmin);
          foundUser = novoAdmin;
        } else if (emailClean === 'wesleydani72@gmail.com') {
          const { hashSenha } = await import('../context/AuthContext');
          const novoAdmin: any = {
            id: 'admin_wesley',
            role: 'admin',
            nome: 'Wesley Pereira Ferreira',
            email: 'wesleydani72@gmail.com',
            telefone: '(11) 99999-0000',
            senha: 'admin',
            status: 'ativo',
            passwordCreated: true,
            foto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
            criadoEm: '2026-06-01',
          };
          saveUser(novoAdmin);
          foundUser = novoAdmin;
        }
      }

      if (!foundUser) {
        setErro(`Não encontramos nenhum ${activeTab === 'mototaxista' ? 'mototaxista com a placa' : activeTab === 'admin' ? 'administrador com o e-mail' : 'cliente com o e-mail'} informado.`);
        setAtualizandoSenhaRecuperacao(false);
        return;
      }

      // Importar hashSenha de AuthContext para criptografar se for mototaxista
      const { hashSenha } = await import('../context/AuthContext');

      const updatedUser: any = {
        ...foundUser,
        senha: novaSenhaRecuperacao,
        passwordCreated: true,
      };

      if (foundUser.role === 'mototaxista') {
        updatedUser.senha_hash = hashSenha(novaSenhaRecuperacao);
      } else if ('senha_hash' in updatedUser) {
        delete updatedUser.senha_hash;
      }

      saveUser(updatedUser);
      setSucessoRecuperacao('Senha atualizada com sucesso no banco de dados! Agora você já pode voltar e fazer o login com a nova senha.');
      
      // Limpar campos de senha por segurança
      setNovaSenhaRecuperacao('');
      setConfirmarSenhaRecuperacao('');
    } catch (err: any) {
      console.error("Erro ao redefinir senha no Firestore:", err);
      setErro('Erro ao atualizar a senha no banco de dados: ' + (err.message || String(err)));
    } finally {
      setAtualizandoSenhaRecuperacao(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!identificador.trim()) {
      setErro(`Informe seu ${activeTab === 'mototaxista' ? 'número da placa' : 'e-mail'}.`);
      return;
    }

    const res = await login(identificador, senha, activeTab);
    if (!res.sucesso) {
      if (res.precisaCriarSenha && res.userId) {
        setUserIdPrimeiroAcesso(res.userId);
        setEtapaCriarSenha(true);
        setErro('');
      } else if (res.cadastroIncompleto && res.motoData) {
        setMototaxistaPendente(res.motoData);
        setAbrirCriarCadastro(true);
        setErro('');
      } else {
        setErro(res.erro || 'Falha ao realizar login.');
      }
    }
  };

  const handleCriarSenhaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (novaSenha.length < 4) {
      setErro('A senha deve ter pelo menos 4 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }

    const res = criarSenhaPrimeiroAcesso(userIdPrimeiroAcesso, novaSenha);
    if (!res.sucesso) {
      setErro(res.erro || 'Erro ao criar senha.');
    }
  };

  const trocarTab = (role: UserRole) => {
    setActiveTab(role);
    setIdentificador('');
    setSenha('');
    setErro('');
    setEtapaCriarSenha(false);
    setRecuperandoSenha(false);
    setIdentificadorRecuperacao('');
    setNovaSenhaRecuperacao('');
    setConfirmarSenhaRecuperacao('');
    setSucessoRecuperacao('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-sans text-slate-800">
      <div className="w-full max-w-md bg-white rounded-[32px] shadow-xl border border-slate-200/80 p-8 sm:p-10 transition-all">
        {/* Logo Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-yellow-400 rounded-3xl mx-auto flex items-center justify-center font-black text-3xl text-slate-900 shadow-sm mb-4">
            M
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">MotoTáxi</h1>
          <p className="text-xs font-medium text-slate-400 mt-1">Plataforma Inteligente de Transporte</p>
        </div>

        {/* Tabs de Tipo de Usuário */}
        {!etapaCriarSenha && !recuperandoSenha && (
          <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
            <button
              type="button"
              onClick={() => trocarTab('cliente')}
              className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${activeTab === 'cliente' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <User className="w-4 h-4 text-blue-500" />
              Cliente
            </button>
            <button
              type="button"
              onClick={() => trocarTab('mototaxista')}
              className={`flex-1 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${activeTab === 'mototaxista' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Bike className="w-4 h-4 text-emerald-500" />
              Mototaxista
            </button>
          </div>
        )}

        {recuperandoSenha && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
            <h3 className="text-sm font-black text-blue-900 mb-1">Recuperação de Senha</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Recuperando acesso para a conta de <span className="font-bold text-blue-800 capitalize">{activeTab === 'mototaxista' ? 'Mototaxista' : activeTab === 'cliente' ? 'Cliente' : 'Administrador'}</span>.
            </p>
          </div>
        )}

        {/* Feedback de Erro */}
        {erro && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs flex items-center gap-3 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/* Formulário de Primeiro Acesso (Criar Senha) */}
        {etapaCriarSenha ? (
          <form onSubmit={handleCriarSenhaSubmit} className="space-y-5 animate-fade-in">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-2xl mb-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-xs mb-1">
                <Sparkles className="w-4 h-4 text-yellow-600" />
                Primeiro Acesso Identificado
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Por segurança, crie sua senha definitiva de acesso antes de prosseguir para o painel.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Nova Senha
              </label>
              <input
                type="password"
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                placeholder="Digite sua nova senha"
                required
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Confirme a Senha
              </label>
              <input
                type="password"
                value={confirmarSenha}
                onChange={e => setConfirmarSenha(e.target.value)}
                placeholder="Repita a nova senha"
                required
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white transition-all"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setEtapaCriarSenha(false)}
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition-all"
              >
                Voltar
              </button>
              <button
                type="submit"
                className="flex-1 py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                Salvar e Entrar
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : recuperandoSenha ? (
          /* Formulário de Recuperação de Senha */
          <form onSubmit={handleAtualizarSenhaDireto} className="space-y-5 animate-fade-in">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 font-semibold">
                {activeTab === 'mototaxista' ? 'Número da sua Placa' : 'E-mail cadastrado'}
              </label>
              <input
                type={activeTab === 'mototaxista' ? 'text' : 'email'}
                value={identificadorRecuperacao}
                onChange={e => setIdentificadorRecuperacao(e.target.value)}
                placeholder={activeTab === 'mototaxista' ? 'Ex: ABC1D23' : 'seu-email@provedor.com'}
                required
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 font-semibold">
                Digite a Nova Senha
              </label>
              <input
                type="password"
                value={novaSenhaRecuperacao}
                onChange={e => setNovaSenhaRecuperacao(e.target.value)}
                placeholder="Mínimo de 4 caracteres"
                required
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 font-semibold">
                Confirme a Nova Senha
              </label>
              <input
                type="password"
                value={confirmarSenhaRecuperacao}
                onChange={e => setConfirmarSenhaRecuperacao(e.target.value)}
                placeholder="Repita a nova senha"
                required
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white transition-all"
              />
            </div>

            {sucessoRecuperacao && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-start gap-3 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{sucessoRecuperacao}</span>
              </div>
            )}

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setRecuperandoSenha(false);
                  setErro('');
                  setSucessoRecuperacao('');
                }}
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition-all"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={atualizandoSenhaRecuperacao}
                className="flex-1 py-4 bg-yellow-400 hover:bg-yellow-500 disabled:bg-slate-200 disabled:text-slate-400 text-slate-900 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                {atualizandoSenhaRecuperacao ? 'Atualizando...' : 'Atualizar Senha'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          /* Formulário de Login Normal */
          <form onSubmit={handleLoginSubmit} className="space-y-5 animate-fade-in">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                {activeTab === 'mototaxista' ? 'Número da Placa' : 'E-mail de Acesso'}
              </label>
              <input
                type={activeTab === 'mototaxista' ? 'text' : 'email'}
                value={identificador}
                onChange={e => setIdentificador(e.target.value)}
                placeholder={activeTab === 'mototaxista' ? 'Ex: ABC1D23 ou MTO9988' : activeTab === 'admin' ? 'admin@email.com' : 'cliente@email.com'}
                required
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white transition-all font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white transition-all"
              />
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setErro('');
                    setSucessoRecuperacao('');
                    // Pré-preenche o identificador na redefinição se o usuário já tiver digitado algo no formulário
                    if (identificador.trim()) {
                      setIdentificadorRecuperacao(identificador.trim());
                    } else {
                      setIdentificadorRecuperacao('');
                    }
                    setRecuperandoSenha(true);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-bold hover:underline transition-all cursor-pointer"
                >
                  Esqueci minha senha
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all mt-6 cursor-pointer"
            >
              Acessar Painel
              <ArrowRight className="w-4 h-4" />
            </button>

            {activeTab === 'mototaxista' && (
              <div className="text-center pt-3">
                <button
                  type="button"
                  onClick={() => { setMototaxistaPendente(undefined); setAbrirCriarCadastro(true); }}
                  className="text-emerald-600 hover:text-emerald-700 font-extrabold text-sm underline transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  Criar Cadastro
                </button>
              </div>
            )}

            {activeTab === 'cliente' && (
              <div className="text-center pt-3">
                <button
                  type="button"
                  onClick={() => setAbrirCriarCadastroCliente(true)}
                  className="text-blue-600 hover:text-blue-700 font-extrabold text-sm underline transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  Criar Cadastro
                </button>
              </div>
            )}
          </form>
        )}
      </div>

      {abrirCriarCadastro && (
        <DriverSignupModal
          isOpen={abrirCriarCadastro}
          onClose={() => { setAbrirCriarCadastro(false); setMototaxistaPendente(undefined); }}
          initialData={mototaxistaPendente}
        />
      )}

      {abrirCriarCadastroCliente && (
        <ClientSignupModal
          isOpen={abrirCriarCadastroCliente}
          onClose={() => setAbrirCriarCadastroCliente(false)}
        />
      )}
    </div>
  );
}
