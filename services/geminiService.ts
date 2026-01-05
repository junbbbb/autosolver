
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const solveProblemFromImage = async (base64Image: string): Promise<{ text: string; reasoning: string; sources: { uri: string; title: string }[] }> => {
  try {
    // Remove data URL prefix if present
    const base64Data = base64Image.split(',')[1] || base64Image;

    const promptText = `이 이미지는 Salesforce DataCloud 인증(Consultant) 시험이나 관련 퀴즈 문제를 촬영한 모니터 화면입니다.
**주의**: 디지털 화면을 촬영했기 때문에 모아레(물결 무늬), 빛 반사, 픽셀 깨짐이 있을 수 있습니다. 이러한 노이즈를 무시하고 텍스트를 정확히 복원하여 분석하세요.
Google Search를 사용하여 정보를 검증하세요.

다음 규칙을 엄격히 준수하여 답변하세요:

1. **정답 (핵심)**:
   - 객관식(선다형) 문제라면 정답을 알파벳(A~E) 또는 숫자(1~5)로 출력하세요.
   - **단일 정답**: "A" 처럼 한 글자만 출력.
   - **복수 정답**: "A, C" 또는 "1, 3" 처럼 쉼표로 구분하여 알파벳/숫자 순서대로 출력.
   - 정답을 100% 확신할 수 없거나, 문제가 잘려 식별 불가능하면 **UNKNOWN** 출력.
   - 설명이나 다른 문장을 절대 포함하지 마세요.

2. **구분선**:
   - 정답 바로 다음 줄에 반드시 \`---SPLIT---\`을 입력하세요.

3. **풀이 (상세)**:
   - 구분선 아래에 정답인 이유를 Salesforce와 DataCloud 기능적 관점에서 설명하세요. 
   - **UNKNOWN**일 경우, 왜 식별할 수 없었는지(예: "문제 지문이 잘림")를 적으세요.

[출력 예시 1 - 단일 정답]
B
---SPLIT---
정답은 B입니다. 상세 설명...

[출력 예시 2 - 복수 정답]
A, C
---SPLIT---
A와 C가 정답입니다. 상세 설명...`;

    // Strategy: Use 'gemini-3-flash-preview' for better reasoning capabilities + Google Search Grounding.
    const apiCall = ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        thinkingConfig: { thinkingBudget: 1024 },
        maxOutputTokens: 2048,
        tools: [{ googleSearch: {} }], // Enable Google Search
      }
    });

    // Increased timeout to 45s to accommodate Thinking + Search
    const timeoutCall = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("응답 시간이 초과되었습니다 (45초).")), 45000)
    );

    const response = await Promise.race([apiCall, timeoutCall]) as any;

    const fullText = response.text || "분석 결과를 찾을 수 없습니다.";
    const parts = fullText.split('---SPLIT---');
    
    // Clean up the answer text
    let rawText = parts[0].trim()
        .replace(/\*\*/g, '')
        .replace(/^정답[:\s]*/i, '') // Remove "정답:" prefix if model hallucinates it
        .replace(/^Answer[:\s]*/i, '')
        .trim();

    // Answer Validation Logic
    let text = rawText;
    const upperText = text.toUpperCase();

    if (upperText.includes("UNKNOWN")) {
        text = "UNKNOWN";
    } else {
        // Regex allows: A-E, 1-5, comma, space. 
        // Example: "A" or "A, C" or "1, 2"
        const isValidChars = /^[A-E1-5,\s]+$/i.test(text);
        
        // Prevent long sentences if the model hallucinates
        const isShortEnough = text.length <= 15; 

        if (!isValidChars || !isShortEnough) {
            console.warn("Filtered invalid response:", text);
            // Try to rescue single letter answers that might have slipped through with punctuation
            const match = text.match(/^([A-E1-5])(\s|$)/i);
            if (match) {
                text = match[1].toUpperCase();
            } else {
                text = "ERROR";
            }
        } else {
            // Normalize: "a,c" -> "A, C"
            // Remove all spaces, split by comma, filter empty, join with ", "
            text = text.toUpperCase().replace(/\s+/g, '').split(',').filter(Boolean).join(', ');
        }
    }

    const reasoning = parts.length > 1 ? parts[1].trim() : "상세 풀이를 생성하지 못했습니다.";
    
    // Extract sources from Google Search grounding
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks
      .map((chunk: any) => chunk.web)
      .filter((web: any) => web && web.uri && web.title)
      .map((web: any) => ({ uri: web.uri, title: web.title }));

    return { text, reasoning, sources };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    let errorMessage = error.message || "알 수 없는 오류";
    if (errorMessage.includes("SAFETY")) {
        errorMessage = "콘텐츠 보안 정책에 의해 차단되었습니다.";
    }

    return { 
        text: "Error", 
        reasoning: `분석 실패: ${errorMessage}`,
        sources: [] 
    };
  }
};
