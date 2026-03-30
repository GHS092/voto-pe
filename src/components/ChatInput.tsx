import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSendMessage, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
      // Reset height immediately after sending
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to auto to correctly calculate scrollHeight
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      // Set new height based on scrollHeight, with a max of 150px
      textareaRef.current.style.height = `${Math.min(scrollHeight, 150)}px`;
    }
  }, [input]);

  return (
    <div className="bg-white border-t border-slate-200 p-3 sm:p-4 shrink-0 pb-safe">
      <div className="max-w-4xl mx-auto relative">
        <form
          onSubmit={handleSubmit}
          className="relative bg-white border border-slate-300 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-red-700 focus-within:border-transparent transition-all overflow-hidden flex items-end"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu pregunta sobre un candidato..."
            className="w-full max-h-[150px] py-3.5 sm:py-4 pl-4 pr-[50px] sm:pr-[60px] bg-transparent border-none focus:ring-0 resize-none outline-none text-sm sm:text-base text-slate-800 placeholder:text-slate-400 leading-normal scrollbar-hide"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-1.5 bottom-1.5 sm:right-2 sm:bottom-2 h-[36px] w-[36px] sm:h-[40px] sm:w-[40px] rounded-xl text-white bg-red-700 hover:bg-red-800 disabled:bg-slate-100 disabled:text-slate-400 transition-all flex items-center justify-center shadow-sm shrink-0"
          >
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.5, rotate: 180 }}
                  transition={{ duration: 0.2 }}
                >
                  <Loader2 size={18} className="sm:w-[20px] sm:h-[20px] animate-spin" />
                </motion.div>
              ) : (
                <motion.div
                  key="send"
                  initial={{ opacity: 0, scale: 0.5, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.5, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Send size={18} className="sm:w-[20px] sm:h-[20px] ml-0.5" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </form>
        <div className="text-center mt-2 px-2">
          <p className="text-[10px] sm:text-xs text-slate-500 leading-tight">
            La información proporcionada es neutral y basada en hechos públicos. La decisión final de voto es tuya.
          </p>
        </div>
      </div>
    </div>
  );
}
