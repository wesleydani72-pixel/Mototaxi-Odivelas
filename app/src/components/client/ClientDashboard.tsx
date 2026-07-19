import React, { useState, useEffect } from 'react';

function compressImage(base64Str: string, maxWidth = 640, maxHeight = 640, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (err) => reject(err);
    img.src = base64Str;
  });
}
import { useAuth } from '../../context/AuthContext';
import { ClienteUser, Ride, RideStatus, TurnoTipo, Mensagem } from '../../types';
import { getRides, saveRide, subscribeRealtime, fileToBase64, getConfig, getUsers, addNotification, calcularTarifaCorrida, identifyingTurnoAtual, getTodayDateStr } from '../../lib/db';
import { Navigation, MapPin, Camera, Bike, Phone, Clock, AlertCircle, CheckCircle2, History, XCircle, ChevronRight, RefreshCw, ArrowLeft, Globe, Compass, MessageSquare, Package, Bell, Volume2, X } from 'lucide-react';
import { ChatModal } from '../chat/ChatModal';
import { ImageLightbox } from '../common/ImageLightbox';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';

export function ClientDashboard() {
  const { currentUser } = useAuth();
  const cli = currentUser as ClienteUser;

  const [minhasCorridas, setMinhasCorridas] = useState<Ride[]>([]);
  const [corridaAtiva, setCorridaAtiva] = useState<Ride | null>(null);
  const [showChat, setShowChat] = useState(false);

  // Estados de Região para Tarifa
  const [regiaoOrigem, setRegiaoOrigem] = useState('Centro');
  const [regiaoDestino, setRegiaoDestino] = useState('Centro');

  // Estados do formulário de solicitação manual (Rua, Número, Bairro, Cidade, Referência)
  const [ruaOrigem, setRuaOrigem] = useState(cli?.bairro || ''); // Fallback
  const [numeroOrigem, setNumeroOrigem] = useState('');
  const [bairroOrigem, setBairroOrigem] = useState(cli?.bairro || '');
  const [cidadeOrigem, setCidadeOrigem] = useState(cli?.cidade || 'São Caetano de Odivelas');
  const [refOrigem, setRefOrigem] = useState(cli?.pontoReferencia || '');
  const [fotoOrigemBase64, setFotoOrigemBase64] = useState('');
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [destinoTexto, setDestinoTexto] = useState('');
  const [isZonaRural, setIsZonaRural] = useState(false);
  const [detalhesZonaRural, setDetalhesZonaRural] = useState('');

  // Novos estados para Encomenda / Entrega
  const [activeTab, setActiveTab] = useState<'corrida' | 'entrega'>('corrida');
  const [entregaTipo, setEntregaTipo] = useState<'levar' | 'buscar'>('levar');
  const [itemTransportado, setItemTransportado] = useState('');
  const [destinatarioNome, setDestinatarioNome] = useState('');
  const [fotoEncomendaBase64, setFotoEncomendaBase64] = useState('');
  const [cameraTarget, setCameraTarget] = useState<'local' | 'encomenda'>('local');

  const [activeView, setActiveView] = useState<'pedir' | 'historico'>('pedir');
  const [corridaSelecionada, setCorridaSelecionada] = useState<Ride | null>(null);
  const [lightboxImg, setLightboxImg] = useState<{ src: string; alt: string } | null>(null);

  // Resumo antes de confirmar corrida
  const [confirmandoResumo, setConfirmandoResumo] = useState<{ origem: string; destino: string; distEst: number; tempoEst: number; turno: TurnoTipo; valor: number; isZonaRural?: boolean; detalhesZonaRural?: string } | null>(null);
  const [showRuralConfirmation, setShowRuralConfirmation] = useState(false);

  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatToast, setChatToast] = useState<{ id: string; text: string; sender: string } | null>(null);

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
        if (lastMsg.id_remetente !== cli?.id) {
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
  }, [corridaAtiva?.id, showChat, cli?.id]);

  useEffect(() => {
    carregarCorridas();

    const unsubscribe = subscribeRealtime((event, payload) => {
      if (event === 'RIDE_UPDATED' || event === 'STORAGE_MUTATED') {
        carregarCorridas();
      }
    });

    return () => unsubscribe();
  }, [cli?.id]);

  const carregarCorridas = () => {
    if (!cli) return;
    const lista = getRides();
    const minhas = lista.filter(r => r.clienteId === cli.id).sort((a, b) => b.criadoEm - a.criadoEm);
    setMinhasCorridas(minhas);

    // Identificar corrida em andamento
    const ativa = minhas.find(r => 
      ['aguardando', 'mototaxista_localizado', 'aceita', 'indo_ao_cliente', 'mototaxista_a_caminho', 'mototaxista_chegou', 'cliente_embarcou', 'em_viagem', 'corrida_em_andamento', 'SOLICITADA', 'AGUARDANDO_MOTORISTA', 'ACEITA', 'MOTORISTA_A_CAMINHO', 'PASSAGEIRO_EMBARCADO', 'EM_CORRIDA'].includes(r.status)
    );
    setCorridaAtiva(ativa || null);
  };

  const handleRuaChange = (novaRua: string) => {
    setRuaOrigem(novaRua);
  };

  const handleBairroChange = (novoBairro: string) => {
    setBairroOrigem(novoBairro);
  };

  const handleNumeroChange = (novoNumero: string) => {
    setNumeroOrigem(novoNumero);
  };

  const requestCameraAccess = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setCameraStream(stream);
      return stream;
    } catch (err: any) {
      console.error('Erro ao acessar a câmera:', err);
      setCameraError('Permita o acesso à câmera para tirar a foto do local de embarque.');
      throw err;
    }
  };

  const startCamera = async (target: 'local' | 'encomenda' = 'local') => {
    setCameraTarget(target);
    setShowPhotoOptions(false);
    setShowCameraModal(true);
    setCameraError(null);
    
    try {
      const stream = await requestCameraAccess();
      setTimeout(() => {
        const videoEl = document.getElementById('camera-preview') as HTMLVideoElement;
        if (videoEl) {
          videoEl.srcObject = stream;
          videoEl.muted = true;
          videoEl.setAttribute('playsinline', 'true');
          videoEl.play().catch(e => console.warn('Erro ao reproduzir vídeo:', e));
        }
      }, 300);
    } catch (err) {
      console.warn('Erro ou negação de câmera:', err);
      setCameraError('Permita o acesso à câmera para tirar a foto.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCameraModal(false);
  };

  const capturePhoto = async () => {
    const videoEl = document.getElementById('camera-preview') as HTMLVideoElement;
    if (!videoEl || !cameraStream) return;

    try {
      const canvas = document.createElement('canvas');
      const track = cameraStream.getVideoTracks()[0];
      const settings = track ? track.getSettings() : null;
      
      canvas.width = videoEl.videoWidth || (settings && settings.width) || 640;
      canvas.height = videoEl.videoHeight || (settings && settings.height) || 480;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const b64 = canvas.toDataURL('image/jpeg', 0.85);
        const compressed = await compressImage(b64);
        if (cameraTarget === 'local') {
          setFotoOrigemBase64(compressed);
        } else {
          setFotoEncomendaBase64(compressed);
        }
        stopCamera();
      }
    } catch (err) {
      console.error('Erro ao capturar foto:', err);
      alert('Erro ao capturar a foto. Tente novamente.');
    }
  };

  const handleFotoLocal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const b64 = await fileToBase64(e.target.files[0]);
        const compressed = await compressImage(b64);
        if (cameraTarget === 'local') {
          setFotoOrigemBase64(compressed);
        } else {
          setFotoEncomendaBase64(compressed);
        }
      } catch (err) {
        console.error('Erro ao comprimir imagem:', err);
      }
    }
  };

  const handleSolicitarCorrida = (e: React.FormEvent) => {
    e.preventDefault();

    if (activeTab === 'corrida' && !fotoOrigemBase64) {
      alert('Por favor, tire uma foto do local de embarque antes de prosseguir.');
      return;
    }

    if (activeTab === 'entrega' && entregaTipo === 'levar' && !fotoEncomendaBase64) {
      alert('Por favor, tire uma foto da sua encomenda antes de prosseguir.');
      return;
    }

    const cfg = getConfig();

    let localOrigemTexto = '';
    let localDestinoTexto = '';

    const addressFromForm = [
      ruaOrigem,
      numeroOrigem ? `Nº ${numeroOrigem}` : 'S/N',
      bairroOrigem,
      cidadeOrigem
    ].filter(Boolean).join(', ');

    if (activeTab === 'entrega') {
      if (entregaTipo === 'levar') {
        localOrigemTexto = addressFromForm;
        localDestinoTexto = isZonaRural ? `Zona Rural - ${detalhesZonaRural}` : (destinoTexto || 'Destino a combinar');
      } else {
        // buscar
        localOrigemTexto = isZonaRural ? `Zona Rural - ${detalhesZonaRural}` : (destinoTexto || 'Ponto de retirada a combinar');
        localDestinoTexto = addressFromForm;
      }
    } else {
      localOrigemTexto = addressFromForm;
      localDestinoTexto = isZonaRural ? `Zona Rural - ${detalhesZonaRural}` : `${destinoTexto || 'Destino a combinar'} (Região: ${regiaoDestino})`;
    }

    const distEst = parseFloat((Math.random() * 5 + 1.5).toFixed(1));
    const tempoEst = Math.round(distEst * 3);
    
    // Buscar tarifa baseada em Região Origem, Região Destino e Turno atual
    const calc = calcularTarifaCorrida(regiaoOrigem, regiaoDestino, null, cfg);

    if (!calc.status) {
      alert(`O turno operacional atual (${calc.turno.toUpperCase()}) encontra-se inativo para novas solicitações no momento.`);
      return;
    }

    setConfirmandoResumo({
      origem: localOrigemTexto,
      destino: localDestinoTexto,
      distEst,
      tempoEst,
      turno: calc.turno,
      valor: calc.valor,
      isZonaRural: isZonaRural,
      detalhesZonaRural: isZonaRural ? detalhesZonaRural : ''
    });
  };

  const executeConfirmarCorridaDefinitiva = () => {
    if (!confirmandoResumo) return;
    const nova: Ride = {
      id: 'ride_' + Date.now(),
      clienteId: cli.id,
      clienteNome: cli.nome,
      clienteFoto: cli.foto,
      clienteTelefone: cli.telefone,
      origem: confirmandoResumo.origem,
      refOrigem: refOrigem || undefined,
      fotoOrigem: fotoOrigemBase64 || undefined,
      regiaoOrigem: regiaoOrigem,
      destino: confirmandoResumo.destino,
      regiaoDestino: regiaoDestino,
      distanciaKm: confirmandoResumo.distEst,
      tempoEstimadoMin: confirmandoResumo.tempoEst,
      valorEstimado: confirmandoResumo.valor,
      turno: confirmandoResumo.turno,
      status: 'SOLICITADA',
      recusadoPor: [],
      data: getTodayDateStr(),
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      criadoEm: Date.now(),
      atualizadoEm: Date.now(),
      isZonaRural: confirmandoResumo.isZonaRural,
      detalhesZonaRural: confirmandoResumo.detalhesZonaRural,

      // Novos campos de Encomenda
      isEntrega: activeTab === 'entrega',
      entregaTipo: activeTab === 'entrega' ? entregaTipo : undefined,
      itemTransportado: activeTab === 'entrega' ? itemTransportado : undefined,
      destinatarioNome: activeTab === 'entrega' && entregaTipo === 'levar' ? destinatarioNome : undefined,
      fotoEncomenda: activeTab === 'entrega' && entregaTipo === 'levar' ? fotoEncomendaBase64 : undefined,
    };

    saveRide(nova, cli.id, cli.role);
    setConfirmandoResumo(null);
    setIsZonaRural(false);
    setDetalhesZonaRural('');
    setItemTransportado('');
    setDestinatarioNome('');
    setFotoOrigemBase64('');
    setFotoEncomendaBase64('');

    // Enviar notificação em tempo real para todos os mototaxistas disponíveis
    addNotification({
      destinatarioId: 'all_drivers',
      titulo: nova.isEntrega ? '📦 Nova Encomenda Disponível!' : '🏍️ Nova Chamada Disponível!',
      mensagem: nova.isEntrega
        ? `${cli.nome} solicita entrega de "${nova.itemTransportado || 'item'}".`
        : `${cli.nome} solicita corrida de ${bairroOrigem || 'sua localidade'} para ${nova.destino}.`,
      tipo: 'nova_corrida',
      rideId: nova.id
    });
  };

  const handleConfirmarCorridaDefinitiva = () => {
    if (!confirmandoResumo) return;
    if (confirmandoResumo.isZonaRural) {
      setShowRuralConfirmation(true);
    } else {
      executeConfirmarCorridaDefinitiva();
    }
  };

  const handleCancelarCorrida = () => {
    if (!corridaAtiva) return;
    const atualizada: Ride = {
      ...corridaAtiva,
      status: 'CANCELADA',
      atualizadoEm: Date.now()
    };
    saveRide(atualizada, cli.id, cli.role);

    if (corridaAtiva.mototaxistaId) {
      addNotification({
        destinatarioId: corridaAtiva.mototaxistaId,
        titulo: '❌ Corrida Cancelada',
        mensagem: `O cliente ${cli.nome} cancelou a solicitação de corrida.`,
        tipo: 'alerta',
        rideId: corridaAtiva.id
      });
    }
  };

  const handleAceitarPrecoAdicional = () => {
    if (!corridaAtiva) return;
    const atualizada: Ride = {
      ...corridaAtiva,
      clienteConfirmouValor: true,
      atualizadoEm: Date.now()
    };
    saveRide(atualizada, cli.id, cli.role);

    if (corridaAtiva.mototaxistaId) {
      addNotification({
        destinatarioId: corridaAtiva.mototaxistaId,
        titulo: '✅ Valor Adicional Aceito!',
        mensagem: `O cliente ${cli.nome} aceitou o valor de R$ ${corridaAtiva.valorEstimado.toFixed(2)}.`,
        tipo: 'alerta',
        rideId: corridaAtiva.id
      });
    }
  };

  const statusLabels: Record<RideStatus, { label: string; bg: string; icon: any }> = {
    aguardando: { label: 'Procurando mototaxista...', bg: 'bg-amber-500 text-white', icon: RefreshCw },
    SOLICITADA: { label: 'Corrida Solicitada! Aguardando...', bg: 'bg-yellow-500 text-slate-900', icon: RefreshCw },
    AGUARDANDO_MOTORISTA: { label: 'Aguardando aceitação de mototaxistas...', bg: 'bg-amber-500 text-white', icon: RefreshCw },
    ACEITA: { label: 'Corrida Aceita! Mototaxista a caminho', bg: 'bg-blue-500 text-white', icon: Bike },
    MOTORISTA_A_CAMINHO: { label: 'Mototaxista a caminho', bg: 'bg-indigo-600 text-white', icon: Navigation },
    PASSAGEIRO_EMBARCADO: { label: 'Passageiro Embarcado! Pronto para iniciar', bg: 'bg-purple-500 text-white', icon: Bike },
    EM_CORRIDA: { label: 'Em Viagem — Boa Viagem! 🏍️', bg: 'bg-purple-600 text-white', icon: Bike },
    FINALIZADA: { label: 'Corrida Finalizada! Obrigado.', bg: 'bg-emerald-600 text-white', icon: CheckCircle2 },
    CANCELADA: { label: 'Corrida Cancelada.', bg: 'bg-red-500 text-white', icon: XCircle },

    mototaxista_localizado: { label: 'Mototaxista Encontrado!', bg: 'bg-blue-500 text-white', icon: Bike },
    aceita: { label: 'Indo até você', bg: 'bg-indigo-600 text-white', icon: Navigation },
    indo_ao_cliente: { label: 'Indo até você', bg: 'bg-indigo-600 text-white', icon: Navigation },
    mototaxista_a_caminho: { label: 'Mototaxista a caminho', bg: 'bg-indigo-600 text-white', icon: Navigation },
    mototaxista_chegou: { label: 'Mototaxista chegou ao local', bg: 'bg-emerald-500 text-white', icon: MapPin },
    cliente_embarcou: { label: 'Em viagem', bg: 'bg-purple-600 text-white', icon: Bike },
    em_viagem: { label: 'Em viagem', bg: 'bg-purple-600 text-white', icon: Bike },
    corrida_em_andamento: { label: 'Corrida em andamento', bg: 'bg-purple-600 text-white', icon: Bike },
    finalizada: { label: 'Corrida encerrada.', bg: 'bg-emerald-600 text-white', icon: CheckCircle2 },
    cancelada: { label: 'Corrida Cancelada', bg: 'bg-red-500 text-white', icon: XCircle },
  };

  return (
    <div className="flex-1 bg-slate-50 p-4 sm:p-8 overflow-y-auto font-sans text-slate-800">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Banner de Boas-vindas e Alternador de Views */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[28px] border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-yellow-400 overflow-hidden flex items-center justify-center font-bold shrink-0">
              {cli.foto ? <img src={cli.foto} alt={cli.nome} className="w-full h-full object-cover" /> : 'CLI'}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Painel do Passageiro</p>
              <h2 className="text-xl font-extrabold text-slate-900">{cli.nome}</h2>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-2xl shrink-0">
            <button
              onClick={() => setActiveView('pedir')}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${activeView === 'pedir' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Bike className="w-4 h-4 text-yellow-600" />
              Pedir Moto
            </button>
            <button
              onClick={() => setActiveView('historico')}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 ${activeView === 'historico' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <History className="w-4 h-4 text-blue-500" />
              Minhas Corridas ({minhasCorridas.length})
            </button>
          </div>
        </div>

        {/* VIEW: SOLICITAR CORRIDA / EM ANDAMENTO */}
        {activeView === 'pedir' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Esquerda: Formulário de Pedido ou Status Ativo */}
            <div className="lg:col-span-7">
              {corridaAtiva ? (
                /* PAINEL DE CORRIDA ATIVA / EM ANDAMENTO */
                <div className="bg-white rounded-[32px] p-8 border border-slate-200/80 shadow-lg relative overflow-hidden animate-fade-in">
                  <div className="absolute top-0 left-0 right-0 h-3 bg-yellow-400" />
                  
                  <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-2xl ${statusLabels[corridaAtiva.status].bg} animate-pulse`}>
                        <Bike className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status em Tempo Real</span>
                        <h3 className="text-xl font-black text-slate-900">
                          {statusLabels[corridaAtiva.status].label}
                        </h3>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xs text-slate-400 font-semibold">Valor Estimado</p>
                      <p className="text-2xl font-black text-slate-900 font-mono">R$ {corridaAtiva.valorEstimado.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* CASO: PROCURANDO MOTOTAXISTA */}
                  {['aguardando', 'SOLICITADA', 'AGUARDANDO_MOTORISTA'].includes(corridaAtiva.status) && (
                    <div className="py-12 text-center space-y-6 bg-slate-50 rounded-3xl p-6 border border-slate-100">
                      <div className="relative w-20 h-20 mx-auto">
                        <div className="absolute inset-0 bg-yellow-400 rounded-full animate-ping opacity-30" />
                        <div className="relative w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center text-slate-900 shadow-md">
                          <RefreshCw className="w-9 h-9 animate-spin font-bold" />
                        </div>
                      </div>
                      <div>
                        <h4 className="font-extrabold text-lg text-slate-900">Procurando mototaxista disponível...</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                          Enviamos seu chamado para os profissionais da sua região. Assim que um mototaxista aceitar, os dados aparecerão aqui.
                        </p>
                      </div>

                      <button
                        onClick={handleCancelarCorrida}
                        className="px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl font-bold text-xs transition-colors"
                      >
                        Cancelar Solicitação
                      </button>
                    </div>
                  )}

                  {/* CASO: MOTOTAXISTA JÁ ACEITOU / VIAGEM */}
                  {corridaAtiva.mototaxistaId && !['aguardando', 'SOLICITADA', 'AGUARDANDO_MOTORISTA'].includes(corridaAtiva.status) && (
                    corridaAtiva.isZonaRural && !corridaAtiva.clienteConfirmouValor ? (
                      <div className="space-y-6 animate-fade-in">
                        <div className="p-6 bg-amber-50 border border-amber-200 rounded-[24px] space-y-4">
                          <div className="flex items-start gap-3">
                            <span className="text-3xl mt-1">🌳</span>
                            <div>
                              <h4 className="font-extrabold text-amber-900 text-lg">Aprovação de Valor - Zona Rural / Cidade Vizinha</h4>
                              <p className="text-xs text-amber-700 font-medium leading-relaxed">
                                Esta corrida é destinada à zona rural. O mototaxista informou os valores para a viagem e aguarda sua concordância.
                              </p>
                            </div>
                          </div>

                          <div className="bg-white p-5 rounded-2xl border border-amber-100 space-y-3.5 text-sm text-slate-700 shadow-sm">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                              <span className="text-slate-500 font-medium">Mototaxista Vinculado</span>
                              <span className="font-extrabold text-slate-900 notranslate" translate="no">{corridaAtiva.mototaxistaNome}</span>
                            </div>
                            <div className="flex justify-between items-start pb-2 border-b border-slate-100">
                              <span className="text-slate-500 font-medium shrink-0">Destino Rural</span>
                              <span className="font-extrabold text-slate-800 text-right max-w-[180px]">{corridaAtiva.destino}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                              <span className="text-slate-500 font-medium">Tarifa Base Municipal</span>
                              <span className="font-bold text-slate-800">
                                R$ {(() => {
                                  const addVal = corridaAtiva.valorAdicionalZonaRural || 0;
                                  return (corridaAtiva.valorEstimado - addVal).toFixed(2);
                                })()}
                              </span>
                            </div>
                            {corridaAtiva.valorAdicionalZonaRural && corridaAtiva.valorAdicionalZonaRural > 0 ? (
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500 font-medium">Adicional Zona Rural</span>
                                <span className="font-bold text-amber-600">
                                  + R$ {corridaAtiva.valorAdicionalZonaRural.toFixed(2)}
                                </span>
                              </div>
                            ) : null}
                            <div className="border-t border-slate-200 pt-3 mt-1 flex justify-between items-center">
                              <span className="font-extrabold text-slate-900 text-base">Valor Total da Corrida</span>
                              <span className="font-black text-emerald-600 text-xl font-mono">
                                R$ {corridaAtiva.valorEstimado.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          <p className="text-[11px] text-amber-800/90 leading-relaxed font-medium">
                            ⚠️ O mototaxista só iniciará a viagem e entrará em rota ("A caminho") após você **Aceitar o Valor** acima. Caso não concorde, clique em **Recusar e Cancelar Corrida**.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                          <button
                            onClick={handleAceitarPrecoAdicional}
                            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                            Aceitar Valor de R$ {corridaAtiva.valorEstimado.toFixed(2)}
                          </button>
                          
                          <button
                            onClick={handleCancelarCorrida}
                            className="w-full py-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <XCircle className="w-5 h-5" />
                            Recusar e Cancelar Corrida
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6 animate-fade-in">
                        <div className="p-6 bg-slate-900 text-white rounded-3xl shadow-xl border border-slate-800 flex flex-col sm:flex-row items-center gap-6">
                          <div className="flex gap-3 shrink-0">
                            {/* Foto do Condutor */}
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-800 border-2 border-white overflow-hidden relative shrink-0" title="Foto do Condutor">
                              {corridaAtiva.mototaxistaFoto ? (
                                <img src={corridaAtiva.mototaxistaFoto} alt="Condutor" className="w-full h-full object-cover" />
                              ) : (
                                <span className="w-full h-full flex items-center justify-center font-bold text-slate-400 text-[10px]">FOTO</span>
                              )}
                            </div>
                            {/* Foto da Moto */}
                            <div className="w-20 h-16 sm:w-24 sm:h-20 rounded-2xl bg-slate-800 border-2 border-yellow-400 overflow-hidden relative shrink-0" title="Foto da Moto">
                              {corridaAtiva.mototaxistaFotoMoto ? (
                                <img src={corridaAtiva.mototaxistaFotoMoto} alt="Moto" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-slate-400 font-bold uppercase gap-0.5">
                                  <span>🏍️</span>
                                  <span className="text-[8px]">Sem foto</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex-1 text-center sm:text-left">
                            <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">Condutor Vinculado</span>
                            <h4 className="text-xl font-extrabold text-white notranslate" translate="no">{corridaAtiva.mototaxistaNome}</h4>
                            <p className="text-xs text-slate-300 mt-1 flex items-center justify-center sm:justify-start gap-2">
                              <Phone className="w-3.5 h-3.5 text-yellow-400" />
                              {corridaAtiva.mototaxistaTelefone}
                            </p>
                          </div>

                          <div className="bg-slate-800 p-4 rounded-2xl text-center min-w-[130px] border border-slate-700">
                            <p className="text-[10px] uppercase font-bold text-slate-400">Veículo</p>
                            <p className="text-xs font-bold text-white mt-0.5 notranslate" translate="no">{corridaAtiva.mototaxistaMoto}</p>
                            <p className="text-sm font-mono font-black text-yellow-400 mt-1 notranslate" translate="no">{corridaAtiva.mototaxistaPlaca}</p>
                          </div>
                        </div>

                        {corridaAtiva.tempoChegadaEstimado && (
                          <div className="p-4 bg-yellow-400 text-slate-950 rounded-2xl border-l-4 border-slate-900 shadow-sm flex items-center gap-3 animate-pulse">
                            <Clock className="w-5 h-5 shrink-0" />
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-wider text-slate-800">Tempo de Chegada do Mototaxista</p>
                              <p className="text-sm font-black">Chegará em aproximadamente: {corridaAtiva.tempoChegadaEstimado}</p>
                            </div>
                          </div>
                        )}

                        <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-4 rounded-2xl">
                          {corridaAtiva.isEntrega ? (
                            <>
                              <div className="mb-2 p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-1.5 text-slate-700">
                                <span className="px-2 py-0.5 bg-blue-600 text-white font-black text-[9px] rounded uppercase block w-max">
                                  📦 SERVIÇO DE ENCOMENDA ({corridaAtiva.entregaTipo === 'levar' ? 'LEVAR PACOTE' : 'BUSCAR ENCOMENDA'})
                                </span>
                                <p className="font-bold">📦 Item a Transportar: <span className="font-extrabold text-slate-950">{corridaAtiva.itemTransportado}</span></p>
                                {corridaAtiva.destinatarioNome && <p className="font-bold">👤 Recebedor: <span className="font-extrabold text-slate-950">{corridaAtiva.destinatarioNome}</span></p>}
                                {corridaAtiva.fotoEncomenda && (
                                  <div className="mt-2.5 pt-2 border-t border-blue-100">
                                    <p className="font-bold mb-1">📸 Foto da Encomenda:</p>
                                    <img src={corridaAtiva.fotoEncomenda} alt="Foto Encomenda" className="w-24 h-24 object-cover rounded-xl border border-slate-200" />
                                  </div>
                                )}
                              </div>
                              <p className="font-bold text-slate-800">📍 Local de Coleta: <span className="font-normal text-slate-600">{corridaAtiva.origem}</span></p>
                              <p className="font-bold text-slate-800">🎯 Local de Entrega: <span className="font-normal text-slate-600">{corridaAtiva.destino}</span></p>
                            </>
                          ) : (
                            <>
                              <p className="font-bold text-slate-800">📍 Origem de Embarque: <span className="font-normal text-slate-600">{corridaAtiva.origem}</span></p>
                              {corridaAtiva.refOrigem && <p className="font-bold text-slate-800">📌 Referência: <span className="font-normal text-slate-600">{corridaAtiva.refOrigem}</span></p>}
                              {corridaAtiva.fotoOrigem && (
                                <div className="mt-2 pb-2 border-b border-slate-200/50">
                                  <p className="font-bold mb-1">📸 Foto de Embarque:</p>
                                  <img src={corridaAtiva.fotoOrigem} alt="Foto Embarque" className="w-24 h-24 object-cover rounded-xl border border-slate-200" />
                                </div>
                              )}
                              <p className="font-bold text-slate-800">🎯 Destino Final: <span className="font-normal text-slate-600">{corridaAtiva.destino}</span></p>
                            </>
                          )}
                        </div>

                        {/* Botão de Conversar / Chat */}
                        <div className="pt-2">
                          <button
                            onClick={() => setShowChat(true)}
                            className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-950 rounded-2xl font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer relative overflow-visible"
                          >
                            <MessageSquare className="w-5 h-5" />
                            Conversar com o Mototaxista (Chat Ao Vivo)
                            {unreadChatCount > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[11px] font-black text-white border-2 border-white animate-bounce shadow-md">
                                {unreadChatCount}
                              </span>
                            )}
                          </button>
                        </div>

                        {/* Botão de Cancelar visível enquanto não iniciou viagem */}
                        {['aceita', 'indo_ao_cliente', 'mototaxista_localizado', 'ACEITA', 'MOTORISTA_A_CAMINHO'].includes(corridaAtiva.status) && (
                          <div className="pt-2">
                            <button
                              onClick={handleCancelarCorrida}
                              className="w-full py-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl font-bold text-xs transition-colors flex items-center justify-center gap-2"
                            >
                              <XCircle className="w-4 h-4" />
                              Cancelar Corrida
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              ) : confirmandoResumo ? (
                <div className="bg-white rounded-[32px] p-8 border border-slate-200/80 shadow-sm space-y-6 animate-fade-in">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Resumo da Solicitação</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Confira abaixo os dados de tarifação automática antes de chamar o mototáxi.</p>
                  </div>

                  <div className="space-y-6 bg-slate-50 p-6 rounded-3xl border border-slate-200/60 text-center">
                    {activeTab === 'entrega' && (
                      <div className="text-left bg-blue-50/50 p-4 border border-blue-100 rounded-2xl text-xs space-y-1.5 mb-2">
                        <span className="px-2 py-0.5 bg-blue-600 text-white font-black text-[9px] rounded uppercase block w-max mb-1">
                          📦 SERVIÇO DE ENCOMENDA
                        </span>
                        <p className="font-bold text-slate-800">Modalidade: <span className="font-normal text-slate-600">{entregaTipo === 'levar' ? 'Levar um pacote' : 'Buscar para mim'}</span></p>
                        <p className="font-bold text-slate-800">Item: <span className="font-black text-slate-900">{itemTransportado}</span></p>
                        {destinatarioNome && <p className="font-bold text-slate-800">Recebedor: <span className="font-black text-slate-900">{destinatarioNome}</span></p>}
                        {fotoEncomendaBase64 && (
                          <div className="mt-2 pt-2 border-t border-blue-100">
                            <p className="font-bold mb-1">📸 Foto da Encomenda Anexada:</p>
                            <img src={fotoEncomendaBase64} alt="Foto Encomenda" className="w-16 h-16 object-cover rounded-xl border border-slate-200" />
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'corrida' && fotoOrigemBase64 && (
                      <div className="text-left bg-yellow-50/50 p-4 border border-yellow-100 rounded-2xl text-xs space-y-1.5 mb-2">
                        <span className="px-2 py-0.5 bg-yellow-400 text-slate-950 font-black text-[9px] rounded uppercase block w-max mb-1">
                          📸 Foto de Embarque Anexada:
                        </span>
                        <div className="mt-1">
                          <img src={fotoOrigemBase64} alt="Foto de Embarque" className="w-16 h-16 object-cover rounded-xl border border-slate-200" />
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block mb-1">Turno identificado</span>
                      <span className="text-2xl font-black text-slate-900 uppercase tracking-tight block">
                        {confirmandoResumo.turno.toUpperCase()}
                      </span>
                    </div>

                    <div className="pt-4 border-t border-slate-200/80">
                      <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block mb-1">Valor da corrida</span>
                      <span className="text-4xl font-black text-emerald-600 font-mono block">
                        R$ {confirmandoResumo.valor.toFixed(2)}
                      </span>
                      {confirmandoResumo.isZonaRural && (
                        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left shadow-sm">
                          <p className="text-xs text-amber-800 font-bold leading-relaxed">
                            ⚠️ Atenção: Para destinos na Zona Rural ou Cidades Vizinhas, o valor final será reajustado pelo mototaxista após a aceitação da corrida.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 text-xs font-bold text-slate-600">
                      Deseja confirmar sua solicitação?
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setConfirmandoResumo(null)}
                      className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmarCorridaDefinitiva}
                      className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-950 rounded-2xl font-black text-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
                    >
                      Confirmar Corrida
                    </button>
                  </div>
                </div>
              ) : (
                /* FORMULÁRIO DE NOVA SOLICITAÇÃO */
                <div className="bg-white rounded-[32px] p-8 border border-slate-200/80 shadow-sm space-y-6 animate-fade-in">
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">
                      {activeTab === 'entrega' ? '📦 Solicitar Encomenda / Entrega' : '🏍️ Solicitar Nova Corrida'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {activeTab === 'entrega'
                        ? 'Insira os dados de coleta, destino e descrição da encomenda para solicitar o envio.'
                        : 'Insira os dados de embarque e destino para calcular o valor da sua corrida.'}
                    </p>
                  </div>

                  {/* Abas Superiores de Serviço */}
                  <div className="bg-slate-100 p-1.5 rounded-2xl flex w-full border border-slate-200/40">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('corrida');
                        setIsZonaRural(false);
                        setDetalhesZonaRural('');
                      }}
                      className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        activeTab === 'corrida'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50 font-black'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span className="text-sm">🚲 🏍️</span>
                      <span className="uppercase tracking-wider">Corrida Comum</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('entrega');
                        setIsZonaRural(false);
                        setDetalhesZonaRural('');
                      }}
                      className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        activeTab === 'entrega'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50 font-black'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span className="text-sm">📦</span>
                      <span className="uppercase tracking-wider">Encomenda / Entrega</span>
                    </button>
                  </div>

                  {activeTab === 'entrega' && (
                    <div className="p-4 bg-blue-50/40 border border-blue-100 rounded-3xl space-y-3 animate-fade-in">
                      <label className="block text-[11px] font-black text-blue-900 uppercase tracking-widest text-center">
                        O que o motoboy deve fazer?
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEntregaTipo('levar');
                            setIsZonaRural(false);
                            setDetalhesZonaRural('');
                          }}
                          className={`py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            entregaTipo === 'levar'
                              ? 'bg-blue-600 text-white shadow-md font-extrabold'
                              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                          }`}
                        >
                          <span className="font-black text-sm">↗</span>
                          <span>Levar um pacote</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEntregaTipo('buscar');
                            setIsZonaRural(false);
                            setDetalhesZonaRural('');
                          }}
                          className={`py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            entregaTipo === 'buscar'
                              ? 'bg-blue-600 text-white shadow-md font-extrabold'
                              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                          }`}
                        >
                          <span className="font-black text-sm">↙</span>
                          <span>Buscar para mim</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSolicitarCorrida} className="space-y-5">
                    {/* SECTION 1: ORIGEM / COLETA / ENTREGA */}
                    <div className="space-y-3 p-5 bg-slate-50 border border-slate-200/60 rounded-3xl">
                      <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                        {activeTab === 'corrida' && '📍 1. Local de Embarque (Origem)'}
                        {activeTab === 'entrega' && entregaTipo === 'levar' && '📍 1. LOCAL DE PARTIDA / COLETA'}
                        {activeTab === 'entrega' && entregaTipo === 'buscar' && '🏁 1. ONDE ENTREGAR (SUA CASA / DESTINO FINAL)'}
                      </h4>
                      
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rua / Logradouro *</label>
                        <input
                          type="text"
                          value={ruaOrigem}
                          onChange={e => handleRuaChange(e.target.value)}
                          placeholder="Digite o nome da rua ou avenida"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Número (Opcional)</label>
                          <input
                            type="text"
                            value={numeroOrigem}
                            onChange={e => handleNumeroChange(e.target.value)}
                            placeholder="Ex: 123 ou S/N"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bairro *</label>
                          <input
                            type="text"
                            value={bairroOrigem}
                            onChange={e => handleBairroChange(e.target.value)}
                            placeholder="Digite o bairro"
                            required
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cidade *</label>
                        <input
                          type="text"
                          value={cidadeOrigem}
                          onChange={e => setCidadeOrigem(e.target.value)}
                          placeholder="Cidade"
                          required
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                      </div>
                    </div>

                    {/* SECTION 2: DESTINO / RETIRADA / DADOS ENCOMENDA */}
                    <div className="space-y-3 p-5 bg-slate-50 border border-slate-200/60 rounded-3xl relative">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                          {activeTab === 'corrida' && '🎯 2. Destino Final'}
                          {activeTab === 'entrega' && entregaTipo === 'levar' && '🏁 2. QUAL O DESTINO FINAL?'}
                          {activeTab === 'entrega' && entregaTipo === 'buscar' && '📦 2. ONDE O MOTOBOY DEVE RETIRAR A ENCOMENDA?'}
                        </h4>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="checkbox"
                            id="isZonaRural"
                            checked={isZonaRural}
                            onChange={e => setIsZonaRural(e.target.checked)}
                            className="w-3.5 h-3.5 text-yellow-500 border-slate-300 rounded focus:ring-yellow-400 cursor-pointer"
                          />
                          <label htmlFor="isZonaRural" className="text-[10px] font-black text-slate-600 uppercase cursor-pointer select-none">
                            ZONA RURAL / CIDADE VIZINHA
                          </label>
                        </div>
                      </div>
                      
                      {!isZonaRural && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            {activeTab === 'corrida' ? 'Endereço de Destino *' : 'Endereço Completo *'}
                          </label>
                          <input
                            type="text"
                            value={destinoTexto}
                            onChange={e => setDestinoTexto(e.target.value)}
                            placeholder={activeTab === 'corrida' ? 'Rua, número, bairro ou ponto conhecido' : 'Ex: Rua Principal, Nº 40, Bairro Alto'}
                            required={!isZonaRural}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                          />
                        </div>
                      )}

                      {isZonaRural && (
                        <div className="mt-2 space-y-1 animate-fade-in">
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            Especifique a localidade da Zona Rural ou Cidade Vizinha (Onde você está e para onde vai) *
                          </label>
                          <input
                            type="text"
                            value={detalhesZonaRural}
                            onChange={e => setDetalhesZonaRural(e.target.value)}
                            placeholder="Ex: Sítio São José até a Vila do Castelo"
                            required={isZonaRural}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                          />
                        </div>
                      )}

                      {/* Campos extras para Encomenda */}
                      {activeTab === 'entrega' && (
                        <div className="space-y-3 pt-3 border-t border-slate-200/60 mt-3 animate-fade-in">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              O que vai ser transportado? *
                            </label>
                            <input
                              type="text"
                              value={itemTransportado}
                              onChange={e => setItemTransportado(e.target.value)}
                              placeholder="Ex: Chave, Documento, Almoço, etc."
                              required={activeTab === 'entrega'}
                              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                            />
                          </div>

                          {entregaTipo === 'levar' && (
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Quem vai receber lá? (Nome)
                              </label>
                              <input
                                type="text"
                                value={destinatarioNome}
                                onChange={e => setDestinatarioNome(e.target.value)}
                                placeholder="Nome de quem vai receber no destino"
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* FOTO DO LOCAL DE EMBARQUE (Para Corrida Comum) */}
                    {activeTab === 'corrida' && (
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          📸 Foto do Local de Embarque * (Obrigatório)
                        </label>
                        <div 
                          onClick={() => {
                            setCameraTarget('local');
                            setShowPhotoOptions(true);
                          }}
                          className="relative w-full h-32 bg-slate-50 border border-dashed border-slate-300 rounded-2xl overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:border-yellow-400 group transition-colors"
                        >
                          {fotoOrigemBase64 ? (
                            <img src={fotoOrigemBase64} alt="Local Origem" className="w-full h-full object-cover" />
                          ) : (
                            <>
                              <Camera className="w-6 h-6 text-slate-400 group-hover:text-yellow-500 mb-1 transition-colors" />
                              <span className="text-xs font-bold text-slate-500">Toque para adicionar foto de embarque</span>
                              <span className="text-[10px] text-slate-400">Escolha tirar foto ou selecionar da galeria</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* FOTO DA ENCOMENDA (Para Encomenda/Entrega Levar) - APENAS OPÇÃO DE TIRAR FOTO NA HORA */}
                    {activeTab === 'entrega' && entregaTipo === 'levar' && (
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          📸 Bater uma foto da encomenda * (Obrigatório)
                        </label>
                        <div 
                          onClick={() => {
                            startCamera('encomenda');
                          }}
                          className="relative w-full h-32 bg-slate-50 border border-dashed border-slate-300 rounded-2xl overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 group transition-colors"
                        >
                          {fotoEncomendaBase64 ? (
                            <div className="relative w-full h-full">
                              <img src={fotoEncomendaBase64} alt="Encomenda" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera className="w-6 h-6 text-white" />
                                <span className="text-white text-xs font-bold ml-2">Tirar Nova Foto</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              <Camera className="w-6 h-6 text-slate-400 group-hover:text-blue-500 mb-1 transition-colors" />
                              <span className="text-xs font-bold text-slate-500">Toque para bater a foto da encomenda</span>
                              <span className="text-[10px] text-slate-400">Apenas foto em tempo real (câmera)</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Inputs de arquivos ocultos para seleção de imagens */}
                    <input
                      type="file"
                      id="gallery-input"
                      accept="image/*"
                      onChange={handleFotoLocal}
                      className="hidden"
                    />
                    <input
                      type="file"
                      id="camera-capture-input"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFotoLocal}
                      className="hidden"
                    />

                    <button
                      type="submit"
                      className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-2xl font-black text-base shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
                    >
                      {activeTab === 'entrega' ? <Package className="w-5 h-5" /> : <Bike className="w-5 h-5" />}
                      Continuar e Ver Valor
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Direita: Card de Tarifas e Segurança */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white rounded-[32px] p-6 border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-slate-900 text-base">Estimativa de Preços</h4>
                  <span className="px-2.5 py-0.5 bg-yellow-400 text-slate-950 font-black rounded-full text-[10px]">
                    🕒 {identifyingTurnoAtual(getConfig())}
                  </span>
                </div>
                <div className="space-y-3 text-xs bg-slate-50 p-4 rounded-2xl">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tarifa Base Municipal</span>
                    <span className="font-bold text-slate-800">
                      R$ {(() => {
                        if (corridaAtiva) {
                          const addVal = corridaAtiva.valorAdicionalZonaRural || 0;
                          return (corridaAtiva.valorEstimado - addVal).toFixed(2);
                        }
                        const systemCfg = getConfig();
                        const currentTurn = identifyingTurnoAtual(systemCfg);
                        const tarObj = (systemCfg.tarifas || []).find(
                          t => t.turno === currentTurn && !t.regiaoOrigem && !t.regiaoDestino
                        );
                        return (tarObj ? tarObj.valor : systemCfg.tarifaBase).toFixed(2);
                      })()}
                    </span>
                  </div>

                  {(isZonaRural || !!confirmandoResumo?.isZonaRural || !!corridaAtiva?.isZonaRural) && (
                    <div className="flex justify-between border-t border-slate-200/60 pt-2 mt-2">
                      <span className="text-slate-500 font-bold">Taxa Adicional (Rural/Vizinha)</span>
                      <span className="font-extrabold text-amber-600 text-right">
                        A combinar / Reajustado pelo piloto
                      </span>
                    </div>
                  )}

                  {corridaAtiva && corridaAtiva.isZonaRural && (corridaAtiva.valorAdicionalZonaRural || 0) > 0 && (
                    <div className="flex justify-between border-t border-slate-250 pt-2 mt-2">
                      <span className="text-slate-500 font-bold">Adicional Zona Rural</span>
                      <span className="font-bold text-amber-600 font-mono">
                        R$ {corridaAtiva.valorAdicionalZonaRural?.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {corridaAtiva && corridaAtiva.isZonaRural && (corridaAtiva.valorAdicionalZonaRural || 0) > 0 && (
                    <div className="flex justify-between border-t border-slate-300 pt-2 mt-2 font-black text-slate-900 text-sm">
                      <span>Valor Total</span>
                      <span className="font-mono text-emerald-600">
                        R$ {corridaAtiva.valorEstimado.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: HISTÓRICO DE CORRIDAS */}
        {activeView === 'historico' && (
          <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-slate-200/80 shadow-sm animate-fade-in">
            <h3 className="text-xl font-extrabold text-slate-900 mb-6">Histórico de Solicitações</h3>
            {minhasCorridas.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Você ainda não realizou nenhuma corrida no MotoTáxi.
              </div>
            ) : (
              <div className="space-y-4">
                {minhasCorridas.map(r => (
                  <div
                    key={r.id}
                    onClick={() => setCorridaSelecionada(r)}
                    className="p-5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-all hover:shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${statusLabels[r.status]?.bg || 'bg-slate-400 text-white'}`}>
                          {r.status.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">{r.data} às {r.hora}</span>
                      </div>
                      <p className="font-extrabold text-slate-900 text-sm mt-1">De: {r.origem}</p>
                      <p className="text-xs text-slate-600">Para: {r.destino}</p>
                      {r.mototaxistaNome && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 pt-1 font-semibold">
                          🏍️ Mototaxista: <span className="notranslate font-bold" translate="no">{r.mototaxistaNome}</span> (<span className="notranslate font-mono" translate="no">{r.mototaxistaPlaca}</span>)
                        </p>
                      )}
                    </div>

                    <div className="text-right sm:shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-200">
                      <p className="text-xs text-slate-400">Valor Cobrado</p>
                      <p className="text-lg font-black text-slate-900 font-mono font-mono">R$ {r.valorEstimado.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Opções de Foto */}
      {showPhotoOptions && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 space-y-4 shadow-xl">
            <div className="text-center">
              <h3 className="text-lg font-extrabold text-slate-800 font-sans">
                Foto do Local de Embarque
              </h3>
              <p className="text-xs text-slate-500 mt-1 font-sans">Como você deseja adicionar a foto?</p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => startCamera('local')}
                className="w-full py-4 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border border-slate-200 transition-colors cursor-pointer"
              >
                <Camera className="w-5 h-5 text-yellow-500" />
                <span>📷 Tirar foto pela câmera</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCameraTarget('local');
                  setShowPhotoOptions(false);
                  const fileInput = document.getElementById('gallery-input');
                  if (fileInput) fileInput.click();
                }}
                className="w-full py-4 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border border-slate-200 transition-colors cursor-pointer"
              >
                <Camera className="w-5 h-5 text-blue-500" />
                <span>🖼️ Escolher foto da galeria</span>
              </button>

              {fotoOrigemBase64 && (
                <button
                  type="button"
                  onClick={() => {
                    setFotoOrigemBase64('');
                    setShowPhotoOptions(false);
                  }}
                  className="w-full py-4 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border border-rose-100 transition-colors cursor-pointer"
                >
                  ❌ Remover foto
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowPhotoOptions(false)}
                className="w-full py-4 bg-white hover:bg-slate-50 text-slate-500 rounded-2xl font-bold text-sm flex items-center justify-center border border-slate-100 transition-colors cursor-pointer"
              >
                🚪 Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Captura da Câmera */}
      {showCameraModal && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <h3 className="text-white font-extrabold text-sm uppercase tracking-wider">
              Câmera de Embarque
            </h3>
            <button
              onClick={stopCamera}
              className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
            {cameraError ? (
              <div className="p-6 text-center space-y-4 max-w-sm">
                <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
                <p className="text-slate-300 font-bold text-sm leading-relaxed">{cameraError}</p>
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={requestCameraAccess}
                    className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-2xl font-bold text-xs cursor-pointer transition-colors"
                  >
                    🔄 Tentar Novamente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      const input = document.getElementById('camera-capture-input') as HTMLInputElement;
                      if (input) input.click();
                    }}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-xs cursor-pointer border border-slate-700 transition-colors"
                  >
                    📷 Usar Câmera do Sistema
                  </button>
                </div>
              </div>
            ) : (
              <>
                <video
                  id="camera-preview"
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Overlay do enquadramento */}
                <div className="absolute inset-0 border-2 border-dashed border-white/25 m-12 rounded-3xl pointer-events-none flex items-center justify-center">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-white/40 bg-black/40 px-3 py-1 rounded-full text-center">
                    Enquadre o ponto de embarque
                  </span>
                </div>
              </>
            )}
          </div>

          {!cameraError && (
            <div className="bg-slate-900 p-8 flex flex-col items-center justify-center space-y-4">
              <button
                onClick={capturePhoto}
                className="w-16 h-16 rounded-full bg-white border-4 border-slate-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                title="Tirar foto"
              >
                <div className="w-10 h-10 rounded-full bg-yellow-400" />
              </button>
              <p className="text-xs text-slate-400">Toque no botão para tirar a foto</p>
            </div>
          )}
        </div>
      )}

      {showRuralConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-[32px] p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-6 my-auto animate-scale-in text-center">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500 border border-amber-200">
              <AlertCircle className="w-10 h-10" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                Taxa Adicional Requerida
              </h3>
              <p className="text-xs text-slate-600 font-bold leading-relaxed">
                Você selecionou um destino na <span className="text-amber-600 font-extrabold">Zona Rural</span> ou em <span className="text-amber-600 font-extrabold">Cidades Vizinhas</span>.
              </p>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl text-left">
              <p className="text-xs text-amber-800 font-bold leading-relaxed">
                ⚠️ O valor estimado de <span className="font-black text-amber-950">R$ {confirmandoResumo?.valor.toFixed(2)}</span> cobre apenas o perímetro municipal padrão. O valor final será reajustado pelo mototaxista com a taxa adicional correspondente após aceitação.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <button
                type="button"
                onClick={() => setShowRuralConfirmation(false)}
                className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition-all cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRuralConfirmation(false);
                  executeConfirmarCorridaDefinitiva();
                }}
                className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-950 rounded-2xl font-black text-xs shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                Confirmar e Chamar
              </button>
            </div>
          </div>
        </div>
      )}

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
          senderId={cli.id}
          senderName={cli.nome}
          onClose={() => setShowChat(false)}
          disabled={['finalizada', 'cancelada', 'FINALIZADA', 'CANCELADA'].includes(corridaAtiva.status)}
        />
      )}

      {/* Modal de Detalhes da Corrida */}
      {corridaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto animate-fade-in" onClick={() => setCorridaSelecionada(null)}>
          <div className="bg-white w-full max-w-2xl rounded-[32px] p-6 sm:p-8 space-y-6 shadow-2xl relative my-8" onClick={(e) => e.stopPropagation()}>
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
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${statusLabels[corridaSelecionada.status]?.bg || 'bg-slate-400 text-white'}`}>
                    {corridaSelecionada.status.replace(/_/g, ' ')}
                  </span>
                  <p className="text-xs text-slate-400 font-medium mt-2">{corridaSelecionada.data} • {corridaSelecionada.hora}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs text-slate-400 font-semibold">Valor Cobrado</p>
                  <p className="text-2xl font-black text-emerald-600 font-mono">R$ {corridaSelecionada.valorEstimado.toFixed(2)}</p>
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
                        {corridaSelecionada.tempoChegadaEstimado ? 'Informado pelo mototaxista' : 'Previsão de tempo de viagem'}
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

              {/* Mototaxista Information */}
              {corridaSelecionada.mototaxistaNome ? (
                <div className="border-t border-slate-100 pt-5 space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Informações do Mototaxista</h4>
                  <div className="flex items-center gap-4">
                    {corridaSelecionada.mototaxistaFoto ? (
                      <img src={corridaSelecionada.mototaxistaFoto} alt="Mototaxista" className="w-14 h-14 rounded-full object-cover border-2 border-slate-200" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                        <Bike className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-slate-900 leading-snug notranslate" translate="no">{corridaSelecionada.mototaxistaNome}</p>
                      {corridaSelecionada.mototaxistaMoto && (
                        <p className="text-xs text-slate-500 mt-0.5">{corridaSelecionada.mototaxistaMoto} • <span className="font-mono font-bold text-amber-600 uppercase">{corridaSelecionada.mototaxistaPlaca}</span></p>
                      )}
                      {corridaSelecionada.mototaxistaTelefone && (
                        <p className="text-xs text-slate-400 mt-0.5">Whats: {corridaSelecionada.mototaxistaTelefone}</p>
                      )}
                    </div>
                    {corridaSelecionada.mototaxistaTelefone && (
                      <a href={`https://wa.me/55${corridaSelecionada.mototaxistaTelefone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 transition-colors">
                        <Phone className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="border-t border-slate-100 pt-5">
                  <p className="text-xs text-slate-400 font-semibold italic text-center">Nenhum mototaxista alocado para esta solicitação.</p>
                </div>
              )}
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
