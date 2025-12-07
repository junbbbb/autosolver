export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface ScanResult {
  id: string;
  timestamp: number;
  imageUrl: string;
  text: string;          // The actual answer
  reasoning?: string;    // Detailed explanation/reasoning
  sources: { uri: string; title: string }[];
  loading: boolean;
  error?: string;
}

export interface CameraHandle {
  capture: () => string | null;
}