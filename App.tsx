
import React, { useState, useEffect, useRef, useCallback } from 'react';
import CameraView from './components/CameraView';
import ResultCard from './components/ResultCard';
import { solveProblemFromImage } from './services/geminiService';
import { ScanResult, CameraHandle } from './types';

const AUTO_SCAN_INTERVAL_MS = 30000; // 30 seconds 

export default function App() {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [timeUntilNextScan, setTimeUntilNextScan] = useState<number>(AUTO_SCAN_INTERVAL_MS);
  const cameraRef = useRef<CameraHandle>(null);
  const intervalRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  const performScan = useCallback(async () => {
    if (!cameraRef.current) return;

    // Prevent overlapping scans: Do not solve if previous response hasn't finished
    if (isProcessingRef.current) {
      console.log("Skipping scan: Previous analysis is still in progress.");
      return;
    }

    const imageBase64 = cameraRef.current.capture();
    if (!imageBase64) return;

    isProcessingRef.current = true; // Lock

    const newId = Date.now().toString();
    const newResult: ScanResult = {
      id: newId,
      timestamp: Date.now(),
      imageUrl: imageBase64,
      text: '',
      reasoning: '',
      sources: [],
      loading: true
    };

    // Prepend new result (LIFO)
    setResults(prev => [newResult, ...prev]);

    // Reset countdown
    setTimeUntilNextScan(AUTO_SCAN_INTERVAL_MS);

    try {
      const { text, reasoning, sources } = await solveProblemFromImage(imageBase64);
      
      setResults(prev => prev.map(r => 
        r.id === newId 
          ? { ...r, loading: false, text, reasoning, sources } 
          : r
      ));
    } catch (error: any) {
      setResults(prev => prev.map(r => 
        r.id === newId 
          ? { ...r, loading: false, error: error.message || "분석 실패" } 
          : r
      ));
    } finally {
      isProcessingRef.current = false; // Unlock
    }
  }, []);

  // Timer logic for countdown
  useEffect(() => {
    if (isActive) {
      timerRef.current = window.setInterval(() => {
        setTimeUntilNextScan(prev => {
          const next = prev - 1000;
          if (next <= 0) return AUTO_SCAN_INTERVAL_MS;
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeUntilNextScan(AUTO_SCAN_INTERVAL_MS);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  // Logic for triggering scan
  useEffect(() => {
    if (isActive) {
      intervalRef.current = window.setInterval(() => {
        performScan();
      }, AUTO_SCAN_INTERVAL_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, performScan]);

  const handleToggle = () => {
    const newState = !isActive;
    setIsActive(newState);
    if (newState) {
      // Trigger immediate scan when turning on
      setTimeout(performScan, 1500); // Wait 1.5s for camera to stabilize
      setTimeUntilNextScan(AUTO_SCAN_INTERVAL_MS);
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}초`;
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-200 px-5 py-3 flex justify-between items-center shadow-sm">
        <div className="flex flex-col">
          <h1 className="text-lg font-black tracking-tight text-gray-900">
            AutoLens <span className="text-blue-600">Solver</span>
          </h1>
        </div>
        
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-9 w-16 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isActive ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-7 w-7 transform rounded-full bg-white transition-transform shadow-md ${
              isActive ? 'translate-x-8' : 'translate-x-1'
            }`}
          />
        </button>
      </header>

      <main className="max-w-lg mx-auto p-5">
        {/* Status Bar */}
        <div className="flex justify-between items-center mb-4 text-sm font-medium">
          <span className={`${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
            {isActive ? "● 실시간 분석 활성" : "○ 대기 중"}
          </span>
          {isActive && (
            <span className="text-gray-500 font-mono bg-gray-200 px-2 py-1 rounded text-xs">
              다음 스캔: {formatTime(timeUntilNextScan)}
            </span>
          )}
        </div>

        {/* Camera Section - Flex Container with Side Button */}
        <div className="relative z-0 flex justify-center items-center mb-8 min-h-[180px]">
          
          {/* Left Scan Button - Big & Prominent */}
          {isActive && (
            <button
              onClick={performScan}
              className="absolute left-0 z-20 flex flex-col items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-xl border-4 border-white active:scale-95 transition-all hover:scale-105 hover:shadow-blue-300/50 animate-fade-in"
              title="즉시 분석 (Scan Now)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-[10px] font-black tracking-widest">SCAN</span>
            </button>
          )}

          {/* Camera View - 50% Width */}
          <div className="w-1/2 relative shadow-2xl rounded-2xl overflow-hidden ring-1 ring-gray-200 bg-black">
            <CameraView ref={cameraRef} isActive={isActive} />
          </div>
        </div>

        {/* Latest Result Display - Prominent */}
        {results.length > 0 && (
          <div className="relative z-10 -mt-4 mb-8">
             <div className="mb-2 px-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <span className="text-xs font-bold text-white drop-shadow-md uppercase tracking-wider text-shadow">최신 결과</span>
             </div>
             <ResultCard result={results[0]} isLatest={true} />
          </div>
        )}

        {/* Empty State */}
        {results.length === 0 && isActive && (
          <div className="text-center py-8 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100 mt-4">
            <div className="animate-bounce text-2xl mb-2">📸</div>
            <p>화면을 비추면 정답을 알려줍니다</p>
            <p className="text-xs text-gray-400 mt-1">버튼을 눌러 즉시 스캔하거나 1분을 기다리세요</p>
          </div>
        )}

        {/* Previous History */}
        {results.length > 1 && (
          <div className="space-y-4 mt-8 opacity-80">
            <h2 className="text-sm font-bold text-gray-500 px-1 uppercase tracking-wider">
              이전 기록
            </h2>
            {results.slice(1).map(result => (
              <ResultCard key={result.id} result={result} isLatest={false} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
