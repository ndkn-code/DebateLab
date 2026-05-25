import type { PracticeLanguage } from "@/types";

export interface TTSVoice {
  id: string;
  name: string;
  nameVi: string;
  gender: 'female' | 'male';
  accent: string;
  accentVi: string;
  language: PracticeLanguage;
  provider: "deepgram" | "azure" | "google";
  locale: string;
  quality?: "high" | null;
}

const VIETNAMESE_CHIRP3_HD_VOICES: Array<Pick<TTSVoice, "id" | "name" | "nameVi" | "gender">> = [
  { id: "vi-VN-Chirp3-HD-Achernar", name: "Achernar", nameVi: "Achernar", gender: "female" },
  { id: "vi-VN-Chirp3-HD-Achird", name: "Achird", nameVi: "Achird", gender: "male" },
  { id: "vi-VN-Chirp3-HD-Algenib", name: "Algenib", nameVi: "Algenib", gender: "male" },
  { id: "vi-VN-Chirp3-HD-Algieba", name: "Algieba", nameVi: "Algieba", gender: "male" },
  { id: "vi-VN-Chirp3-HD-Alnilam", name: "Alnilam", nameVi: "Alnilam", gender: "male" },
  { id: "vi-VN-Chirp3-HD-Aoede", name: "Aoede", nameVi: "Aoede", gender: "female" },
  { id: "vi-VN-Chirp3-HD-Autonoe", name: "Autonoe", nameVi: "Autonoe", gender: "female" },
  { id: "vi-VN-Chirp3-HD-Callirrhoe", name: "Callirrhoe", nameVi: "Callirrhoe", gender: "female" },
  { id: "vi-VN-Chirp3-HD-Charon", name: "Charon", nameVi: "Charon", gender: "male" },
  { id: "vi-VN-Chirp3-HD-Despina", name: "Despina", nameVi: "Despina", gender: "female" },
  { id: "vi-VN-Chirp3-HD-Enceladus", name: "Enceladus", nameVi: "Enceladus", gender: "male" },
  { id: "vi-VN-Chirp3-HD-Erinome", name: "Erinome", nameVi: "Erinome", gender: "female" },
  { id: "vi-VN-Chirp3-HD-Fenrir", name: "Fenrir", nameVi: "Fenrir", gender: "male" },
  { id: "vi-VN-Chirp3-HD-Gacrux", name: "Gacrux", nameVi: "Gacrux", gender: "female" },
  { id: "vi-VN-Chirp3-HD-Iapetus", name: "Iapetus", nameVi: "Iapetus", gender: "male" },
  { id: "vi-VN-Chirp3-HD-Kore", name: "Kore", nameVi: "Kore", gender: "female" },
  { id: "vi-VN-Chirp3-HD-Laomedeia", name: "Laomedeia", nameVi: "Laomedeia", gender: "female" },
  { id: "vi-VN-Chirp3-HD-Leda", name: "Leda", nameVi: "Leda", gender: "female" },
  { id: "vi-VN-Chirp3-HD-Orus", name: "Orus", nameVi: "Orus", gender: "male" },
  { id: "vi-VN-Chirp3-HD-Puck", name: "Puck", nameVi: "Puck", gender: "male" },
  { id: "vi-VN-Chirp3-HD-Pulcherrima", name: "Pulcherrima", nameVi: "Pulcherrima", gender: "female" },
  { id: "vi-VN-Chirp3-HD-Rasalgethi", name: "Rasalgethi", nameVi: "Rasalgethi", gender: "male" },
  { id: "vi-VN-Chirp3-HD-Sadachbia", name: "Sadachbia", nameVi: "Sadachbia", gender: "male" },
  { id: "vi-VN-Chirp3-HD-Sadaltager", name: "Sadaltager", nameVi: "Sadaltager", gender: "male" },
  { id: "vi-VN-Chirp3-HD-Schedar", name: "Schedar", nameVi: "Schedar", gender: "male" },
  { id: "vi-VN-Chirp3-HD-Sulafat", name: "Sulafat", nameVi: "Sulafat", gender: "female" },
  { id: "vi-VN-Chirp3-HD-Umbriel", name: "Umbriel", nameVi: "Umbriel", gender: "male" },
  { id: "vi-VN-Chirp3-HD-Vindemiatrix", name: "Vindemiatrix", nameVi: "Vindemiatrix", gender: "female" },
  { id: "vi-VN-Chirp3-HD-Zephyr", name: "Zephyr", nameVi: "Zephyr", gender: "female" },
  { id: "vi-VN-Chirp3-HD-Zubenelgenubi", name: "Zubenelgenubi", nameVi: "Zubenelgenubi", gender: "male" },
];

function vietnameseGoogleVoice(
  id: string,
  name: string,
  gender: TTSVoice["gender"],
  quality: TTSVoice["quality"] = "high"
): TTSVoice {
  return {
    id,
    name,
    nameVi: name,
    gender,
    accent: "Vietnamese",
    accentVi: "Việt Nam",
    language: "vi",
    provider: "google",
    locale: "vi-VN",
    quality,
  };
}

export const TTS_SAMPLE_BUCKET = "tts-voice-samples";
export const TTS_SAMPLE_TEXT_BY_LANGUAGE: Record<PracticeLanguage, string> = {
  en: "That is a strong claim, but let me challenge the assumption behind it.",
  vi: "Xin chào, đây là giọng luyện tập tranh biện tiếng Việt. Hãy lắng nghe độ rõ, nhịp điệu và cảm xúc trước khi chọn giọng cho phiên luyện tập.",
};

export const TTS_VOICES: TTSVoice[] = [
  { id: 'aura-asteria-en', name: 'Asteria', nameVi: 'Asteria', gender: 'female', accent: 'American', accentVi: 'Mỹ', language: 'en', provider: 'deepgram', locale: 'en-US' },
  { id: 'aura-luna-en', name: 'Luna', nameVi: 'Luna', gender: 'female', accent: 'American', accentVi: 'Mỹ', language: 'en', provider: 'deepgram', locale: 'en-US' },
  { id: 'aura-stella-en', name: 'Stella', nameVi: 'Stella', gender: 'female', accent: 'American', accentVi: 'Mỹ', language: 'en', provider: 'deepgram', locale: 'en-US' },
  { id: 'aura-athena-en', name: 'Athena', nameVi: 'Athena', gender: 'female', accent: 'British', accentVi: 'Anh', language: 'en', provider: 'deepgram', locale: 'en-GB' },
  { id: 'aura-hera-en', name: 'Hera', nameVi: 'Hera', gender: 'female', accent: 'American', accentVi: 'Mỹ', language: 'en', provider: 'deepgram', locale: 'en-US' },
  { id: 'aura-orion-en', name: 'Orion', nameVi: 'Orion', gender: 'male', accent: 'American', accentVi: 'Mỹ', language: 'en', provider: 'deepgram', locale: 'en-US' },
  { id: 'aura-arcas-en', name: 'Arcas', nameVi: 'Arcas', gender: 'male', accent: 'American', accentVi: 'Mỹ', language: 'en', provider: 'deepgram', locale: 'en-US' },
  { id: 'aura-perseus-en', name: 'Perseus', nameVi: 'Perseus', gender: 'male', accent: 'American', accentVi: 'Mỹ', language: 'en', provider: 'deepgram', locale: 'en-US' },
  { id: 'aura-angus-en', name: 'Angus', nameVi: 'Angus', gender: 'male', accent: 'Irish', accentVi: 'Ireland', language: 'en', provider: 'deepgram', locale: 'en-IE' },
  { id: 'aura-orpheus-en', name: 'Orpheus', nameVi: 'Orpheus', gender: 'male', accent: 'American', accentVi: 'Mỹ', language: 'en', provider: 'deepgram', locale: 'en-US' },
  { id: 'aura-helios-en', name: 'Helios', nameVi: 'Helios', gender: 'male', accent: 'British', accentVi: 'Anh', language: 'en', provider: 'deepgram', locale: 'en-GB' },
  { id: 'aura-zeus-en', name: 'Zeus', nameVi: 'Zeus', gender: 'male', accent: 'American', accentVi: 'Mỹ', language: 'en', provider: 'deepgram', locale: 'en-US' },
  { id: 'vi-VN-HoaiMyNeural', name: 'Hoai My', nameVi: 'Hoài My', gender: 'female', accent: 'Vietnamese', accentVi: 'Việt Nam', language: 'vi', provider: 'azure', locale: 'vi-VN', quality: 'high' },
  { id: 'vi-VN-NamMinhNeural', name: 'Nam Minh', nameVi: 'Nam Minh', gender: 'male', accent: 'Vietnamese', accentVi: 'Việt Nam', language: 'vi', provider: 'azure', locale: 'vi-VN', quality: 'high' },
  vietnameseGoogleVoice("vi-VN-Standard-A", "Standard A", "female", null),
  vietnameseGoogleVoice("vi-VN-Standard-B", "Standard B", "male", null),
  vietnameseGoogleVoice("vi-VN-Standard-C", "Standard C", "female", null),
  vietnameseGoogleVoice("vi-VN-Standard-D", "Standard D", "male", null),
  vietnameseGoogleVoice("vi-VN-Wavenet-A", "WaveNet A", "female"),
  vietnameseGoogleVoice("vi-VN-Wavenet-B", "WaveNet B", "male"),
  vietnameseGoogleVoice("vi-VN-Wavenet-C", "WaveNet C", "female"),
  vietnameseGoogleVoice("vi-VN-Wavenet-D", "WaveNet D", "male"),
  vietnameseGoogleVoice("vi-VN-Neural2-A", "Neural2 A", "female"),
  vietnameseGoogleVoice("vi-VN-Neural2-D", "Neural2 D", "male"),
  ...VIETNAMESE_CHIRP3_HD_VOICES.map((voice) =>
    vietnameseGoogleVoice(voice.id, voice.name, voice.gender)
  ),
];

export const DEFAULT_VOICE = 'aura-asteria-en';
export const DEFAULT_VOICE_BY_LANGUAGE: Record<PracticeLanguage, string> = {
  en: DEFAULT_VOICE,
  vi: 'vi-VN-Chirp3-HD-Kore',
};

export function getVoicesForLanguage(language: PracticeLanguage) {
  return TTS_VOICES.filter((voice) => voice.language === language);
}

export function getVoiceById(voiceId: string) {
  return TTS_VOICES.find((voice) => voice.id === voiceId) ?? null;
}

export function getDefaultVoiceForLanguage(language: PracticeLanguage) {
  return DEFAULT_VOICE_BY_LANGUAGE[language];
}

export function coerceVoiceForLanguage(
  voiceId: unknown,
  language: PracticeLanguage
) {
  const voice = typeof voiceId === "string" ? getVoiceById(voiceId) : null;
  return voice?.language === language
    ? voice.id
    : getDefaultVoiceForLanguage(language);
}

export function resolveTtsVoiceForRequest(
  voiceId: unknown,
  practiceLanguage?: PracticeLanguage
) {
  const requestedVoice = typeof voiceId === "string" ? getVoiceById(voiceId) : null;
  const language = practiceLanguage ?? requestedVoice?.language ?? "en";
  return coerceVoiceForLanguage(voiceId, language);
}

export function getVoiceSampleStoragePath(voiceId: string) {
  const voice = getVoiceById(voiceId);
  if (!voice) return null;
  return `${voice.language}/${voice.id}.mp3`;
}

export function getVoiceSampleUrl(voiceId: string) {
  const path = getVoiceSampleStoragePath(voiceId);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !supabaseUrl) return null;

  const baseUrl = supabaseUrl.replace(/\/+$/, "");
  return `${baseUrl}/storage/v1/object/public/${TTS_SAMPLE_BUCKET}/${path}`;
}
