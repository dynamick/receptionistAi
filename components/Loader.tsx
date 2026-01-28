
import React, { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';

const Loader: React.FC = () => {
  const { active, progress } = useProgress();
  const [show, setShow] = useState(false);

  // Evitiamo flash veloci per caricamenti quasi istantanei
  useEffect(() => {
    if (active) {
      setShow(true);
    } else {
      const timeout = setTimeout(() => setShow(false), 500);
      return () => clearTimeout(timeout);
    }
  }, [active]);

  if (!show) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md transition-opacity duration-500">
      <div className="w-64 md:w-80 space-y-6 text-center">
        {/* Logo/Icon placeholder */}
        <div className="relative w-20 h-20 mx-auto mb-8">
          <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
          <div 
            className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin"
            style={{ animationDuration: '1.5s' }}
          ></div>
          <div className="absolute inset-0 flex items-center justify-center text-indigo-400 font-bold">
            {Math.round(progress)}%
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">Preparazione Avatar</h2>
          <p className="text-slate-400 text-sm animate-pulse">
            Caricamento risorse 3D e animazioni in corso...
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
          <div 
            className="h-full bg-indigo-500 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="text-[10px] text-slate-500 uppercase tracking-widest pt-4">
          Powered by Gemini 2.5 & Three.js
        </div>
      </div>
    </div>
  );
};

export default Loader;
