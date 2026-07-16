import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowLeft, AlertTriangle } from 'lucide-react';

export function SecretAdminPortal() {
  const { atualizarUsuarioLogado, setSecretAdminUnlocked } = useAuth();
  const navigate = useNavigate();
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // E-mails autorizados para acesso administrativo
  const allowedEmails = ['wesleydani72@gmail.com', 'jl6568402@gmail.com'];

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loading(true);

    const emailClean = emailInput.toLowerCase().trim();
    const isEmailAllowed = allowedEmails.includes(emailClean);

    // Validar e-mail de administrador
    if (!isEmailAllowed) {
      setError('Acesso negado: Seu e-mail não tem autorização para acessar esta área secreta.');
      loading(false);
      setTimeout(() => {
        navigate('/');
      }, 3000);
      return;
    }

    // Senhas mestras aceitas no portal de segurança
    const correctPasswords = ['W&sl&y194080', 'WesleyAdmin2026', 'WesleyMotoTaxiAdmin72'];
    const isPasswordCorrect = correctPasswords.includes(passwordInput.trim());

    if (!isPasswordCorrect) {
      setError('Acesso negado: Senha mestra de administrador incorreta.');
      loading(false);
      setTimeout(() => {
        navigate('/');
      }, 3000);
      return;
    }

    // Sucesso! Autenticar o administrador correto
    setSuccess(true);
    
    // Identificar dinamicamente os dados corretos de perfil para o painel
    const isWesley = emailClean === 'wesleydani72@gmail.com';
    const adminId = isWesley ? 'admin_wesley' : 'admin_1';
    const adminNome = isWesley ? 'Wesley Pereira Ferreira' : 'Administrador Geral';
    
    // Se for o Wesley, podemos definir dados personalizados de perfil
    const adminUser = {
      id: adminId,
      role: 'admin' as const,
      nome: adminNome,
      email: emailClean,
      telefone: isWesley ? '(11) 99999-0000' : '(11) 99999-0000',
      senha: passwordInput.trim(),
      status: 'ativo' as const,
      passwordCreated: true,
      // Se for o Wesley, você pode adicionar a sua foto real aqui depois se quiser!
      foto: isWesley 
        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' // Imagem alternativa/sua
        : 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      criadoEm: '2026-06-01',
    };

    setTimeout(() => {
      // Gravar sessão ativa no navegador
      localStorage.setItem('mototaxi_logged_session_id', adminUser.id);
      
      // Atualizar o estado global do aplicativo com as credenciais limpas
      atualizarUsuarioLogado(adminUser);
      setSecretAdminUnlocked(true);
      
      setLoading(false);
      navigate('/'); // Redireciona para a página inicial atualizada com o painel correto
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4 overflow-y-auto">
      {/* Decoração de fundo */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#facc15_1px,transparent_1px)] [background-size:16px_16px]" />
      
      <div className="bg-slate-900 border border-slate-800 rounded-[32px] p-8 max-w-md w-full shadow-2xl relative z-10 space-y-8 animate-fade-in">
        {/* Cabeçalho */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <Shield className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white tracking-tight">Portal Administrativo</h2>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Acesso Restrito & Criptografado</p>
          </div>
        </div>

        {/* Notificação de Erro */}
        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex gap-3 text-left animate-shake">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-red-400">Bloqueio de Segurança</p>
              <p className="text-red-300/80 font-medium mt-0.5 leading-relaxed">{error}</p>
              <p className="text-slate-500 font-bold mt-1.5 uppercase tracking-wider text-[10px]">Redirecionando em instantes...</p>
            </div>
          </div>
        ) : success ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex gap-3 text-left">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0 mt-1.5" />
            <div className="text-xs">
              <p className="font-bold text-emerald-400">Acesso Concedido</p>
              <p className="text-emerald-300/80 font-medium mt-0.5">Credenciais validadas. Inicializando painel...</p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <p className="text-left text-xs text-slate-400 font-semibold">
              Digite seu e-mail administrativo e a senha mestra para autenticar.
            </p>
          </div>
        )}

        {/* Formulário de Login */}
        {!success && !error && (
          <form onSubmit={handleVerify} className="space-y-5">
            {/* Campo de E-mail */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider text-left">
                E-mail de Administrador
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="exemplo@admin.com"
                  required
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-sm font-semibold text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Campo de Senha */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider text-left">
                Senha Mestra de Administrador
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-sm font-semibold text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/')}
                disabled={loading}
                className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 border border-slate-700/50"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-2xl font-black text-xs transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 active:scale-98"
              >
                {loading ? 'Verificando...' : 'Liberar Painel'}
              </button>
            </div>
          </form>
        )}

        {/* Estado de Carregamento */}
        {(loading || success || error) && (
          <div className="flex flex-col items-center justify-center py-4 space-y-3">
            <div className={`w-6 h-6 border-2 ${error ? 'border-red-500' : 'border-amber-500'} border-t-transparent rounded-full animate-spin`} />
            <p className="text-xs text-slate-500 font-medium">
              {error ? 'Retornando à página inicial...' : 'Aguarde um momento...'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
