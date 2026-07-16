import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ZoomIn, ZoomOut, RotateCw, Download, RefreshCw, Maximize } from 'lucide-react';

interface ImageLightboxProps {
  src: string | null;
  alt: string;
  onClose: () => void;
  isAdmin?: boolean;
}

export function ImageLightbox({ src, alt, onClose, isAdmin = false }: ImageLightboxProps) {
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Escape key support to close lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!src) return null;

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.5, 1));
    // Reset position if zoomed out to 1
    if (scale <= 1.5) {
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = alt.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'imagem';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md select-none"
        onClick={onClose}
      >
        {/* Top Header Controls */}
        <div 
          className="absolute top-0 inset-x-0 h-16 flex items-center justify-between px-6 bg-gradient-to-b from-black/60 to-transparent text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col">
            <span className="text-sm font-black tracking-wide text-slate-100 uppercase truncate max-w-[200px] sm:max-w-md">
              {alt || 'Visualização de Imagem'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {scale.toFixed(1)}x • {rotation}° Rotacionado
            </span>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleZoomOut}
              disabled={scale <= 1}
              className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Afastar (-)"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <button
              onClick={handleZoomIn}
              disabled={scale >= 4}
              className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Aproximar (+)"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              onClick={handleRotate}
              className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 transition-all"
              title="Rotacionar (90°)"
            >
              <RotateCw className="w-5 h-5" />
            </button>
            <button
              onClick={handleReset}
              className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 transition-all"
              title="Resetar"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            {isAdmin && (
              <button
                onClick={handleDownload}
                className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 transition-all"
                title="Baixar Imagem"
              >
                <Download className="w-5 h-5" />
              </button>
            )}
            <div className="w-px h-6 bg-slate-800 mx-1" />
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-red-950/60 hover:bg-red-900 text-red-200 hover:text-white border border-red-900/50 transition-all"
              title="Fechar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div 
          className="w-full h-full flex items-center justify-center p-4 sm:p-12 overflow-hidden"
          onClick={onClose}
        >
          <motion.div
            drag={scale > 1}
            dragConstraints={{ left: -500 * scale, right: 500 * scale, top: -500 * scale, bottom: 500 * scale }}
            dragElastic={0.1}
            dragMomentum={true}
            onDrag={(event, info) => {
              setPosition(prev => ({
                x: prev.x + info.delta.x,
                y: prev.y + info.delta.y
              }));
            }}
            style={{
              x: position.x,
              y: position.y,
            }}
            className="relative cursor-grab active:cursor-grabbing max-w-full max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.img
              src={src}
              alt={alt}
              style={{
                scale: scale,
                rotate: `${rotation}deg`,
              }}
              className="max-w-[90vw] max-h-[80vh] sm:max-w-[85vw] sm:max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/5 pointer-events-none transition-transform duration-200 ease-out"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: scale, opacity: 1 }}
              transition={{ 
                type: 'spring', 
                stiffness: 300, 
                damping: 30,
                // Avoid transition-transform conflicting with the React inline state for rotate/scale
                layout: true
              }}
            />
          </motion.div>
        </div>

        {/* Bottom instructions */}
        {isAdmin && (
          <div 
            className="absolute bottom-4 text-center pointer-events-none select-none px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] text-slate-500 font-medium">
              {scale > 1 ? 'Arraste para mover a imagem ampliada' : 'Clique na imagem para fechar • Role o mouse ou use os botões para dar zoom'}
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
