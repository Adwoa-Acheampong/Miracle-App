export type ActiveSheet = 'none' | 'altar' | 'obelisk' | 'well' | 'portal' | 'journal' | 'history' | 'quest';

export interface ReflectionResponse {
  scripture: string;
  reflection: string;
  action: string;
  mode: 'gemini' | 'fallback';
  error?: string;
}

export interface MiracleResponse {
  title: string;
  description: string;
  insight: string;
  sparkles: number;
  mode: 'gemini' | 'fallback';
  error?: string;
}

export interface JournalResponse {
  blessing: string;
  sparkles: number;
  mode: 'gemini' | 'fallback';
  error?: string;
}

export interface SparkleHistoryItem {
  id: string;
  amount: number;
  reason: string;
  timestamp: string;
}

export interface DiscoveredMiracle {
  id: string;
  title: string;
  category: string;
  insight: string;
  sparkles: number;
  date: string;
}

export interface GameQuest {
  id: string;
  title: string;
  description: string;
  targetCount: number;
  currentCount: number;
  completed: boolean;
  rewardSparkles: number;
}
