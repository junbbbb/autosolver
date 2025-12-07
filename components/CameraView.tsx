import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { CameraHandle } from '../types';

interface CameraViewProps {
  isActive: boolean;
}

const CameraView = forwardRef<CameraHandle, CameraViewProps>(({ isActive }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [minZoom, setMinZoom] = useState<number>(1);
  const [maxZoom, setMaxZoom] = useState<number>(1);
  const [supportsZoom, setSupportsZoom] = useState<boolean>(false);

  useImperativeHandle(ref, () => ({
    capture: () => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        // Set canvas dimensions to match video resolution exactly
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Draw the current frame
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Quality Optimization:
          // Increased to 0.8 and resolution to 1080p.
          // This provides clearer text edges for OCR while keeping file size manageable.
          return canvas.toDataURL('image/jpeg', 0.8); 
        }
      }
      return null;
    }
  }));

  // Zoom click handler for chips
  const handleZoomClick = async (targetZoom: number) => {
    // Clamp zoom value between min and max
    const newZoom = Math.min(Math.max(targetZoom, minZoom), maxZoom);
    setZoom(newZoom);

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      
      if (track) {
        try {
          // @ts-ignore - 'zoom' is part of advanced constraints in newer browsers
          await track.applyConstraints({ advanced: [{ zoom: newZoom }] });
        } catch (e) {
          console.warn("Zoom constraint failed:", e);
        }
      }
    }
  };

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.error("Camera API not supported in this environment");
          return;
        }

        // Resolution Optimization: Set to 1080p (FHD)
        // Better for screen reading than 720p, but faster than 2K.
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 }, 
            height: { ideal: 1080 },
            // @ts-ignore - specific property for some browsers
            advanced: [{ focusMode: "continuous" }]
          }
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Check for Zoom Capabilities
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();

        // @ts-ignore - 'zoom' property check
        if (capabilities.zoom) {
          setSupportsZoom(true);
          // @ts-ignore
          setMinZoom(capabilities.zoom.min || 1);
          // @ts-ignore
          setMaxZoom(capabilities.zoom.max || 10); // Limit max zoom logic if needed
          // @ts-ignore
          setZoom(track.getSettings().zoom || 1);
        } else {
          setSupportsZoom(false);
        }

      } catch (err) {
        console.error("Error accessing camera:", err);
        // Fallback to standard VGA if HD fails
        try {
             stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
            });
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (e) {
            console.error("Fallback failed", e);
        }
      }
    };

    if (isActive) {
      startCamera();
    } else {
      // Stop stream if inactive
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
        setSupportsZoom(false);
      }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive]);

  // Zoom presets: 0.7 to 1.5 with 0.1 increments
  const ZOOM_PRESETS = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5];

  return (
    <div className="relative w-full aspect-[3/4] bg-black rounded-2xl overflow-hidden shadow-lg">
      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-900">
          <p>카메라가 꺼져있습니다</p>
        </div>
      )}
      <video 
        ref={videoRef}
        autoPlay 
        playsInline 
        muted 
        className={`w-full h-full object-cover transform ${isActive ? 'opacity-100' : 'opacity-0'}`}
      />
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Overlay Guidelines for user */}
      {isActive && (
        <>
          <div className="absolute inset-0 border-2 border-white/20 pointer-events-none m-4 rounded-xl flex items-center justify-center">
             {/* Corner Markers */}
            <div className="w-12 h-12 border-t-4 border-l-4 border-blue-500/90 absolute top-0 left-0 rounded-tl-xl shadow-sm"></div>
            <div className="w-12 h-12 border-t-4 border-r-4 border-blue-500/90 absolute top-0 right-0 rounded-tr-xl shadow-sm"></div>
            <div className="w-12 h-12 border-b-4 border-l-4 border-blue-500/90 absolute bottom-0 left-0 rounded-bl-xl shadow-sm"></div>
            <div className="w-12 h-12 border-b-4 border-r-4 border-blue-500/90 absolute bottom-0 right-0 rounded-br-xl shadow-sm"></div>
            
            {/* Center Focus Point */}
            <div className="w-4 h-4 border-2 border-white/50 rounded-full bg-white/20 backdrop-blur-sm"></div>
          </div>

          {/* Zoom Chips (Only if supported) */}
          {supportsZoom && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-20 max-h-[90%] overflow-y-auto px-1 scrollbar-hide">
              {ZOOM_PRESETS.map((level) => {
                // Only show presets within the camera's supported range
                if (level < minZoom || level > maxZoom) return null;
                
                const isSelected = Math.abs(zoom - level) < 0.05;
                
                return (
                  <button
                    key={level}
                    onClick={() => handleZoomClick(level)}
                    className={`
                      w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg backdrop-blur-md transition-all duration-200 border
                      ${isSelected 
                        ? 'bg-white text-blue-600 border-blue-500 scale-110 ring-2 ring-blue-300 z-10' 
                        : 'bg-black/50 text-white border-white/30 hover:bg-black/70'}
                    `}
                  >
                    {level.toFixed(1)}x
                  </button>
                );
              })}
            </div>
          )}

          {/* Instructions */}
          <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
             <div className="bg-black/60 backdrop-blur text-white text-xs px-4 py-2 rounded-full border border-white/10 shadow-lg text-center">
               {supportsZoom ? "줌 버튼으로 배율 조정" : "화면 글자가 잘 보이게 비춰주세요"}
             </div>
          </div>
        </>
      )}
    </div>
  );
});

export default CameraView;