import React, { useState } from 'react';
import { MototaxistaUser } from '../../types';
import { saveUser, getUsers, uploadBase64Image, sanitizeForFirestore } from '../../lib/db';
import { hashSenha } from '../../context/AuthContext';
import { collection, addDoc } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';
import { Shield, Bike, User, FileText, Upload, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, X, Camera, MapPin, XCircle, RefreshCw } from 'lucide-react';

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

interface DriverSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: MototaxistaUser | null;
}

export function DriverSignupModal({ isOpen, onClose, initialData }: DriverSignupModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [erroState, setErroState] = useState('');
  const setErro = (msg: string) => {
    setErroState(msg);
    if (msg) {
      setTimeout(() => {
        const modal = document.getElementById('driver-signup-modal-scroll');
        if (modal) {
          modal.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 50);
    }
  };
  const erro = erroState;
  const [sucesso, setSucesso] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Estados da Câmera
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeCameraField, setActiveCameraField] = useState<'fotoPerfil' | 'fotoMoto' | 'docCnh' | 'docRgCpf' | 'docMotoAnexo' | null>(null);

  // Passo 1: Dados Pessoais
  const [nome, setNome] = useState(initialData?.nome || '');
  const [cpf, setCpf] = useState(initialData?.cpf || (initialData?.docRgCpf ? 'Anexado' : ''));
  const [nascimento, setNascimento] = useState(initialData?.nascimento || '');
  const [telefone, setTelefone] = useState(initialData?.telefone || '');
  const [whatsapp, setWhatsapp] = useState(initialData?.whatsapp || '');
  const [cidade, setCidade] = useState(initialData?.cidade || '');
  const [bairro, setBairro] = useState(initialData?.bairro || '');
  const [endereco, setEndereco] = useState(initialData?.endereco || '');
  const [senha, setSenha] = useState(initialData?.senha || '');
  const [confirmarSenha, setConfirmarSenha] = useState(initialData?.senha || '');

  // Passo 2: Veículo e CNH
  const [placa, setPlaca] = useState(initialData?.placa || '');
  const [modeloMoto, setModeloMoto] = useState(initialData?.modeloMoto || '');
  const [corMoto, setCorMoto] = useState(initialData?.corMoto || '');
  const [possuiCnh, setPossuiCnh] = useState<boolean>(initialData?.possui_cnh !== false);
  const [numeroCnh, setNumeroCnh] = useState(initialData?.numeroCnh || '');
  const [categoriaCnh, setCategoriaCnh] = useState(initialData?.categoriaCnh || 'AB');
  const [validadeCnh, setValidadeCnh] = useState(initialData?.validadeCnh || '');

  // Passo 3: Fotos e Anexos (Base64)
  const [fotoPerfil, setFotoPerfil] = useState(initialData?.foto || '');
  const [fotoMoto, setFotoMoto] = useState(initialData?.fotoMoto || '');
  const [docCnh, setDocCnh] = useState(initialData?.docCnh || '');
  const [docRgCpf, setDocRgCpf] = useState(initialData?.docRgCpf || '');
  const [docMotoAnexo, setDocMotoAnexo] = useState(initialData?.docMoto || '');

  if (!isOpen) return null;

  const requestCameraAccess = async (field: 'fotoPerfil' | 'fotoMoto' | 'docCnh' | 'docRgCpf' | 'docMotoAnexo') => {
    setCameraError(null);
    const useRearCamera = field !== 'fotoPerfil';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: useRearCamera ? { ideal: 'environment' } : 'user', 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        }
      });
      setCameraStream(stream);
      return stream;
    } catch (err: any) {
      console.error('Erro ao acessar a câmera:', err);
      // Fallback a qualquer câmera de vídeo disponível
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true
        });
        setCameraStream(stream);
        return stream;
      } catch (fallbackErr) {
        setCameraError('Permita o acesso à câmera para bater a foto.');
        throw err;
      }
    }
  };

  const startCamera = async (field: 'fotoPerfil' | 'fotoMoto' | 'docCnh' | 'docRgCpf' | 'docMotoAnexo') => {
    setActiveCameraField(field);
    setShowCameraModal(true);
    setCameraError(null);
    try {
      const stream = await requestCameraAccess(field);
      setTimeout(() => {
        const videoEl = document.getElementById('driver-camera-preview') as HTMLVideoElement;
        if (videoEl) {
          videoEl.srcObject = stream;
        }
      }, 150);
    } catch (err) {
      console.warn('Erro ou negação de câmera:', err);
      setCameraError('Permita o acesso à câmera para bater a foto.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCameraModal(false);
    setActiveCameraField(null);
  };

  const capturePhoto = async () => {
    const videoEl = document.getElementById('driver-camera-preview') as HTMLVideoElement;
    if (!videoEl || !cameraStream || !activeCameraField) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoEl.videoWidth || 640;
      canvas.height = videoEl.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        const b64 = canvas.toDataURL('image/jpeg');
        const compressed = await compressImage(b64);
        
        if (activeCameraField === 'fotoPerfil') setFotoPerfil(compressed);
        else if (activeCameraField === 'fotoMoto') setFotoMoto(compressed);
        else if (activeCameraField === 'docCnh') setDocCnh(compressed);
        else if (activeCameraField === 'docRgCpf') setDocRgCpf(compressed);
        else if (activeCameraField === 'docMotoAnexo') setDocMotoAnexo(compressed);

        stopCamera();
      }
    } catch (err) {
      console.error('Erro ao capturar foto:', err);
      alert('Erro ao capturar a foto. Tente novamente.');
    }
  };

  const handleSystemCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onloadend = async () => {
          const b64 = reader.result as string;
          const compressed = await compressImage(b64);
          setFotoPerfil(compressed);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('Erro ao processar foto do sistema:', err);
      }
    }
  };

  const converterFileParaBase64 = (file: File, callback: (b64: string) => void) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const b64 = reader.result as string;
      if (file.type.startsWith('image/')) {
        try {
          const compressed = await compressImage(b64, 800, 800, 0.6);
          callback(compressed);
        } catch (err) {
          console.error('Erro ao comprimir imagem:', err);
          callback(b64);
        }
      } else {
        callback(b64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, callback: (b64: string) => void) => {
    if (e.target.files && e.target.files[0]) {
      converterFileParaBase64(e.target.files[0], callback);
    }
  };

  const handleDrop = (e: React.DragEvent, callback: (b64: string) => void) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      converterFileParaBase64(e.dataTransfer.files[0], callback);
    }
  };

  const validarCPF = (cpfStr: string): boolean => {
    const cleanCPF = cpfStr.replace(/\D/g, '');
    if (cleanCPF.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) {
      soma += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cleanCPF.charAt(9))) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) {
      soma += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cleanCPF.charAt(10))) return false;

    return true;
  };

  const validarPasso1 = () => {
    setErro('');
    if (!nome.trim() || !cpf.trim() || !nascimento || !whatsapp.trim() || !cidade.trim() || !bairro.trim() || !senha) {
      setErro('Preencha todos os campos obrigatórios (*).');
      return false;
    }

    // 1. Validação de Idade (Maior de 18 anos) - Robust Timezone-Agnostic Calculation
    let birthYear = 0, birthMonth = 0, birthDay = 0;
    if (nascimento.includes('-')) {
      const parts = nascimento.split('-');
      birthYear = parseInt(parts[0], 10);
      birthMonth = parseInt(parts[1], 10) - 1; // 0-indexed month
      birthDay = parseInt(parts[2], 10);
    } else if (nascimento.includes('/')) {
      const parts = nascimento.split('/');
      birthYear = parseInt(parts[2], 10);
      birthMonth = parseInt(parts[1], 10) - 1; // 0-indexed month
      birthDay = parseInt(parts[0], 10);
    }

    if (birthYear && !isNaN(birthMonth) && birthDay) {
      const hoje = new Date();
      let idade = hoje.getFullYear() - birthYear;
      const m = hoje.getMonth() - birthMonth;
      if (m < 0 || (m === 0 && hoje.getDate() < birthDay)) {
        idade--;
      }
      if (idade < 18) {
        setErro('Você precisa ter 18 anos ou mais para se cadastrar como parceiro.');
        return false;
      }
    } else {
      setErro('Data de nascimento inválida.');
      return false;
    }

    // 2. Validação de CPF (Algoritmo Oficial)
    const cleanCpf = cpf.trim();
    if (!cleanCpf.toLowerCase().includes('anexado')) {
      if (!validarCPF(cleanCpf)) {
        setErro('O CPF informado é inválido. Por favor, verifique os dígitos digitados.');
        return false;
      }
    }

    if (senha.length < 4) {
      setErro('A senha secreta deve ter no mínimo 4 caracteres.');
      return false;
    }
    if (senha !== confirmarSenha) {
      setErro('A confirmação de senha não confere.');
      return false;
    }
    return true;
  };

  const validarPasso2 = () => {
    setErro('');
    const placaClean = placa.trim().toUpperCase();
    if (!placaClean || !modeloMoto.trim() || !corMoto.trim()) {
      setErro('Preencha todos os dados da moto.');
      return false;
    }
    if (possuiCnh) {
      if (!numeroCnh.trim() || !validadeCnh) {
        setErro('Preencha todos os dados obrigatórios da CNH.');
        return false;
      }
    }
    // Verificar se placa já existe
    const todos = getUsers();
    const dup = todos.find(u => u.role === 'mototaxista' && (u as MototaxistaUser).placa.replace(/[^a-zA-Z0-9]/g, '') === placaClean.replace(/[^a-zA-Z0-9]/g, '') && u.id !== initialData?.id);
    if (dup) {
      setErro('Já existe um parceiro cadastrado com esta placa no sistema.');
      return false;
    }
    return true;
  };

  const handleFinalizarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setErro('');

    if (step === 1) {
      if (validarPasso1()) {
        setStep(2);
      }
      return;
    }

    if (step === 2) {
      if (validarPasso2()) {
        setStep(3);
      }
      return;
    }

    if (!fotoPerfil || !fotoMoto || !docRgCpf || (possuiCnh && !docCnh)) {
      setErro('É obrigatório anexar a sua foto de perfil, foto da moto e os documentos solicitados.');
      return;
    }

    setEnviando(true);
    try {
      const placaClean = placa.trim().toUpperCase();
      const tempId = 'mto_temp_' + Date.now().toString(36);

      // Upload das imagens para o Firebase Storage (retorna URL ou fallback se falhar)
      const fotoPerfilUrl = await uploadBase64Image(fotoPerfil, `mototaxistas/${tempId}/foto_perfil.jpg`);
      const fotoMotoUrl = await uploadBase64Image(fotoMoto, `mototaxistas/${tempId}/foto_moto.jpg`);
      const docRgCpfUrl = await uploadBase64Image(docRgCpf, `mototaxistas/${tempId}/doc_rg_cpf.jpg`);
      const docCnhUrl = possuiCnh && docCnh ? await uploadBase64Image(docCnh, `mototaxistas/${tempId}/doc_cnh.jpg`) : '';
      const docMotoUrl = docMotoAnexo ? await uploadBase64Image(docMotoAnexo, `mototaxistas/${tempId}/doc_moto.jpg`) : '';

      const dadosMoto: Omit<MototaxistaUser, 'id'> = {
        nome: nome.trim(),
        email: `${placaClean.toLowerCase()}@parceiro.mototxi.com`,
        role: 'mototaxista' as const,
        status: 'ativo' as const,
        placa: placaClean,
        modeloMoto: modeloMoto.trim(),
        corMoto: corMoto.trim(),
        telefone: whatsapp.trim(),
        whatsapp: whatsapp.trim(),
        cidade: cidade.trim(),
        bairro: bairro.trim(),
        endereco: endereco.trim(),
        foto: fotoPerfilUrl || '',
        fotoMoto: fotoMotoUrl || '',
        cpf: cpf.trim(),
        nascimento: nascimento,
        disponibilidade: (initialData?.disponibilidade || 'indisponivel') as 'disponivel' | 'ocupado' | 'indisponivel',
        status_aprovacao: 'PENDENTE' as const,
        status_cadastro: 'Aguardando Aprovação' as const,
        motivo_reprovacao: initialData?.motivo_reprovacao || '',
        data_cadastro: initialData?.data_cadastro || new Date().toISOString(),
        criadoEm: initialData?.criadoEm || new Date().toISOString(),
        totalCorridas: initialData?.totalCorridas || 0,
        ganhosHoje: initialData?.ganhosHoje || 0,
        ganhosSemana: initialData?.ganhosSemana || 0,
        ganhosMes: initialData?.ganhosMes || 0,
        avaliacao: initialData?.avaliacao || 5.0,
        senha: senha,
        senha_hash: hashSenha(senha),
        passwordCreated: true,
        // Documentos e CNH
        possui_cnh: possuiCnh,
        numero_cnh: possuiCnh ? numeroCnh.trim() : null,
        categoria_cnh: possuiCnh ? categoriaCnh : null,
        validade_cnh: possuiCnh ? validadeCnh : null,
        foto_cnh: possuiCnh ? docCnhUrl : null,
        numeroCnh: possuiCnh ? numeroCnh.trim() : null,
        categoriaCnh: possuiCnh ? categoriaCnh : null,
        validadeCnh: possuiCnh ? validadeCnh : null,
        docCnh: possuiCnh ? docCnhUrl : null,
        docRgCpf: docRgCpfUrl || '',
        docMoto: docMotoUrl || '',
        docResidencia: initialData?.docResidencia || '',
        latitude: initialData?.latitude || (-23.5505 + (Math.random() - 0.5) * 0.05),
        longitude: initialData?.longitude || (-46.6333 + (Math.random() - 0.5) * 0.05),
      };

      let docId = '';
      if (firestore) {
        // Use standard addDoc for Firestore to auto-generate the ID safely
        const docRef = await addDoc(collection(firestore, 'users'), sanitizeForFirestore(dadosMoto));
        docId = docRef.id;
      } else {
        docId = 'mto_' + Date.now().toString(36);
      }

      const novoMoto: MototaxistaUser = {
        ...dadosMoto,
        id: docId,
      };

      await saveUser(novoMoto);
      setSucesso(true);
    } catch (err) {
      console.error("Erro ao salvar cadastro de mototaxista:", err);
      setErro("Houve um erro ao enviar seu cadastro. Por favor, tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  const renderUploadBox = (
    label: string, 
    icon: React.ReactNode, 
    valBase64: string, 
    setVal: (s: string) => void,
    field: 'fotoMoto' | 'docCnh' | 'docRgCpf' | 'docMotoAnexo'
  ) => {
    const idSafe = label.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return (
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => handleDrop(e, setVal)}
        className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all flex flex-col items-center justify-center relative min-h-[140px] ${valBase64 ? 'border-emerald-500 bg-emerald-50/40' : 'border-slate-300 hover:border-emerald-400 bg-slate-50'}`}
      >
        {valBase64 ? (
          <>
            <img src={valBase64} alt={label} className="w-16 h-16 object-cover rounded-xl mb-2 border border-slate-200 shadow-sm" />
            <span className="text-xs font-extrabold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Anexado com sucesso!
            </span>
            <button
              type="button"
              onClick={() => setVal('')}
              className="absolute top-2 right-2 p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-full text-[10px] font-bold cursor-pointer transition-all"
            >
              Trocar
            </button>
          </>
        ) : (
          <div className="w-full flex flex-col items-center">
            <div className="p-2.5 bg-white rounded-xl shadow-sm text-slate-600 mb-2">
              {icon}
            </div>
            <p className="text-xs font-bold text-slate-700 mb-1.5">{label}</p>
            
            <div className="flex flex-col xs:flex-row gap-1.5 w-full mt-1">
              <button
                type="button"
                onClick={() => startCamera(field)}
                className="flex-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-600" /> Bater Foto
              </button>
              <button
                type="button"
                onClick={() => document.getElementById(`file-${idSafe}`)?.click()}
                className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
              >
                <Upload className="w-3.5 h-3.5 text-slate-600" /> Galeria/PDF
              </button>
            </div>

            {/* Hidden Inputs */}
            <input
              type="file"
              id={`cam-${idSafe}`}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFileChange(e, setVal)}
            />
            <input
              type="file"
              id={`file-${idSafe}`}
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => handleFileChange(e, setVal)}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div id="driver-signup-modal-scroll" className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative my-8 border border-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>

        {sucesso ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">{initialData ? 'Atualização Enviada com Sucesso!' : 'Cadastro Enviado com Sucesso!'}</h3>
            <p className="text-slate-600 max-w-md mx-auto text-sm leading-relaxed mb-6">
              {initialData ? 'Suas atualizações e novos documentos foram recebidos pela administração para reavaliação.' : `Suas informações e documentos foram recebidos e estão sob análise da nossa equipe administrativa. Assim que aprovado, você poderá fazer login no sistema usando a sua placa ${placa.toUpperCase()} e senha.`}
            </p>
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-xs text-left max-w-md mx-auto mb-8 font-medium">
              ℹ️ <b>Prazo de análise:</b> Em média algumas horas. Se houver alguma pendência nos documentos, o status mudará para <i>"Solicitada Edição"</i> no seu painel.
            </div>
            <button
              onClick={onClose}
              className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-extrabold text-sm transition-all shadow-md cursor-pointer"
            >
              {initialData ? 'Voltar ao Meu Painel' : 'Entendido, Voltar ao Login'}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                <Bike className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{initialData ? 'Atualizar Meu Cadastro / Anexos' : 'Seja um Mototaxista Parceiro'}</h3>
                <p className="text-xs font-semibold text-slate-500">{initialData ? 'Edite seus dados ou reenvie documentos com pendência' : 'Cadastro autônomo com envio de documentos e CNH'}</p>
              </div>
            </div>

            {/* Indicador de Passos */}
            <div className="grid grid-cols-3 gap-2 mb-8 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/60 text-center">
              <div className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${step === 1 ? 'bg-white text-slate-900 shadow-sm' : step > 1 ? 'text-emerald-600' : 'text-slate-400'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-slate-900 text-white' : step > 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>1</span>
                Dados Pessoais
              </div>
              <div className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${step === 2 ? 'bg-white text-slate-900 shadow-sm' : step > 2 ? 'text-emerald-600' : 'text-slate-400'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-slate-900 text-white' : step > 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>2</span>
                Moto e CNH
              </div>
              <div className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${step === 3 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>3</span>
                Anexar Docs
              </div>
            </div>

            {erro && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {erro}
              </div>
            )}

            <form onSubmit={handleFinalizarCadastro}>
              {/* PASSO 1: DADOS PESSOAIS */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Nome Completo *</label>
                    <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Carlos Pereira da Silva" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">CPF ou RG *</label>
                      <input type="text" value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Data de Nascimento *</label>
                      <input type="date" value={nascimento} onChange={e => setNascimento(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">WhatsApp *</label>
                    <input type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Cidade *</label>
                      <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex: São Paulo" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Bairro / Região Base *</label>
                      <input type="text" value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Ex: Centro" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Endereço Residencial Completo</label>
                    <input type="text" value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua das Flores, 123 - Apto 4" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-xs font-extrabold text-slate-800 mb-2.5">Crie sua Senha Secreta de Login</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Senha Secreta *</label>
                        <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 4 caracteres" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Repita a Senha *</label>
                        <input type="password" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} placeholder="Repita a senha" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => { if (validarPasso1()) setStep(2); }}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-extrabold text-sm transition-all flex items-center justify-center gap-2 mt-6 cursor-pointer shadow-md"
                  >
                    Próximo: Dados da Moto e CNH <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* PASSO 2: VEÍCULO E CNH */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Sua placa será o seu identificador de login no app após a aprovação.</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Placa da Moto *</label>
                      <input type="text" value={placa} onChange={e => setPlaca(e.target.value)} placeholder="ABC1D23" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono font-black uppercase text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Modelo da Moto *</label>
                      <input type="text" value={modeloMoto} onChange={e => setModeloMoto(e.target.value)} placeholder="Ex: Honda CG 160" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Cor da Moto *</label>
                      <input type="text" value={corMoto} onChange={e => setCorMoto(e.target.value)} placeholder="Ex: Vermelha" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 mt-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Possui CNH?</label>
                    <div className="flex items-center gap-6 mb-4">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-slate-800 select-none">
                        <input
                          type="radio"
                          name="possui_cnh_option"
                          checked={possuiCnh === true}
                          onChange={() => setPossuiCnh(true)}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        Sim
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-slate-800 select-none">
                        <input
                          type="radio"
                          name="possui_cnh_option"
                          checked={possuiCnh === false}
                          onChange={() => setPossuiCnh(false)}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        Não
                      </label>
                    </div>
                  </div>

                  {possuiCnh && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 animate-in fade-in duration-200">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Número da CNH *</label>
                        <input type="text" value={numeroCnh} onChange={e => setNumeroCnh(e.target.value)} placeholder="00000000000" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Categoria CNH *</label>
                        <select value={categoriaCnh} onChange={e => setCategoriaCnh(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all">
                          <option value="A">A</option>
                          <option value="AB">AB</option>
                          <option value="AC">AC</option>
                          <option value="AD">AD</option>
                          <option value="AE">AE</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Validade CNH *</label>
                        <input type="date" value={validadeCnh} onChange={e => setValidadeCnh(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-8">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-extrabold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" /> Voltar
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (validarPasso2()) setStep(3); }}
                      className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-extrabold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      Próximo: Anexar Documentos <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* PASSO 3: FOTOS E ANEXOS */}
              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-600 font-medium">
                    Anexar fotos nítidas dos documentos acelera a sua aprovação. Suporte a clique ou arrastar e soltar.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Foto de Perfil (Selfie) via Câmera em Tempo Real */}
                    <div
                      className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all flex flex-col items-center justify-center relative min-h-[140px] ${fotoPerfil ? 'border-emerald-500 bg-emerald-50/40' : 'border-slate-300 hover:border-emerald-400 bg-slate-50'}`}
                    >
                      {fotoPerfil ? (
                        <>
                          <img src={fotoPerfil} alt="Foto de Perfil" className="w-16 h-16 object-cover rounded-xl mb-2 border border-slate-200 shadow-sm" />
                          <span className="text-xs font-extrabold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Foto capturada!
                          </span>
                          <button
                            type="button"
                            onClick={() => setFotoPerfil('')}
                            className="absolute top-2 right-2 p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-full text-[10px] font-bold cursor-pointer transition-all"
                          >
                            Trocar
                          </button>
                        </>
                      ) : (
                        <div className="w-full flex flex-col items-center">
                          <div className="p-2.5 bg-white rounded-xl shadow-sm text-emerald-600 mb-2">
                            <Camera className="w-6 h-6" />
                          </div>
                          <p className="text-xs font-bold text-slate-700 mb-1.5">1. Foto de Perfil *</p>
                          
                          <div className="flex flex-col xs:flex-row gap-1.5 w-full mt-1">
                            <button
                              type="button"
                              onClick={() => startCamera('fotoPerfil')}
                              className="flex-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                            >
                              <Camera className="w-3.5 h-3.5 text-emerald-600" /> Bater Foto
                            </button>
                            <button
                              type="button"
                              onClick={() => document.getElementById('driver-file-profile')?.click()}
                              className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all"
                            >
                              <Upload className="w-3.5 h-3.5 text-slate-600" /> Galeria
                            </button>
                          </div>

                          {/* Hidden Input for System Camera fallback/Gallery selection */}
                          <input
                            type="file"
                            id="driver-file-profile"
                            accept="image/*"
                            className="hidden"
                            onChange={handleSystemCameraCapture}
                          />
                        </div>
                      )}
                    </div>
                    {renderUploadBox('2. Foto da Moto *', <Bike className="w-6 h-6 text-emerald-600" />, fotoMoto, setFotoMoto, 'fotoMoto')}
                  </div>

                  <div className={`grid grid-cols-2 ${possuiCnh ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3 pt-2`}>
                    {possuiCnh && renderUploadBox('CNH Aberta *', <FileText className="w-5 h-5 text-slate-700" />, docCnh, setDocCnh, 'docCnh')}
                    {renderUploadBox('RG ou CPF *', <FileText className="w-5 h-5 text-slate-700" />, docRgCpf, setDocRgCpf, 'docRgCpf')}
                    {renderUploadBox('Doc Moto (CRLV) (Opcional)', <FileText className="w-5 h-5 text-slate-700" />, docMotoAnexo, setDocMotoAnexo, 'docMotoAnexo')}
                  </div>

                  <div className="flex items-center gap-3 mt-8">
                    <button
                      type="button"
                      disabled={enviando}
                      onClick={() => setStep(2)}
                      className="px-6 py-4 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-2xl font-extrabold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" /> Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={enviando}
                      className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white rounded-2xl font-extrabold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-xl"
                    >
                      {enviando ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" /> Enviando Cadastro...
                        </>
                      ) : (
                        <>
                          Enviar para Aprovação Admin <CheckCircle2 className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </>
        )}
      </div>

      {/* Modal da Câmera */}
      {showCameraModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center shadow-2xl relative border border-slate-100 flex flex-col gap-4">
            <button
              onClick={stopCamera}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-lg font-black text-slate-900">Tirar Foto de Perfil</h3>
            <p className="text-xs text-slate-500 leading-normal mb-2">Centralize seu rosto e clique no botão para capturar.</p>

            <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 shadow-inner flex items-center justify-center">
              {cameraError ? (
                <div className="p-4 text-center text-xs text-red-500 font-bold flex flex-col items-center gap-2">
                  <XCircle className="w-8 h-8 text-red-500 animate-pulse" />
                  <p>{cameraError}</p>
                  <p className="text-[11px] text-slate-500 font-normal leading-relaxed">
                    Verifique as permissões de acesso à câmera no seu navegador ou tente novamente.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      document.getElementById('driver-file-profile')?.click();
                    }}
                    className="w-full mt-2 py-2.5 bg-slate-900 hover:bg-slate-850 text-white rounded-xl font-bold text-xs cursor-pointer border border-slate-800 transition-colors"
                  >
                    📷 Usar Câmera do Sistema / Arquivo
                  </button>
                </div>
              ) : (
                <video
                  id="driver-camera-preview"
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              )}
            </div>

            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={stopCamera}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer transition-all"
              >
                Cancelar
              </button>
              {!cameraError && (
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs cursor-pointer transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" /> Bater Foto
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
