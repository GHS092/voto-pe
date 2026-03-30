import React, { useState, useRef, useEffect } from 'react';
import { createPoliticalChat } from './services/gemini';
import { ChatMessage, Message } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { ShieldAlert, Info, Scale, Menu, X, MessageSquare, Trash2, Plus, Pin, Swords, Settings, Volume2 } from 'lucide-react';
import { GenerateContentResponse } from '@google/genai';

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  isPinned: boolean;
}

export default function App() {
  const [accessCode, setAccessCode] = useState(() => localStorage.getItem('voto-informado-access-code') || '');
  const [tempCodeInput, setTempCodeInput] = useState('');

  const submitAccessCode = () => {
    if (tempCodeInput.trim().toUpperCase().startsWith('GHS') && tempCodeInput.trim().length >= 7) {
      const code = tempCodeInput.trim().toUpperCase();
      setAccessCode(code);
      localStorage.setItem('voto-informado-access-code', code);
    } else {
      alert("Código inválido. Asegúrate de digitarlo correctamente (Ej: GHS1129)");
    }
  };

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('voto-informado-sessions');
    if (saved) return JSON.parse(saved);
    return [];
  });
  
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessions.length > 0 ? sessions[0].id : null);
  const [isLoading, setIsLoading] = useState(false);
  const [chatInstance, setChatInstance] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDebateMode, setIsDebateMode] = useState(() => {
    return localStorage.getItem('voto-informado-debate-mode') === 'true';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [voices, setVoices] = useState<any[]>([]);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState<number>(-1);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(s => s.id === currentSessionId);
  const messages = activeSession ? activeSession.messages : [];

  useEffect(() => {
    localStorage.setItem('voto-informado-debate-mode', String(isDebateMode));
  }, [isDebateMode]);

  useEffect(() => {
    if (!chatInstance) {
      setChatInstance(createPoliticalChat(isDebateMode));
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    localStorage.setItem('voto-informado-sessions', JSON.stringify(sessions));
  }, [sessions]);

  const loadVoices = async (isRetry = false) => {
    try {
      if (!isRetry) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      } else {
        setVoicesError(null);
      }
      
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
      const res = await TextToSpeech.getSupportedVoices();
      setVoices(res.voices);
      setVoicesError(null);
      
      let foundIndex = -1;
      const saved = localStorage.getItem('voto-informado-voice-idx');
      if (saved !== null) {
        foundIndex = parseInt(saved, 10);
      } else {
        foundIndex = res.voices.findIndex(v => v.lang.startsWith('es') && (v.name.toLowerCase().includes('premium') || v.name.toLowerCase().includes('enhanced') || v.voiceURI.toLowerCase().includes('premium')));
        if (foundIndex === -1) {
          foundIndex = res.voices.findIndex(v => v.lang.startsWith('es'));
        }
      }
      setSelectedVoiceIndex(foundIndex);
    } catch (e: any) {
      console.log("Error loading voices", e);
      setVoicesError("El motor TTS de este celular aún está arrancando, no respondió o bloqueó la lectura externa.");
    }
  };

  useEffect(() => {
    loadVoices();
  }, []);

  const saveSettings = (idx: number) => {
    setSelectedVoiceIndex(idx);
    localStorage.setItem('voto-informado-voice-idx', idx.toString());
  };

  const playVoicePreview = async (e: React.MouseEvent, idx: number, langTitle: string) => {
    e.stopPropagation();
    try {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
      await TextToSpeech.stop();
      await TextToSpeech.speak({
        text: `Hola, esta es la ${langTitle}.`,
        lang: 'es-ES',
        voice: idx,
        rate: 1.0,
      });
    } catch(err) {
      console.log('Error reproduciendo preview', err);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !chatInstance) return;

    let sessionId = currentSessionId;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    if (!sessionId) {
      sessionId = Date.now().toString();
      const newSession: ChatSession = {
        id: sessionId,
        title: text.length > 30 ? text.substring(0, 30) + '...' : text,
        messages: [userMessage],
        updatedAt: Date.now(),
        isPinned: false
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(sessionId);
    } else {
      setSessions(prev => prev.map(s => 
        s.id === sessionId 
          ? { ...s, messages: [...s.messages, userMessage], updatedAt: Date.now() } 
          : s
      ));
    }

    setIsLoading(true);
    const assistantMessageId = (Date.now() + 1).toString();
    
    setSessions(prev => prev.map(s => 
      s.id === sessionId 
        ? { ...s, messages: [...s.messages, { id: assistantMessageId, role: 'assistant', content: '', isStreaming: true }] } 
        : s
    ));

    try {
      const sessionForHistory = sessions.find(s => s.id === sessionId);
      const historyToPass = sessionForHistory ? sessionForHistory.messages.filter(m => !m.isStreaming && m.content) : [];

      const responseStream = await chatInstance.sendMessageStream({ 
        message: text,
        history: historyToPass
      });
      let fullResponse = '';
      for await (const chunk of responseStream) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          fullResponse += c.text;
          setSessions(prev => prev.map(s => 
            s.id === sessionId 
              ? { ...s, messages: s.messages.map(m => m.id === assistantMessageId ? { ...m, content: fullResponse } : m) }
              : s
          ));
        }
      }
      
      setSessions(prev => prev.map(s => 
        s.id === sessionId 
          ? { ...s, messages: s.messages.map(m => m.id === assistantMessageId ? { ...m, isStreaming: false } : m) }
          : s
      ));
      
    } catch (error: any) {
      console.error("Error sending message:", error);
      
      // Manejar el caso de bloqueo por el backend para que limpie el código si fue bloqueado
      if (error?.message?.includes("expulsado") || error?.message?.includes("bloqueado")) {
        setAccessCode('');
        localStorage.removeItem('voto-informado-access-code');
      }

      setSessions((prev) => prev.map(s => 
        s.id === sessionId 
          ? { 
              ...s, 
              messages: [
                ...s.messages.filter(msg => msg.id !== assistantMessageId),
                { id: assistantMessageId, role: 'assistant', content: 'Lo siento, tu código de acceso fue rechazado o bloqueado. Por favor, verifica en pantalla.' }
              ]
            }
          : s
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllHistory = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar TODO',
      message: '¿Estás seguro de vaciar la aplicación completa? Se borrarán todas las conversaciones. Esta acción no se puede deshacer.',
      onConfirm: () => {
        setSessions([]);
        setCurrentSessionId(null);
        setIsSidebarOpen(false);
      }
    });
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar chat',
      message: '¿Estás seguro de eliminar este chat para siempre?',
      onConfirm: () => {
        setSessions(prev => prev.filter(s => s.id !== id));
        if (currentSessionId === id) {
          setCurrentSessionId(null);
        }
      }
    });
  };

  const togglePin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => prev.map(s => s.id === id ? { ...s, isPinned: !s.isPinned } : s));
  };

  const createNewChat = () => {
    setCurrentSessionId(null);
    setIsSidebarOpen(false);
  };

  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.updatedAt - a.updatedAt;
  });

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans relative overflow-hidden">
      
      {/* ACCESS CODE OVERLAY */}
      {!accessCode && (
        <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-xl px-4">
          <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-sm text-center transform transition-all animate-in fade-in zoom-in-95 border border-slate-200/20">
            <div className="bg-red-50 text-red-600 p-5 rounded-full inline-flex mb-6 shadow-sm ring-1 ring-red-100">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">Acceso Premium</h2>
            <p className="text-sm text-slate-500 mb-8 px-2 font-medium">Esta aplicación opera en servidores dedicados. Ingresa tu código de invitación para continuar.</p>
            <input 
              type="text" 
              placeholder="Ej: GHS1129" 
              value={tempCodeInput}
              onChange={(e) => setTempCodeInput(e.target.value.toUpperCase().trim())}
              onKeyDown={(e) => e.key === 'Enter' && submitAccessCode()}
              className="w-full text-center text-xl font-mono font-bold tracking-[0.2em] p-4 border-2 border-slate-200 focus:border-red-500 rounded-xl outline-none mb-4 transition-colors text-slate-800 bg-slate-50 placeholder:text-slate-300"
              maxLength={10}
            />
            <button 
              onClick={submitAccessCode}
              className="w-full bg-slate-900 hover:bg-black text-white px-6 py-4 rounded-xl transition shadow-lg shadow-slate-900/20 font-bold tracking-wide uppercase text-sm flex items-center justify-center gap-2"
            >
              Cargar Módulo IA
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Sidebar Overlay */}

      {isSidebarOpen && (
        <div 
          className="absolute inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`absolute inset-y-0 left-0 w-64 sm:w-72 bg-slate-50 border-r border-slate-200 z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-4 border-b border-slate-200 flex items-center justify-between text-slate-800 bg-white">
          <div className="flex items-center gap-2 font-semibold">
            <MessageSquare size={18} />
            <h2>Historial</h2>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 bg-white">
          <button 
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-700 hover:bg-red-100 p-2.5 rounded-lg text-sm font-bold transition shadow-sm"
          >
            <Plus size={16} strokeWidth={2.5} />
            Nueva Conversación
          </button>
        </div>

        <div className="flex-1 overflow-y-auto w-full p-4 flex flex-col gap-3">
          {sortedSessions.length > 0 ? (
            sortedSessions.map((session) => (
              <div 
                key={session.id} 
                onClick={() => { setCurrentSessionId(session.id); setIsSidebarOpen(false); }}
                className={`p-3 rounded-xl border transition-colors cursor-pointer flex flex-col gap-2 ${currentSessionId === session.id ? 'bg-white border-red-200 shadow-sm ring-1 ring-red-100' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`}
              >
                <div className="flex items-start justify-between gap-2 overflow-hidden w-full">
                  <div className="min-w-0 flex-1 w-full overflow-hidden">
                    <p className={`truncate text-sm font-bold w-full ${currentSessionId === session.id ? 'text-red-800' : 'text-slate-700'}`}>
                      {session.title}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{session.messages.length} mensajes</p>
                  </div>
                  {session.isPinned && <Pin size={12} className="text-blue-500 fill-blue-50 shrink-0 mt-1" />}
                </div>
                
                {/* Flat Action Buttons */}
                <div className="flex items-center gap-4 mt-1 pt-2 border-t border-slate-100">
                  <button 
                    onClick={(e) => togglePin(e, session.id)}
                    className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${session.isPinned ? 'text-blue-600' : 'text-slate-400 hover:text-slate-700'}`}
                  >
                    <Pin size={13} className={session.isPinned ? 'fill-blue-100' : ''} />
                    {session.isPinned ? 'Desanclar' : 'Anclar'}
                  </button>
                  <button 
                    onClick={(e) => deleteSession(e, session.id)}
                    className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={13} />
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-slate-400 text-sm mt-10">
              No hay chats guardados.
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 mt-auto bg-white flex items-center gap-2">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 p-2.5 rounded-lg transition"
            title="Ajustes de Voz"
          >
            <Settings size={20} strokeWidth={2.5} />
          </button>
          <button 
            onClick={clearAllHistory}
            disabled={sessions.length === 0}
            className="flex-1 flex items-center justify-center gap-2 text-slate-500 hover:text-red-700 hover:bg-red-50 p-2.5 rounded-lg text-xs tracking-wide uppercase font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={16} strokeWidth={2.5} />
            Eliminar Todo
          </button>
        </div>
      </div>

      {/* Custom Confirm Dialog */}
      {confirmDialog.isOpen && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-xs transform transition-all animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-800 mb-2">{confirmDialog.title}</h3>
            <p className="text-sm text-slate-600 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog({ ...confirmDialog, isOpen: false });
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Dialog */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-sm transform transition-all animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Settings size={20} /> Ajustes de Voz
            </h3>
            <p className="text-sm text-slate-600 mb-4">Selecciona la voz narradora. Te recomendamos elegir una versión "Premium", "Enhanced" o "Network" para mayor calidad.</p>
            
            <div className="max-h-60 overflow-y-auto w-full border border-slate-200 rounded-lg mb-4">
              {voices.filter(v => v.lang.startsWith('es')).map((voice) => {
                const globalIndex = voices.indexOf(voice);
                const isSelected = globalIndex === selectedVoiceIndex;
                const isPremium = voice.name.toLowerCase().includes('premium') || voice.name.toLowerCase().includes('enhanced') || voice.voiceURI.toLowerCase().includes('network') || voice.voiceURI.toLowerCase().includes('premium');
                const voiceName = `${voice.name} (${globalIndex + 1})`;
                const uriDetails = voice.voiceURI ? voice.voiceURI.split('-').slice(-2).join('-') : '';
                
                return (
                  <div 
                    key={globalIndex}
                    onClick={() => saveSettings(globalIndex)}
                    className={`p-3 border-b border-slate-100 last:border-0 cursor-pointer flex justify-between items-center transition-colors gap-2 ${isSelected ? 'bg-red-50' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isSelected ? 'text-red-800' : 'text-slate-700'}`}>
                        {voiceName}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono truncate max-w-[160px]">{uriDetails || voice.voiceURI}</p>
                    </div>
                    <div className="flex flex-row items-center gap-2 shrink-0">
                      {isPremium && (
                        <span className="bg-yellow-100 text-yellow-800 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-md">
                          Premium
                        </span>
                      )}
                      <button 
                        onClick={(e) => playVoicePreview(e, globalIndex, `Voz número ${globalIndex + 1}`)}
                        className={`p-1.5 rounded-full transition-colors ${isSelected ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                        title="Probar voz individual"
                      >
                        <Volume2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {voicesError ? (
                <div className="p-4 text-center text-xs flex flex-col items-center gap-3 font-semibold text-amber-700 bg-amber-50 rounded-b-lg">
                  <p>{voicesError}</p>
                  <button 
                    onClick={() => loadVoices(true)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md shadow-sm transition-colors"
                  >
                    Reintentar conexión
                  </button>
                </div>
              ) : voices.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  Cargando voces o no disponibles...
                </div>
              ) : null}
            </div>
            
            <div className="flex gap-3 justify-end mt-2">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors shadow-sm w-full"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-red-700 text-white shadow-md z-10 shrink-0">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="text-white hover:bg-red-800 p-1 sm:p-1.5 rounded-lg transition"
            >
              <Menu size={24} />
            </button>
            <div className="bg-white p-1.5 sm:p-2 rounded-lg shrink-0">
              <Scale className="text-red-700 w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-lg sm:text-xl tracking-tight truncate">Voto Informado Perú</h1>
              <p className="text-red-100 text-[10px] sm:text-xs font-medium truncate">Asistente Electoral Neutral</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newValue = !isDebateMode;
                setIsDebateMode(newValue);
                setChatInstance(createPoliticalChat(newValue));
                
                if (newValue) {
                  const sessionId = Date.now().toString();
                  const introMessage: Message = {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: '⚔️ **Modo Debate Activado**\n\nHe asumido el rol de debatidor. Para empezar, dime:\n1. ¿De qué candidato quieres debatir?\n2. ¿Estás **a favor** o **en contra** de este candidato?\n\n*Tomaré la posición contraria a la tuya y debatiremos con datos y hechos reales.*'
                  };
                  const newSession: ChatSession = {
                    id: sessionId,
                    title: '⚔️ Debate',
                    messages: [introMessage],
                    updatedAt: Date.now(),
                    isPinned: false
                  };
                  setSessions(prev => [newSession, ...prev]);
                  setCurrentSessionId(sessionId);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors border ${
                isDebateMode 
                  ? "bg-red-900 border-red-950 text-white shadow-inner" 
                  : "bg-red-800 border-red-700 text-red-50 hover:bg-red-700"
              }`}
            >
              <Swords size={16} />
              <span className="hidden sm:inline">{isDebateMode ? 'Modo Debate: ON' : 'Modo Debate: OFF'}</span>
              <span className="sm:hidden">{isDebateMode ? 'Debate: ON' : 'Debate: OFF'}</span>
            </button>
            <div className="hidden md:flex items-center gap-2 text-red-100 text-sm bg-red-800 px-3 py-1.5 rounded-full shrink-0">
              <ShieldAlert size={16} />
              <span>Datos públicos</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto w-full scroll-smooth scrollbar-hide">
        {messages.length === 0 ? (
          <div className="min-h-full flex flex-col items-center justify-center py-12 px-4 sm:p-6 text-center max-w-2xl mx-auto">
            <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 mb-6 sm:mb-8 w-full mt-4 sm:mt-0">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">Bienvenido a Voto Informado</h2>
              <p className="text-sm sm:text-base text-slate-600 mb-5 sm:mb-6">
                Este asistente está diseñado para proporcionarte información objetiva, neutral y basada en hechos sobre los candidatos a la presidencia y al congreso del Perú.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-left">
                <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors">
                  <Info className="w-5 h-5 text-blue-600 mb-1.5 sm:mb-2" />
                  <h3 className="font-semibold text-slate-800 text-sm mb-1">Propuestas y Equipo</h3>
                  <p className="text-xs text-slate-600">Conoce los planes de gobierno y quiénes acompañan al candidato.</p>
                </div>
                <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-100 hover:border-amber-200 transition-colors">
                  <ShieldAlert className="w-5 h-5 text-amber-600 mb-1.5 sm:mb-2" />
                  <h3 className="font-semibold text-slate-800 text-sm mb-1">Antecedentes Legales</h3>
                  <p className="text-xs text-slate-600">Información transparente sobre investigaciones, juicios o actos ilícitos.</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 w-full">
              <button 
                onClick={() => handleSendMessage("¿Cuáles son los principales candidatos a la presidencia actualmente?")}
                className="bg-white border-2 border-slate-200 hover:border-red-600 hover:text-red-700 text-slate-700 font-semibold px-5 py-3 rounded-xl text-sm transition-colors w-full sm:w-auto shadow-sm"
              >
                ¿Quiénes son los candidatos?
              </button>
              <button 
                onClick={() => handleSendMessage("¿Qué debo tener en cuenta antes de decidir mi voto?")}
                className="bg-white border-2 border-slate-200 hover:border-red-600 hover:text-red-700 text-slate-700 font-semibold px-5 py-3 rounded-xl text-sm transition-colors w-full sm:w-auto shadow-sm"
              >
                ¿Cómo analizar mi voto?
              </button>
            </div>
          </div>
        ) : (
          <div className="pb-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} onSendMessage={handleSendMessage} isDebateMode={isDebateMode} selectedVoiceIndex={selectedVoiceIndex} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Input Area */}
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  );
}
