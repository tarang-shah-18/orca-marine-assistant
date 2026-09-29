import { LanguageCode } from '../types';
import { speechTagFor } from '../core/language';

// Web Speech API interface declarations
interface SpeechRecognitionEvent extends Event {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
    };
    length: number;
  };
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface IWindowWithSpeech extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

/** The eleven languages ORCA answers in, as ISO-639-1 base codes. */
const INDIAN_LANGS = ['en', 'hi', 'mr', 'gu', 'kn', 'ml', 'te', 'ta', 'bn', 'or', 'pa'] as const;

export class SpeechService {
  private static recognitionInstance: any = null;
  private static isListening: boolean = false;

  /**
   * Check if speech recognition is available in current browser/device
   */
  public static isRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as IWindowWithSpeech;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  /**
   * Start Speech-to-Text listening
   *
   * `language` is a BCP-47 tag, not an ORCA locale code: the browser has no
   * voice tagged `gu-IN`-style ORCA locales reliably, but it does understand
   * `gu-IN` / `gu`. `speechTagFor` maps one onto the other.
   */
  public static startListening(params: {
    language: LanguageCode | string;
    onResult: (transcript: string) => void;
    onError: (errorMsg: string) => void;
    onEnd: () => void;
  }): boolean {
    if (!this.isRecognitionSupported()) {
      params.onError(
        'Speech recognition is not supported in this browser. Please type your query or use Google Chrome on Android.'
      );
      return false;
    }

    try {
      const win = window as IWindowWithSpeech;
      const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

      if (this.recognitionInstance) {
        try {
          this.recognitionInstance.abort();
        } catch {
          // ignore
        }
      }

      const recognition = new SpeechRecognitionClass();
      this.recognitionInstance = recognition;

      // An ORCA locale code that the Web Speech API does not know would fail
      // silently and never match anything; map it to a real BCP-47 tag first.
      const tag = normaliseSpeechTag(params.language);
      recognition.lang = tag;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        this.isListening = true;
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (item && item[0]) {
            finalTranscript += item[0].transcript;
          }
        }
        if (finalTranscript.trim()) {
          params.onResult(finalTranscript);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        this.isListening = false;
        let msg = `Speech error: ${event.error}`;
        if (event.error === 'not-allowed') {
          msg = 'Microphone permission was denied. Please allow microphone access in your browser/device settings.';
        } else if (event.error === 'no-speech') {
          msg = 'No speech was detected. Please tap the microphone and speak clearly.';
        }
        params.onError(msg);
      };

      recognition.onend = () => {
        this.isListening = false;
        params.onEnd();
      };

      recognition.start();
      return true;
    } catch (err: any) {
      this.isListening = false;
      params.onError(`Could not initialize microphone: ${err?.message || err}`);
      return false;
    }
  }

  /**
   * Stop Speech-to-Text listening
   */
  public static stopListening() {
    if (this.recognitionInstance && this.isListening) {
      try {
        this.recognitionInstance.stop();
      } catch {
        // ignore
      }
      this.isListening = false;
    }
  }

  /**
   * Check if speech synthesis is supported
   */
  public static isSynthesisSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /**
   * Text-to-Speech playback for ORCA answers
   */
  public static speak(params: {
    text: string;
    language: LanguageCode | string;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  }): boolean {
    if (!this.isSynthesisSupported()) {
      params.onError?.('Text-to-speech is not supported on this device.');
      return false;
    }

    try {
      this.stopSpeaking();

      // Clean text of markdown asterisks or special symbols for smooth TTS
      const cleanText = params.text
        .replace(/\*/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/https?:\/\/\S+/g, '');

      const utterance = new SpeechSynthesisUtterance(cleanText);

      const tag = normaliseSpeechTag(params.language);
      utterance.lang = tag;
      utterance.rate = 0.95; // Slightly slower for clear sea announcements
      utterance.pitch = 1.0;

      // Try matching voice
      const voices = window.speechSynthesis.getVoices();
      const base = tag.split('-')[0].toLowerCase();
      const matchingVoice =
        voices.find((v) => v.lang.toLowerCase() === tag.toLowerCase()) ??
        voices.find((v) => v.lang.toLowerCase().startsWith(`${base}-`)) ??
        voices.find((v) => v.lang.toLowerCase() === base);
      // The fallback has to test the voice, not the requested language: an
      // `INDIAN_LANGS.includes(base)` predicate is constant for the whole
      // utterance, so it returned whichever voice happened to be first in the
      // system — typically an English one, defeating the point of the fallback.
      const fallbackVoice =
        voices.find((v) => INDIAN_LANGS.some((l) => v.lang.toLowerCase().startsWith(`${l}-`))) ??
        voices.find((v) => v.lang.toLowerCase().includes('in'));

      const chosen = matchingVoice ?? fallbackVoice;
      if (chosen) {
        utterance.voice = chosen;
      }

      utterance.onstart = () => {
        params.onStart?.();
      };

      utterance.onend = () => {
        params.onEnd?.();
      };

      utterance.onerror = (e) => {
        params.onError?.(e);
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err) {
      params.onError?.(err);
      return false;
    }
  }

  /**
   * Stop current speech playback
   */
  public static stopSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  public static isSpeaking(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking;
  }
}

/**
 * ORCA locale code → a BCP-47 tag the browser's speech engine recognises.
 *
 * A recogniser handed an unknown tag starts and then matches nothing, which
 * looks to a user exactly like a broken microphone.
 */
function normaliseSpeechTag(language: LanguageCode | string): string {
  if (typeof language !== 'string' || !language.trim()) return 'en-IN';
  const trimmed = language.trim();
  // A bare subtag ("hi") still needs its region to reach a real voice.
  if (/^[a-z]{2}-[A-Z]{2}$/.test(trimmed)) return trimmed;
  return speechTagFor(trimmed as LanguageCode) ?? trimmed;
}
