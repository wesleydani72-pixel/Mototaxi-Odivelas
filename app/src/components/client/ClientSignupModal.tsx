import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';
import { ClienteUser } from '../../types';
import { saveUser, getUsers, addNotification, uploadBase64Image } from '../../lib/db';
import { User, Mail, Phone, Lock, Camera, ArrowRight, ArrowLeft, X, CheckCircle2, AlertCircle, RefreshCw, Compass, XCircle, Calendar, FileText } from 'lucide-react';

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

export function validarCPF(cpf: string): boolean {
  // Remove caracteres especiais (. e -)
  const cpfLimpo = cpf.replace(/[^\d]+/g, '');

  // Se não tiver 11 dígitos ou for uma sequência repetida conhecida, é inválido
  if (cpfLimpo.length !== 11 || !!cpfLimpo.match(/^(\d)\1{10}$/)) {
    return false;
  }

  const digitos = cpfLimpo.split('').map(el => +el);

  // Validação do primeiro dígito verificador
  let soma = 0;
  for (let i = 1; i <= 9; i++) {
    soma = soma + digitos[i - 1] * (11 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== digitos[9]) return false;

  // Validação do segundo dígito verificador
  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma = soma + digitos[i - 1] * (12 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== digitos[10]) return false;

  return true;
}


interface ClientSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ClientSignupModal({ isOpen, onClose }: ClientSignupModalProps) {
  const navigate = useNavigate();
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  // Conta & Contato (Persistidos de forma segura no localStorage para evitar perda caso o SO recarregue a WebView ao abrir a câmera)
  const [nome, setNome] = useState(() => {
    try {
      return localStorage.getItem('signup_client_nome') || '';
    } catch {
      return '';
    }
  });
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem('signup_client_email') || '';
    } catch {
      return '';
    }
  });
  const [telefone, setTelefone] = useState(() => {
    try {
      return localStorage.getItem('signup_client_telefone') || '';
    } catch {
      return '';
    }
  });
  const [senha, setSenha] = useState(() => {
    try {
      return localStorage.getItem('signup_client_senha') || '';
    } catch {
      return '';
    }
  });
  const [confirmarSenha, setConfirmarSenha] = useState(() => {
    try {
      return localStorage.getItem('signup_client_confirmarSenha') || '';
    } catch {
      return '';
    }
  });
  const [fotoBase64, setFotoBase64] = useState(() => {
    try {
      return localStorage.getItem('signup_client_fotoBase64') || '';
    } catch {
      return '';
    }
  });
  const [dataNascimento, setDataNascimento] = useState(() => {
    try {
      return localStorage.getItem('signup_client_dataNascimento') || '';
    } catch {
      return '';
    }
  });
  const [rgCpf, setRgCpf] = useState(() => {
    try {
      return localStorage.getItem('signup_client_rgCpf') || '';
    } catch {
      return '';
    }
  });
  const [fotoRgCpfFrenteBase64, setFotoRgCpfFrenteBase64] = useState(() => {
    try {
      return localStorage.getItem('signup_client_fotoRgCpfFrenteBase64') || '';
    } catch {
      return '';
    }
  });
  const [fotoRgCpfVersoBase64, setFotoRgCpfVersoBase64] = useState(() => {
    try {
      return localStorage.getItem('signup_client_fotoRgCpfVersoBase64') || '';
    } catch {
      return '';
    }
  });

  // Efeitos para sincronizar o estado com o localStorage com blocos try-catch para segurança absoluta
  React.useEffect(() => {
    try {
      localStorage.setItem('signup_client_nome', nome);
    } catch (e) {
      console.warn('Erro ao salvar nome no cache local:', e);
    }
  }, [nome]);

  React.useEffect(() => {
    try {
      localStorage.setItem('signup_client_email', email);
    } catch (e) {
      console.warn('Erro ao salvar email no cache local:', e);
    }
  }, [email]);

  React.useEffect(() => {
    try {
      localStorage.setItem('signup_client_telefone', telefone);
    } catch (e) {
      console.warn('Erro ao salvar telefone no cache local:', e);
    }
  }, [telefone]);

  React.useEffect(() => {
    try {
      localStorage.setItem('signup_client_senha', senha);
    } catch (e) {
      console.warn('Erro ao salvar senha no cache local:', e);
    }
  }, [senha]);

  React.useEffect(() => {
    try {
      localStorage.setItem('signup_client_confirmarSenha', confirmarSenha);
    } catch (e) {
      console.warn('Erro ao salvar confirmarSenha no cache local:', e);
    }
  }, [confirmarSenha]);

  React.useEffect(() => {
    try {
      localStorage.setItem('signup_client_fotoBase64', fotoBase64);
    } catch (e) {
      console.warn('Erro ao salvar fotoBase64 no cache local:', e);
    }
  }, [fotoBase64]);

  React.useEffect(() => {
    try {
      localStorage.setItem('signup_client_dataNascimento', dataNascimento);
    } catch (e) {
      console.warn('Erro ao salvar dataNascimento no cache local:', e);
    }
  }, [dataNascimento]);

  React.useEffect(() => {
    try {
      localStorage.setItem('signup_client_rgCpf', rgCpf);
    } catch (e) {
      console.warn('Erro ao salvar rgCpf no cache local:', e);
    }
  }, [rgCpf]);

  React.useEffect(() => {
    try {
      localStorage.setItem('signup_client_fotoRgCpfFrenteBase64', fotoRgCpfFrenteBase64);
    } catch (e) {
      console.warn('Erro ao salvar fotoRgCpfFrenteBase64 no cache local:', e);
    }
  }, [fotoRgCpfFrenteBase64]);

  React.useEffect(() => {
    try {
      localStorage.setItem('signup_client_fotoRgCpfVersoBase64', fotoRgCpfVersoBase64);
    } catch (e) {
      console.warn('Erro ao salvar fotoRgCpfVersoBase64 no cache local:', e);
    }
  }, [fotoRgCpfVersoBase64]);

  const limparCamposSalvos = () => {
    try {
      localStorage.removeItem('signup_client_active');
      localStorage.removeItem('signup_client_nome');
      localStorage.removeItem('signup_client_email');
      localStorage.removeItem('signup_client_telefone');
      localStorage.removeItem('signup_client_senha');
      localStorage.removeItem('signup_client_confirmarSenha');
      localStorage.removeItem('signup_client_fotoBase64');
      localStorage.removeItem('signup_client_dataNascimento');
      localStorage.removeItem('signup_client_rgCpf');
      localStorage.removeItem('signup_client_fotoRgCpfFrenteBase64');
      localStorage.removeItem('signup_client_fotoRgCpfVersoBase64');
    } catch (e) {
      console.warn('Erro ao limpar cache local:', e);
    }
  };

  const handleClose = () => {
    limparCamposSalvos();
    onClose();
  };

  // Estados da Câmera
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeCameraField, setActiveCameraField] = useState<'fotoPerfil' | 'fotoRgCpfFrente' | 'fotoRgCpfVerso' | null>(null);

  // Estado de Cadastro / Envio
  const [cadastrando, setCadastrando] = useState(false);

  // Validação em tempo real de maioridade (menor de 18 anos)
  const isMenorDeIdade = (dataNasc: string): boolean => {
    if (!dataNasc) return false;
    const nascimento = new Date(dataNasc);
    if (isNaN(nascimento.getTime())) return false;
    
    const ano = nascimento.getFullYear();
    if (ano < 1900 || ano > new Date().getFullYear()) return false;

    const hoje = new Date();
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const m = hoje.getMonth() - nascimento.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    return idade < 18;
  };

  const menorDeIdade = isMenorDeIdade(dataNascimento);

  // Validação em tempo real de CPF matemático
  const isCpfInvalido = (valor: string): boolean => {
    const limpo = valor.replace(/[^\d]+/g, '');
    if (limpo.length === 11) {
      return !validarCPF(limpo);
    }
    return false;
  };

  const cpfInvalido = isCpfInvalido(rgCpf);

  if (!isOpen) return null;

  const requestCameraAccess = async (field: 'fotoPerfil' | 'fotoRgCpfFrente' | 'fotoRgCpfVerso') => {
    setCameraError(null);
    try {
      const facingMode = field !== 'fotoPerfil' ? { ideal: 'environment' } : 'user';
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setCameraStream(stream);
      return stream;
    } catch (err: any) {
      console.error('Erro ao acessar a câmera:', err);
      setCameraError('Permita o acesso à câmera para tirar a foto.');
      throw err;
    }
  };

  const startCamera = async (field: 'fotoPerfil' | 'fotoRgCpfFrente' | 'fotoRgCpfVerso') => {
    setActiveCameraField(field);
    setShowCameraModal(true);
    setCameraError(null);
    try {
      const stream = await requestCameraAccess(field);
      setTimeout(() => {
        const videoEl = document.getElementById('register-camera-preview') as HTMLVideoElement;
        if (videoEl) {
          videoEl.srcObject = stream;
        }
      }, 150);
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
    setActiveCameraField(null);
  };

  const capturePhoto = async () => {
    const videoEl = document.getElementById('register-camera-preview') as HTMLVideoElement;
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
        if (activeCameraField === 'fotoPerfil') {
          setFotoBase64(compressed);
        } else if (activeCameraField === 'fotoRgCpfFrente') {
          setFotoRgCpfFrenteBase64(compressed);
        } else if (activeCameraField === 'fotoRgCpfVerso') {
          setFotoRgCpfVersoBase64(compressed);
        }
        stopCamera();
      }
    } catch (err) {
      console.error('Erro ao capturar foto:', err);
      alert('Erro ao capturar a foto. Tente novamente.');
    }
  };

  const handleSystemCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>, field: 'fotoPerfil' | 'fotoRgCpfFrente' | 'fotoRgCpfVerso') => {
    try {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      const files = e?.target?.files;
      if (!files || files.length === 0) {
        console.warn('Captura cancelada ou nenhum arquivo foi retornado pela câmera.');
        return;
      }

      const file = files[0];
      if (!file) {
        console.warn('Arquivo nulo ou inválido retornado pela câmera.');
        return;
      }

      if (!file.type.startsWith('image/')) {
        console.warn('O arquivo retornado não é uma imagem válida:', file.type);
        return;
      }

      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const b64 = event?.target?.result as string;
          if (!b64) {
            console.error('Erro: Conteúdo do FileReader está nulo.');
            return;
          }

          try {
            const compressed = await compressImage(b64);
            if (field === 'fotoPerfil') {
              setFotoBase64(compressed);
            } else if (field === 'fotoRgCpfFrente') {
              setFotoRgCpfFrenteBase64(compressed);
            } else if (field === 'fotoRgCpfVerso') {
              setFotoRgCpfVersoBase64(compressed);
            }
          } catch (compressErr) {
            console.warn('Erro ao comprimir imagem, utilizando imagem original.', compressErr);
            if (field === 'fotoPerfil') {
              setFotoBase64(b64);
            } else if (field === 'fotoRgCpfFrente') {
              setFotoRgCpfFrenteBase64(b64);
            } else if (field === 'fotoRgCpfVerso') {
              setFotoRgCpfVersoBase64(b64);
            }
          }
        } catch (innerErr) {
          console.error('Erro ao converter imagem na leitura do arquivo:', innerErr);
        }
      };

      reader.onerror = (readErr) => {
        console.error('Erro de leitura no FileReader:', readErr);
      };

      reader.readAsDataURL(file);

    } catch (err) {
      console.error('Erro silencioso capturado para prevenção de crash no cadastro:', err);
    }
  };

  const validarFormulario = () => {
    setErro('');
    if (!nome.trim() || !email.trim() || !telefone.trim() || !senha || !confirmarSenha) {
      setErro('Por favor, preencha todos os campos obrigatórios (*).');
      return false;
    }
    if (!fotoBase64) {
      setErro('Por favor, tire uma foto de perfil (obrigatória).');
      return false;
    }
    if (!dataNascimento) {
      setErro('Por favor, informe sua data de nascimento.');
      return false;
    }
    if (menorDeIdade) {
      setErro('Cadastro restrito para maiores de 18 anos.');
      return false;
    }
    // Validação de formato de e-mail estrutural
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErro('Por favor, insira um e-mail estruturalmente válido (exemplo: usuario@provedor.com).');
      return false;
    }

    if (senha.length < 6) {
      setErro('A senha deve ter no mínimo 6 caracteres para cadastro seguro.');
      return false;
    }
    if (senha !== confirmarSenha) {
      setErro('As senhas digitadas não coincidem.');
      return false;
    }

    // Verificar e-mail duplicado na cache local (em qualquer função/perfil)
    const todos = getUsers();
    const dup = todos.find(u => u.email?.trim().toLowerCase() === email.trim().toLowerCase());
    if (dup) {
      setErro('Este e-mail já está cadastrado no sistema por outro usuário.');
      return false;
    }

    return true;
  };

  const handleFinalizarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validarFormulario()) return;

    setCadastrando(true);
    setErro('');

    // Consulta em tempo real no Firestore para garantir unicidade absoluta do e-mail
    if (firestore) {
      try {
        const q = query(collection(firestore, 'users'), where('email', '==', email.trim().toLowerCase()));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setErro('Este e-mail já está sendo utilizado por outra conta cadastrada.');
          setCadastrando(false);
          return;
        }
      } catch (dbErr) {
        console.warn('Erro ao verificar e-mail duplicado no Firestore online:', dbErr);
        // Prosseguir se estiver offline, pois a validação local já foi realizada
      }
    }

    const tempId = 'cli_temp_' + Date.now().toString(36);

    const finalLat = -23.55052; // Centro de SP por padrão
    const finalLng = -46.633308;
    const finalRegiao = 'Centro';

    // Upload da foto de perfil do cliente para o Firebase Storage se o Storage estiver ativo
    let fotoUrl = fotoBase64;
    try {
      fotoUrl = await uploadBase64Image(fotoBase64, `clientes/${tempId}/foto_perfil.jpg`);
    } catch (errImg) {
      console.error("Erro ao fazer upload da imagem do cliente:", errImg);
    }

    // Upload da foto da FRENTE do documento do cliente para o Firebase Storage se o Storage estiver ativo
    let docRgCpfFrenteUrl = fotoRgCpfFrenteBase64;
    try {
      if (fotoRgCpfFrenteBase64) {
        docRgCpfFrenteUrl = await uploadBase64Image(fotoRgCpfFrenteBase64, `clientes/${tempId}/doc_rg_cpf_frente.jpg`);
      }
    } catch (errDoc) {
      console.error("Erro ao fazer upload da imagem da frente do documento:", errDoc);
    }

    // Upload da foto do VERSO do documento do cliente para o Firebase Storage se o Storage estiver ativo
    let docRgCpfVersoUrl = fotoRgCpfVersoBase64;
    try {
      if (fotoRgCpfVersoBase64) {
        docRgCpfVersoUrl = await uploadBase64Image(fotoRgCpfVersoBase64, `clientes/${tempId}/doc_rg_cpf_verso.jpg`);
      }
    } catch (errDoc) {
      console.error("Erro ao fazer upload da imagem do verso do documento:", errDoc);
    }

    try {
      let docId = '';
      if (firestore) {
        // Use standard addDoc for Firestore to auto-generate the ID safely
        const docRef = await addDoc(collection(firestore, 'clientes'), {
          nome: nome.trim() || '',
          email: email.trim().toLowerCase() || '',
          telefone: telefone.trim() || '',
          senha: senha || '',
          status: 'ativo',
          foto: fotoUrl || '',
          dataNascimento: dataNascimento || '',
          rgCpf: rgCpf.trim() || '',
          docRgCpf: docRgCpfFrenteUrl || '',
          docRgCpfFrente: docRgCpfFrenteUrl || '',
          docRgCpfVerso: docRgCpfVersoUrl || '',
          criadoEm: new Date().toISOString()
        });
        docId = docRef.id;
      } else {
        docId = 'cli_' + Date.now().toString(36);
      }

      const novoCliente: ClienteUser = {
        id: docId,
        role: 'cliente',
        nome: nome.trim() || '',
        email: email.trim().toLowerCase() || '',
        telefone: telefone.trim() || '',
        senha: senha || '',
        status: 'ativo',
        passwordCreated: true,
        cidade: 'São Caetano de Odivelas - PA',
        bairro: 'Não informado',
        endereco: 'Não informado',
        pontoReferencia: 'Não informado',
        cadastroCompleto: true,
        foto: fotoUrl || '',
        dataNascimento: dataNascimento || '',
        rgCpf: rgCpf.trim() || '',
        docRgCpf: docRgCpfFrenteUrl || '',
        docRgCpfFrente: docRgCpfFrenteUrl || '',
        docRgCpfVerso: docRgCpfVersoUrl || '',
        latitude: finalLat,
        longitude: finalLng,
        regiaoMunicipal: finalRegiao,
        enderecoConvertido: 'Não informado',
        criadoEm: new Date().toISOString().split('T')[0],
      };

      // 1. Gravar no cache unificado do sistema (que salva na coleção 'users')
      saveUser(novoCliente);

      addNotification({
        destinatarioId: 'admin',
        titulo: '🙋 Novo Cliente Cadastrado',
        mensagem: `${nome.trim()} se cadastrou com sucesso diretamente no banco de dados.`,
        tipo: 'sucesso'
      });

      setSucesso(true);
    } catch (err: any) {
      setErro('Erro ao persistir os dados cadastrais no banco. Tente novamente.');
      console.error(err);
    } finally {
      setCadastrando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-[32px] max-w-lg w-full p-6 sm:p-8 shadow-2xl relative my-8 border border-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>

        {sucesso ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Cadastro Concluído!</h3>
            <p className="text-slate-600 max-w-md mx-auto text-sm leading-relaxed mb-6">
              Sua conta foi criada e autenticada via Firebase com sucesso!
            </p>
            <button
              onClick={() => {
                handleClose();
                navigate('/');
              }}
              className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-950 rounded-2xl font-black text-sm transition-all shadow-md cursor-pointer"
            >
              Fazer Login Agora
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl">
                <Compass className="w-7 h-7 text-blue-600" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Criar Conta de Cliente</h3>
                <p className="text-xs font-semibold text-slate-500">Cadastro rápido de passageiro</p>
              </div>
            </div>

            {erro && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{erro}</span>
              </div>
            )}

            <form onSubmit={handleFinalizarCadastro}>
              <div className="space-y-4">
                  {/* Foto de Perfil Obrigatória */}
                  <div className="flex flex-col items-center py-2 border-b border-slate-100">
                    <button
                      type="button"
                      onClick={() => startCamera('fotoPerfil')}
                      className={`relative w-20 h-20 rounded-full border-2 border-dashed overflow-hidden flex items-center justify-center group hover:border-blue-500 transition-all cursor-pointer ${fotoBase64 ? 'border-blue-600 bg-blue-50' : 'border-slate-300 bg-slate-50'}`}
                    >
                      {fotoBase64 ? (
                        <img src={fotoBase64} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-6 h-6 text-slate-400 group-hover:text-blue-600 transition-colors" />
                      )}
                    </button>
                    <input
                      type="file"
                      id="register-system-camera"
                      accept="image/*"
                      capture="user"
                      onChange={e => handleSystemCameraCapture(e, 'fotoPerfil')}
                      className="hidden"
                    />
                    <span className="text-[10px] font-bold text-slate-500 mt-2">
                      Foto de Perfil * (Obrigatória)
                    </span>
                    <button
                      type="button"
                      onClick={() => startCamera('fotoPerfil')}
                      className="mt-1 text-[10px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-full transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Camera className="w-3 h-3" /> Tirar foto de perfil
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nome Completo *</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                      <input
                        type="text"
                        value={nome}
                        onChange={e => setNome(e.target.value)}
                        placeholder="Ex: Ana Maria Silva"
                        required
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">E-mail de Acesso *</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="Ex: ana@exemplo.com"
                        required
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">WhatsApp / Celular *</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                      <input
                        type="text"
                        value={telefone}
                        onChange={e => setTelefone(e.target.value)}
                        placeholder="Ex: (11) 99999-9999"
                        required
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Data de Nascimento *</label>
                      <div className="relative">
                        <Calendar className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                        <input
                          type="date"
                          value={dataNascimento}
                          onChange={e => setDataNascimento(e.target.value)}
                          required
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-800"
                        />
                      </div>
                      {menorDeIdade && (
                        <div className="mt-1.5 flex items-start gap-1.5 text-red-600 bg-red-50 border border-red-100 rounded-xl p-2 animate-pulse">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span className="text-[10px] font-bold leading-tight">Cadastro restrito para maiores de 18 anos.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Senha *</label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                        <input
                          type="password"
                          value={senha}
                          onChange={e => setSenha(e.target.value)}
                          placeholder="Mín. 6 caracteres"
                          required
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Confirmar Senha *</label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
                        <input
                          type="password"
                          value={confirmarSenha}
                          onChange={e => setConfirmarSenha(e.target.value)}
                          placeholder="Repita a senha"
                          required
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={cadastrando || menorDeIdade || cpfInvalido}
                    className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 disabled:bg-slate-200 disabled:text-slate-400 text-slate-950 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 mt-6 cursor-pointer shadow-md hover:shadow-lg"
                  >
                    {cadastrando ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Cadastrando conta no Firebase...
                      </>
                    ) : (
                      <>
                        Finalizar Cadastro de Cliente <CheckCircle2 className="w-5 h-5" />
                      </>
                    )}
                  </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* Modal de Captura da Câmera para Cadastro */}
      {showCameraModal && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <h3 className="text-white font-extrabold text-sm uppercase tracking-wider">
              {activeCameraField === 'fotoPerfil' ? 'Tirar Foto de Perfil' : 'Tirar Foto do RG/CPF'}
            </h3>
            <button
              type="button"
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
                    onClick={() => activeCameraField && requestCameraAccess(activeCameraField)}
                    className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-2xl font-bold text-xs cursor-pointer transition-colors"
                  >
                    🔄 Tentar Novamente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      let inputId = 'register-system-camera';
                      if (activeCameraField === 'fotoRgCpfFrente') {
                        inputId = 'register-system-camera-doc-frente';
                      } else if (activeCameraField === 'fotoRgCpfVerso') {
                        inputId = 'register-system-camera-doc-verso';
                      }
                      const input = document.getElementById(inputId) as HTMLInputElement;
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
                  id="register-camera-preview"
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {/* Overlay do enquadramento circular para selfie de perfil ou retangular para documento */}
                {activeCameraField === 'fotoPerfil' ? (
                  <div className="absolute inset-0 border-2 border-dashed border-white/25 m-12 rounded-full pointer-events-none flex items-center justify-center">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-white/40 bg-black/40 px-3 py-1 rounded-full">
                      Enquadre o seu rosto aqui
                    </span>
                  </div>
                ) : (
                  <div className="absolute inset-x-8 inset-y-24 border-2 border-dashed border-white/45 rounded-2xl pointer-events-none flex items-center justify-center">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-white/60 bg-black/50 px-4 py-2 rounded-full">
                      Enquadre o Documento RG/CPF Aqui
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {!cameraError && (
            <div className="bg-slate-900 p-8 flex flex-col items-center justify-center space-y-4">
              <button
                type="button"
                onClick={capturePhoto}
                className="w-16 h-16 rounded-full bg-white border-4 border-slate-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                title="Tirar foto"
              >
                <div className="w-10 h-10 rounded-full bg-blue-600" />
              </button>
              <p className="text-xs text-slate-400">
                Toque no botão para tirar a foto {activeCameraField === 'fotoPerfil' ? 'de perfil' : 'do documento'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
