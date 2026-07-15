import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MototaxistaUser, Ride, RideStatus, Mensagem } from '../../types';
import { getRides, saveRide, saveUser, subscribeRealtime, addNotification, getUsers, getTodayDateStr } from '../../lib/db';
import { Bike, DollarSign, Navigation, Phone, MapPin, CheckCircle, Clock, AlertTriangle, XCircle, Shield, Sparkles, User, RefreshCw, MessageSquare, Package, ArrowRight, X, Compass } from 'lucide-react';
import { ChatModal } from '../chat/ChatModal';
import { ImageLightbox } from '../common/ImageLightbox';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';

export function DriverDashboard() {
  const { currentUser, atualizarUsuarioLogado } = useAuth();
  const moto = currentUser as MototaxistaUser;

  const [minhasCorridas, setMinhasCorridas] = useState<Ride[]>([]);
  const [corridaAtiva, setCorridaAtiva] = useState<Ride | null>(null);
  const corridaAtivaRef = React.useRef<Ride | null>(null);
  
  useEffect(() => {
    corridaAtivaRef.current = corridaAtiva;
  }, [corridaAtiva]);

  const [showChat, setShowChat] = useState(false);
  const [chamadaPendente, setChamadaPendente] = useState<Ride | null>(null);
  const [chamadasDisponiveis, setChamadasDisponiveis] = useState<Ride[]>([]);
  const [valorAdicional, setValorAdicional] = useState<string>('');
  const [tempoChegadaInput, setTempoChegadaInput] = useState<string>('10 min');
  const [activeTab, setActiveTab] = useState<'painel' | 'historico'>('painel');
  const [corridaSelecionada, setCorridaSelecionada] = useState<Ride | null>(null);
  const [lightboxImg, setLightboxImg] = useState<{ src: string; alt: string } | null>(null);

  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatToast, setChatToast] = useState<{ id: string; text: string; sender: string } | null>(null);

  // Dynamic stats calculated from real rides for high accuracy and timezone safety
  const corridasFinalizadas = minhasCorridas.filter(r => r && ['finalizada', 'FINALIZADA'].includes(r.status));
  const totalCorridasCalculadas = corridasFinalizadas.length;

  const hojeStr = getTodayDateStr();
  const corridasHoje = corridasFinalizadas.filter(r => r.data === hojeStr);
  const ganhosHojeCalculados = corridasHoje.reduce((sum, r) => sum + (r.valorEstimado || 0), 0);

  const seteDiasMs = 7 * 24 * 60 * 60 * 1000;
  const agoraMs = Date.now();
  const corridasSemana = corridasFinalizadas.filter(r => (agoraMs - (r.criadoEm || 0)) <= seteDiasMs);
  const ganhosSemanaCalculados = corridasSemana.reduce((sum, r) => sum + (r.valorEstimado || 0), 0);

  const trintaDiasMs = 30 * 24 * 60 * 60 * 1000;
  const corridasMes = corridasFinalizadas.filter(r => (agoraMs - (r.criadoEm || 0)) <= trintaDiasMs);
  const ganhosMesCalculados = corridasMes.reduce((sum, r) => sum + (r.valorEstimado || 0), 0);

  // Auto-close toast alert after 5 seconds
  useEffect(() => {
    if (!chatToast) return;
    const timer = setTimeout(() => {
      setChatToast(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [chatToast]);

  // Escutar mensagens em tempo real para exibir alertas e badge de não lidas
  useEffect(() => {
    if (!firestore || !corridaAtiva?.id) {
      setUnreadChatCount(0);
      return;
    }

    const rideId = corridaAtiva.id;

    // Se o chat estiver aberto, não marcar como não lidas e resetar
    if (showChat) {
      setUnreadChatCount(0);
    }

    const q = query(
      collection(firestore, 'mensagens'),
      where('id_corrida', '==', rideId)
    );

    let isFirstLoad = true;

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Mensagem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          id_corrida: data.id_corrida || '',
          id_remetente: data.id_remetente || '',
          nome_remetente: data.nome_remetente || '',
          texto: data.texto || '',
          timestamp: data.timestamp || '',
        });
      });

      // Ordenar localmente
      list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      if (isFirstLoad) {
        // Na primeira carga, apenas inicializamos sem emitir novos alertas
        isFirstLoad = false;
        return;
      }

      // Se há mensagens novas e a última mensagem NÃO é do próprio usuário
      if (list.length > 0) {
        const lastMsg = list[list.length - 1];
        if (lastMsg.id_remetente !== moto?.id) {
          // Play a friendly chat beep
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
            osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.35);
          } catch (e) {
            console.warn('Audio play blocked or not supported:', e);
          }

          // Show Toast alert if chat modal is closed
          if (!showChat) {
            setUnreadChatCount(prev => prev + 1);
            setChatToast({
              id: lastMsg.id || String(Date.now()),
              sender: lastMsg.nome_remetente,
              text: lastMsg.texto
            });
          }
        }
      }
    }, (error) => {
      console.error('Erro ao escutar mensagens:', error);
    });

    return () => unsubscribe();
  }, [corridaAtiva?.id, showChat, moto?.id]);

  useEffect(() => {
    carregarDados();

    const unsubscribe = subscribeRealtime((event, payload) => {
      if (event === 'NEW_NOTIFICATION' && payload && moto.disponibilidade === 'disponivel') {
        const notif = payload as any;
        if (notif.tipo === 'nova_corrida' && notif.rideId) {
          const list = getRides();
          const found = list.find(r => r.id === notif.rideId);
          if (found) {
            if ((found.status === 'aguardando' || found.status === 'SOLICITADA' || found.status === 'AGUARDANDO_MOTORISTA') && !(found.recusadoPor || []).includes(moto.id)) {
              setChamadaPendente(found);
            }
          } else {
            // Se não encontrou no cache local devido à latência de replicação, buscar direto do Firestore
            import('firebase/firestore').then(async ({ doc, getDoc }) => {
              const { firestore } = await import('../../lib/firebase');
              if (firestore) {
                try {
                  const docSnap = await getDoc(doc(firestore, 'rides', notif.rideId));
                  if (docSnap.exists()) {
                    const rideData = { ...docSnap.data(), id: docSnap.id } as Ride;
                    if ((rideData.status === 'aguardando' || rideData.status === 'SOLICITADA' || rideData.status === 'AGUARDANDO_MOTORISTA') && !(rideData.recusadoPor || []).includes(moto.id)) {
                      setChamadaPendente(rideData);
                    }
                  }
                } catch (e) {
                  console.warn("Erro ao buscar corrida pendente no Firestore:", e);
                }
              }
            });
          }
        }
      } else if (event === 'RIDE_UPDATED' || event === 'STORAGE_MUTATED') {
        carregarDados();
      }
    });

    return () => unsubscribe();
  }, [moto?.id, moto?.disponibilidade]);

  const carregarDados = () => {
    if (!moto) return;
    const lista = getRides();
    const minhas = lista.filter(r => r.mototaxistaId === moto.id).sort((a, b) => b.criadoEm - a.criadoEm);
    setMinhasCorridas(minhas);

    const ativa = minhas.find(r => 
      ['mototaxista_localizado', 'aceita', 'indo_ao_cliente', 'cliente_embarcou', 'em_viagem', 'ACEITA', 'MOTORISTA_A_CAMINHO', 'PASSAGEIRO_EMBARCADO', 'EM_CORRIDA'].includes(r.status)
    );
    setCorridaAtiva(ativa || null);

    // Se o mototaxista está marcado como ocupado mas não tem corrida ativa, voltar para disponível!
    if (moto.disponibilidade === 'ocupado' && !ativa) {
      const updated: MototaxistaUser = {
        ...moto,
        disponibilidade: 'disponivel',
      };
      atualizarUsuarioLogado(updated);

      const anterior = corridaAtivaRef.current;
      if (anterior) {
        const cancelada = minhas.find(r => r.id === anterior.id && ['CANCELADA', 'cancelada'].includes(r.status));
        if (cancelada) {
          alert('Atenção: A corrida foi cancelada pelo cliente!');
        }
      }
      return;
    }

    // Filtrar todas as chamadas disponíveis (não recusadas e sem motorista) ordenando pelas mais recentes
    const disponiveis = lista.filter(r => 
      (r.status === 'aguardando' || r.status === 'SOLICITADA' || r.status === 'AGUARDANDO_MOTORISTA') && 
      !r.mototaxistaId && 
      !r.recusadoPor?.includes(moto.id)
    ).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
    
    setChamadasDisponiveis(disponiveis);

    // Verificar se há alguma chamada aguardando/solicitada e ainda não recusada
    if (moto.disponibilidade === 'disponivel' && !ativa) {
      setChamadaPendente(prev => {
        if (prev) {
          const aindaDisponivel = disponiveis.find(r => r.id === prev.id);
          if (aindaDisponivel) {
            return aindaDisponivel; // Mantém a mesma com os dados mais atualizados
          }
        }
        return disponiveis[0] || null;
      });
    } else {
      setChamadaPendente(null);
    }
  };

  const toggleDisponibilidade = () => {
    if (!moto) return;
    if (corridaAtiva) {
      alert('Você não pode alterar seu status enquanto está em uma corrida ativa.');
      return;
    }

    const nextStatus = moto.disponibilidade === 'disponivel' ? 'indisponivel' : 'disponivel';
    const updated: MototaxistaUser = {
      ...moto,
      disponibilidade: nextStatus,
    };
    atualizarUsuarioLogado(updated);

    if (nextStatus === 'disponivel') {
      carregarDados();
    } else {
      setChamadaPendente(null);
    }
  };

  const handleAceitarChamada = (ride: Ride) => {
    // Verificar se outro mototaxista já não pegou nos milissegundos anteriores
    const fresh = getRides().find(r => r.id === ride.id);
    if (!fresh || !['aguardando', 'SOLICITADA', 'AGUARDANDO_MOTORISTA'].includes(fresh.status) || fresh.mototaxistaId) {
      alert('Esta corrida acabou de ser aceita por outro mototaxista!');
      setChamadaPendente(null);
      return;
    }

    const extraVal = fresh.isZonaRural ? (parseFloat(valorAdicional) || 0) : 0;
    const eta = tempoChegadaInput || '10 min';

    const aceita: Ride = {
      ...fresh,
      mototaxistaId: moto.id,
      mototaxistaNome: moto.nome,
      mototaxistaFoto: moto.foto,
      mototaxistaFotoMoto: moto.fotoMoto,
      mototaxistaTelefone: moto.telefone,
      mototaxistaMoto: moto.modeloMoto,
      mototaxistaPlaca: moto.placa,
      status: 'ACEITA', // Requisito 1 e 5
      inicio_rastreamento: new Date().toISOString(), // Requisito 8 e 7
      tempoChegadaEstimado: eta,
      atualizadoEm: Date.now(),
      valorAdicionalZonaRural: extraVal,
      valorEstimado: fresh.valorEstimado + extraVal,
    };

    saveRide(aceita);
    setChamadaPendente(null);
    setValorAdicional('');
    setCorridaAtiva(aceita);

    // Mudar status do mototaxista para ocupado
    atualizarUsuarioLogado({
      ...moto,
      disponibilidade: 'ocupado',
    });

    // Notificar cliente
    addNotification({
      destinatarioId: aceita.clienteId,
      titulo: '🏍️ Corrida Aceita!',
      mensagem: `${moto.nome} (${moto.modeloMoto} - ${moto.placa}) aceitou sua corrida! Tempo estimado de chegada: ${eta}. Acompanhe no mapa em tempo real.`,
      tipo: 'corrida_aceita',
      rideId: aceita.id
    });

    // Notificar os demais motoristas que a corrida foi aceita
    addNotification({
      destinatarioId: 'all_drivers',
      titulo: '⚠️ Corrida Aceita',
      mensagem: `A solicitação de ${aceita.clienteNome} foi aceita por outro mototaxista.`,
      tipo: 'alerta'
    });
  };

  const handleRecusarChamada = (ride: Ride) => {
    const fresh = getRides().find(r => r.id === ride.id);
    if (!fresh) {
      setChamadaPendente(null);
      return;
    }

    const recusadoLista = [...(fresh.recusadoPor || []), moto.id];
    const recusada: Ride = {
      ...fresh,
      recusadoPor: recusadoLista,
      atualizadoEm: Date.now(),
    };
    saveRide(recusada);
    setChamadaPendente(null);
  };

  const mudarStatusCorrida = (novoStatus: RideStatus) => {
    if (!corridaAtiva) return;

    // Configurar campos extras de finalização se for o caso
    const isEnding = novoStatus === 'finalizada' || novoStatus === 'FINALIZADA';

    const atual: Ride = {
      ...corridaAtiva,
      status: novoStatus,
      atualizadoEm: Date.now(),
      ...(isEnding ? {
        fim_rastreamento: new Date().toISOString(), // Requisito 7 e 8
      } : {})
    };

    if (isEnding) {
      const ganhoCorrida = corridaAtiva.valorEstimado;
      const novoTotalCorridas = moto.totalCorridas + 1;
      const novoGanhoHoje = moto.ganhosHoje + ganhoCorrida;
      const novoGanhoSemana = moto.ganhosSemana + ganhoCorrida;
      const novoGanhoMes = moto.ganhosMes + ganhoCorrida;

      const motoLiberado: MototaxistaUser = {
        ...moto,
        disponibilidade: 'disponivel',
        totalCorridas: novoTotalCorridas,
        ganhosHoje: parseFloat(novoGanhoHoje.toFixed(2)),
        ganhosSemana: parseFloat(novoGanhoSemana.toFixed(2)),
        ganhosMes: parseFloat(novoGanhoMes.toFixed(2)),
      };

      atualizarUsuarioLogado(motoLiberado);
      setCorridaAtiva(null);

      addNotification({
        destinatarioId: corridaAtiva.clienteId,
        titulo: '✅ Corrida Finalizada',
        mensagem: `Chegamos ao destino! O valor total foi de R$ ${ganhoCorrida.toFixed(2)}. Obrigado por viajar conosco.`,
        tipo: 'sucesso',
        rideId: corridaAtiva.id
      });
    } else {
      setCorridaAtiva(atual);
      let notifMsg = '';
      if (novoStatus === 'MOTORISTA_A_CAMINHO' || novoStatus === 'indo_ao_cliente') {
        notifMsg = 'O mototaxista está a caminho do seu local de embarque.';
      } else if (novoStatus === 'PASSAGEIRO_EMBARCADO' || novoStatus === 'cliente_embarcou') {
        notifMsg = 'O passageiro embarcou na moto!';
      } else if (novoStatus === 'EM_CORRIDA' || novoStatus === 'em_viagem') {
        notifMsg = 'Corrida iniciada! Boa viagem.';
      }

      if (notifMsg) {
        addNotification({
          destinatarioId: corridaAtiva.clienteId,
          titulo: '📍 Atualização de Status',
          mensagem: notifMsg,
          tipo: 'corrida_atualizada',
          rideId: corridaAtiva.id
        });
      }
    }

    saveRide(atual);
  };

  const atualizarTempoChegada = (tempo: string) => {
    if (!corridaAtiva) return;
    const atual: Ride = {
      ...corridaAtiva,
      tempoChegadaEstimado: tempo,
      atualizadoEm: Date.now()
    };
    setCorridaAtiva(atual);
    saveRide(atual);

    addNotification({
      destinatarioId: corridaAtiva.clienteId,
      titulo: '🕒 Tempo de Chegada',
      mensagem: `O mototaxista atualizou o tempo estimado de chegada para ${tempo}.`,
      tipo: 'corrida_atualizada',
      rideId: corridaAtiva.id
    });
  };

  const abrirRotaMapa = (endereco: string) => {
    const enc = encodeURIComponent(`${endereco}, ${moto.cidade}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${enc}`, '_blank');
  };

  return (
    <div className="flex-1 bg-slate-50 p-4 sm:p-8 overflow-y-auto font-sans text-slate-800 relative">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Topo do Mototaxista: Perfil, Status Toggles e Stats de Ganhos */}
        <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="w-16 h-16 rounded-2xl bg-yellow-400 overflow-hidden shrink-0 shadow-sm border border-slate-100 flex items-center justify-center">
              {moto.foto ? <img src={moto.foto} alt={moto.nome} className="w-full h-full object-cover" /> : <User className="w-8 h-8" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-slate-900 notranslate" translate="no">{moto.nome}</h2>
                <span className="font-mono text-xs font-black bg-slate-900 text-yellow-400 px-2.5 py-0.5 rounded-lg notranslate" translate="no">
                  {moto.placa}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 font-semibold">
                <span className="notranslate" translate="no">{moto.modeloMoto}</span> • <span className="notranslate" translate="no">{moto.corMoto}</span>
              </p>
              <div className="flex items-center gap-2 mt-2 text-[11px] font-bold text-slate-600">
                <span>{totalCorridasCalculadas} corridas realizadas</span>
              </div>
            </div>
          </div>

          {/* BOTÃO DISPONÍVEL / INDISPONÍVEL */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto justify-end">
            <div className="flex bg-slate-100 p-1 rounded-2xl w-full sm:w-auto">
              <button
                onClick={() => setActiveTab('painel')}
                className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${activeTab === 'painel' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                Painel Geral
              </button>
              <button
                onClick={() => setActiveTab('historico')}
                className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${activeTab === 'historico' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                Minhas Corridas
              </button>
            </div>

            <button
              onClick={toggleDisponibilidade}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${moto.disponibilidade === 'disponivel' ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20' : moto.disponibilidade === 'ocupado' ? 'bg-amber-500 text-white cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-900 text-slate-200'}`}
            >
              <span className={`w-3 h-3 rounded-full ${moto.disponibilidade === 'disponivel' ? 'bg-white animate-pulse' : moto.disponibilidade === 'ocupado' ? 'bg-white' : 'bg-red-400'}`} />
              {moto.disponibilidade === 'disponivel' ? 'Estou Disponível' : moto.disponibilidade === 'ocupado' ? 'Em Corrida' : 'Indisponível (Offline)'}
            </button>
          </div>
        </div>

        {activeTab === 'painel' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* GRID DE GANHOS */}
            <div className="lg:col-span-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-[28px] shadow-sm border border-slate-200/80 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10 text-slate-900">
                  <DollarSign className="w-20 h-20" />
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Ganhos Hoje</p>
                <p className="text-3xl font-black mt-2 text-slate-900 font-mono">R$ {ganhosHojeCalculados.toFixed(2)}</p>
                <p className="text-emerald-500 text-xs font-bold mt-1.5 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Recebimento Imediato
                </p>
              </div>

              <div className="bg-white p-6 rounded-[28px] shadow-sm border border-slate-200/80">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Esta Semana</p>
                <p className="text-3xl font-black mt-2 text-slate-900 font-mono">R$ {ganhosSemanaCalculados.toFixed(2)}</p>
                <p className="text-slate-500 text-xs font-medium mt-1.5">Média diária positiva</p>
              </div>

              <div className="bg-white p-6 rounded-[28px] shadow-sm border border-slate-200/80">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Este Mês</p>
                <p className="text-3xl font-black mt-2 text-slate-900 font-mono">R$ {ganhosMesCalculados.toFixed(2)}</p>
                <p className="text-slate-500 text-xs font-medium mt-1.5">Meta: 100% ativa</p>
              </div>
            </div>

            {/* ÁREA PRINCIPAL: CORRIDA EM ANDAMENTO OU AGUARDANDO CHAMADAS */}
            <div className="lg:col-span-12">
              {corridaAtiva ? (
                /* PAINEL DE CONTROLE DE VIAGEM ATIVA */
                <div className="bg-white rounded-[32px] p-8 border border-slate-200/80 shadow-lg space-y-8 relative overflow-hidden animate-fade-in">
                  <div className="absolute top-0 left-0 right-0 h-3 bg-emerald-500" />
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest px-3 py-1 bg-emerald-50 rounded-full border border-emerald-200">
                        Corrida em Andamento
                      </span>
                      <h3 className="text-2xl font-black text-slate-900 mt-2">Passageiro: {corridaAtiva.clienteNome}</h3>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-yellow-400 overflow-hidden flex items-center justify-center font-bold">
                          {corridaAtiva.clienteFoto ? <img src={corridaAtiva.clienteFoto} alt="CLI" className="w-full h-full object-cover" /> : 'CLI'}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{corridaAtiva.clienteTelefone}</p>
                          <a 
                            href={`tel:${corridaAtiva.clienteTelefone}`}
                            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <Phone className="w-3 h-3" /> Ligar pro Cliente
                          </a>
                        </div>
                      </div>
                      <div className="w-full sm:w-auto sm:pl-4 sm:border-l border-slate-200 flex flex-col gap-2">
                        <button
                          onClick={() => setShowChat(true)}
                          className="w-full sm:w-auto px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer relative overflow-visible"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Chat com Cliente
                          {unreadChatCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white border border-white animate-bounce shadow-md">
                              {unreadChatCount}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {corridaAtiva.isEntrega && (
                      <div className="md:col-span-2 p-5 bg-blue-50 border border-blue-200 rounded-3xl space-y-3">
                        <span className="px-2.5 py-1 bg-blue-600 text-white font-black text-[10px] rounded uppercase block w-max tracking-wider">
                          📦 SERVIÇO DE ENCOMENDA ({corridaAtiva.entregaTipo === 'levar' ? 'LEVAR PACOTE' : 'BUSCAR ENCOMENDA'})
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-700">
                          <div>
                            <p className="font-bold">📦 Item a Transportar: <span className="font-extrabold text-slate-900">{corridaAtiva.itemTransportado}</span></p>
                            {corridaAtiva.destinatarioNome && <p className="font-bold mt-1.5">👤 Recebedor: <span className="font-extrabold text-slate-900">{corridaAtiva.destinatarioNome}</span></p>}
                          </div>
                          {corridaAtiva.fotoEncomenda && (
                            <div className="sm:text-right">
                              <p className="font-bold mb-1">📸 Foto da Encomenda:</p>
                              <img src={corridaAtiva.fotoEncomenda} alt="Foto da Encomenda" className="w-24 h-24 object-cover rounded-xl border border-slate-250 inline-block" />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tempo Estimado de Chegada */}
                    <div className="md:col-span-2 p-6 bg-slate-900 text-white rounded-3xl border border-slate-800 space-y-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="p-3.5 bg-yellow-400 text-slate-950 rounded-2xl shrink-0 font-extrabold text-xl animate-pulse">
                          🕒
                        </div>
                        <div>
                          <h4 className="text-yellow-400 text-[10px] font-black uppercase tracking-widest">Tempo Estimado de Chegada (ETA)</h4>
                          <p className="text-lg font-black text-white mt-0.5">
                            {corridaAtiva.tempoChegadaEstimado ? `O cliente vê: ${corridaAtiva.tempoChegadaEstimado}` : 'Ainda não informado ao cliente'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5 shrink-0">
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">Atualizar Tempo:</p>
                        <div className="flex flex-wrap gap-2 items-center">
                          {['3 min', '5 min', '10 min', '15 min'].map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => atualizarTempoChegada(t)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border ${
                                corridaAtiva.tempoChegadaEstimado === t
                                  ? 'bg-yellow-400 text-slate-950 border-yellow-400'
                                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 cursor-pointer'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                          <input
                            type="text"
                            placeholder="Outro tempo..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                atualizarTempoChegada(e.currentTarget.value.trim());
                                e.currentTarget.value = '';
                              }
                            }}
                            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 max-w-[120px]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Detalhes de Origem */}
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase">📍 Local de Embarque</span>
                      </div>
                      <p className="font-extrabold text-slate-900 text-sm">
                        {corridaAtiva.origem ? corridaAtiva.origem.replace(/\s*\(Região:[^)]*\)/gi, '').replace(/^Zona Rural\s*-\s*/gi, '') : ''}
                      </p>
                      {corridaAtiva.refOrigem && !corridaAtiva.refOrigem.toLowerCase().includes('identificado via gps') && (
                        <p className="text-xs text-slate-500 font-medium">Ref: {corridaAtiva.refOrigem}</p>
                      )}
                      {corridaAtiva.fotoOrigem && (
                        <div className="pt-2">
                          <p className="text-xs font-bold text-slate-700 uppercase mb-0.5">Foto do local de embarque</p>
                          <p className="text-[11px] text-slate-500 mb-2">Imagem enviada pelo cliente para ajudar na localização do ponto de embarque</p>
                          <img src={corridaAtiva.fotoOrigem} alt="Local" className="w-full h-32 object-cover rounded-2xl border border-slate-200" />
                        </div>
                      )}
                    </div>

                    {/* Detalhes de Destino e Tarifa */}
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200/60 space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-400 uppercase">🎯 Destino Final</span>
                          {corridaAtiva.isZonaRural && (
                            <span className="px-2 py-0.5 bg-yellow-400 text-slate-950 font-black text-[9px] rounded uppercase animate-pulse">
                              🌳 Zona Rural
                            </span>
                          )}
                        </div>
                        {corridaAtiva.isZonaRural ? (
                          <div className="mt-1 p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-xl">
                            <p className="font-extrabold text-yellow-600 text-sm">
                              {corridaAtiva.destino ? corridaAtiva.destino.replace(/^Zona Rural\s*-\s*/gi, '') : ''}
                            </p>
                          </div>
                        ) : (
                          <p className="font-extrabold text-slate-900 text-sm mt-1">
                            {corridaAtiva.destino ? corridaAtiva.destino.replace(/\s*\(Região:[^)]*\)/gi, '').replace(/^Zona Rural\s*-\s*/gi, '') : ''}
                          </p>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">Valor a Receber</span>
                        <span className="text-2xl font-black text-emerald-600 font-mono">R$ {corridaAtiva.valorEstimado.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* CONTROLES DA CORRIDA (Botões Operacionais - Sem Rastreamento) */}
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
                    {['ACEITA', 'aceita'].includes(corridaAtiva.status) && (() => {
                      const isBlocked = corridaAtiva.isZonaRural && !corridaAtiva.clienteConfirmouValor;
                      return (
                        <div className="flex-1 flex flex-col gap-2">
                          <button
                            onClick={() => !isBlocked && mudarStatusCorrida('MOTORISTA_A_CAMINHO')}
                            disabled={isBlocked}
                            className={`w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 ${
                              isBlocked
                                ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg cursor-pointer'
                            }`}
                          >
                            <Navigation className="w-5 h-5" />
                            Avisar "Estou a Caminho"
                          </button>
                          {isBlocked && (
                            <span className="text-[11px] text-amber-600 font-bold text-center block animate-pulse">
                              ⏳ Aguardando cliente aceitar o valor da corrida...
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {['MOTORISTA_A_CAMINHO', 'indo_ao_cliente', 'mototaxista_a_caminho'].includes(corridaAtiva.status) && (
                      <button
                        onClick={() => mudarStatusCorrida('PASSAGEIRO_EMBARCADO')}
                        className="flex-1 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-base shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Bike className="w-5 h-5 animate-bounce text-white" />
                        Passageiro Embarcou
                      </button>
                    )}

                    {['PASSAGEIRO_EMBARCADO', 'cliente_embarcou'].includes(corridaAtiva.status) && (
                      <button
                        onClick={() => mudarStatusCorrida('EM_CORRIDA')}
                        className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-base shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer animate-pulse"
                      >
                        <Bike className="w-5 h-5 text-white" />
                        Iniciar Corrida
                      </button>
                    )}

                    {['EM_CORRIDA', 'em_viagem', 'corrida_em_andamento'].includes(corridaAtiva.status) && (
                      <button
                        onClick={() => mudarStatusCorrida('finalizada')}
                        className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-base shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle className="w-5 h-5 font-bold" />
                        Finalizar Corrida
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* ESTADO SEM CORRIDA ATIVA */
                <div className="bg-white rounded-[32px] p-8 md:p-12 border border-slate-200/80 shadow-sm text-center space-y-6">
                  {moto.disponibilidade === 'disponivel' ? (
                    chamadasDisponiveis.length > 0 ? (
                      <div className="space-y-6 text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                          <div>
                            <h3 className="text-xl font-black text-slate-900">Serviços Disponíveis ({chamadasDisponiveis.length})</h3>
                            <p className="text-xs text-slate-500">Toque em qualquer pedido abaixo para ver detalhes e aceitar.</p>
                          </div>
                          <div className="flex items-center gap-2 self-start sm:self-center">
                            <span className="flex h-2.5 w-2.5 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Monitorando em tempo real</span>
                          </div>
                        </div>

                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                          {chamadasDisponiveis.map(ride => (
                            <div 
                              key={ride.id} 
                              className="p-5 bg-slate-50 hover:bg-slate-100/60 rounded-2xl border border-slate-200/60 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                              <div className="flex items-start gap-4">
                                <div className="p-3 bg-yellow-400 text-slate-950 rounded-2xl shrink-0 font-extrabold text-lg mt-0.5 shadow-sm">
                                  {ride.isEntrega ? <Package className="w-5 h-5 text-slate-950" /> : <Bike className="w-5 h-5 text-slate-950" />}
                                </div>
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-extrabold text-slate-900 text-sm md:text-base">{ride.clienteNome}</span>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${ride.isEntrega ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-amber-100 text-amber-900 border border-amber-200'}`}>
                                      {ride.isEntrega ? '📦 Encomenda' : '🏍️ Corrida'}
                                    </span>
                                    {ride.isZonaRural && (
                                      <span className="px-2 py-0.5 bg-green-100 text-green-800 font-black text-[9px] rounded uppercase border border-green-200">
                                        🌳 Zona Rural
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-600 space-y-1">
                                    <p className="flex items-start gap-1.5"><span className="font-bold text-slate-400 shrink-0">📍 DE:</span> <span className="font-medium text-slate-700">{ride.origem ? ride.origem.replace(/\s*\(Região:[^)]*\)/gi, '').replace(/^Zona Rural\s*-\s*/gi, '') : ''}</span></p>
                                    <p className="flex items-start gap-1.5"><span className="font-bold text-slate-400 shrink-0">🏁 PARA:</span> <span className="font-medium text-slate-700">{ride.destino ? ride.destino.replace(/\s*\(Região:[^)]*\)/gi, '').replace(/^Zona Rural\s*-\s*/gi, '') : ''}</span></p>
                                    {ride.isEntrega && ride.itemTransportado && (
                                      <p className="flex items-start gap-1.5 font-semibold text-blue-600"><span className="font-bold text-slate-400 shrink-0">📦 ITEM:</span> <span>{ride.itemTransportado}</span></p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between md:flex-col md:items-end gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-slate-200/50">
                                <div className="md:text-right">
                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Ganhos Estimados</p>
                                  <p className="text-lg md:text-xl font-black text-emerald-600 font-mono">R$ {ride.valorEstimado.toFixed(2)}</p>
                                </div>
                                <button
                                  onClick={() => setChamadaPendente(ride)}
                                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white hover:text-yellow-400 rounded-xl font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ml-auto md:ml-0"
                                >
                                  Ver Detalhes
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="relative w-20 h-20 mx-auto">
                          <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-25" />
                          <div className="relative w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                            <Bike className="w-10 h-10 animate-pulse font-bold" />
                          </div>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900">Você está online e visível</h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                          Aguarde. Assim que um cliente da sua cidade solicitar uma corrida ou entrega, a notificação com som e tela inteira de aceitação aparecerá instantaneamente pro primeiro que clicar.
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="space-y-4 py-6">
                      <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                        <Clock className="w-8 h-8 font-bold" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-700">Modo Offline Ativado</h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Clique em "Estou Disponível" no topo da tela para voltar a receber chamadas de passageiros.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* VIEW: HISTÓRICO DE CORRIDAS DO MOTORISTA */
          <div className="bg-white rounded-[32px] p-8 border border-slate-200/80 shadow-sm space-y-6 animate-fade-in">
            <h3 className="text-xl font-black text-slate-900">Suas Corridas Realizadas</h3>
            {minhasCorridas.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Nenhuma corrida registrada no seu histórico.
              </div>
            ) : (
              <div className="space-y-4">
                {minhasCorridas.map(r => (
                  <div
                    key={r.id}
                    onClick={() => setCorridaSelecionada(r)}
                    className="p-5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-all hover:shadow-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${['finalizada', 'FINALIZADA'].includes(r.status) ? 'bg-emerald-100 text-emerald-800 font-bold' : ['cancelada', 'CANCELADA'].includes(r.status) ? 'bg-red-100 text-red-800 font-bold' : 'bg-blue-100 text-blue-800 font-bold'}`}>
                          {r.status}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">{r.data} • {r.hora}</span>
                      </div>
                      <p className="font-extrabold text-slate-900 text-sm">Passageiro: {r.clienteNome}</p>
                      <p className="text-xs text-slate-600 mt-0.5">De: {r.origem ? r.origem.replace(/^Zona Rural\s*-\s*/gi, '') : ''} → Para: {r.destino ? r.destino.replace(/^Zona Rural\s*-\s*/gi, '') : ''}</p>
                    </div>
                    <div className="text-right sm:shrink-0">
                      <p className="text-xs text-slate-400">Ganhos</p>
                      <p className="text-lg font-black text-emerald-600 font-mono">+ R$ {r.valorEstimado.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================================= */}
        {/* OVERLAY REAL-TIME DE NOVA CHAMADA (MODAL EXCLUSIVO TIPO UBER) */}
        {/* ================================================================================= */}
        {chamadaPendente && moto.disponibilidade === 'disponivel' && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-start justify-center p-4 overflow-y-auto animate-fade-in">
            <div className="w-full max-w-xl bg-slate-900 border-2 border-yellow-400 rounded-[36px] shadow-2xl p-6 sm:p-8 text-white space-y-6 my-auto relative overflow-y-auto max-h-[90vh] ring-12 ring-yellow-400/10">
              <div className="absolute top-0 left-0 right-0 h-4 bg-yellow-400 animate-pulse" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-3 bg-yellow-400 text-slate-950 rounded-2xl font-black text-xl animate-bounce shrink-0 mt-0.5">
                    🔔
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-yellow-400 text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest">Nova Corrida Disponível pro 1º que Aceitar!</h4>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <p className="text-xl sm:text-2xl font-black text-white truncate max-w-[180px] sm:max-w-none">{chamadaPendente.clienteNome}</p>
                      {chamadaPendente.clienteFoto ? (
                        <img 
                          src={chamadaPendente.clienteFoto} 
                          alt="Foto do Passageiro" 
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-yellow-400 shadow-md shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-xs font-bold border border-slate-700 shrink-0 uppercase">
                          {chamadaPendente.clienteNome ? chamadaPendente.clienteNome.slice(0, 2) : 'CLI'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 border border-slate-700/80 px-4 py-2.5 rounded-2xl text-left sm:text-right shrink-0 sm:self-center">
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Valor Estimado</p>
                  <p className="text-2xl sm:text-3xl font-black text-yellow-400 font-mono leading-none mt-1">R$ {chamadaPendente.valorEstimado.toFixed(2)}</p>
                </div>
              </div>

              <div className="space-y-4 bg-slate-800/80 p-6 rounded-3xl border border-slate-700 text-xs">
                {chamadaPendente.isEntrega && (
                  <div className="p-4 bg-blue-950/50 border border-blue-500/30 rounded-2xl space-y-2">
                    <span className="px-2 py-0.5 bg-blue-500 text-white font-black text-[9px] rounded uppercase block w-max tracking-wider">
                      📦 SERVIÇO DE ENCOMENDA ({chamadaPendente.entregaTipo === 'levar' ? 'LEVAR PACOTE' : 'BUSCAR ENCOMENDA'})
                    </span>
                    <p className="font-bold text-slate-200">📦 Item a Transportar: <span className="font-extrabold text-white">{chamadaPendente.itemTransportado}</span></p>
                    {chamadaPendente.destinatarioNome && <p className="font-bold text-slate-200">👤 Recebedor: <span className="font-extrabold text-white">{chamadaPendente.destinatarioNome}</span></p>}
                    {chamadaPendente.fotoEncomenda && (
                      <div className="pt-1">
                        <p className="text-slate-400 text-[10px] uppercase font-bold mb-1">📸 Foto da Encomenda:</p>
                        <img src={chamadaPendente.fotoEncomenda} alt="Foto da Encomenda" className="w-20 h-20 object-cover rounded-xl border border-slate-700 inline-block" />
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <span className="font-bold text-slate-400 uppercase text-[10px]">📍 Ponto de Embarque informado:</span>
                  <p className="text-sm font-extrabold text-white mt-1">
                    {chamadaPendente.origem ? chamadaPendente.origem.replace(/\s*\(Região:[^)]*\)/gi, '').replace(/^Zona Rural\s*-\s*/gi, '') : ''}
                  </p>
                  {chamadaPendente.refOrigem && !chamadaPendente.refOrigem.toLowerCase().includes('identificado via gps') && (
                    <p className="text-slate-300 mt-0.5">Ref: {chamadaPendente.refOrigem}</p>
                  )}
                </div>

                <div>
                  <span className="font-bold text-slate-400 uppercase text-[10px]">🎯 Destino pretendido:</span>
                  {chamadaPendente.isZonaRural ? (
                    <div className="mt-1 p-3.5 bg-yellow-450/25 border border-yellow-450/40 rounded-2xl">
                      <span 
                        style={{ backgroundColor: '#ee1111' }}
                        className="px-2 py-0.5 text-white font-black text-[9px] rounded uppercase block w-max mb-1.5 animate-pulse"
                      >
                        🌳 ZONA RURAL / CIDADE VIZINHA
                      </span>
                      <p className="text-sm font-black text-yellow-450">
                        {chamadaPendente.destino ? chamadaPendente.destino.replace(/^Zona Rural\s*-\s*/gi, '') : ''}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm font-extrabold text-white mt-1">
                      {chamadaPendente.destino ? chamadaPendente.destino.replace(/\s*\(Região:[^)]*\)/gi, '').replace(/^Zona Rural\s*-\s*/gi, '') : ''}
                    </p>
                  )}
                </div>

                {chamadaPendente.fotoOrigem && (
                  <div className="pt-2">
                    <p className="text-xs font-bold text-yellow-400 uppercase mb-0.5">Foto do local de embarque</p>
                    <p className="text-[11px] text-slate-300 mb-2">Imagem enviada pelo cliente para ajudar na localização do ponto de embarque</p>
                    <img src={chamadaPendente.fotoOrigem} alt="Foto" className="w-full h-32 object-cover rounded-2xl border border-slate-600" />
                  </div>
                )}
              </div>

              {chamadaPendente.isZonaRural && (
                <div className="space-y-2 p-5 bg-yellow-400/10 border border-yellow-400/30 rounded-3xl animate-fade-in">
                  <label className="block text-[10px] font-black uppercase text-yellow-400 tracking-wider">
                    💵 Reajuste de Valor por Turno (Valor Adicional)
                  </label>
                  <p className="text-[11px] text-slate-300">
                    Defina um valor adicional a ser cobrado para esta corrida na Zona Rural / Cidade Vizinha:
                  </p>
                  <div className="relative mt-1">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-sm font-bold text-yellow-400">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={valorAdicional}
                      onChange={e => setValorAdicional(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-yellow-450/40 rounded-2xl text-base font-black text-yellow-450 focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-yellow-400/30"
                    />
                  </div>
                </div>
              )}

              {/* Tempo Estimado de Chegada */}
              <div className="space-y-2 p-5 bg-slate-850 border border-slate-700/60 rounded-[24px] animate-fade-in">
                <label className="block text-[10px] font-black uppercase text-yellow-400 tracking-wider">
                  🕒 Tempo Estimado de Chegada (ETA)
                </label>
                <p className="text-[11px] text-slate-300">
                  Selecione ou digite em quantos minutos você estima chegar ao passageiro:
                </p>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {['3 min', '5 min', '10 min', '15 min'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTempoChegadaInput(t)}
                      className={`py-2 px-1 rounded-xl text-xs font-black transition-all border ${
                        tempoChegadaInput === t
                          ? 'bg-yellow-400 text-slate-950 border-yellow-400'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={tempoChegadaInput}
                  onChange={e => setTempoChegadaInput(e.target.value)}
                  placeholder="Ex: 8 min, 12 min, outro..."
                  className="w-full mt-2 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => handleRecusarChamada(chamadaPendente)}
                  className="flex-1 py-5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold text-sm transition-all cursor-pointer"
                >
                  Recusar Chamada
                </button>
                <button
                  onClick={() => handleAceitarChamada(chamadaPendente)}
                  className="flex-[2] py-5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 rounded-2xl font-black text-lg shadow-[0_0_40px_rgba(250,204,21,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Bike className="w-6 h-6" />
                  ACEITAR CORRIDA AGORA
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Toast de Nova Mensagem de Chat */}
      {chatToast && (
        <div 
          onClick={() => {
            setShowChat(true);
            setChatToast(null);
          }}
          className="fixed top-4 right-4 z-[120] max-w-sm w-full bg-slate-900 border-l-4 border-yellow-400 text-white rounded-2xl p-4 shadow-2xl flex items-start gap-3 cursor-pointer hover:bg-slate-800 transition-all animate-bounce"
        >
          <div className="p-2 bg-yellow-400 text-slate-950 rounded-xl shrink-0 mt-0.5">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-yellow-400 uppercase tracking-wide">
                Nova mensagem
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setChatToast(null);
                }}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs font-extrabold text-white mt-1 uppercase">
              {chatToast.sender}
            </p>
            <p className="text-xs font-medium text-slate-300 mt-0.5 truncate">
              {chatToast.text}
            </p>
            <p className="text-[10px] text-yellow-400/80 font-bold mt-1">
              Toque para responder
            </p>
          </div>
        </div>
      )}

      {showChat && corridaAtiva && (
        <ChatModal
          rideId={corridaAtiva.id}
          senderId={moto.id}
          senderName={moto.nome}
          onClose={() => setShowChat(false)}
          disabled={['finalizada', 'cancelada', 'FINALIZADA', 'CANCELADA'].includes(corridaAtiva.status)}
        />
      )}

      {/* Modal de Detalhes da Corrida */}
      {corridaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto animate-fade-in" onClick={() => setCorridaSelecionada(null)}>
          <div className="bg-white w-full max-w-2xl rounded-[32px] p-6 sm:p-8 space-y-6 shadow-2xl relative my-8 text-slate-900" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Detalhes da Corrida</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {corridaSelecionada.id.toUpperCase()}</p>
              </div>
              <button onClick={() => setCorridaSelecionada(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
              {/* Status and Cost Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 gap-4">
                <div>
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                    ['finalizada', 'FINALIZADA'].includes(corridaSelecionada.status) ? 'bg-emerald-100 text-emerald-800' :
                    ['cancelada', 'CANCELADA'].includes(corridaSelecionada.status) ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {corridaSelecionada.status.replace(/_/g, ' ')}
                  </span>
                  <p className="text-xs text-slate-400 font-medium mt-2">{corridaSelecionada.data} • {corridaSelecionada.hora}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs text-slate-400 font-semibold">Seus Ganhos</p>
                  <p className="text-2xl font-black text-emerald-600 font-mono">+ R$ {corridaSelecionada.valorEstimado.toFixed(2)}</p>
                </div>
              </div>

              {/* Addresses (De e Para) */}
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0">
                      <MapPin className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="w-0.5 h-full bg-dashed border-l border-slate-300 my-1" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Origem (De)</p>
                    <p className="text-sm font-extrabold text-slate-950 mt-0.5">{corridaSelecionada.origem}</p>
                    {corridaSelecionada.refOrigem && (
                      <p className="text-xs text-slate-500 mt-1">📌 Ref: <span className="font-semibold">{corridaSelecionada.refOrigem}</span></p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100 shrink-0">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Destino (Para)</p>
                    <p className="text-sm font-extrabold text-slate-950 mt-0.5">{corridaSelecionada.destino || 'Não informado'}</p>
                  </div>
                </div>
              </div>

              {/* Tempo da Corrida / Chegada */}
              {(corridaSelecionada.tempoChegadaEstimado || corridaSelecionada.tempoEstimadoMin) && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tempo Estimado</p>
                      <p className="text-xs font-extrabold text-slate-700 mt-0.5">
                        {corridaSelecionada.tempoChegadaEstimado ? 'Informado por você' : 'Previsão de tempo de viagem'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-slate-900 font-mono">
                      {corridaSelecionada.tempoChegadaEstimado || `${corridaSelecionada.tempoEstimadoMin} min`}
                    </span>
                  </div>
                </div>
              )}

              {/* Photos */}
              {(corridaSelecionada.fotoOrigem || (corridaSelecionada.isEntrega && corridaSelecionada.fotoEncomenda)) && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Anexos / Fotos da Corrida</h4>
                  <div className="flex gap-4 overflow-x-auto pb-1">
                    {corridaSelecionada.fotoOrigem && (
                      <div className="relative group cursor-pointer shrink-0" onClick={() => setLightboxImg({ src: corridaSelecionada.fotoOrigem!, alt: 'Foto do Local de Embarque' })}>
                        <img src={corridaSelecionada.fotoOrigem} alt="Embarque" className="w-24 h-24 rounded-2xl object-cover border border-slate-200 hover:opacity-90 transition-opacity" />
                        <span className="absolute bottom-1 right-1 bg-black/60 text-[9px] text-white px-1.5 py-0.5 rounded-md font-bold">Embarque</span>
                      </div>
                    )}
                    {corridaSelecionada.isEntrega && corridaSelecionada.fotoEncomenda && (
                      <div className="relative group cursor-pointer shrink-0" onClick={() => setLightboxImg({ src: corridaSelecionada.fotoEncomenda!, alt: 'Foto da Encomenda' })}>
                        <img src={corridaSelecionada.fotoEncomenda} alt="Encomenda" className="w-24 h-24 rounded-2xl object-cover border border-slate-200 hover:opacity-90 transition-opacity" />
                        <span className="absolute bottom-1 right-1 bg-black/60 text-[9px] text-white px-1.5 py-0.5 rounded-md font-bold">Encomenda</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Delivery Details */}
              {corridaSelecionada.isEntrega && (
                <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100/60 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-800">
                    <Package className="w-5 h-5 font-bold" />
                    <span className="text-xs font-black uppercase tracking-wider">Detalhes de Encomenda / Entrega</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-slate-400 font-semibold">Tipo de Serviço</p>
                      <p className="font-bold text-indigo-950 capitalize mt-0.5">{corridaSelecionada.entregaTipo === 'levar' ? '📦 Levar Encomenda' : '📥 Buscar Encomenda'}</p>
                    </div>
                    {corridaSelecionada.destinatarioNome && (
                      <div>
                        <p className="text-slate-400 font-semibold">Destinatário</p>
                        <p className="font-bold text-indigo-950 mt-0.5">{corridaSelecionada.destinatarioNome}</p>
                      </div>
                    )}
                    {corridaSelecionada.itemTransportado && (
                      <div className="col-span-2">
                        <p className="text-slate-400 font-semibold">Item Transportado</p>
                        <p className="font-bold text-indigo-950 mt-0.5">{corridaSelecionada.itemTransportado}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Rural Area Details */}
              {corridaSelecionada.isZonaRural && (
                <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-100/60 space-y-3">
                  <div className="flex items-center gap-2 text-amber-800">
                    <Compass className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-wider">Zona Rural ou Cidade Vizinha</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-slate-400 font-semibold">Adicional Cobrado</p>
                      <p className="font-bold text-amber-950 mt-0.5">R$ {(corridaSelecionada.valorAdicionalZonaRural || 0).toFixed(2)}</p>
                    </div>
                    {corridaSelecionada.detalhesZonaRural && (
                      <div className="col-span-2">
                        <p className="text-slate-400 font-semibold font-bold">Detalhes do Destino Rural</p>
                        <p className="font-semibold text-slate-800 mt-0.5">{corridaSelecionada.detalhesZonaRural}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Passenger Information */}
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Informações do Passageiro</h4>
                <div className="flex items-center gap-4">
                  {corridaSelecionada.clienteFoto ? (
                    <img src={corridaSelecionada.clienteFoto} alt="Passageiro" className="w-14 h-14 rounded-full object-cover border-2 border-slate-200" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                      <User className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-slate-900 leading-snug notranslate" translate="no">{corridaSelecionada.clienteNome}</p>
                    {corridaSelecionada.clienteTelefone && (
                      <p className="text-xs text-slate-400 mt-0.5">Whats: {corridaSelecionada.clienteTelefone}</p>
                    )}
                  </div>
                  {corridaSelecionada.clienteTelefone && (
                    <a href={`https://wa.me/55${corridaSelecionada.clienteTelefone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 transition-colors">
                      <Phone className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Footer action button */}
            <div className="border-t border-slate-100 pt-4 flex justify-end">
              <button onClick={() => setCorridaSelecionada(null)} className="px-6 py-3.5 bg-slate-900 text-white font-bold rounded-2xl text-xs cursor-pointer hover:bg-slate-800 transition-colors">
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox local */}
      {lightboxImg && (
        <ImageLightbox
          src={lightboxImg.src}
          alt={lightboxImg.alt}
          onClose={() => setLightboxImg(null)}
          isAdmin={false}
        />
      )}
    </div>
  );
}
