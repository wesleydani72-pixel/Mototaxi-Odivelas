export type UserRole = 'admin' | 'mototaxista' | 'cliente';

export interface BaseUser {
  id: string;
  role: UserRole;
  nome: string;
  email?: string;
  telefone: string;
  foto?: string;
  status: 'ativo' | 'inativo' | 'bloqueado';
  passwordCreated: boolean;
  senha?: string;
  senha_hash?: string;
  criadoEm: string;
  latitude?: number;
  longitude?: number;
  enderecoConvertido?: string;
}

export interface AdminUser extends BaseUser {
  role: 'admin';
  email: string;
}

export interface MototaxistaUser extends BaseUser {
  role: 'mototaxista';
  placa: string; // Login principal
  modeloMoto: string;
  corMoto: string;
  fotoMoto?: string;
  cidade: string;
  bairro: string;
  endereco?: string;
  whatsapp?: string;
  disponibilidade: 'disponivel' | 'ocupado' | 'indisponivel';
  status_aprovacao?: 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'BLOQUEADO';
  totalCorridas: number;
  ganhosHoje: number;
  ganhosSemana: number;
  ganhosMes: number;
  avaliacao: number;

  // Campos do novo fluxo autônomo e de aprovação
  senha_hash?: string;
  nascimento?: string;
  cpf?: string;
  status_cadastro?: 'Cadastro Incompleto' | 'Aguardando Aprovação' | 'Aprovado' | 'Bloqueado' | 'CADASTRO PENDENTE DE CORREÇÃO';
  data_cadastro?: string;
  data_aprovacao?: string;
  aprovado_por?: string;
  motivo_reprovacao?: string;
  bloqueado_em?: string;

  // Documentos e CNH
  possui_cnh?: boolean;
  numeroCnh?: string | null;
  categoriaCnh?: string | null;
  validadeCnh?: string | null;
  docCnh?: string | null;
  numero_cnh?: string | null;
  categoria_cnh?: string | null;
  validade_cnh?: string | null;
  foto_cnh?: string | null;
  docRgCpf?: string;
  docMoto?: string;
  docResidencia?: string;
}

export interface ClienteUser extends BaseUser {
  role: 'cliente';
  email: string; // Login principal
  cidade: string;
  bairro: string;
  endereco: string;
  pontoReferencia: string;
  cadastroCompleto: boolean;
  regiaoMunicipal?: string;
  dataNascimento?: string;
  rgCpf?: string;
  docRgCpf?: string; // foto do documento
  docRgCpfFrente?: string; // Foto da frente do RG/CPF
  docRgCpfVerso?: string; // Foto do verso do RG/CPF
}

export type AnyUser = AdminUser | MototaxistaUser | ClienteUser;

export type RideStatus =
  | 'aguardando'
  | 'mototaxista_localizado'
  | 'aceita'
  | 'indo_ao_cliente'
  | 'mototaxista_a_caminho'
  | 'mototaxista_chegou'
  | 'cliente_embarcou'
  | 'em_viagem'
  | 'corrida_em_andamento'
  | 'finalizada'
  | 'cancelada'
  | 'SOLICITADA'
  | 'AGUARDANDO_MOTORISTA'
  | 'ACEITA'
  | 'MOTORISTA_A_CAMINHO'
  | 'PASSAGEIRO_EMBARCADO'
  | 'EM_CORRIDA'
  | 'FINALIZADA'
  | 'CANCELADA';

export interface Ride {
  id: string;
  clienteId: string;
  clienteNome: string;
  clienteFoto?: string;
  clienteTelefone: string;
  origem: string;
  refOrigem?: string;
  fotoOrigem?: string;
  regiaoOrigem?: string; // Região da Origem
  destino?: string;
  regiaoDestino?: string; // Região do Destino
  distanciaKm: number;
  tempoEstimadoMin: number;
  valorEstimado: number;
  turno?: 'Manhã' | 'Tarde' | 'Noite' | 'Madrugada';
  
  // Mototaxista alocado
  mototaxistaId?: string;
  mototaxistaNome?: string;
  mototaxistaFoto?: string;
  mototaxistaFotoMoto?: string;
  mototaxistaTelefone?: string;
  mototaxistaMoto?: string;
  mototaxistaPlaca?: string;

  status: RideStatus;
  recusadoPor: string[]; // IDs dos mototaxistas que recusaram esta chamada
  tempoChegadaEstimado?: string; // Tempo estimado de chegada informado pelo mototaxista (e.g. "5 min")
  
  // Campos de Zona Rural / Cidade Vizinha
  isZonaRural?: boolean;
  detalhesZonaRural?: string;
  valorAdicionalZonaRural?: number;
  clienteConfirmouValor?: boolean;

  // Campos de Encomenda / Entrega
  isEntrega?: boolean;
  entregaTipo?: 'levar' | 'buscar';
  itemTransportado?: string;
  destinatarioNome?: string;
  fotoEncomenda?: string;
  
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  criadoEm: number; // timestamp
  atualizadoEm: number;

  // Campos para histórico, auditoria e fechamento diário
  data_operacional?: string; // YYYY-MM-DD
  hora_corrida?: string; // HH:MM
  periodo_fechado?: boolean;
  status_auditoria?: 'pendente' | 'aprovado' | 'revisado';
  inicio_rastreamento?: string;
}

export interface RelatorioDiario {
  id: string;
  data: string; // YYYY-MM-DD
  total_corridas: number;
  total_canceladas: number;
  total_finalizadas: number;
  valor_total: number;
  taxa_total: number;
  status: 'ABERTO' | 'FECHADO';
}

export interface NotificationItem {
  id: string;
  destinatarioId: string; // ID do usuário ou 'all_drivers' ou 'admin'
  destinatarioRole?: UserRole;
  titulo: string;
  mensagem: string;
  tipo: 'nova_corrida' | 'corrida_aceita' | 'corrida_atualizada' | 'alerta' | 'sucesso';
  lida: boolean;
  dataHora: string;
  rideId?: string;
}

export interface SystemLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  acao: string;
  detalhe: string;
  dataHora: string;
}

export type TurnoTipo = string;

export interface Tarifa {
  id: string;
  turno: TurnoTipo;
  hora_inicio: string;
  hora_fim: string;
  valor: number;
  status: boolean;
  created_at: string;
  updated_at: string;
  regiaoOrigem?: string;
  regiaoDestino?: string;
}

export interface SystemConfig {
  tarifaBase: number;
  precoKm: number;
  taxaAdminPercentual: number;
  raioBuscaKm: number;
  cidadePadrao: string;
  tarifas?: Tarifa[];
  blacklistedLogins?: string[]; // Placas ou emails de usuários excluídos definitivamente
}

export interface Mensagem {
  id: string;
  id_corrida: string;
  id_remetente: string;
  nome_remetente: string;
  texto: string;
  timestamp: string;
}

