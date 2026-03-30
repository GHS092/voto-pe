import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Bot, ChevronRight, Search, Globe, Loader2, Copy, Share2, Check, Volume2, VolumeX } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { Share } from '@capacitor/share';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

interface ChatMessageProps {
  message: Message;
  onSendMessage?: (text: string) => void;
  isDebateMode?: boolean;
  selectedVoiceIndex?: number;
}

export function ChatMessage({ message, onSendMessage, isDebateMode = false, selectedVoiceIndex = -1 }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    return () => {
      TextToSpeech.stop().catch(() => {});
      isPlayingRef.current = false;
    };
  }, []);

  // Parse suggested questions if present
  const splitMarker = '### 🔍 Preguntas sugeridas:';
  const hasQuestions = message.content.includes(splitMarker);
  
  let mainText = message.content;
  let questions: string[] = [];
  
  if (hasQuestions && !isUser) {
    const parts = message.content.split(splitMarker);
    mainText = parts[0];
    const questionsText = parts[1];
    
    // Extract questions using regex
    const questionMatches = questionsText.match(/\d+\.\s*(.+)/g);
    if (questionMatches) {
      questions = questionMatches.map(q => 
        q.replace(/^\d+\.\s*/, '').replace(/[*_]/g, '').trim()
      );
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(mainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        title: 'Voto Informado Perú',
        text: mainText,
        dialogTitle: 'Compartir información'
      });
    } catch (error) {
      console.log('Error compartiendo con Capacitor', error);
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: 'Voto Informado Perú',
            text: mainText,
          });
        } catch(e) { handleCopy(); }
      } else {
        handleCopy(); 
      }
    }
  };

  const toggleSpeech = async () => {
    if (isPlayingRef.current) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      try {
        await TextToSpeech.stop();
      } catch(e) {}
    } else {
      isPlayingRef.current = true;
      setIsPlaying(true);
      try {
        await TextToSpeech.stop(); // Stop any pending speech
      } catch(e) {}
      
      // Create a clean version of the text without markdown or emojis for reading
      const cleanText = mainText
        .replace(/[#*`_~]/g, '') // Remove markdown characters
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with just their text
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, ''); // Remove emojis

      // Dividir el texto largo en oraciones para evitar el límite de caracteres del TTS nativo
      const sentences = cleanText.match(/[^.!?\n]+[.!?\n]+/g) || [cleanText];

      try {
        for (const sentence of sentences) {
          if (!isPlayingRef.current) break; // Si el usuario detuvo la reproducción
          
          await TextToSpeech.speak({
            text: sentence.trim(),
            lang: 'es-ES',
            rate: 1.0,
            pitch: 1.0,
            volume: 1.0,
            voice: selectedVoiceIndex >= 0 ? selectedVoiceIndex : undefined,
            category: 'ambient',
          });
        }
      } catch (error) {
        console.error("Error reproduciendo voz:", error);
      } finally {
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
    }
  };

  const MarkdownComponents: any = {
    h1: ({node, ...props}: any) => <h1 className="text-black font-extrabold text-xl sm:text-2xl mt-5 sm:mt-6 mb-3 sm:mb-4" {...props} />,
    h2: ({node, ...props}: any) => <h2 className="text-black font-bold text-lg sm:text-xl mt-4 sm:mt-5 mb-2 sm:mb-3" {...props} />,
    h3: ({node, ...props}: any) => {
      const text = String(props.children);
      if (text.includes('🚨') || text.toLowerCase().includes('antecedentes') || text.toLowerCase().includes('ilegal') || text.toLowerCase().includes('corrupción')) {
        return <h3 className="text-red-700 font-bold text-base sm:text-lg mt-4 sm:mt-5 mb-2 border-b-2 border-red-200 pb-1 flex items-center gap-2" {...props} />
      }
      return <h3 className="text-black font-bold text-base sm:text-lg mt-4 sm:mt-5 mb-2" {...props} />
    },
    strong: ({node, ...props}: any) => {
      const text = String(props.children);
      const dangerWords = [
        'corrupción', 'fraude', 'ilegal', 'delito', 'lavado', 'cárcel', 'prisión', 
        'investigación', 'sentencia', 'crimen', 'ilícito', 'soborno', 'cohecho',
        'pro crimen', 'mafia', 'blindaje', 'impunidad', 'extorsión', 'sicariato',
        'organización criminal', 'traición'
      ];
      const isDanger = dangerWords.some(word => text.toLowerCase().includes(word));
      
      if (isDanger) {
        return <strong className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded border border-red-200 shadow-sm mx-0.5" {...props} />
      }
      return <strong className="font-bold text-slate-900" {...props} />
    },
    p: ({node, ...props}: any) => <p className="mb-3 text-slate-700 leading-relaxed" {...props} />,
    ul: ({node, ...props}: any) => <ul className="list-disc pl-4 sm:pl-5 mb-4 space-y-1 text-slate-700" {...props} />,
    ol: ({node, ...props}: any) => <ol className="list-decimal pl-4 sm:pl-5 mb-4 space-y-1 text-slate-700" {...props} />,
    li: ({node, ...props}: any) => <li className="pl-1" {...props} />,
    a: ({node, ...props}: any) => <a className="text-blue-600 hover:text-blue-800 underline font-medium break-words" {...props} />,
  };

  return (
    <div
      className={cn(
        "flex w-full py-4 sm:py-6 px-3 sm:px-8",
        isUser ? "bg-slate-50" : "bg-white border-b border-slate-100"
      )}
    >
      <div className="max-w-4xl mx-auto flex w-full gap-3 sm:gap-6">
        <div className="flex-shrink-0 mt-0.5 sm:mt-1">
          {isUser ? (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 flex items-center justify-center text-white">
              <User size={16} className="sm:w-[18px] sm:h-[18px]" />
            </div>
          ) : (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-red-700 flex items-center justify-center text-white shadow-sm">
              <Bot size={16} className="sm:w-[18px] sm:h-[18px]" />
            </div>
          )}
        </div>
        
        <div className="flex-1 space-y-1.5 sm:space-y-2 overflow-hidden">
          <div className="font-semibold text-xs sm:text-sm text-slate-800">
            {isUser ? 'Tú' : 'Voto Informado Perú'}
          </div>
          <div className="prose-custom max-w-none text-sm sm:text-base">
            {!isUser && message.isStreaming && message.content === '' ? (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-3 py-2"
              >
                <div className="flex items-center gap-3 text-red-700 font-medium">
                  <motion.div
                    animate={{ 
                      rotate: 360,
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ 
                      rotate: { duration: 4, repeat: Infinity, ease: "linear" },
                      scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                    }}
                    className="bg-red-50 p-2 rounded-full"
                  >
                    <Globe size={20} />
                  </motion.div>
                  <span className="text-sm tracking-tight">Realizando búsqueda en tiempo real...</span>
                </div>
                
                <div className="flex gap-1.5 ml-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ 
                        opacity: [0.3, 1, 0.3],
                        scale: [1, 1.2, 1]
                      }}
                      transition={{ 
                        duration: 1.5, 
                        repeat: Infinity, 
                        delay: i * 0.2,
                        ease: "easeInOut" 
                      }}
                      className="w-2 h-2 bg-red-600 rounded-full"
                    />
                  ))}
                </div>
                
                <p className="text-xs text-slate-500 italic ml-1">
                  Consultando registros públicos y noticias actuales para brindarte información veraz.
                </p>
              </motion.div>
            ) : (
              <>
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={MarkdownComponents}
                >
                  {mainText}
                </ReactMarkdown>
                {message.isStreaming && !hasQuestions && (
                  <span className="inline-block w-2 h-4 ml-1 bg-slate-400 animate-pulse" />
                )}
              </>
            )}
          </div>

          {!isUser && !message.isStreaming && mainText && (
            <div className="flex flex-wrap items-center gap-4 mt-2 mb-2">
              <button
                onClick={toggleSpeech}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium transition-colors px-2 py-1 rounded-md border",
                  isPlaying 
                    ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" 
                    : "bg-transparent text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700"
                )}
                title="Escuchar respuesta"
              >
                {isPlaying ? (
                  <>
                    <VolumeX size={14} />
                    Detener lectura
                  </>
                ) : (
                  <>
                    <Volume2 size={14} />
                    Escuchar
                  </>
                )}
              </button>
              <button 
                onClick={handleCopy} 
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors py-1"
                title="Copiar al portapapeles"
              >
                {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                {copied ? <span className="text-green-600">Copiado</span> : 'Copiar'}
              </button>
              <button 
                onClick={handleShare} 
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors py-1"
                title="Compartir"
              >
                <Share2 size={14} />
                Compartir
              </button>
            </div>
          )}
          
          {/* Render Suggested Questions as Clickable Buttons */}
          {questions.length > 0 && !message.isStreaming && !isDebateMode && (
            <div className="mt-5 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-100">
              <p className="text-xs sm:text-sm font-semibold text-slate-500 mb-2 sm:mb-3 flex items-center gap-2">
                <span className="text-blue-600">💡</span> Sugerencias para continuar:
              </p>
              <div className="flex flex-col gap-2">
                {questions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSendMessage && onSendMessage(q)}
                    className="text-left flex items-start gap-2 p-2.5 sm:p-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-100 text-blue-800 text-xs sm:text-sm transition-colors group"
                  >
                    <ChevronRight size={16} className="mt-0.5 flex-shrink-0 text-blue-400 group-hover:text-blue-600" />
                    <span className="font-medium leading-snug">{q}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
