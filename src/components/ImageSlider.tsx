import React, { useState, useRef, useEffect } from 'react';

interface ImageSliderProps {
  before: string;
  after: string;
}

export const ImageSlider: React.FC<ImageSliderProps> = ({ before, after }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const position = ((clientX - rect.left) / rect.width) * 100;
    
    setSliderPosition(Math.min(Math.max(position, 0), 100));
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleMove(e.clientX);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        handleMove(e.touches[0].clientX);
      }
    };

    const onMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', onMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onMouseUp);
    };
  }, [isDragging]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
    >
      {/* After Image (Restored) */}
      <img 
        src={after} 
        alt="Restored" 
        className="absolute inset-0 w-full h-full object-contain"
        referrerPolicy="no-referrer"
      />
      
      {/* Before Image (Original) with Clip Path */}
      <div 
        className="absolute inset-0 w-full h-full overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img 
          src={before} 
          alt="Original" 
          className="absolute inset-0 w-full h-full object-contain bg-black"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Slider Line & Handle */}
      <div 
        className="absolute inset-y-0 w-1 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] z-10 no-pan cursor-col-resize"
        style={{ left: `${sliderPosition}%` }}
        onMouseDown={(e) => {
          e.stopPropagation();
          setIsDragging(true);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          setIsDragging(true);
        }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-white/20 hover:scale-110 transition-transform">
          <div className="flex gap-1.5">
            <div className="w-0.5 h-4 bg-gray-400 rounded-full" />
            <div className="w-0.5 h-4 bg-gray-400 rounded-full" />
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded text-xs text-white font-medium z-20">
        GỐC
      </div>
      <div className="absolute bottom-4 right-4 bg-blue-600/80 backdrop-blur-md px-3 py-1 rounded text-xs text-white font-medium z-20">
        PHỤC HỒI
      </div>
    </div>
  );
};
