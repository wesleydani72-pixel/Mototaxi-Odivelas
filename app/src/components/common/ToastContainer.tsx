import React, { useEffect, useState } from 'react';
import { NotificationItem } from '../../types';
import { getNotifications, markNotificationsAsRead, subscribeRealtime, getRides } from '../../lib/db';
import { useAuth } from '../../context/AuthContext';
import { Bell, Check, Info, AlertCircle, X } from 'lucide-react';

export function ToastContainer() {
  const { currentUser } = useAuth();
  const [toasts, setToasts] = useState<NotificationItem[]>([]);
  const [isOpenPanel, setIsOpenPanel] = useState(false);
  const [allNotifs, setAllNotifs] = useState<NotificationItem[]>([]);
  const unreadCount = allNotifs.filter(n => !n.lida).length;

  useEffect(() => {
    if (!currentUser) return;

    // Carregar iniciais
    const carregar = () => {
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
      setAllNotifs(myNotifs);
    };

    carregar();

    const unsubscribe = subscribeRealtime((event, payload) => {
      if (event === 'NEW_NOTIFICATION' && payload) {
        const notif = payload as NotificationItem;
        const isMinha = notif.destinatarioId === currentUser.id || 
          (currentUser.role === 'mototaxista' && notif.destinatarioId === 'all_drivers') ||
          notif.destinatarioRole === currentUser.role;

        if (isMinha) {
          carregar();
          // Não exibir toast duplicado se for a chamada que já aciona o modal de "Nova Corrida" pro motorista
          if (!(currentUser.role === 'mototaxista' && notif.tipo === 'nova_corrida')) {
            setToasts(prev => {
              if (prev.some(t => t.id === notif.id)) {
                return prev;
              }
              return [notif, ...prev.slice(0, 3)];
            });
            setTimeout(() => {
              setToasts(prev => prev.filter(t => t.id !== notif.id));
            }, 6000);
          }
        }
      } else if (event === 'NOTIFICATIONS_READ' || event === 'STORAGE_MUTATED' || event === 'RIDE_UPDATED') {
        carregar();
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const handleToggle = () => {
      setIsOpenPanel(prev => {
        const next = !prev;
        if (next && unreadCount > 0) {
          markNotificationsAsRead(currentUser.id);
        }
        return next;
      });
    };

    window.addEventListener('TOGGLE_NOTIFICATIONS', handleToggle);
    return () => {
      window.removeEventListener('TOGGLE_NOTIFICATIONS', handleToggle);
    };
  }, [currentUser, unreadCount]);

  if (!currentUser) return null;

  const hasActiveOrPendingRide = () => {
    try {
      const rides = getRides();
      if (currentUser.role === 'mototaxista') {
        // Active ride where this user is the driver
        const hasActive = rides.some(r => 
          r.mototaxistaId === currentUser.id && 
          !['finalizada', 'cancelada', 'FINALIZADA', 'CANCELADA'].includes(r.status)
        );
        // Pending calls
        const hasPending = rides.some(r => 
          ['aguardando', 'SOLICITADA', 'AGUARDANDO_MOTORISTA'].includes(r.status) &&
          (!r.recusadoPor || !r.recusadoPor.includes(currentUser.id))
        );
        return hasActive || hasPending;
      } else if (currentUser.role === 'cliente') {
        // Active or pending ride where this user is the client
        return rides.some(r => 
          r.clienteId === currentUser.id && 
          !['finalizada', 'cancelada', 'FINALIZADA', 'CANCELADA'].includes(r.status)
        );
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const isRideScreen = hasActiveOrPendingRide();

  return (
    <>
      {/* Painel lateral / Dropdown de Notificações */}
      {isOpenPanel && !isRideScreen && (
        <div className="fixed top-20 right-4 sm:right-8 w-80 sm:w-96 bg-white border border-slate-200 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[500px]">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-600" />
              <h4 className="font-bold text-slate-800 text-sm">Notificações</h4>
            </div>
            <button 
              onClick={() => setIsOpenPanel(false)}
              className="p-1 rounded-lg hover:bg-slate-200 text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 p-3 space-y-2">
            {allNotifs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhuma notificação recebida ainda.
              </div>
            ) : (
              allNotifs.map(n => (
                <div 
                  key={n.id} 
                  className={`p-3 rounded-2xl text-xs transition-colors ${n.lida ? 'bg-slate-50 text-slate-600' : 'bg-yellow-50/60 border border-yellow-200/60 text-slate-900 font-medium'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-slate-800">{n.titulo}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{n.dataHora}</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{n.mensagem}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Toasts Flutuantes */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 p-4 bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-800 animate-slide-up"
          >
            <div className="p-2 bg-yellow-400 text-slate-900 rounded-xl">
              {t.tipo === 'sucesso' ? <Check className="w-4 h-4 font-bold" /> : <Info className="w-4 h-4 font-bold" />}
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="font-bold text-xs text-yellow-400 tracking-wider uppercase mb-0.5">{t.titulo}</h5>
              <p className="text-xs text-slate-200 leading-snug break-words">{t.mensagem}</p>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
