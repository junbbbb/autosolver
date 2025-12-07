import { GoogleGenAI } from "@google/genai";
import { GroundingChunk } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const solveProblemFromImage = async (base64Image: string): Promise<{ text: string; reasoning: string; sources: { uri: string; title: string }[] }> => {
  try {
    // Remove data URL prefix if present
    const base64Data = base64Image.split(',')[1] || base64Image;

    const promptText = `이 이미지는 Salesforce Slack 인증 시험(Admin, Consultant, Developer)이나 관련 퀴즈 문제를 촬영한 모니터 화면입니다.
**주의**: 디지털 화면을 촬영했기 때문에 모아레(물결 무늬), 빛 반사, 픽셀 깨짐이 있을 수 있습니다. 이러한 노이즈를 무시하고 텍스트를 정확히 복원하여 분석하세요.

다음 규칙을 엄격히 준수하여 답변하세요:

1. **정답 (핵심)**:
   - 객관식(선다형) 문제라면: **A, B, C, D** 또는 **1, 2, 3, 4** 중 정답 하나만 딱 한 글자로 출력하세요. (예: "A", "3")
   - 단답형 문제라면: **Salesforce/Slack 공식 용어**나 **명령어**만 짧게 출력하세요. (예: "Flow Builder", "/remind")
   - **중요**: 정답을 100% 확신할 수 없거나, 문제가 잘리지 않아 식별이 불가능하거나, 모르는 문제라면 절대 임의로 찍지 말고 **UNKNOWN** 이라고만 출력하세요. 무작위로 A를 출력하지 마세요.
   - 설명이나 문장을 덧붙이지 마세요.

2. **구분선**:
   - 정답 바로 다음 줄에 반드시 \`---SPLIT---\`을 입력하세요.

3. **풀이 (상세)**:
   - 구분선 아래에 정답인 이유를 Salesforce와 Slack의 기능적 관점에서 설명하세요. 
   - **UNKNOWN**일 경우, 왜 식별할 수 없었는지(예: "문제 지문이 잘림", "화질 흐림" 등)를 적으세요.

[출력 예시 1 - 객관식]
B
---SPLIT---
정답은 B입니다. Slack Connect는 외부 조직과 안전하게 협업할 수 있는 Salesforce Slack의 핵심 기능이기 때문입니다.

[출력 예시 2 - 모르는 경우]
UNKNOWN
---SPLIT---
화면의 글자가 너무 흐릿하여 문제를 읽을 수 없습니다. 카메라 초점을 맞추거나 화면을 더 가까이 비춰주세요.`;

    // Create the API request promise
    // Strategy: Use 'gemini-2.5-flash' for SPEED, but enable 'thinkingConfig' for ACCURACY.
    // This allows the fast model to "think" before answering, simulating Pro-level reasoning with Flash-level latency.
    const apiCall = ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
        // Budget for thinking tokens. 1024 is a sweet spot for quiz reasoning without being too slow.
        thinkingConfig: { thinkingBudget: 1024 },
        // Total output limit (Thinking + Actual Answer)
        maxOutputTokens: 2048, 
      }
    });

    // Timeout Logic
    // Flash is fast, so 15s is plenty. If it takes longer, something is wrong.
    const timeoutCall = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("응답 시간이 초과되었습니다.")), 15000)
    );

    // Race the API call against the timeout
    const response = await Promise.race([apiCall, timeoutCall]) as any;

    const fullText = response.text || "분석 결과를 찾을 수 없습니다.";
    const parts = fullText.split('---SPLIT---');
    
    let text = parts[0].trim(); // 정답 부분
    
    // Clean up answer text (remove markdown bolding, extra spaces, periods)
    text = text.replace(/\*\*/g, '').replace(/\./g, '').trim();

    const reasoning = parts.length > 1 ? parts[1].trim() : "상세 풀이를 생성하지 못했습니다."; // 풀이 부분
    
    const sources: { uri: string; title: string }[] = [];

    return { text, reasoning, sources };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // Handle safety blocks or other specific API errors
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