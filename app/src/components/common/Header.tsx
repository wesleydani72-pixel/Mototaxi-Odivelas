import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Bell } from 'lucide-react';
import { getNotifications, subscribeRealtime, markNotificationsAsRead, getRides } from '../../lib/db';

export function Header() {
  const { currentUser, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRideScreen, setIsRideScreen] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const carregar = () => {
      try {
        const list = getNotifications();
        const seen = new Set<string>();
        const myNotifs = list.filter(n => {
          if (!n.id) return false;
          if (seen.has(n.id)) return false;
          seen.add(n.id);
          return n.destinatarioId === currentUser.id || 
            n.destinatarioId === (currentUser.role === 'mototaxista' ? 'all_drivers' : '') ||
            n.destinatarioRole === currentUser.role;
        });
        const unread = myNotifs.filter(n => !n.lida).length;
        setUnreadCount(unread);

        // Check ride screen status
        const rides = getRides();
        if (currentUser.role === 'mototaxista') {
          const hasActive = rides.some(r => 
            r.mototaxistaId === currentUser.id && 
            !['finalizada', 'cancelada', 'FINALIZADA', 'CANCELADA'].includes(r.status)
          );
          const hasPending = rides.some(r => 
            ['aguardando', 'SOLICITADA', 'AGUARDANDO_MOTORISTA'].includes(r.status) &&
            (!r.recusadoPor || !r.recusadoPor.includes(currentUser.id))
          );
          setIsRideScreen(hasActive || hasPending);
        } else if (currentUser.role === 'cliente') {
          const hasActive = rides.some(r => 
            r.clienteId === currentUser.id && 
            !['finalizada', 'cancelada', 'FINALIZADA', 'CANCELADA'].includes(r.status)
          );
          setIsRideScreen(hasActive);
        } else {
          setIsRideScreen(false);
        }
      } catch (e) {
        console.error(e);
      }
    };

    carregar();

    const unsubscribe = subscribeRealtime((event) => {
      if (
        event === 'NEW_NOTIFICATION' || 
        event === 'NOTIFICATIONS_READ' || 
        event === 'STORAGE_MUTATED' || 
        event === 'RIDE_UPDATED'
      ) {
        carregar();
      }
    });

    return () => unsubscribe();
  }, [currentUser]);
  
  if (!currentUser) return null;

  const roleLabels = {
    admin: { title: 'Administrador do Sistema', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
    mototaxista: { title: 'Mototaxista Parceiro', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    cliente: { title: 'Passageiro', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
  };

  const info = roleLabels[currentUser.role] || roleLabels.cliente;

  return (
    <header className="h-20 bg-white border-b border-slate-200 px-6 sm:px-8 flex items-center justify-between shrink-0">
      <div 
        className="flex items-center gap-4 select-none"
        title="MotoTáxi"
      >
        <div className="w-10 h-10 bg-yellow-400 rounded-2xl flex items-center justify-center font-black text-xl text-slate-900 shadow-sm">
          M
        </div>
        <div>
          <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900 flex items-center gap-2">
            MotoTáxi
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${info.badge}`}>
              {currentUser.role}
            </span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-5 sm:gap-6">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-semibold text-slate-400">Bem-vindo(a),</p>
          <p className="font-bold text-slate-900 text-sm truncate max-w-[160px]">{currentUser.nome}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Central de Notificações - Sino */}
          {!isRideScreen && (
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('TOGGLE_NOTIFICATIONS'));
                if (unreadCount > 0) {
                  markNotificationsAsRead(currentUser.id);
                  setUnreadCount(0);
                }
              }}
              className="relative p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl transition-all shadow-sm cursor-pointer"
              title="Central de Notificações"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 text-slate-900 font-extrabold text-[10px] rounded-full flex items-center justify-center shadow-sm">
                  {unreadCount}
                </span>
              )}
            </button>
          )}

          <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
            {currentUser.foto && currentUser.role !== 'admin' ? (
              <img src={currentUser.foto} alt={currentUser.nome} className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold text-slate-600 text-sm">{currentUser.nome.substring(0, 2).toUpperCase()}</span>
            )}
          </div>

          <button
            onClick={logout}
            className="p-2.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 rounded-2xl transition-all shadow-sm"
            title="Encerrar sessão"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
