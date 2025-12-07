import React, { useState } from 'react';
import { ScanResult } from '../types';

interface ResultCardProps {
  result: ScanResult;
  isLatest?: boolean;
}

const ResultCard: React.FC<ResultCardProps> = ({ result, isLatest = false }) => {
  const [showReasoning, setShowReasoning] = useState(false);

  // Helper to determine color based on the answer text
  const getAnswerStyle = (text: string) => {
    const cleanText = text.trim().toUpperCase();
    
    // Specific Colors for A, B, C, D / 1, 2, 3, 4
    if (cleanText.startsWith('A') || cleanText === '1') {
      return 'bg-red-500 text-white border-red-600 shadow-red-200';
    }
    if (cleanText.startsWith('B') || cleanText === '2') {
      return 'bg-blue-500 text-white border-blue-600 shadow-blue-200';
    }
    if (cleanText.startsWith('C') || cleanText === '3') {
      return 'bg-green-500 text-white border-green-600 shadow-green-200';
    }
    if (cleanText.startsWith('D') || cleanText === '4') {
      return 'bg-amber-400 text-black border-amber-500 shadow-amber-200'; // Amber/Yellow for D
    }
    if (cleanText.startsWith('E') || cleanText === '5') {
      return 'bg-purple-500 text-white border-purple-600 shadow-purple-200';
    }
    if (cleanText === 'UNKNOWN') {
        return 'bg-gray-700 text-white border-gray-800 shadow-gray-400';
    }
    if (cleanText === 'ERROR' || cleanText === '분석 실패') {
        return 'bg-gray-200 text-gray-500 border-gray-300';
    }
    
    // Default style for keywords (e.g., "/remind")
    return 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-200';
  };

  const answerStyle = getAnswerStyle(result.text || "");

  return (
    <div className={`rounded-3xl overflow-hidden animate-fade-in transition-all duration-500 ${isLatest ? 'shadow-2xl scale-100' : 'opacity-80 scale-95 shadow-sm'}`}>
      
      {/* Header: Time & Status */}
      <div className="bg-white px-4 py-2 flex justify-between items-center border-b border-gray-100">
        <span className="text-xs font-mono text-gray-400">
          {new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        {result.loading && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span> 분석 중...
          </span>
        )}
        {result.error && (
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-500">오류 발생</span>
        )}
      </div>
      
      <div className="flex flex-col">
        
        {/* Massive Answer Display */}
        <div className={`
            relative min-h-[160px] flex items-center justify-center p-6 text-center border-b-4 transition-colors duration-300
            ${result.loading ? 'bg-gray-50 border-gray-200' : answerStyle}
        `}>
          {result.loading ? (
            <div className="flex flex-col items-center gap-3">
               <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
               <p className="text-gray-400 text-sm font-medium animate-pulse">AI가 생각하고 있습니다...</p>
            </div>
          ) : (
            <div className="animate-scale-in">
               {/* If it's very long text, make it smaller, otherwise huge */}
               <h2 className={`font-black tracking-tighter drop-shadow-md ${
                   (result.text?.length || 0) > 3 ? 'text-4xl leading-tight break-all' : 'text-8xl'
               }`}>
                 {result.text || "?"}
               </h2>
               {!result.error && (result.text?.length || 0) <= 3 && (
                   <div className="absolute bottom-2 right-4 text-xs font-bold opacity-60 uppercase tracking-widest">
                       Answer
                   </div>
               )}
            </div>
          )}
        </div>

        {/* Reasoning Toggle Section (White Background) */}
        <div className="bg-white p-4">
          {!result.loading && !result.error && result.reasoning && (
             <div>
               <button 
                 onClick={() => setShowReasoning(!showReasoning)}
                 className="w-full group flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all"
               >
                 <span className="text-lg">{showReasoning ? '👆' : '🧐'}</span>
                 <span className="font-bold text-gray-600 group-hover:text-blue-600 text-sm">
                    {showReasoning ? '설명 접기' : '왜 정답일까요? (해설 보기)'}
                 </span>
               </button>
               
               {showReasoning && (
                 <div className="mt-3 bg-slate-50 p-4 rounded-xl text-sm text-gray-800 leading-relaxed break-words whitespace-pre-wrap border border-slate-100 shadow-inner animate-fade-in">
                   <div className="flex gap-2 mb-2">
                      <span className="text-lg">💡</span>
                      <span className="font-bold text-slate-700">AI 분석 리포트</span>
                   </div>
                   {result.reasoning}
                 </div>
               )}
             </div>
          )}

          {/* Footer: Sources */}
          {!result.loading && !result.error && result.sources && result.sources.length > 0 && (
             <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                {result.sources.map((source, idx) => (
                  <a 
                    key={idx}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md transition-colors max-w-[45%] truncate"
                  >
                     🌍 {source.title || "Web Source"}
                  </a>
                ))}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultCard;