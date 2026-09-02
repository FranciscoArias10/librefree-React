import * as Speech from 'expo-speech';

export interface TTSState {
  isSpeaking: boolean;
  isPaused: boolean;
  currentChunkIndex: number;
  totalChunks: number;
  rate: number;
}

let chunks: string[] = [];
let currentIndex = 0;
let currentRate = 1.0;
let onProgressCallback: ((index: number, total: number, text: string) => void) | null = null;
let onFinishCallback: (() => void) | null = null;
let isSpeakingActive = false;
let isManualChange = false;
let activeBookId: string | null = null;

export function splitTextIntoChunks(text: string, chunkSize: number = 250): string[] {
  if (!text) return [];

  // Strip raw HTML/XML tags, entities, and normalize whitespace to prevent TTS skips
  const cleaned = text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/[{}$^~%\\\/\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];

  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  const result: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (!sentence.trim()) continue;
    if ((current + ' ' + sentence).length > chunkSize) {
      if (current.trim().length > 0) result.push(current.trim());
      current = sentence.trim();
    } else {
      current += (current ? ' ' : '') + sentence.trim();
    }
  }
  if (current.trim().length > 0) result.push(current.trim());
  return result;
}

export function isTTSSpeakingForBook(bookId: string): boolean {
  return isSpeakingActive && activeBookId === bookId;
}

export function isTTSSpeaking(): boolean {
  return isSpeakingActive;
}

export function getCurrentTTSChunkIndex(): number {
  return currentIndex;
}

export function getTotalTTSChunks(): number {
  return chunks.length;
}

export function getCurrentTTSSnippet(): string {
  if (chunks.length > 0 && currentIndex >= 0 && currentIndex < chunks.length) {
    return chunks[currentIndex];
  }
  return '';
}

export async function startTTSBook(
  fullText: string,
  rate: number = 1.0,
  onProgress?: (index: number, total: number, text: string) => void,
  onFinish?: () => void,
  initialChunkIndex: number = 0,
  bookId?: string
) {
  stopTTS();
  activeBookId = bookId || null;
  chunks = splitTextIntoChunks(fullText);
  currentIndex = chunks.length > 0 ? Math.min(Math.max(0, initialChunkIndex), chunks.length - 1) : 0;
  currentRate = rate;
  onProgressCallback = onProgress || null;
  onFinishCallback = onFinish || null;
  isSpeakingActive = true;
  isManualChange = false;

  if (chunks.length > 0) {
    speakCurrentChunk();
  }
}

function speakCurrentChunk() {
  if (!isSpeakingActive || currentIndex >= chunks.length) {
    isSpeakingActive = false;
    if (onFinishCallback) onFinishCallback();
    return;
  }

  const chunkIndexToRead = currentIndex;
  const textToSpeak = chunks[chunkIndexToRead];
  
  if (onProgressCallback) {
    onProgressCallback(chunkIndexToRead, chunks.length, textToSpeak);
  }

  Speech.speak(textToSpeak, {
    language: 'es-ES',
    rate: currentRate,
    pitch: 1.0,
    onDone: () => {
      if (isSpeakingActive && !isManualChange) {
        if (currentIndex === chunkIndexToRead) {
          currentIndex++;
        }
        speakCurrentChunk();
      }
    },
    onError: (err) => {
      console.warn('Error en TTS chunk:', err);
      if (isSpeakingActive && !isManualChange) {
        if (currentIndex === chunkIndexToRead) {
          currentIndex++;
        }
        speakCurrentChunk();
      }
    },
  });
}

export function pauseTTS() {
  isSpeakingActive = false;
  isManualChange = true;
  Speech.stop();
}

export function resumeTTS() {
  if (chunks.length > 0 && currentIndex < chunks.length) {
    isSpeakingActive = true;
    isManualChange = false;
    speakCurrentChunk();
  }
}

export function stopTTS() {
  isSpeakingActive = false;
  isManualChange = true;
  Speech.stop();
  chunks = [];
  currentIndex = 0;
}

export function setTTSSpeed(rate: number, targetIndex?: number) {
  currentRate = rate;
  if (targetIndex !== undefined && targetIndex >= 0 && targetIndex < chunks.length) {
    currentIndex = targetIndex;
  }

  if (isSpeakingActive) {
    isManualChange = true;
    Speech.stop();
    setTimeout(() => {
      isManualChange = false;
      speakCurrentChunk();
    }, 80);
  }
}

export function jumpToTTSChunk(index: number) {
  if (index >= 0 && index < chunks.length) {
    currentIndex = index;
    if (isSpeakingActive) {
      isManualChange = true;
      Speech.stop();
      setTimeout(() => {
        isManualChange = false;
        speakCurrentChunk();
      }, 80);
    }
  }
}

export async function speakText(text: string, options?: { rate?: number; onDone?: () => void; onError?: () => void }) {
  const rate = options?.rate || 1.0;
  startTTSBook(text, rate, undefined, options?.onDone);
}

export async function stopSpeech(): Promise<void> {
  stopTTS();
}
