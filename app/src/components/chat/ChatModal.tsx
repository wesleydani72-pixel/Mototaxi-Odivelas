import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { firestore } from '../../lib/firebase';
import { Mensagem } from '../../types';
import { MessageSquare, Send, X } from 'lucide-react';

interface ChatModalProps {
  rideId: string;
  senderId: string;
  senderName: string;
  onClose: () => void;
  disabled?: boolean; // When the ride is finished or cancelled
}

export function ChatModal({ rideId, senderId, senderName, onClose, disabled = false }: ChatModalProps) {
  const [messages, setMessages] = useState<Mensagem[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!firestore || !rideId) return;

    // Bypassing composite index by doing local sort
    const q = query(
      collection(firestore, 'mensagens'),
      where('id_corrida', '==', rideId)
    );

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

      // Sort messages locally by timestamp
      list.sort((a, b) => {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });

      setMessages(list);
    }, (error) => {
      console.error('Erro ao escutar mensagens:', error);
    });

    return () => unsubscribe();
  }, [rideId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !firestore || disabled) return;

    const messageText = inputText.trim();
    setInputText('');

    try {
      await addDoc(collection(firestore, 'mensagens'), {
        id_corrida: rideId,
        id_remetente: senderId,
        nome_remetente: senderName,
        texto: messageText,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      alert('Erro ao enviar mensagem. Tente novamente.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[550px] border border-slate-100">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-yellow-400 rounded-xl text-slate-950 animate-pulse">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base">Chat em Tempo Real</h3>
              <p className="text-[10px] text-yellow-400 font-bold tracking-wider uppercase">Corrida #{rideId.replace('ride_', '')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
          {disabled && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-center text-xs font-semibold text-amber-800">
              ⚠️ Esta corrida foi concluída ou cancelada. O chat está desativado para novas mensagens.
            </div>
          )}

          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2 py-12">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 animate-bounce">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500">Nenhuma mensagem ainda</p>
                <p className="text-[11px] text-slate-400 max-w-xs">Envie uma mensagem para iniciar o contato em tempo real!</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.id_remetente === senderId;
              const formattedTime = new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className={`max-w-[80%] rounded-2xl p-3.5 ${
                    isMe
                      ? 'bg-yellow-400 text-slate-950 rounded-tr-none'
                      : 'bg-white text-slate-800 rounded-tl-none border border-slate-200/80'
                  }`}>
                    {!isMe && (
                      <p className="text-[10px] font-black text-yellow-600 mb-0.5 uppercase tracking-wide">
                        {msg.nome_remetente}
                      </p>
                    )}
                    <p className="text-xs sm:text-sm font-medium leading-relaxed break-words">
                      {msg.texto}
                    </p>
                    <p className={`text-[9px] text-right mt-1 font-semibold ${isMe ? 'text-slate-800' : 'text-slate-400'}`}>
                      {formattedTime}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={disabled ? "Chat desativado" : "Digite sua mensagem..."}
            disabled={disabled}
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={disabled || !inputText.trim()}
            className="p-3.5 bg-yellow-400 hover:bg-yellow-500 disabled:bg-slate-100 disabled:text-slate-400 text-slate-950 rounded-2xl shadow-sm hover:shadow transition-all flex items-center justify-center cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
