import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AnyUser, MototaxistaUser, ClienteUser, Ride, SystemConfig, SystemLog, TurnoTipo, Tarifa, RelatorioDiario } from '../../types';
import { getUsers, saveUser, deleteUser, getRides, saveRide, getConfig, saveConfig, getLogs, subscribeRealtime, fileToBase64, addNotification, identifyingTurnoAtual, getRelatoriosDiarios, saveRelatorioDiario, getTodayDateStr, formatToPtBrDate } from '../../lib/db';
import { Users, Bike, Shield, DollarSign, Activity, Plus, Edit2, Trash2, Lock, Unlock, MapPin, Search, FileText, Settings, Eye, CheckCircle2, XCircle, ChevronRight, X, Camera, Sparkles, Check, Clock, Printer } from 'lucide-react';

export function AdminDashboard() {
  const [users, setUsers] = useState<AnyUser[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [config, setConfigState] = useState<SystemConfig>(getConfig());
  const [logs, setLogs] = useState<SystemLog[]>([]);
  
  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'mototaxistas' | 'clientes' | 'corridas' | 'tarifas'>('dashboard');

  // Estados do módulo de Tarifação Municipal
  const [modalTarifaAberto, setModalTarifaAberto] = useState(false);
  const [tarifaEditando, setTarifaEditando] = useState<Tarifa | null>(null);
  const [tTurno, setTTurno] = useState<TurnoTipo>('Manhã');
  const [tHoraInicio, setTHoraInicio] = useState('06:00');
  const [tHoraFim, setTHoraFim] = useState('11:59');
  const [tValor, setTValor] = useState(10);
  const [tAtivo, setTAtivo] = useState(true);

  // Estados de Filtro e Pesquisa
  const [busca, setBusca] = useState('');

  // Estados de Filtro e Pesquisa de Corridas e Relatórios Diários
  const [periodoFiltro, setPeriodoFiltro] = useState<'hoje' | 'ontem' | '7dias' | 'personalizado'>('hoje');
  const [dataInicioPersonalizada, setDataInicioPersonalizada] = useState(getTodayDateStr());
  const [dataFimPersonalizada, setDataFimPersonalizada] = useState(getTodayDateStr());
  const [pesquisaCorrida, setPesquisaCorrida] = useState('');
  const [statusFiltroCorrida, setStatusFiltroCorrida] = useState<string>('todos');
  const [relatoriosDiarios, setRelatoriosDiariosState] = useState<RelatorioDiario[]>([]);

  // Estados do Modal de Cadastro / Edição de Mototaxista
  const [modalMotoAberto, setModalMotoAberto] = useState(false);
  const [motoEditando, setMotoEditando] = useState<MototaxistaUser | null>(null);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [placa, setPlaca] = useState('');
  const [modeloMoto, setModeloMoto] = useState('');
  const [corMoto, setCorMoto] = useState('');
  const [cidade, setCidade] = useState('São Paulo');
  const [bairro, setBairro] = useState('');
  const [statusMoto, setStatusMoto] = useState<'ativo' | 'inativo' | 'bloqueado'>('ativo');
  const [disponibilidadeMoto, setDisponibilidadeMoto] = useState<'disponivel' | 'ocupado' | 'indisponivel'>('disponivel');
  
  const [fotoMotoristaB64, setFotoMotoristaB64] = useState('');
  const [fotoMotoB64, setFotoMotoB64] = useState('');

  // Modal de Histórico/Detalhes do Mototaxista selecionado
  const [motoDetalhes, setMotoDetalhes] = useState<MototaxistaUser | null>(null);

  // Modal de Histórico/Detalhes do Cliente selecionado
  const [clienteDetalhes, setClienteDetalhes] = useState<ClienteUser | null>(null);

  // Modal Customizado para Confirmação de Exclusão (contornando bloqueio do window.confirm no iframe)
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    userId: string;
    userName: string;
    userRole: 'mototaxista' | 'cliente';
  }>({
    isOpen: false,
    userId: '',
    userName: '',
    userRole: 'mototaxista'
  });

  useEffect(() => {
    carregarTudo();

    const unsubscribe = subscribeRealtime((event) => {
      carregarTudo();
    });

    return () => unsubscribe();
  }, []);

  const carregarTudo = () => {
    setUsers(getUsers());
    setRides(getRides());
    setConfigState(getConfig());
    setLogs(getLogs());
    setRelatoriosDiariosState(getRelatoriosDiarios());
  };

  const baixarClientePDF = (c: ClienteUser) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 1. Banner Superior (Slate-900 / Yellow-500)
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 38, 'F');

    doc.setFillColor(234, 179, 8); // yellow-500
    doc.rect(0, 38, 210, 2, 'F');

    // Título Principal do Cabeçalho
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('MOTO-TÁXI', 15, 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(253, 224, 71); // text-yellow-300
    doc.text('FICHA CADASTRAL DO PASSAGEIRO - RELATÓRIO OFICIAL', 15, 26);

    // Data de Geração e Status
    doc.setFontSize(8);
    doc.setTextColor(226, 232, 240); // text-slate-200
    const dataHoraStr = `Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`;
    doc.text(dataHoraStr, 210 - 15, 18, { align: 'right' });

    const statusStr = `STATUS DO CADASTRO: ${(c.status || 'ATIVO').toUpperCase()}`;
    doc.text(statusStr, 210 - 15, 25, { align: 'right' });

    // 2. Seção 1: Dados Pessoais
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('1. DADOS PESSOAIS E CONTATO', 15, 50);

    // Tabela estilizada de Dados Pessoais
    autoTable(doc, {
      startY: 53,
      theme: 'striped',
      head: [['Campo', 'Informação']],
      body: [
        ['Nome Completo:', c.nome],
        ['RG / CPF:', c.rgCpf || '-'],
        ['E-mail (Login):', c.email || '-'],
        ['WhatsApp / Telefone:', c.telefone || '-'],
        ['Data de Nascimento:', formatToPtBrDate(c.dataNascimento || '') || '-'],
      ],
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [51, 65, 85]
      },
      columnStyles: {
        0: { cellWidth: 45, fontStyle: 'bold' },
        1: { cellWidth: 135 }
      },
      margin: { left: 15, right: 15 }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 10;

    // 3. Seção 2: Endereço e Localização
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('2. ENDEREÇO E LOCALIZAÇÃO', 15, currentY);

    autoTable(doc, {
      startY: currentY + 3,
      theme: 'striped',
      head: [['Campo', 'Especificação']],
      body: [
        ['Endereço Principal:', c.endereco || '-'],
        ['Bairro / Região:', c.bairro || '-'],
        ['Ponto de Referência:', c.pontoReferencia || '-'],
        ['Região Municipal:', c.regiaoMunicipal || '-'],
        ['Cidade Base:', c.cidade || '-']
      ],
      headStyles: {
        fillColor: [234, 179, 8],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [51, 65, 85]
      },
      columnStyles: {
        0: { cellWidth: 45, fontStyle: 'bold' },
        1: { cellWidth: 135 }
      },
      margin: { left: 15, right: 15 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;

    // 4. Foto de Perfil na primeira página
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('FOTO DE PERFIL DO PASSAGEIRO', 15, currentY);

    let profileImgAdded = false;
    if (c.foto && c.foto !== 'Anexado (Firestore)' && c.foto.startsWith('data:image')) {
      try {
        doc.addImage(c.foto, 'JPEG', 15, currentY + 4, 38, 38);
        profileImgAdded = true;
      } catch (err) {
        console.error("Erro ao inserir foto de perfil no PDF:", err);
      }
    }

    if (!profileImgAdded) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, currentY + 4, 38, 38, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(15, currentY + 4, 38, 38, 'S');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('Foto de\nPerfil\nPendente', 34, currentY + 18, { align: 'center' });
    }


    // 5. Página 2: Fotos e Documentos Enviados
    const anexos = [
      { id: 'docRgCpf', titulo: '1. Documento de Identidade (RG/CPF)', val: c.docRgCpf },
      { id: 'docRgCpfFrente', titulo: '2. RG/CPF (Frente)', val: c.docRgCpfFrente },
      { id: 'docRgCpfVerso', titulo: '3. RG/CPF (Verso)', val: c.docRgCpfVerso }
    ].filter(item => item.val && item.val !== 'Anexado (Firestore)');

    if (anexos.length > 0) {
      doc.addPage();

      // Cabeçalho Página 2
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 20, 'F');
      
      doc.setFillColor(234, 179, 8); // yellow-500
      doc.rect(0, 20, 210, 1.5, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`COMPROVANTES E ANEXOS INTEGRADOS - ${c.nome.toUpperCase()}`, 15, 13);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text('3. COMPROVANTES E DOCUMENTOS DIGITALIZADOS', 15, 32);

      let startX = 15;
      let startY = 38;
      const boxW = 85;
      const boxH = 65;
      const spaceX = 10;
      const spaceY = 10;

      anexos.forEach((anexo, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        let posX = startX + col * (boxW + spaceX);
        let posY = startY + row * (boxH + spaceY);

        // Se passar da área segura vertical, cria uma nova página de anexos!
        if (posY + boxH > 285) {
          doc.addPage();
          // Header resumido
          doc.setFillColor(15, 23, 42);
          doc.rect(0, 0, 210, 15, 'F');
          doc.setFillColor(234, 179, 8);
          doc.rect(0, 15, 210, 1.5, 'F');
          
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text(`ANEXOS E COMPROVANTES (CONT.) - ${c.nome.toUpperCase()}`, 15, 10);

          // Reiniciar posições para o novo referencial
          startY = 25;
          const newIndex = index - 4; // Ajuste de índice relativo para a nova página
          const newCol = newIndex % 2;
          const newRow = Math.floor(newIndex / 2);

          posX = startX + newCol * (boxW + spaceX);
          posY = startY + newRow * (boxH + spaceY);
        }

        // Moldura externa elegante do anexo
        doc.setFillColor(248, 250, 252);
        doc.rect(posX, posY, boxW, boxH, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(posX, posY, boxW, boxH, 'S');

        // Título do anexo
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text(anexo.titulo.toUpperCase(), posX + 4, posY + 6);

        let imgAdded = false;
        if (anexo.val && anexo.val.startsWith('data:image')) {
          try {
            doc.addImage(anexo.val, 'JPEG', posX + 4, posY + 9, boxW - 8, boxH - 12);
            imgAdded = true;
          } catch (e) {
            console.error(`Erro ao renderizar anexo ${anexo.titulo}:`, e);
          }
        }

        if (!imgAdded) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text('[Formato ou tamanho do arquivo\nnão suportado para visualização]', posX + boxW/2, posY + boxH/2 + 3, { align: 'center' });
        }
      });
    }

    // Salvar o arquivo PDF
    const safeName = c.nome.toLowerCase().replace(/[^a-z0-9]/g, '_');
    doc.save(`ficha_passageiro_${safeName}.pdf`);
  };

  const baixarFichaPDF = (moto: MototaxistaUser) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 1. Banner Superior (Slate-900 / Emerald-500)
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 38, 'F');

    doc.setFillColor(16, 185, 129); // emerald-500
    doc.rect(0, 38, 210, 2, 'F');

    // Título Principal do Cabeçalho
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('MOTO-TÁXI', 15, 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 231, 183); // text-emerald-300
    doc.text('FICHA CADASTRAL DO PROFISSIONAL - RELATÓRIO OFICIAL', 15, 26);

    // Data de Geração e Status
    doc.setFontSize(8);
    doc.setTextColor(226, 232, 240); // text-slate-200
    const dataHoraStr = `Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`;
    doc.text(dataHoraStr, 210 - 15, 18, { align: 'right' });

    const statusStr = `STATUS DO CADASTRO: ${(moto.status_aprovacao || 'APROVADO').toUpperCase()}`;
    doc.text(statusStr, 210 - 15, 25, { align: 'right' });

    // 2. Seção 1: Dados Pessoais
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('1. DADOS PESSOAIS E CONTATO', 15, 50);

    // Tabela estilizada de Dados Pessoais
    autoTable(doc, {
      startY: 53,
      theme: 'striped',
      head: [['Campo', 'Informação']],
      body: [
        ['Nome Completo:', moto.nome],
        ['CPF ou RG:', moto.cpf || '-'],
        ['WhatsApp / Telefone:', moto.whatsapp || moto.telefone || '-'],
        ['Data de Nascimento:', formatToPtBrDate(moto.nascimento || '') || '-'],
        ['Cidade Base:', moto.cidade || '-'],
        ['Bairro / Região:', moto.bairro || '-'],
        ['Endereço Completo:', moto.endereco || '-']
      ],
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [51, 65, 85]
      },
      columnStyles: {
        0: { cellWidth: 45, fontStyle: 'bold' },
        1: { cellWidth: 135 }
      },
      margin: { left: 15, right: 15 }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 10;

    // 3. Seção 2: Dados do Veículo & CNH
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('2. INFORMAÇÕES DO VEÍCULO E HABILITAÇÃO (CNH)', 15, currentY);

    // Tabela estilizada do Veículo e CNH
    autoTable(doc, {
      startY: currentY + 3,
      theme: 'striped',
      head: [['Item', 'Especificação']],
      body: [
        ['Modelo da Moto:', moto.modeloMoto || '-'],
        ['Cor da Moto:', moto.corMoto || '-'],
        ['Placa da Moto:', (moto.placa || '-').toUpperCase()],
        ['Possui CNH:', moto.possui_cnh === false ? 'NÃO' : 'SIM'],
        ['Número da CNH:', moto.numeroCnh || moto.numero_cnh || '-'],
        ['Categoria CNH:', moto.categoriaCnh || moto.categoria_cnh || '-'],
        ['Validade CNH:', moto.validadeCnh || moto.validade_cnh || '-']
      ],
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [51, 65, 85]
      },
      columnStyles: {
        0: { cellWidth: 45, fontStyle: 'bold' },
        1: { cellWidth: 135 }
      },
      margin: { left: 15, right: 15 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;

    // 4. Foto de Perfil (Selfie) na primeira página
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('FOTO DE PERFIL DO CONDUTOR', 15, currentY);

    let profileImgAdded = false;
    if (moto.foto && moto.foto !== 'Anexado (Firestore)' && moto.foto.startsWith('data:image')) {
      try {
        doc.addImage(moto.foto, 'JPEG', 15, currentY + 4, 38, 38);
        profileImgAdded = true;
      } catch (err) {
        console.error("Erro ao inserir foto de perfil no PDF:", err);
      }
    }

    if (!profileImgAdded) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, currentY + 4, 38, 38, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(15, currentY + 4, 38, 38, 'S');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('Foto de\nPerfil\nPendente', 34, currentY + 18, { align: 'center' });
    }

    // Assinaturas e Declaração de Responsabilidade ao lado da foto de perfil
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('DECLARAÇÃO E COMPROMISSO', 65, currentY + 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const declaracaoText = [
      'Declaro sob as penas da lei que todas as informações prestadas são fidedignas',
      'e condizentes com os documentos originais apresentados. Autorizo o uso',
      'desses dados para fins exclusivos de validação profissional no sistema.'
    ];
    doc.text(declaracaoText, 65, currentY + 8);

    // Linhas para assinaturas
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.line(65, currentY + 31, 125, currentY + 31);
    doc.text('Assinatura do Profissional', 65, currentY + 35);

    doc.line(135, currentY + 31, 195, currentY + 31);
    doc.text('Visto da Administração', 135, currentY + 35);

    // 5. Página 2: Fotos e Documentos Enviados
    const anexos = [
      { id: 'fotoMoto', titulo: '1. Foto da Moto (Veículo)', val: moto.fotoMoto },
      { id: 'docCnh', titulo: '2. Carteira de Habilitação (CNH)', val: moto.docCnh || moto.foto_cnh },
      { id: 'docRgCpf', titulo: '3. Documento de Identidade (RG/CPF)', val: moto.docRgCpf },
      { id: 'docMotoAnexo', titulo: '4. Documento do Veículo (CRLV)', val: moto.docMoto },
      { id: 'docResidencia', titulo: '5. Comprovante de Residência', val: moto.docResidencia }
    ].filter(item => item.val && item.val !== 'Anexado (Firestore)');

    if (anexos.length > 0) {
      doc.addPage();

      // Cabeçalho Página 2
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 20, 'F');
      
      doc.setFillColor(16, 185, 129); // emerald-500
      doc.rect(0, 20, 210, 1.5, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`COMPROVANTES E ANEXOS INTEGRADOS - ${moto.nome.toUpperCase()}`, 15, 13);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text('3. COMPROVANTES E DOCUMENTOS DIGITALIZADOS', 15, 32);

      let startX = 15;
      let startY = 38;
      const boxW = 85;
      const boxH = 65;
      const spaceX = 10;
      const spaceY = 10;

      anexos.forEach((anexo, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        let posX = startX + col * (boxW + spaceX);
        let posY = startY + row * (boxH + spaceY);

        // Se passar da área segura vertical, cria uma nova página de anexos!
        if (posY + boxH > 285) {
          doc.addPage();
          // Header resumido
          doc.setFillColor(15, 23, 42);
          doc.rect(0, 0, 210, 15, 'F');
          doc.setFillColor(16, 185, 129);
          doc.rect(0, 15, 210, 1.5, 'F');
          
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text(`ANEXOS E COMPROVANTES (CONT.) - ${moto.nome.toUpperCase()}`, 15, 10);

          // Reiniciar posições para o novo referencial
          startY = 25;
          const newIndex = index - 4; // Ajuste de índice relativo para a nova página
          const newCol = newIndex % 2;
          const newRow = Math.floor(newIndex / 2);
          posX = startX + newCol * (boxW + spaceX);
          posY = startY + newRow * (boxH + spaceY);
        }

        // Moldura externa elegante do anexo
        doc.setFillColor(248, 250, 252);
        doc.rect(posX, posY, boxW, boxH, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(posX, posY, boxW, boxH, 'S');

        // Título do anexo
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text(anexo.titulo.toUpperCase(), posX + 4, posY + 6);

        let imgAdded = false;
        if (anexo.val && anexo.val.startsWith('data:image')) {
          try {
            doc.addImage(anexo.val, 'JPEG', posX + 4, posY + 9, boxW - 8, boxH - 12);
            imgAdded = true;
          } catch (e) {
            console.error(`Erro ao renderizar anexo ${anexo.titulo}:`, e);
          }
        }

        if (!imgAdded) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text('[Formato ou tamanho do arquivo\nnão suportado para visualização]', posX + boxW/2, posY + boxH/2 + 3, { align: 'center' });
        }
      });
    }

    // Salvar o arquivo PDF
    const safeName = moto.nome.toLowerCase().replace(/[^a-z0-9]/g, '_');
    doc.save(`ficha_mototaxista_${safeName}.pdf`);
  };

  const mototaxistas = (users || []).filter(u => u && u.role === 'mototaxista') as MototaxistaUser[];
  const clientes = (users || []).filter(u => u && u.role === 'cliente') as ClienteUser[];

  // Stats Dashboard
  const hojeStr = getTodayDateStr();
  const ridesHojeFiltradas = (rides || []).filter(r => r && r.data === hojeStr && typeof r.hora === 'string' && r.hora >= '00:00' && r.hora <= '23:59');
  const corridasFinalizadasHoje = ridesHojeFiltradas.filter(r => r && (r.status === 'finalizada' || r.status === 'FINALIZADA'));

  const corridasFinalizadas = (rides || []).filter(r => r && (r.status === 'finalizada' || r.status === 'FINALIZADA'));
  const faturamentoTotal = corridasFinalizadas.reduce((acc, r) => acc + (r.valorEstimado || 0), 0);
  const receitaAdmin = faturamentoTotal * ((config.taxaAdminPercentual || 15) / 100);

  const abrirModalNovoMoto = () => {
    setMotoEditando(null);
    setNome('');
    setTelefone('');
    setPlaca('');
    setModeloMoto('');
    setCorMoto('');
    setCidade('São Paulo');
    setBairro('');
    setStatusMoto('ativo');
    setDisponibilidadeMoto('disponivel');
    setFotoMotoristaB64('');
    setFotoMotoB64('');
    setModalMotoAberto(true);
  };

  const abrirModalEditarMoto = (m: MototaxistaUser) => {
    setMotoEditando(m);
    setNome(m.nome);
    setTelefone(m.telefone);
    setPlaca(m.placa);
    setModeloMoto(m.modeloMoto);
    setCorMoto(m.corMoto);
    setCidade(m.cidade);
    setBairro(m.bairro);
    setStatusMoto(m.status);
    setDisponibilidadeMoto(m.disponibilidade);
    setFotoMotoristaB64(m.foto || '');
    setFotoMotoB64(m.fotoMoto || '');
    setModalMotoAberto(true);
  };

  const handleSalvarMotorista = (e: React.FormEvent) => {
    e.preventDefault();

    const placaClean = placa.trim().toUpperCase();
    if (!placaClean) return alert('Número da placa é obrigatório pro login!');

    // Verificar placa duplicada em outro usuário
    const dup = mototaxistas.find(x => x.placa.replace(/[^a-zA-Z0-9]/g, '') === placaClean.replace(/[^a-zA-Z0-9]/g, '') && x.id !== motoEditando?.id);
    if (dup) return alert('Já existe um mototaxista cadastrado com esta placa!');

    const novoOuEditado: MototaxistaUser = motoEditando ? {
      ...motoEditando,
      nome,
      telefone,
      placa: placaClean,
      modeloMoto,
      corMoto,
      cidade,
      bairro,
      status: statusMoto,
      disponibilidade: disponibilidadeMoto,
      foto: fotoMotoristaB64 || motoEditando.foto,
      fotoMoto: fotoMotoB64 || motoEditando.fotoMoto,
    } : {
      id: 'moto_' + Date.now(),
      role: 'mototaxista',
      nome,
      telefone,
      placa: placaClean, // Login inicial
      senha: '', // Senha em branco obriga criar no primeiro acesso
      passwordCreated: false,
      status: statusMoto,
      disponibilidade: disponibilidadeMoto,
      status_aprovacao: 'PENDENTE',
      modeloMoto,
      corMoto,
      cidade,
      bairro,
      totalCorridas: 0,
      ganhosHoje: 0,
      ganhosSemana: 0,
      ganhosMes: 0,
      avaliacao: 5.0,
      foto: fotoMotoristaB64 || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      fotoMoto: fotoMotoB64 || 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=300&auto=format&fit=crop&q=80',
      criadoEm: new Date().toISOString().split('T')[0],
      latitude: -23.5505 + (Math.random() - 0.5) * 0.05,
      longitude: -46.6333 + (Math.random() - 0.5) * 0.05,
    };

    saveUser(novoOuEditado);
    setModalMotoAberto(false);

    if (!motoEditando) {
      addNotification({
        destinatarioId: 'admin',
        titulo: '🏍️ Novo Mototaxista Cadastrado',
        mensagem: `Parceiro ${nome} (${placaClean}) foi provisionado no sistema.`,
        tipo: 'sucesso'
      });
    }
  };

  const handleExcluirMototaxista = (id: string, nomeUser: string) => {
    setConfirmDeleteModal({
      isOpen: true,
      userId: id,
      userName: nomeUser,
      userRole: 'mototaxista'
    });
  };

  const handleExcluirCliente = (id: string, nomeUser: string) => {
    setConfirmDeleteModal({
      isOpen: true,
      userId: id,
      userName: nomeUser,
      userRole: 'cliente'
    });
  };

  const executarExclusao = () => {
    const { userId, userRole } = confirmDeleteModal;
    if (!userId) return;

    deleteUser(userId);
    if (userRole === 'mototaxista' && motoDetalhes?.id === userId) {
      setMotoDetalhes(null);
    }
    carregarTudo();
    setConfirmDeleteModal({ isOpen: false, userId: '', userName: '', userRole: 'mototaxista' });
  };

  const handleAprovarMototaxista = (m: MototaxistaUser) => {
    const upd = { ...m, status_aprovacao: 'APROVADO' as const, status_cadastro: 'Aprovado' as const, status: 'ativo' as const, disponibilidade: 'disponivel' as const };
    saveUser(upd);
    if (motoDetalhes?.id === m.id) setMotoDetalhes(upd);
    addNotification({
      destinatarioId: m.id,
      titulo: '✅ Cadastro Aprovado!',
      mensagem: 'Seu cadastro de mototaxista foi aprovado pela Prefeitura/Administração Municipal. Você já pode fazer login e receber chamadas.',
      tipo: 'sucesso'
    });
    carregarTudo();
  };

  const handleRejeitarMototaxista = (m: MototaxistaUser) => {
    const upd = { ...m, status_aprovacao: 'REJEITADO' as const, status_cadastro: 'CADASTRO PENDENTE DE CORREÇÃO' as const, status: 'inativo' as const, disponibilidade: 'indisponivel' as const };
    saveUser(upd);
    if (motoDetalhes?.id === m.id) setMotoDetalhes(upd);
    addNotification({
      destinatarioId: m.id,
      titulo: '❌ Cadastro Rejeitado',
      mensagem: 'Seu cadastro não foi aprovado pela Administração Municipal.',
      tipo: 'alerta'
    });
    carregarTudo();
  };

  const abrirModalEditarTarifa = (t: Tarifa) => {
    setTarifaEditando(t);
    setTTurno(t.turno);
    setTHoraInicio(t.hora_inicio);
    setTHoraFim(t.hora_fim);
    setTValor(t.valor);
    setTAtivo(t.status);
    setModalTarifaAberto(true);
  };

  const handleSalvarTarifa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tarifaEditando) return;

    const agora = new Date().toISOString();
    const lista = config.tarifas ? [...config.tarifas] : [];
    const idx = lista.findIndex(x => x.id === tarifaEditando.id);
    if (idx >= 0) {
      lista[idx] = {
        ...tarifaEditando,
        hora_inicio: tHoraInicio,
        hora_fim: tHoraFim,
        valor: Number(tValor),
        status: tAtivo,
        updated_at: agora
      };
    }

    const nextCfg = { ...config, tarifas: lista };
    saveConfig(nextCfg);
    setConfigState(nextCfg);
    setModalTarifaAberto(false);
  };

  const toggleTarifaAtiva = (t: Tarifa) => {
    const lista = config.tarifas ? [...config.tarifas] : [];
    const idx = lista.findIndex(x => x.id === t.id);
    if (idx >= 0) {
      lista[idx] = { ...lista[idx], status: !lista[idx].status, updated_at: new Date().toISOString() };
      const nextCfg = { ...config, tarifas: lista };
      saveConfig(nextCfg);
      setConfigState(nextCfg);
    }
  };

  const handleCadastrarTodosTurnos = () => {
    const defaultTarifas: Tarifa[] = [
      { id: 'tar_manha', turno: 'Manhã', hora_inicio: '06:00', hora_fim: '11:59', valor: 10.00, status: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'tar_tarde', turno: 'Tarde', hora_inicio: '12:00', hora_fim: '17:59', valor: 12.00, status: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'tar_noite', turno: 'Noite', hora_inicio: '18:00', hora_fim: '23:59', valor: 15.00, status: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'tar_madrugada', turno: 'Madrugada', hora_inicio: '00:00', hora_fim: '05:59', valor: 20.00, status: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    ];

    const lista = config.tarifas ? [...config.tarifas] : [];
    
    defaultTarifas.forEach(def => {
      const exists = lista.some(x => x.turno.toLowerCase() === def.turno.toLowerCase() && !x.regiaoOrigem && !x.regiaoDestino);
      if (!exists) {
        lista.push(def);
      } else {
        // Se já existe, atualiza as horas e ativa se estiver inativo
        const idx = lista.findIndex(x => x.turno.toLowerCase() === def.turno.toLowerCase() && !x.regiaoOrigem && !x.regiaoDestino);
        if (idx >= 0) {
          lista[idx] = {
            ...lista[idx],
            hora_inicio: def.hora_inicio,
            hora_fim: def.hora_fim,
            status: true,
            updated_at: new Date().toISOString()
          };
        }
      }
    });

    const nextCfg = { ...config, tarifas: lista };
    saveConfig(nextCfg);
    setConfigState(nextCfg);
  };

  const handleExcluirUser = (id: string, nomeUser: string) => {
    if (confirm(`Tem certeza que deseja excluir permanentemente o usuário "${nomeUser}"?`)) {
      deleteUser(id);
      carregarTudo();
    }
  };

  const toggleBloqueioUser = (u: AnyUser) => {
    const next = u.status === 'bloqueado' ? 'ativo' : 'bloqueado';
    saveUser({ ...u, status: next });
    carregarTudo();
  };

  // Funções Auxiliares de Filtro, Grupo, Financeiro e CSV para Corridas e Auditoria
  const getFilteredRides = () => {
    try {
      if (!rides || rides.length === 0) {
        return [];
      }

      const today = getTodayDateStr();
      // Filtrar apenas corridas válidas para evitar qualquer erro de undefined/null
      let filtered = rides.filter(r => r && r.id && typeof r.id === 'string');

      // 1. Filtrar por período
      if (periodoFiltro === 'hoje') {
        filtered = filtered.filter(r => {
          const dt = r.data_operacional || r.data;
          return dt && dt === today;
        });
      } else if (periodoFiltro === 'ontem') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const ontemStr = `${yyyy}-${mm}-${dd}`;
        filtered = filtered.filter(r => {
          const dt = r.data_operacional || r.data;
          return dt && dt === ontemStr;
        });
      } else if (periodoFiltro === '7dias') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        const limite = d.toISOString().split('T')[0];
        filtered = filtered.filter(r => {
          const dt = r.data_operacional || r.data;
          return dt && dt >= limite;
        });
      } else if (periodoFiltro === 'personalizado') {
        if (dataInicioPersonalizada) {
          filtered = filtered.filter(r => {
            const dt = r.data_operacional || r.data;
            return dt && dt >= dataInicioPersonalizada;
          });
        }
        if (dataFimPersonalizada) {
          filtered = filtered.filter(r => {
            const dt = r.data_operacional || r.data;
            return dt && dt <= dataFimPersonalizada;
          });
        }
      }

      // 2. Filtrar por status
      if (statusFiltroCorrida !== 'todos') {
        filtered = filtered.filter(r => r && r.status && r.status === statusFiltroCorrida);
      }

      // 3. Pesquisa textual (Nome do passageiro, telefone, moto-taxista, placa, data, status)
      if (pesquisaCorrida.trim() !== '') {
        const term = pesquisaCorrida.toLowerCase();
        filtered = filtered.filter(r => {
          if (!r) return false;
          const idMatch = (r.id || '').toLowerCase().includes(term);
          const nameMatch = (r.clienteNome || '').toLowerCase().includes(term);
          const phoneMatch = (r.clienteTelefone || '').toLowerCase().includes(term);
          const motoMatch = (r.mototaxistaNome || '').toLowerCase().includes(term);
          const placaMatch = (r.mototaxistaPlaca || '').toLowerCase().includes(term);
          const dateMatch = (r.data || '').toLowerCase().includes(term);
          const statusMatch = (r.status || '').toLowerCase().includes(term);
          const originMatch = (r.origem || '').toLowerCase().includes(term);
          const destMatch = (r.destino || '').toLowerCase().includes(term);
          return idMatch || nameMatch || phoneMatch || motoMatch || placaMatch || dateMatch || statusMatch || originMatch || destMatch;
        });
      }

      // Ordenar decrescente com segurança
      return filtered.sort((a, b) => {
        const dateA = a.data_operacional || a.data || '';
        const dateB = b.data_operacional || b.data || '';
        const dateComp = dateB.localeCompare(dateA);
        if (dateComp !== 0) return dateComp;
        
        const horaA = a.hora_corrida || a.hora || '';
        const horaB = b.hora_corrida || b.hora || '';
        return horaB.localeCompare(horaA);
      });
    } catch (error) {
      console.error("Erro ao filtrar corridas:", error);
      return [];
    }
  };

  const getDriverStats = (driverId: string) => {
    const driverRides = (rides || []).filter(r => r && r.mototaxistaId === driverId && (r.status === 'finalizada' || r.status === 'FINALIZADA'));
    const totalCorridas = driverRides.length;
    const ganhos = driverRides.reduce((sum, r) => sum + (r.valorEstimado || 0), 0);
    return { totalCorridas, ganhos };
  };

  const getFaturamentoPorMotorista = (corridasFiltradas: Ride[]) => {
    try {
      if (!corridasFiltradas || corridasFiltradas.length === 0) {
        return [];
      }
      const motoristasStats: { [id: string]: { nome: string; placa: string; totalCorridas: number; totalCanceladas: number; valorGerado: number; taxaPlataforma: number } } = {};

      corridasFiltradas.forEach(r => {
        if (!r || !r.mototaxistaId) return;
        const mId = r.mototaxistaId;
        if (!motoristasStats[mId]) {
          motoristasStats[mId] = {
            nome: r.mototaxistaNome || 'Mototaxista Sem Nome',
            placa: r.mototaxistaPlaca || 'Sem Placa',
            totalCorridas: 0,
            totalCanceladas: 0,
            valorGerado: 0,
            taxaPlataforma: 0
          };
        }

        const val = typeof r.valorEstimado === 'number' ? r.valorEstimado : 0;

        if (r.status === 'finalizada' || r.status === 'FINALIZADA') {
          motoristasStats[mId].totalCorridas += 1;
          motoristasStats[mId].valorGerado += val;
          motoristasStats[mId].taxaPlataforma += val * ((config.taxaAdminPercentual || 15) / 100);
        } else if (r.status === 'cancelada' || r.status === 'CANCELADA') {
          motoristasStats[mId].totalCanceladas += 1;
        }
      });

      return Object.values(motoristasStats);
    } catch (error) {
      console.error("Erro no faturamento por motorista:", error);
      return [];
    }
  };

  const agruparCorridasPorData = (corridas: Ride[]) => {
    try {
      if (!corridas || corridas.length === 0) {
        return {};
      }
      const grupos: { [data: string]: Ride[] } = {};
      corridas.forEach(r => {
        if (!r) return;
        const d = r.data_operacional || r.data || 'Sem Data';
        if (!grupos[d]) grupos[d] = [];
        grupos[d].push(r);
      });
      return grupos;
    } catch (error) {
      console.error("Erro ao agrupar corridas:", error);
      return {};
    }
  };

  const exportarRelatorioPdf = (filteredRides: Ride[]) => {
    const doc = new jsPDF('landscape', 'mm', 'a4');

    // Título e Informações Gerais
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("RELATÓRIO DE CORRIDAS & AUDITORIA", 14, 18);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139); // slate-500
    const dataEmissao = formatToPtBrDate(getTodayDateStr()) + " às " + new Date().toLocaleTimeString('pt-BR');
    doc.text(`Data de Emissão: ${dataEmissao}`, 14, 24);
    
    let periodoLabel = periodoFiltro.toUpperCase();
    if (periodoFiltro === 'personalizado') {
      periodoLabel = `PERSONALIZADO (${formatToPtBrDate(dataInicioPersonalizada)} ATÉ ${formatToPtBrDate(dataFimPersonalizada)})`;
    } else if (periodoFiltro === 'hoje') {
      periodoLabel = `HOJE (${formatToPtBrDate(getTodayDateStr())})`;
    }
    doc.text(`Período do Filtro: ${periodoLabel}`, 14, 29);

    // Cálculos de Resumo
    const totalCorridas = filteredRides.length;
    const finalizadas = filteredRides.filter(r => r.status === 'finalizada' || r.status === 'FINALIZADA');
    const totalFinalizadas = finalizadas.length;
    const faturamentoTotal = finalizadas.reduce((acc, r) => acc + r.valorEstimado, 0);

    // Box de Resumo Financeiro / Indicadores
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(14, 34, 269, 16, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);

    doc.text("TOTAL CORRIDAS:", 20, 44);
    doc.setFont("helvetica", "normal");
    doc.text(`${totalCorridas} (${totalFinalizadas} Finalizadas)`, 55, 44);

    doc.setFont("helvetica", "bold");
    doc.text("FATURAMENTO TOTAL:", 115, 44);
    doc.setFont("helvetica", "normal");
    doc.text(`R$ ${faturamentoTotal.toFixed(2)}`, 157, 44);

    // Estrutura de dados para a tabela
    const headers = [
      "ID", "Data/Hora", "Status", "Passageiro", "Telefone", "Mototaxista", "Origem", "Destino", "Valor (R$)"
    ];

    const data = filteredRides.map(r => {
      const statusFormatado = (r.status === 'finalizada' || r.status === 'FINALIZADA') ? 'FINALIZADA' : (r.status === 'cancelada' || r.status === 'CANCELADA') ? 'CANCELADA' : 'EM ANDAMENTO';
      return [
        r.id.substring(0, 8).toUpperCase(),
        `${r.data_operacional || r.data} ${r.hora_corrida || r.hora}`,
        statusFormatado,
        r.clienteNome,
        r.clienteTelefone,
        r.mototaxistaNome || 'N/A',
        r.origem,
        r.destino || 'N/A',
        `R$ ${(r.valorEstimado || 0).toFixed(2)}`
      ];
    });

    autoTable(doc, {
      startY: 56,
      head: [headers],
      body: data,
      theme: 'striped',
      headStyles: {
        fillColor: [15, 23, 42], // slate-900
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center'
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        valign: 'middle'
      },
      columnStyles: {
        0: { cellWidth: 15 }, // ID
        1: { cellWidth: 26 }, // Data/Hora
        2: { cellWidth: 20 }, // Status
        3: { cellWidth: 30 }, // Passageiro
        4: { cellWidth: 25 }, // Telefone
        5: { cellWidth: 30 }, // Mototaxista
        6: { cellWidth: 50 }, // Origem
        7: { cellWidth: 55 }, // Destino
        8: { cellWidth: 18, halign: 'right' } // Valor
      },
      didDrawPage: (data: any) => {
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(
          `Página ${data.pageNumber} de ${pageCount}`,
          doc.internal.pageSize.width - 25,
          doc.internal.pageSize.height - 10
        );
        doc.text(
          "Sistema de Gestão de Mototáxi - Relatório Oficial de Auditoria",
          14,
          doc.internal.pageSize.height - 10
        );
      }
    });

    doc.save(`relatorio_corridas_${periodoFiltro}_${getTodayDateStr()}.pdf`);
  };

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'moto' | 'motorista') => {
    if (e.target.files && e.target.files[0]) {
      const b64 = await fileToBase64(e.target.files[0]);
      if (target === 'motorista') setFotoMotoristaB64(b64);
      else setFotoMotoB64(b64);
    }
  };



  // Filtrar listas por busca
  const motosFiltrados = mototaxistas.filter(m => 
    m.nome.toLowerCase().includes(busca.toLowerCase()) || 
    m.placa.toLowerCase().includes(busca.toLowerCase()) ||
    m.bairro.toLowerCase().includes(busca.toLowerCase())
  );

  const clientesFiltrados = clientes.filter(c => 
    c.nome.toLowerCase().includes(busca.toLowerCase()) || 
    c.email.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="flex-1 bg-slate-50 flex overflow-hidden font-sans text-slate-800">
      
      {/* Sidebar de Navegação do Administrador */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col justify-between shrink-0 hidden md:flex">
        <div className="space-y-6">
          <div className="px-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              Painel de Controle
            </span>
          </div>

          <nav className="space-y-1.5">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Activity },
              { id: 'mototaxistas', label: 'Mototaxistas', icon: Bike, badge: mototaxistas.length },
              { id: 'clientes', label: 'Clientes', icon: Users, badge: clientes.length },
              { id: 'corridas', label: 'Corridas & Ganhos', icon: DollarSign, badge: rides.length },
              { id: 'tarifas', label: 'Configuração de Tarifas', icon: Clock, badge: config.tarifas?.length || 0 },
            ].map(item => {
              const Icon = item.icon;
              const isAtivo = activeMenu === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveMenu(item.id as any); setBusca(''); }}
                  className={`w-full px-4 py-3.5 rounded-2xl font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${isAtivo ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isAtivo ? 'text-yellow-400' : ''}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${isAtivo ? 'bg-yellow-400 text-slate-950' : 'bg-slate-100 text-slate-600'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 bg-slate-100 rounded-2xl text-xs space-y-1">
          <p className="font-bold text-slate-800">🚀 Ambiente Produção</p>
          <p className="text-[11px] text-slate-500">Sincronizado via Local & BroadcastChannel</p>
        </div>
      </aside>

      {/* Navegação Mobile Top Tabs */}
      <div className="flex md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-2 z-40 justify-around text-[10px] font-bold">
        {[
          { id: 'dashboard', label: 'Dash', icon: Activity },
          { id: 'mototaxistas', label: 'Motos', icon: Bike },
          { id: 'clientes', label: 'Clientes', icon: Users },
          { id: 'corridas', label: 'Corridas', icon: DollarSign },
          { id: 'tarifas', label: 'Tarifas', icon: Clock },
        ].map(x => (
          <button key={x.id} onClick={() => setActiveMenu(x.id as any)} className={`p-2 rounded-xl flex flex-col items-center ${activeMenu === x.id ? 'text-yellow-600 bg-yellow-50 font-bold' : 'text-slate-400'}`}>
            <x.icon className="w-5 h-5 mb-0.5" />
            {x.label}
          </button>
        ))}
      </div>

      {/* Conteúdo Principal do Menu Selecionado */}
      <main className="flex-1 p-4 sm:p-8 overflow-y-auto pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* MENU: DASHBOARD */}
          {activeMenu === 'dashboard' && (
            <div className="space-y-8 animate-fade-in">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Visão Geral do Sistema</h2>
                <p className="text-xs text-slate-500 mt-1">Métricas operacionais e financeiras atualizadas em tempo real.</p>
              </div>

              {/* Grid 3 Cards Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[28px] shadow-sm border border-slate-200/80">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Frota Parceira</p>
                      <h4 className="text-3xl font-black text-slate-900 mt-2">{mototaxistas.length}</h4>
                    </div>
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><Bike className="w-6 h-6 font-bold" /></div>
                  </div>
                  <p className="text-xs text-emerald-600 font-bold mt-3">
                    {mototaxistas.filter(m => m.disponibilidade === 'disponivel').length} disponíveis agora
                  </p>
                </div>

                <div className="bg-white p-6 rounded-[28px] shadow-sm border border-slate-200/80">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Passageiros</p>
                      <h4 className="text-3xl font-black text-slate-900 mt-2">{clientes.length}</h4>
                    </div>
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Users className="w-6 h-6 font-bold" /></div>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 font-semibold">Base ativa cadastrada</p>
                </div>

                <div className="bg-white p-6 rounded-[28px] shadow-sm border border-slate-200/80">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Corridas</p>
                      <h4 className="text-3xl font-black text-slate-900 mt-2">{ridesHojeFiltradas.length}</h4>
                    </div>
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl"><Activity className="w-6 h-6 font-bold" /></div>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 font-semibold">{corridasFinalizadasHoje.length} concluídas</p>
                </div>
              </div>


            </div>
          )}

          {/* MENU: MOTOTAXISTAS */}
          {activeMenu === 'mototaxistas' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Gestão de Mototaxistas</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Monitore os profissionais habilitados.</p>
                </div>

                <div className="flex gap-3">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                      placeholder="Buscar por nome ou placa..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>
                </div>
              </div>

              {/* Tabela de Mototaxistas */}
              <div className="bg-white rounded-[32px] border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase">
                        <th className="p-4 pl-6">Profissional</th>
                        <th className="p-4">Placa (Login)</th>
                        <th className="p-4">Moto</th>
                        <th className="p-4">Região</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Corridas / Ganhos</th>
                        <th className="p-4 pr-6 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {motosFiltrados.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-4 pl-6">
                            <div className="flex items-center gap-3">
                              <img src={m.foto || ''} alt="" className="w-10 h-10 rounded-xl object-cover bg-slate-200 shrink-0" />
                              <div>
                                <p className="font-extrabold text-slate-900 text-sm">{m.nome}</p>
                                <p className="text-slate-400 text-[11px] font-mono">{m.telefone}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 font-mono font-black text-slate-900">{m.placa}</td>
                          <td className="p-4 font-semibold text-slate-700">{m.modeloMoto} ({m.corMoto})</td>
                          <td className="p-4 text-slate-600">{m.bairro}, {m.cidade}</td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1">
                              <span className={`inline-flex w-fit px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${m.status === 'ativo' ? 'bg-emerald-100 text-emerald-800 font-bold' : m.status === 'bloqueado' ? 'bg-red-100 text-red-800 font-bold' : 'bg-slate-200 text-slate-700'}`}>
                                {m.status}
                              </span>
                              {m.status_aprovacao === 'PENDENTE' && (
                                <span className="bg-amber-100 text-amber-800 border border-amber-300 font-bold px-2 py-0.5 rounded-full text-[9px] animate-pulse">
                                  ⚠️ Pendente Aprovação
                                </span>
                              )}
                              {m.status_aprovacao === 'REJEITADO' && (
                                <span className="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full text-[9px]">
                                  ❌ Rejeitado
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 capitalize">• {m.disponibilidade}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            {(() => {
                              const stats = getDriverStats(m.id);
                              return (
                                <>
                                  <p className="font-bold text-slate-800">{stats.totalCorridas} corridas</p>
                                  <p className="text-emerald-600 font-mono font-black">R$ {stats.ganhos.toFixed(2)}</p>
                                </>
                              );
                            })()}
                          </td>
                          <td className="p-4 pr-6 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => setMotoDetalhes(m)}
                              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
                              title="Ver Detalhes / Localização"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => abrirModalEditarMoto(m)}
                              className="p-2 bg-slate-100 hover:bg-yellow-100 hover:text-yellow-800 text-slate-600 rounded-xl transition-colors"
                              title="Editar Dados"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {m.status_aprovacao === 'PENDENTE' && (
                              <>
                                <button
                                  onClick={() => handleAprovarMototaxista(m)}
                                  className="p-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold rounded-xl"
                                  title="Aprovar Cadastro"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleRejeitarMototaxista(m)}
                                  className="p-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-xl"
                                  title="Rejeitar Cadastro"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => toggleBloqueioUser(m)}
                              className={`p-2 rounded-xl transition-colors ${m.status === 'bloqueado' ? 'bg-red-100 text-red-700 font-bold' : 'bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-600'}`}
                              title={m.status === 'bloqueado' ? 'Desbloquear Acesso' : 'Bloquear Acesso'}
                            >
                              {m.status === 'bloqueado' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleExcluirMototaxista(m.id, m.nome)}
                              className="p-2 bg-slate-100 hover:bg-red-100 hover:text-red-600 text-slate-600 rounded-xl transition-colors cursor-pointer"
                              title="Excluir Definitivamente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MENU: CLIENTES */}
          {activeMenu === 'clientes' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Clientes Cadastrados</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Gestão de passageiros usuários do aplicativo.</p>
                </div>
                <div className="relative sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Pesquisar cliente..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                </div>
              </div>

              <div className="bg-white rounded-[32px] border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase">
                        <th className="p-4 pl-6">Passageiro</th>
                        <th className="p-4">E-mail (Login)</th>
                        <th className="p-4">Telefone</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 pr-6 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {clientesFiltrados.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-4 pl-6">
                            <div className="flex items-center gap-3">
                              <img src={c.foto || ''} alt="" className="w-9 h-9 rounded-xl object-cover bg-slate-200 shrink-0" />
                              <span className="font-extrabold text-slate-900 text-sm">{c.nome}</span>
                            </div>
                          </td>
                          <td className="p-4 font-mono text-slate-700">{c.email}</td>
                          <td className="p-4 font-semibold text-slate-800">{c.telefone}</td>

                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${c.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="p-4 pr-6 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => setClienteDetalhes(c)}
                              className="p-2 bg-slate-100 hover:bg-blue-100 hover:text-blue-600 text-slate-600 rounded-xl cursor-pointer inline-flex items-center"
                              title="Visualizar Cadastro"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => toggleBloqueioUser(c)}
                              className={`p-2 rounded-xl transition-colors inline-flex items-center ${c.status === 'bloqueado' ? 'bg-red-100 text-red-700 font-bold' : 'bg-slate-100 hover:bg-amber-100'}`}
                              title={c.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}
                            >
                              {c.status === 'bloqueado' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleExcluirCliente(c.id, c.nome)}
                              className="p-2 bg-slate-100 hover:bg-red-100 hover:text-red-600 text-slate-600 rounded-xl cursor-pointer inline-flex items-center"
                              title="Excluir Definitivamente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MENU: CORRIDAS & GANHOS */}
          {activeMenu === 'corridas' && (() => {
            try {
              const filteredRides = getFilteredRides() || [];
              const faturamentoPorMotorista = getFaturamentoPorMotorista(filteredRides) || [];
              const corridasAgrupadas = agruparCorridasPorData(filteredRides) || {};

              const totalFiltro = filteredRides.length;
              const finalizadasFiltro = filteredRides.filter(r => r && (r.status === 'finalizada' || r.status === 'FINALIZADA')).length;
              const canceladasFiltro = filteredRides.filter(r => r && (r.status === 'cancelada' || r.status === 'CANCELADA')).length;
              const emAndamentoFiltro = filteredRides.filter(r => r && r.status !== 'finalizada' && r.status !== 'FINALIZADA' && r.status !== 'cancelada' && r.status !== 'CANCELADA').length;

              // Verificar se o período atual selecionado é hoje e se está aberto
              const hojeStr = getTodayDateStr() || '';
              const ehHoje = periodoFiltro === 'hoje';

              const handleAprovarAuditoria = (r: Ride) => {
                if (!r) return;
                saveRide({
                  ...r,
                  status_auditoria: 'aprovado'
                });
                carregarTudo();
              };

              return (

              <div className="space-y-6 animate-fade-in">
                {/* Cabeçalho */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Histórico de Corridas & Auditoria</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Todas as chamadas solicitadas, fechamentos financeiros diários e conciliação.</p>
                  </div>
                  <button
                    onClick={() => exportarRelatorioPdf(filteredRides)}
                    className="px-5 py-3 bg-slate-900 hover:bg-slate-850 text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <FileText className="w-4 h-4 text-yellow-400" />
                    Exportar Relatório (PDF)
                  </button>
                </div>

                {/* Filtros e Pesquisa */}
                <div className="bg-white rounded-[28px] border border-slate-200/80 shadow-sm p-5 space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                    
                    {/* Período das Corridas */}
                    <div className="lg:col-span-4 space-y-1.5">
                      <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Período das Corridas</label>
                      <div className="grid grid-cols-4 bg-slate-100 p-1 rounded-xl">
                        {(['hoje', 'ontem', '7dias', 'personalizado'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setPeriodoFiltro(mode)}
                            className={`py-2 text-[10px] font-black rounded-lg transition-all cursor-pointer uppercase ${
                              periodoFiltro === mode
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900'
                            }`}
                          >
                            {mode === 'hoje' ? 'Hoje' : mode === 'ontem' ? 'Ontem' : mode === '7dias' ? '7 Dias' : 'Personaliz.'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Datas Customizadas (se personalizado) */}
                    {periodoFiltro === 'personalizado' ? (
                      <div className="lg:col-span-4 grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase">Início</span>
                          <input
                            type="date"
                            value={dataInicioPersonalizada}
                            onChange={(e) => setDataInicioPersonalizada(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase">Fim</span>
                          <input
                            type="date"
                            value={dataFimPersonalizada}
                            onChange={(e) => setDataFimPersonalizada(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="lg:col-span-4 text-xs text-slate-500 pb-3 font-semibold italic">
                        {periodoFiltro === 'hoje' && `Exibindo o dia de hoje: ${formatToPtBrDate(hojeStr)}`}
                        {periodoFiltro === 'ontem' && 'Exibindo o dia operacional de ontem.'}
                        {periodoFiltro === '7dias' && 'Exibindo corridas dos últimos 7 dias.'}
                      </div>
                    )}

                    {/* Filtro Status */}
                    <div className="lg:col-span-2 space-y-1.5">
                      <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Status</label>
                      <select
                        value={statusFiltroCorrida}
                        onChange={(e) => setStatusFiltroCorrida(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      >
                        <option value="todos">Todos</option>
                        <option value="finalizada">Finalizada</option>
                        <option value="cancelada">Cancelada</option>
                        <option value="aceita">Aceita (Em andamento)</option>
                        <option value="aguardando">Aguardando Moto</option>
                      </select>
                    </div>

                    {/* Barra de Pesquisa */}
                    <div className="lg:col-span-2 space-y-1.5">
                      <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Buscar por Texto</label>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          value={pesquisaCorrida}
                          onChange={(e) => setPesquisaCorrida(e.target.value)}
                          placeholder="Passageiro, placa, etc..."
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                      </div>
                    </div>

                  </div>
                </div>

                {/* Resumo / Indicadores (Bento Grid) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  <div className="bg-white p-5 rounded-[24px] border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Data Operacional</p>
                      <h4 className="text-base font-black text-slate-900 mt-1">
                        {periodoFiltro === 'hoje' ? formatToPtBrDate(hojeStr) : periodoFiltro === 'ontem' ? 'Ontem' : 'Filtro Ativo'}
                      </h4>
                    </div>
                    <span className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black rounded-full uppercase w-max ${
                      periodoFiltro === 'hoje' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                      {periodoFiltro === 'hoje' ? 'ABERTO' : 'FECHADO'}
                    </span>
                  </div>

                  <div className="bg-white p-5 rounded-[24px] border border-slate-200/80 shadow-sm">
                    <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Total Corridas</p>
                    <h4 className="text-3xl font-black text-slate-950 mt-1">{totalFiltro}</h4>
                    <p className="text-[10px] text-slate-500 mt-1 font-semibold">{emAndamentoFiltro} em andamento</p>
                  </div>

                  <div className="bg-white p-5 rounded-[24px] border border-slate-200/80 shadow-sm">
                    <p className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-wider">Finalizadas</p>
                    <h4 className="text-3xl font-black text-emerald-600 mt-1">{finalizadasFiltro}</h4>
                    <p className="text-[10px] text-slate-500 mt-1 font-semibold">Corridas concluídas com sucesso</p>
                  </div>

                  <div className="bg-white p-5 rounded-[24px] border border-slate-200/80 shadow-sm">
                    <p className="text-[10px] text-red-500 font-extrabold uppercase tracking-wider">Canceladas</p>
                    <h4 className="text-3xl font-black text-red-500 mt-1">{canceladasFiltro}</h4>
                    <p className="text-[10px] text-slate-500 mt-1 font-semibold">Corridas não concluídas</p>
                  </div>

                </div>

                {/* Controle Financeiro Diário por Motorista */}
                <div className="bg-white rounded-[28px] border border-slate-200/80 shadow-sm p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-amber-500" />
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Fechamento de Ganhos por Moto-Taxista</h3>
                      <p className="text-[11px] text-slate-400">Somatório de corridas, faturamento bruto e taxa da plataforma do período filtrado.</p>
                    </div>
                  </div>

                  {faturamentoPorMotorista.length === 0 ? (
                    <div className="py-4 text-center text-slate-400 text-xs font-semibold">Nenhum ganho registrado para moto-taxistas neste período.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[10px] border-b border-slate-200">
                            <th className="p-3 pl-4">Moto-Taxista / Placa</th>
                            <th className="p-3 text-center">Corridas Realizadas</th>
                            <th className="p-3 text-center">Canceladas</th>
                            <th className="p-3 text-right pr-4">Faturamento Bruto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {faturamentoPorMotorista.map(m => (
                            <tr key={m.placa} className="hover:bg-slate-50/60 transition-colors">
                              <td className="p-3 pl-4">
                                <span className="font-extrabold text-slate-900 block">{m.nome}</span>
                                <span className="text-[10px] font-mono text-slate-500 uppercase">Placa: {m.placa}</span>
                              </td>
                              <td className="p-3 text-center font-bold text-slate-700">{m.totalCorridas}</td>
                              <td className="p-3 text-center text-red-500 font-semibold">{m.totalCanceladas}</td>
                              <td className="p-3 text-right font-black font-mono text-slate-900 pr-4">R$ {m.valorGerado.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Histórico Separado por Dia e Auditoria */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-indigo-500" />
                      <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Histórico de Auditoria Geral</h3>
                        <p className="text-[11px] text-slate-400">Corridas agrupadas e seladas cronologicamente por dia.</p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 font-semibold">Total filtrado: {filteredRides.length} corridas</span>
                  </div>

                  {Object.keys(corridasAgrupadas).length === 0 ? (
                    <div className="bg-white rounded-[28px] border border-slate-200/80 p-12 text-center text-slate-400 text-sm">
                      Nenhuma corrida registrada para este período
                    </div>
                  ) : (
                    Object.entries(corridasAgrupadas).map(([dia, listaCorridas]) => {
                      const validLista = (listaCorridas || []).filter((x): x is Ride => !!x);
                      const finalizadasDia = validLista.filter(x => x.status === 'finalizada' || x.status === 'FINALIZADA');
                      const totalFaturadoDia = finalizadasDia.reduce((acc, x) => acc + (typeof x.valorEstimado === 'number' ? x.valorEstimado : 0), 0);
                      
                      return (
                        <div key={dia} className="space-y-3">
                          
                          {/* Separador de Dia Operacional */}
                          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-white rounded-xl shadow-sm text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">📅</span>
                              <span className="font-black text-sm">{formatToPtBrDate(dia)}</span>
                              <span className="text-[10px] opacity-75">
                                {dia === hojeStr ? '(Hoje - Dia Operacional Ativo)' : '(Dia Encerrado / Fechamento Concluído)'}
                              </span>
                            </div>
                            <div className="flex gap-4 font-mono text-[10px] uppercase font-bold text-yellow-400">
                              <span>Corridas: {validLista.length}</span>
                              <span>Faturado: R$ {totalFaturadoDia.toFixed(2)}</span>
                            </div>
                          </div>

                          {/* Lista do Dia */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {validLista.map(r => {
                              const valorCorrida = typeof r.valorEstimado === 'number' ? r.valorEstimado : 0;
                              return (
                                <div
                                  key={r.id}
                                  className="bg-white rounded-2xl border border-slate-200/85 p-5 shadow-sm space-y-4 flex flex-col justify-between"
                                >
                                  {/* Topo do Card de Auditoria */}
                                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-wider block">ID: {r.id}</span>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded ${
                                          ['finalizada', 'FINALIZADA'].includes(r.status) 
                                            ? 'bg-emerald-100 text-emerald-800' 
                                            : ['cancelada', 'CANCELADA'].includes(r.status) 
                                            ? 'bg-red-100 text-red-800' 
                                            : 'bg-blue-100 text-blue-800'
                                        }`}>
                                          {['finalizada', 'FINALIZADA'].includes(r.status) ? 'Finalizada' : ['cancelada', 'CANCELADA'].includes(r.status) ? 'Cancelada' : 'Em Andamento'}
                                        </span>
                                        <span className="text-xs text-slate-500 font-mono font-bold">{r.hora_corrida || r.hora}</span>
                                      </div>
                                    </div>
                                    
                                    <div className="text-right">
                                      <p className="text-[10px] text-slate-400 font-extrabold uppercase">Valor Corrida</p>
                                      <p className="text-lg font-black font-mono text-slate-900 leading-none mt-0.5">R$ {valorCorrida.toFixed(2)}</p>
                                    </div>
                                  </div>

                                  {/* Corpo do Card: Detalhes de Passageiro e Condutor */}
                                  <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div className="space-y-1">
                                      <h5 className="font-extrabold text-slate-400 text-[10px] uppercase">Passageiro</h5>
                                      <p className="font-black text-slate-900">{r.clienteNome}</p>
                                      <p className="text-[10px] text-slate-500 font-mono">{r.clienteTelefone}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <h5 className="font-extrabold text-slate-400 text-[10px] uppercase">Moto-Taxista</h5>
                                      {r.mototaxistaNome ? (
                                        <>
                                          <p className="font-black text-slate-900 notranslate" translate="no">{r.mototaxistaNome}</p>
                                          <p className="text-[10px] text-slate-600 font-semibold">
                                            <span className="notranslate" translate="no">{r.mototaxistaMoto}</span> • Placa: <span className="font-mono uppercase font-black notranslate" translate="no">{r.mototaxistaPlaca}</span>
                                          </p>
                                        </>
                                      ) : (
                                        <p className="text-slate-400 font-semibold italic">Aguardando alocação</p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Rota */}
                                  <div className="bg-slate-50 p-3 rounded-xl space-y-2.5 text-xs">
                                    <div>
                                      <span className="text-[10px] font-extrabold text-emerald-600 uppercase block">Partida / Origem</span>
                                      <p className="font-semibold text-slate-700 leading-tight mt-0.5">{r.origem}</p>
                                    </div>
                                    <div>
                                      <span className="text-[10px] font-extrabold text-red-500 uppercase block">Destino / Chegada</span>
                                      <p className="font-semibold text-slate-700 leading-tight mt-0.5">{r.destino || 'N/A'}</p>
                                    </div>
                                  </div>

                                  {/* Rodapé do Card: Pagamento, Auditoria e Ações */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-[11px]">
                                    <div className="flex flex-wrap items-center gap-3 font-semibold text-slate-600">
                                      <span>💵 Pagamento: <strong className="text-slate-900">Dinheiro</strong></span>
                                      <span>|</span>
                                      <span className="flex items-center gap-1">
                                        🛡️ Auditoria: 
                                        <span className={`font-black uppercase text-[10px] ${
                                          r.status_auditoria === 'aprovado' ? 'text-emerald-600' : 'text-amber-500'
                                        }`}>
                                          {r.status_auditoria === 'aprovado' ? 'Aprovado' : 'Pendente'}
                                        </span>
                                      </span>
                                    </div>

                                    {r.status_auditoria !== 'aprovado' && (r.status === 'finalizada' || r.status === 'FINALIZADA') && (
                                      <button
                                        onClick={() => handleAprovarAuditoria(r)}
                                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black rounded-lg cursor-pointer transition-all self-end sm:self-auto uppercase text-[9px]"
                                      >
                                        ✓ Conciliar Corrida
                                      </button>
                                    )}
                                  </div>

                                </div>
                              );
                            })}
                          </div>

                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            );
          } catch (error) {
            console.error("Erro renderizando Histórico de Corridas & Auditoria:", error);
            return (
              <div className="p-6 bg-red-50 border border-red-200 text-red-800 rounded-[28px] space-y-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  <h3 className="font-extrabold text-base">Erro ao processar as corridas</h3>
                </div>
                <p className="text-xs">
                  Ocorreu uma falha ao filtrar ou renderizar as corridas com base no período selecionado. Isso pode ser devido a dados corrompidos ou ausência de registros.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setPeriodoFiltro('hoje');
                      carregarTudo();
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer"
                  >
                    Redefinir para "Hoje"
                  </button>
                  <button
                    onClick={() => {
                      carregarTudo();
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition-all cursor-pointer"
                  >
                    Recarregar Dados
                  </button>
                </div>
              </div>
            );
          }
          })()}

          {/* MENU: CONFIGURAÇÃO DE TARIFAS MUNICIPAIS E TURNOS */}
          {activeMenu === 'tarifas' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Configuração de Tarifas por Turno</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Gerencie os horários e valores cobrados em cada um dos quatro turnos fixos do sistema.</p>
                </div>
                <div>
                  <button
                    onClick={handleCadastrarTodosTurnos}
                    className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-xs rounded-2xl flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
                  >
                    <Plus className="w-4 h-4 font-bold" />
                    Cadastrar Todos os Turnos (Manhã, Tarde, Noite, Madrugada)
                  </button>
                </div>
              </div>

              {/* Tabela de Tarifas */}
              <div className="bg-white rounded-[32px] border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center text-xs">
                  <span className="font-bold uppercase tracking-wider text-yellow-400">🕒 Turno Atual Identificado automaticamente:</span>
                  <span className="px-3 py-1 bg-yellow-400 text-slate-950 font-black rounded-full text-sm">
                    {identifyingTurnoAtual(config)}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                        <th className="p-4 pl-6">Turno</th>
                        <th className="p-4">Horário Inicial</th>
                        <th className="p-4">Horário Final</th>
                        <th className="p-4">Valor da Corrida</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 pr-6 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(config.tarifas || []).map(t => {
                        const iconeTurno = t.turno === 'Manhã' ? '☀' : t.turno === 'Tarde' ? '🌤' : t.turno === 'Noite' ? '🌙' : '🌑';
                        return (
                          <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-4 pl-6 font-black text-slate-900 text-sm flex items-center gap-2">
                              <span className="text-base">{iconeTurno}</span> {t.turno}
                            </td>
                            <td className="p-4 font-mono font-bold text-slate-700 text-sm">{t.hora_inicio}</td>
                            <td className="p-4 font-mono font-bold text-slate-700 text-sm">{t.hora_fim}</td>
                            <td className="p-4 font-mono font-black text-emerald-600 text-sm">R$ {t.valor.toFixed(2)}</td>
                            <td className="p-4">
                              <button
                                onClick={() => toggleTarifaAtiva(t)}
                                className={`px-3 py-1 rounded-full text-[10px] font-extrabold cursor-pointer transition-all ${t.status ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-red-100 text-red-800 hover:bg-red-200'}`}
                              >
                                {t.status ? '● Ativo' : '○ Inativo'}
                              </button>
                            </td>
                            <td className="p-4 pr-6 text-right whitespace-nowrap">
                              <button
                                onClick={() => abrirModalEditarTarifa(t)}
                                className="px-3.5 py-2 bg-slate-100 hover:bg-yellow-400 hover:text-slate-950 text-slate-700 rounded-xl transition-all font-bold flex items-center gap-1.5 ml-auto cursor-pointer"
                                title="Editar Turno"
                              >
                                <Edit2 className="w-3.5 h-3.5" /> Editar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* MODAL: EDIÇÃO DE TARIFA POR TURNO */}
      {modalTarifaAberto && tarifaEditando && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-[36px] shadow-2xl p-8 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">Editar Turno: {tarifaEditando.turno}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Altere os parâmetros operacionais deste turno fixo.</p>
              </div>
              <button onClick={() => setModalTarifaAberto(false)} className="p-1.5 hover:bg-slate-100 rounded-xl cursor-pointer"><X className="w-5 h-5 text-slate-500" /></button>
            </div>

            <form onSubmit={handleSalvarTarifa} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Horário Inicial</label>
                  <input
                    type="time"
                    value={tHoraInicio}
                    onChange={e => setTHoraInicio(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Horário Final</label>
                  <input
                    type="time"
                    value={tHoraFim}
                    onChange={e => setTHoraFim(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Valor da corrida (R$)</label>
                <input
                  type="number"
                  step="0.5"
                  value={tValor}
                  onChange={e => setTValor(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold font-mono text-emerald-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-3 pt-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <input
                  type="checkbox"
                  id="chkTarAtivo"
                  checked={tAtivo}
                  onChange={e => setTAtivo(e.target.checked)}
                  className="w-5 h-5 rounded text-yellow-500 focus:ring-yellow-400 cursor-pointer"
                />
                <label htmlFor="chkTarAtivo" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Turno Ativo (Permitir solicitações de corrida neste período)
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-sm rounded-2xl shadow-sm transition-all cursor-pointer mt-2"
              >
                Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================================= */}
      {/* MODAL DE CADASTRO OU EDIÇÃO DE MOTOTAXISTA */}
      {/* ================================================================================= */}
      {modalMotoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-2xl bg-white rounded-[36px] shadow-2xl border border-slate-200 p-8 sm:p-10 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-yellow-400 text-slate-950 rounded-2xl"><Bike className="w-6 h-6 font-bold" /></div>
                <h3 className="text-xl font-black text-slate-900">
                  {motoEditando ? 'Editar Mototaxista' : 'Cadastrar Novo Mototaxista'}
                </h3>
              </div>
              <button onClick={() => setModalMotoAberto(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSalvarMotorista} className="space-y-5 text-xs">
              
              {/* Fotos Upload */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-200/60">
                <div className="flex flex-col items-center">
                  <span className="font-bold text-slate-700 uppercase text-[10px] mb-2">Foto Motorista</span>
                  <div className="relative w-20 h-20 rounded-full bg-white border-2 border-dashed border-slate-300 overflow-hidden flex items-center justify-center cursor-pointer group">
                    {fotoMotoristaB64 ? <img src={fotoMotoristaB64} alt="" className="w-full h-full object-cover" /> : <Camera className="w-6 h-6 text-slate-400" />}
                    <input type="file" accept="image/*" onChange={e => handleFotoUpload(e, 'motorista')} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  <span className="font-bold text-slate-700 uppercase text-[10px] mb-2">Foto da Moto</span>
                  <div className="relative w-28 h-20 rounded-2xl bg-white border-2 border-dashed border-slate-300 overflow-hidden flex items-center justify-center cursor-pointer group">
                    {fotoMotoB64 ? <img src={fotoMotoB64} alt="" className="w-full h-full object-cover" /> : <Bike className="w-6 h-6 text-slate-400" />}
                    <input type="file" accept="image/*" onChange={e => handleFotoUpload(e, 'moto')} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">Nome Completo</label>
                  <input type="text" value={nome} onChange={e => setNome(e.target.value)} required placeholder="Nome do parceiro" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-semibold" />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">WhatsApp / Telefone</label>
                  <input type="text" value={telefone} onChange={e => setTelefone(e.target.value)} required placeholder="(11) 98888-8888" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-semibold" />
                </div>

                <div>
                  <label className="block font-bold text-slate-900 uppercase tracking-wider mb-1.5 bg-yellow-50 px-2 py-0.5 rounded w-fit">Placa da Moto (Login Inicial)</label>
                  <input type="text" value={placa} onChange={e => setPlaca(e.target.value)} required placeholder="Ex: ABC1D23" className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl font-mono font-black text-sm" />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">Modelo da Moto</label>
                  <input type="text" value={modeloMoto} onChange={e => setModeloMoto(e.target.value)} required placeholder="Ex: Honda CG 160" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-semibold" />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">Cor da Moto</label>
                  <input type="text" value={corMoto} onChange={e => setCorMoto(e.target.value)} required placeholder="Ex: Vermelha" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-semibold" />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">Bairro / Setor</label>
                  <input type="text" value={bairro} onChange={e => setBairro(e.target.value)} required placeholder="Ex: Centro" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-semibold" />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">Status Cadastro</label>
                  <select value={statusMoto} onChange={e => setStatusMoto(e.target.value as any)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-semibold">
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                    <option value="bloqueado">Bloqueado</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">Disponibilidade Operacional</label>
                  <select value={disponibilidadeMoto} onChange={e => setDisponibilidadeMoto(e.target.value as any)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-semibold">
                    <option value="disponivel">Disponível</option>
                    <option value="ocupado">Ocupado</option>
                    <option value="indisponivel">Indisponível (Offline)</option>
                  </select>
                </div>
              </div>

              {!motoEditando && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-[11px] text-blue-800 leading-relaxed">
                  ℹ️ Ao salvar, o usuário será criado automaticamente. A senha inicial ficará em branco pro sistema reconhecer e obrigar o mototaxista a definir sua própria senha secreta na primeira vez que entrar com a placa <b>{placa || '...'}</b>.
                </div>
              )}

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setModalMotoAberto(false)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold">Cancelar</button>
                <button type="submit" className="flex-[2] py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-sm rounded-2xl shadow-sm cursor-pointer">
                  Salvar Mototaxista
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================================= */}
      {/* MODAL DETALHES DO MOTOTAXISTA SELECIONADO */}
      {/* ================================================================================= */}
      {motoDetalhes && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in print:hidden">
          <div className="w-full max-w-3xl bg-white rounded-[36px] shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <img src={motoDetalhes.foto || ''} alt="" className="w-16 h-16 rounded-2xl object-cover bg-slate-200" />
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">{motoDetalhes.nome}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono font-black text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{motoDetalhes.placa}</span>
                    <span className="text-[10px] text-slate-400 capitalize">• {motoDetalhes.disponibilidade}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setMotoDetalhes(null)} className="p-1.5 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
            </div>

            {/* ETAPAS DE CADASTRO UNIFICADAS (BENTO-STYLE) */}
            <div className="space-y-6">
              {/* ETAPA 1: DADOS PESSOAIS */}
              <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200/60 space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center gap-1.5 border-b border-slate-200 pb-2 mb-2">
                  <Users className="w-4 h-4 text-emerald-600" /> Etapa 1: Dados Pessoais
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                  <p><b>Nome Completo:</b> {motoDetalhes.nome}</p>
                  <p><b>CPF ou RG:</b> {motoDetalhes.cpf || '-'}</p>
                  <p><b>WhatsApp (Obrigatório):</b> {motoDetalhes.whatsapp || motoDetalhes.telefone || '-'}</p>
                  <p><b>Data de Nascimento:</b> {formatToPtBrDate(motoDetalhes.nascimento || '') || '-'}</p>
                  <p><b>Cidade Base:</b> {motoDetalhes.cidade || '-'}</p>
                  <p><b>Bairro / Região Base:</b> {motoDetalhes.bairro || '-'}</p>
                  {motoDetalhes.endereco && <p className="sm:col-span-2"><b>Endereço Completo:</b> {motoDetalhes.endereco}</p>}
                </div>
              </div>

              {/* ETAPA 2: VEÍCULO E CNH */}
              <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200/60 space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center gap-1.5 border-b border-slate-200 pb-2 mb-2">
                  <Bike className="w-4 h-4 text-emerald-600" /> Etapa 2: Dados do Veículo & CNH
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                  <p><b>Modelo da Moto:</b> {motoDetalhes.modeloMoto || '-'}</p>
                  <p><b>Cor da Moto:</b> {motoDetalhes.corMoto || '-'}</p>
                  <p><b>Placa da Moto:</b> <span className="font-mono font-bold text-amber-700">{motoDetalhes.placa}</span></p>
                  <p><b>Possui CNH:</b> {motoDetalhes.possui_cnh === false ? 'NÃO' : 'SIM'}</p>
                  {motoDetalhes.possui_cnh !== false && (
                    <>
                      <p><b>Número CNH:</b> {motoDetalhes.numeroCnh || motoDetalhes.numero_cnh || '-'}</p>
                      <p><b>Categoria CNH:</b> {motoDetalhes.categoriaCnh || motoDetalhes.categoria_cnh || '-'}</p>
                      <p><b>Validade CNH:</b> {motoDetalhes.validadeCnh || motoDetalhes.validade_cnh || '-'}</p>
                    </>
                  )}
                </div>
              </div>

              {/* ETAPA 3: FOTOS E DOCUMENTOS ANEXADOS */}
              <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200/60 space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center gap-1.5 border-b border-slate-200 pb-2 mb-2">
                  <FileText className="w-4 h-4 text-emerald-600" /> Etapa 3: Arquivos e Documentos Enviados
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {/* Foto de Perfil */}
                  <div className="border border-slate-200 rounded-2xl p-3 bg-white space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">1. Foto de Perfil (Selfie)</span>
                    {motoDetalhes.foto ? (
                      motoDetalhes.foto === 'Anexado (Firestore)' ? (
                        <div className="p-3 bg-slate-50 rounded-xl text-[10px] text-slate-500 border border-slate-100 italic">Anexado no Banco (Base64)</div>
                      ) : (
                        <a href={motoDetalhes.foto} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-xl border border-slate-200">
                          <img src={motoDetalhes.foto} alt="Perfil" className="w-full h-24 object-cover hover:scale-105 transition-all" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-bold transition-all">Ampliar</div>
                        </a>
                      )
                    ) : (
                      <p className="text-[10px] text-red-500 font-bold">Pendente</p>
                    )}
                  </div>

                  {/* Foto da Moto */}
                  <div className="border border-slate-200 rounded-2xl p-3 bg-white space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">2. Foto da Moto</span>
                    {motoDetalhes.fotoMoto ? (
                      motoDetalhes.fotoMoto === 'Anexado (Firestore)' ? (
                        <div className="p-3 bg-slate-50 rounded-xl text-[10px] text-slate-500 border border-slate-100 italic">Anexado no Banco (Base64)</div>
                      ) : (
                        <a href={motoDetalhes.fotoMoto} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-xl border border-slate-200">
                          <img src={motoDetalhes.fotoMoto} alt="Veículo" className="w-full h-24 object-cover hover:scale-105 transition-all" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-bold transition-all">Ampliar</div>
                        </a>
                      )
                    ) : (
                      <p className="text-[10px] text-red-500 font-bold">Pendente</p>
                    )}
                  </div>

                  {/* Documento CNH */}
                  {motoDetalhes.possui_cnh !== false && (
                    <div className="border border-slate-200 rounded-2xl p-3 bg-white space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">3. Documento CNH</span>
                      {motoDetalhes.docCnh || motoDetalhes.foto_cnh ? (
                        (motoDetalhes.docCnh === 'Anexado (Firestore)' || motoDetalhes.foto_cnh === 'Anexado (Firestore)') ? (
                          <div className="p-3 bg-slate-50 rounded-xl text-[10px] text-slate-500 border border-slate-100 italic">Anexado no Banco (Base64)</div>
                        ) : (
                          <a href={motoDetalhes.docCnh || motoDetalhes.foto_cnh || undefined} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-xl border border-slate-200">
                            <img src={motoDetalhes.docCnh || motoDetalhes.foto_cnh || undefined} alt="CNH" className="w-full h-24 object-cover hover:scale-105 transition-all" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-bold transition-all">Ampliar</div>
                          </a>
                        )
                      ) : (
                        <p className="text-[10px] text-red-500 font-bold">Pendente</p>
                      )}
                    </div>
                  )}

                  {/* Documento RG/CPF */}
                  <div className="border border-slate-200 rounded-2xl p-3 bg-white space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">4. RG ou CPF</span>
                    {motoDetalhes.docRgCpf ? (
                      motoDetalhes.docRgCpf === 'Anexado (Firestore)' ? (
                        <div className="p-3 bg-slate-50 rounded-xl text-[10px] text-slate-500 border border-slate-100 italic">Anexado no Banco (Base64)</div>
                      ) : (
                        <a href={motoDetalhes.docRgCpf} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-xl border border-slate-200">
                          <img src={motoDetalhes.docRgCpf} alt="RG/CPF" className="w-full h-24 object-cover hover:scale-105 transition-all" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-bold transition-all">Ampliar</div>
                        </a>
                      )
                    ) : (
                      <p className="text-[10px] text-red-500 font-bold">Pendente</p>
                    )}
                  </div>

                  {/* Documento CRLV (Doc Moto) */}
                  <div className="border border-slate-200 rounded-2xl p-3 bg-white space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">5. Doc Moto (CRLV)</span>
                    {motoDetalhes.docMoto ? (
                      motoDetalhes.docMoto === 'Anexado (Firestore)' ? (
                        <div className="p-3 bg-slate-50 rounded-xl text-[10px] text-slate-500 border border-slate-100 italic">Anexado no Banco (Base64)</div>
                      ) : (
                        <a href={motoDetalhes.docMoto} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-xl border border-slate-200">
                          <img src={motoDetalhes.docMoto} alt="CRLV" className="w-full h-24 object-cover hover:scale-105 transition-all" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-bold transition-all">Ampliar</div>
                        </a>
                      )
                    ) : (
                      <p className="text-[10px] text-slate-400 font-medium">Não enviado (Opcional)</p>
                    )}
                  </div>

                  {/* Comprovante de Residência */}
                  {motoDetalhes.docResidencia && (
                    <div className="border border-slate-200 rounded-2xl p-3 bg-white space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">6. Comp. Residência</span>
                      {motoDetalhes.docResidencia === 'Anexado (Firestore)' ? (
                        <div className="p-3 bg-slate-50 rounded-xl text-[10px] text-slate-500 border border-slate-100 italic">Anexado no Banco (Base64)</div>
                      ) : (
                        <a href={motoDetalhes.docResidencia} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-xl border border-slate-200">
                          <img src={motoDetalhes.docResidencia} alt="Residência" className="w-full h-24 object-cover hover:scale-105 transition-all" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-bold transition-all">Ampliar</div>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {motoDetalhes.status_aprovacao === 'PENDENTE' && (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleAprovarMototaxista(motoDetalhes)}
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" /> APROVAR CADASTRO
                </button>
                <button
                  onClick={() => handleRejeitarMototaxista(motoDetalhes)}
                  className="flex-1 py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" /> REJEITAR CADASTRO
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => handleExcluirMototaxista(motoDetalhes.id, motoDetalhes.nome)}
                className="flex-1 py-3.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Trash2 className="w-4 h-4" /> Excluir Mototaxista Definitivamente
              </button>
              <button
                type="button"
                onClick={() => baixarFichaPDF(motoDetalhes)}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
              >
                <Printer className="w-4 h-4" /> Baixar Ficha Completa (PDF)
              </button>
              <button onClick={() => setMotoDetalhes(null)} className="px-6 py-3.5 bg-slate-900 text-white font-bold rounded-2xl text-xs cursor-pointer">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================================= */}
      {/* MODAL DETALHES DO CLIENTE SELECIONADO */}
      {/* ================================================================================= */}
      {clienteDetalhes && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in print:hidden">
          <div className="w-full max-w-3xl bg-white rounded-[36px] shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <img src={clienteDetalhes.foto || ''} alt="" className="w-16 h-16 rounded-2xl object-cover bg-slate-200 shrink-0" />
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">{clienteDetalhes.nome}</h3>
                  <p className="text-xs text-slate-500 font-semibold">{clienteDetalhes.email || 'Sem e-mail cadastrado'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setClienteDetalhes(null)} className="p-1.5 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
            </div>

            <div className="space-y-6">
              {/* ETAPA 1: DADOS PESSOAIS E DE CONTATO */}
              <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200/60 space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center gap-1.5 border-b border-slate-200 pb-2 mb-2">
                  <Users className="w-4 h-4 text-yellow-600" /> Dados Pessoais e de Contato
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                  <p><b>Nome Completo:</b> {clienteDetalhes.nome}</p>
                  <p><b>RG / CPF:</b> {clienteDetalhes.rgCpf || '-'}</p>
                  <p><b>E-mail (Login):</b> {clienteDetalhes.email || '-'}</p>
                  <p><b>WhatsApp / Telefone:</b> {clienteDetalhes.telefone || '-'}</p>
                  <p><b>Data de Nascimento:</b> {formatToPtBrDate(clienteDetalhes.dataNascimento || '') || '-'}</p>
                </div>
              </div>

              {/* ETAPA 2: ENDEREÇO E LOCALIZAÇÃO */}
              <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200/60 space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center gap-1.5 border-b border-slate-200 pb-2 mb-2">
                  <MapPin className="w-4 h-4 text-yellow-600" /> Endereço e Localização
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
                  <p className="sm:col-span-2"><b>Endereço Principal:</b> {clienteDetalhes.endereco || '-'}</p>
                  <p><b>Bairro / Região:</b> {clienteDetalhes.bairro || '-'}</p>
                  <p><b>Ponto de Referência:</b> {clienteDetalhes.pontoReferencia || '-'}</p>
                  <p><b>Região Municipal:</b> {clienteDetalhes.regiaoMunicipal || '-'}</p>
                  <p><b>Cidade Base:</b> {clienteDetalhes.cidade || '-'}</p>
                </div>
              </div>

              {/* ETAPA 3: FOTOS E DOCUMENTOS ENVIADOS */}
              <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200/60 space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm tracking-tight flex items-center gap-1.5 border-b border-slate-200 pb-2 mb-2">
                  <FileText className="w-4 h-4 text-yellow-600" /> Fotos e Documentos Enviados
                </h4>

                <div className="max-w-xs">
                  {/* Foto de Perfil */}
                  <div className="border border-slate-200 rounded-2xl p-3 bg-white space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Foto de Perfil</span>
                    {clienteDetalhes.foto ? (
                      clienteDetalhes.foto === 'Anexado (Firestore)' ? (
                        <div className="p-3 bg-slate-50 rounded-xl text-[10px] text-slate-500 border border-slate-100 italic">Anexado no Banco (Base64)</div>
                      ) : (
                        <a href={clienteDetalhes.foto} target="_blank" rel="noopener noreferrer" className="block relative group overflow-hidden rounded-xl border border-slate-200">
                          <img src={clienteDetalhes.foto} alt="Perfil" className="w-full h-24 object-cover hover:scale-105 transition-all" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-bold transition-all">Ampliar</div>
                        </a>
                      )
                    ) : (
                      <p className="text-[10px] text-red-500 font-bold">Pendente</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  handleExcluirCliente(clienteDetalhes.id, clienteDetalhes.nome);
                  setClienteDetalhes(null);
                }}
                className="flex-1 py-3.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Trash2 className="w-4 h-4" /> Excluir Cliente Definitivamente
              </button>
              <button
                type="button"
                onClick={() => baixarClientePDF(clienteDetalhes)}
                className="flex-1 py-3.5 bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-black rounded-2xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
              >
                <Printer className="w-4 h-4" /> Baixar Ficha Completa (PDF)
              </button>
              <button onClick={() => setClienteDetalhes(null)} className="px-6 py-3.5 bg-slate-900 text-white font-bold rounded-2xl text-xs cursor-pointer">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* SEÇÃO OCULTA EXCLUSIVA PARA IMPRESSÃO EM PDF */}
      {motoDetalhes && (
        <div id="printable-ficha" className="hidden print:block bg-white p-8 font-sans text-slate-900 min-h-screen">
          {/* Cabeçalho Comercial */}
          <div className="border-b-4 border-emerald-600 pb-4 mb-6 flex justify-between items-end">
            <div>
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-emerald-600">Sistema Administrativo</span>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Ficha Cadastral do Mototaxista</h1>
              <p className="text-[10px] text-slate-500 mt-1">Gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-slate-900">MOTO<span className="text-emerald-600">TÁXI</span></span>
              <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Status: {motoDetalhes.status_aprovacao || 'APROVADO'}</p>
            </div>
          </div>

          {/* Grid Principal: Dados e Foto do Condutor */}
          <div className="grid grid-cols-3 gap-6 mb-6 break-inside-avoid">
            <div className="col-span-2 space-y-4">
              <h2 className="text-sm font-black text-slate-800 border-b border-slate-200 pb-1 uppercase tracking-wide">Dados Pessoais</h2>
              <table className="w-full text-xs text-slate-700">
                <tbody>
                  <tr className="border-b border-slate-100"><td className="py-1.5 font-bold w-1/3">Nome Completo:</td><td className="py-1.5 text-slate-900 font-medium">{motoDetalhes.nome}</td></tr>
                  <tr className="border-b border-slate-100"><td className="py-1.5 font-bold">CPF ou RG:</td><td className="py-1.5 text-slate-900 font-medium">{motoDetalhes.cpf || '-'}</td></tr>
                  <tr className="border-b border-slate-100"><td className="py-1.5 font-bold">WhatsApp:</td><td className="py-1.5 text-slate-900 font-medium">{motoDetalhes.whatsapp || motoDetalhes.telefone || '-'}</td></tr>
                  <tr className="border-b border-slate-100"><td className="py-1.5 font-bold">Data de Nascimento:</td><td className="py-1.5 text-slate-900 font-medium">{formatToPtBrDate(motoDetalhes.nascimento || '') || '-'}</td></tr>
                  <tr className="border-b border-slate-100"><td className="py-1.5 font-bold">Cidade Base:</td><td className="py-1.5 text-slate-900 font-medium">{motoDetalhes.cidade || '-'}</td></tr>
                  <tr className="border-b border-slate-100"><td className="py-1.5 font-bold">Bairro / Região:</td><td className="py-1.5 text-slate-900 font-medium">{motoDetalhes.bairro || '-'}</td></tr>
                  {motoDetalhes.endereco && (
                    <tr className="border-b border-slate-100"><td className="py-1.5 font-bold">Endereço Completo:</td><td className="py-1.5 text-slate-900 font-medium">{motoDetalhes.endereco}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Foto de Perfil na Ficha */}
            <div className="col-span-1 flex flex-col items-center justify-center border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
              <span className="text-[9px] font-bold text-slate-400 uppercase mb-2">Foto de Perfil</span>
              {motoDetalhes.foto && motoDetalhes.foto !== 'Anexado (Firestore)' ? (
                <img src={motoDetalhes.foto} alt="Perfil" className="w-32 h-32 rounded-xl object-cover border border-slate-200 shadow-sm" />
              ) : (
                <div className="w-32 h-32 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400 font-bold bg-white">Sem Foto</div>
              )}
            </div>
          </div>

          {/* Dados do Veículo e CNH */}
          <div className="grid grid-cols-2 gap-6 mb-6 break-inside-avoid">
            <div className="space-y-4">
              <h2 className="text-sm font-black text-slate-800 border-b border-slate-200 pb-1 uppercase tracking-wide">Dados do Veículo</h2>
              <table className="w-full text-xs text-slate-700">
                <tbody>
                  <tr className="border-b border-slate-100"><td className="py-1.5 font-bold w-1/2">Modelo da Moto:</td><td className="py-1.5 text-slate-900 font-medium">{motoDetalhes.modeloMoto || '-'}</td></tr>
                  <tr className="border-b border-slate-100"><td className="py-1.5 font-bold">Cor da Moto:</td><td className="py-1.5 text-slate-900 font-medium">{motoDetalhes.corMoto || '-'}</td></tr>
                  <tr className="border-b border-slate-100"><td className="py-1.5 font-bold">Placa da Moto:</td><td className="py-1.5 text-amber-700 font-mono font-bold uppercase">{motoDetalhes.placa}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-black text-slate-800 border-b border-slate-200 pb-1 uppercase tracking-wide">Dados da Habilitação (CNH)</h2>
              <table className="w-full text-xs text-slate-700">
                <tbody>
                  <tr className="border-b border-slate-100"><td className="py-1.5 font-bold w-1/2">Possui CNH:</td><td className="py-1.5 text-slate-900 font-medium">{motoDetalhes.possui_cnh === false ? 'NÃO' : 'SIM'}</td></tr>
                  {motoDetalhes.possui_cnh !== false && (
                    <>
                      <tr className="border-b border-slate-100"><td className="py-1.5 font-bold">Número CNH:</td><td className="py-1.5 text-slate-900 font-medium">{motoDetalhes.numeroCnh || motoDetalhes.numero_cnh || '-'}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-1.5 font-bold">Categoria CNH:</td><td className="py-1.5 text-slate-900 font-medium">{motoDetalhes.categoriaCnh || motoDetalhes.categoria_cnh || '-'}</td></tr>
                      <tr className="border-b border-slate-100"><td className="py-1.5 font-bold">Validade CNH:</td><td className="py-1.5 text-slate-900 font-medium">{motoDetalhes.validadeCnh || motoDetalhes.validade_cnh || '-'}</td></tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fotos e Documentos Enviados (Um abaixo do outro com page-break) */}
          <div className="space-y-4 mt-6">
            <h2 className="text-sm font-black text-slate-800 border-b border-slate-200 pb-1 uppercase tracking-wide">Documentos e Fotos Enviados</h2>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Foto da Moto */}
              {motoDetalhes.fotoMoto && motoDetalhes.fotoMoto !== 'Anexado (Firestore)' && (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col items-center break-inside-avoid">
                  <span className="text-[10px] font-bold text-slate-600 uppercase mb-2">Foto da Moto</span>
                  <img src={motoDetalhes.fotoMoto} alt="Foto da Moto" className="max-h-48 object-contain rounded-xl border border-slate-200 bg-white" />
                </div>
              )}

              {/* Documento CNH */}
              {(motoDetalhes.docCnh || motoDetalhes.foto_cnh) && (motoDetalhes.docCnh !== 'Anexado (Firestore)' && motoDetalhes.foto_cnh !== 'Anexado (Firestore)') && (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col items-center break-inside-avoid">
                  <span className="text-[10px] font-bold text-slate-600 uppercase mb-2">Documento CNH</span>
                  <img src={motoDetalhes.docCnh || motoDetalhes.foto_cnh || undefined} alt="Documento CNH" className="max-h-48 object-contain rounded-xl border border-slate-200 bg-white" />
                </div>
              )}

              {/* RG ou CPF */}
              {motoDetalhes.docRgCpf && motoDetalhes.docRgCpf !== 'Anexado (Firestore)' && (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col items-center break-inside-avoid">
                  <span className="text-[10px] font-bold text-slate-600 uppercase mb-2">RG ou CPF</span>
                  <img src={motoDetalhes.docRgCpf} alt="RG ou CPF" className="max-h-48 object-contain rounded-xl border border-slate-200 bg-white" />
                </div>
              )}

              {/* Doc Moto (CRLV) */}
              {motoDetalhes.docMoto && motoDetalhes.docMoto !== 'Anexado (Firestore)' && (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col items-center break-inside-avoid">
                  <span className="text-[10px] font-bold text-slate-600 uppercase mb-2">Documento da Moto (CRLV)</span>
                  <img src={motoDetalhes.docMoto} alt="Doc Moto (CRLV)" className="max-h-48 object-contain rounded-xl border border-slate-200 bg-white" />
                </div>
              )}

              {/* Comprovante de Residência */}
              {motoDetalhes.docResidencia && motoDetalhes.docResidencia !== 'Anexado (Firestore)' && (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex flex-col items-center break-inside-avoid">
                  <span className="text-[10px] font-bold text-slate-600 uppercase mb-2">Comprovante de Residência</span>
                  <img src={motoDetalhes.docResidencia} alt="Comprovante de Residência" className="max-h-48 object-contain rounded-xl border border-slate-200 bg-white" />
                </div>
              )}
            </div>
          </div>

          {/* Rodapé de Assinatura / Termo */}
          <div className="mt-10 border-t border-slate-200 pt-6 text-center text-[10px] text-slate-400 break-inside-avoid">
            <p>Declaro para os devidos fins que os dados acima foram fornecidos pelo profissional e revisados pela administração.</p>
            <div className="flex justify-around mt-8">
              <div className="border-t border-slate-300 w-1/3 pt-2 text-center">
                <p className="font-bold text-slate-600">Assinatura do Administrador</p>
              </div>
              <div className="border-t border-slate-300 w-1/3 pt-2 text-center">
                <p className="font-bold text-slate-600">Assinatura do Mototaxista</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Customizado de Confirmação de Exclusão */}
      {confirmDeleteModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-[28px] max-w-md w-full p-6 shadow-xl border border-slate-100 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-3 bg-red-50 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 leading-tight">Confirmar Exclusão</h3>
                <p className="text-xs text-slate-500">Esta ação é irreversível</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Tem certeza que deseja excluir permanentemente o perfil de <strong>{confirmDeleteModal.userName}</strong> ({confirmDeleteModal.userRole === 'mototaxista' ? 'Mototaxista' : 'Cliente'})?
              {confirmDeleteModal.userRole === 'mototaxista' 
                ? ' Esta ação removerá completamente o acesso ao sistema, impedirá novos logins e colocará os dados cadastrados na lista de restrições.' 
                : ' Esta ação removerá o acesso ao aplicativo permanentemente.'}
            </p>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setConfirmDeleteModal({ isOpen: false, userId: '', userName: '', userRole: 'mototaxista' })}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={executarExclusao}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl text-xs cursor-pointer shadow-sm shadow-red-100 transition-all"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
