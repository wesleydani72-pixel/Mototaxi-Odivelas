import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ClienteUser } from '../../types';
import { fileToBase64 } from '../../lib/db';
import { Camera, MapPin, Phone, User, Check, Sparkles } from 'lucide-react';

export function ClientCompleteProfile() {
  const { currentUser, completarCadastroCliente } = useAuth();
  const cli = currentUser as ClienteUser;

  const [nome, setNome] = useState(cli?.nome || '');
  const [telefone, setTelefone] = useState(cli?.telefone || '');
  const [cidade, setCidade] = useState(cli?.cidade && cli.cidade !== 'São Paulo' ? cli.cidade : 'São Caetano de Odivelas - PA');
  const [bairro, setBairro] = useState(cli?.bairro || '');
  const [endereco, setEndereco] = useState(cli?.endereco || '');
  const [pontoReferencia, setPontoReferencia] = useState(cli?.pontoReferencia || '');
  const [fotoBase64, setFotoBase64] = useState(cli?.foto || '');
  const [carregandoFoto, setCarregandoFoto] = useState(false);

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCarregandoFoto(true);
      try {
        const b64 = await fileToBase64(e.target.files[0]);
        setFotoBase64(b64);
      } catch (err) {
        console.error(err);
      } finally {
        setCarregandoFoto(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    completarCadastroCliente({
      nome,
      telefone,
      cidade,
      bairro,
      endereco,
      pontoReferencia,
      foto: fotoBase64 || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-sans text-slate-800">
      <div className="w-full max-w-xl bg-white rounded-[32px] shadow-xl border border-slate-200/80 p-8 sm:p-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-50 text-yellow-800 rounded-full text-xs font-bold mb-3 border border-yellow-200">
            <Sparkles className="w-3.5 h-3.5 text-yellow-600" />
            Quase lá!
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Complete seu Cadastro</h2>
          <p className="text-xs text-slate-500 mt-1">Para garantir sua segurança e agilidade no embarque.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Upload de Foto */}
          <div className="flex flex-col items-center">
            <div className="relative w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 overflow-hidden flex items-center justify-center group cursor-pointer hover:border-yellow-400 transition-colors">
              {fotoBase64 ? (
                <img src={fotoBase64} alt="Foto perfil" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-8 h-8 text-slate-400 group-hover:text-yellow-500 transition-colors" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFotoChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
            <span className="text-[11px] font-semibold text-slate-400 mt-2">
              {carregandoFoto ? 'Processando imagem...' : 'Toque para enviar sua foto (obrigatório)'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nome Completo
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                <input
                  type="text"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Telefone (WhatsApp)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                <input
                  type="text"
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Cidade *
              </label>
              <input
                type="text"
                value={cidade}
                readOnly
                disabled
                required
                className="w-full px-4 py-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none cursor-not-allowed text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Bairro Principal
              </label>
              <input
                type="text"
                value={bairro}
                onChange={e => setBairro(e.target.value)}
                placeholder="Ex: Centro"
                required
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Endereço Residencial
              </label>
              <input
                type="text"
                value={endereco}
                onChange={e => setEndereco(e.target.value)}
                placeholder="Ex: Rua das Flores, 120"
                required
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Ponto de Referência
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
                <input
                  type="text"
                  value={pontoReferencia}
                  onChange={e => setPontoReferencia(e.target.value)}
                  placeholder="Ex: Em frente à padaria Estrela"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm mt-8 cursor-pointer"
          >
            <Check className="w-5 h-5 font-bold" />
            Concluir Cadastro e Pedir Moto
          </button>
        </form>
      </div>
    </div>
  );
}
