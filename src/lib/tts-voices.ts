export interface TTSVoice {
  id: string;
  name: string;
  nameVi: string;
  gender: 'female' | 'male';
  accent: string;
  accentVi: string;
}

export const TTS_VOICES: TTSVoice[] = [
  { id: 'aura-asteria-en', name: 'Asteria', nameVi: 'Asteria', gender: 'female', accent: 'American', accentVi: 'Mỹ' },
  { id: 'aura-luna-en', name: 'Luna', nameVi: 'Luna', gender: 'female', accent: 'American', accentVi: 'Mỹ' },
  { id: 'aura-stella-en', name: 'Stella', nameVi: 'Stella', gender: 'female', accent: 'American', accentVi: 'Mỹ' },
  { id: 'aura-athena-en', name: 'Athena', nameVi: 'Athena', gender: 'female', accent: 'British', accentVi: 'Anh' },
  { id: 'aura-hera-en', name: 'Hera', nameVi: 'Hera', gender: 'female', accent: 'American', accentVi: 'Mỹ' },
  { id: 'aura-orion-en', name: 'Orion', nameVi: 'Orion', gender: 'male', accent: 'American', accentVi: 'Mỹ' },
  { id: 'aura-arcas-en', name: 'Arcas', nameVi: 'Arcas', gender: 'male', accent: 'American', accentVi: 'Mỹ' },
  { id: 'aura-perseus-en', name: 'Perseus', nameVi: 'Perseus', gender: 'male', accent: 'American', accentVi: 'Mỹ' },
  { id: 'aura-angus-en', name: 'Angus', nameVi: 'Angus', gender: 'male', accent: 'Irish', accentVi: 'Ireland' },
  { id: 'aura-orpheus-en', name: 'Orpheus', nameVi: 'Orpheus', gender: 'male', accent: 'American', accentVi: 'Mỹ' },
  { id: 'aura-helios-en', name: 'Helios', nameVi: 'Helios', gender: 'male', accent: 'British', accentVi: 'Anh' },
  { id: 'aura-zeus-en', name: 'Zeus', nameVi: 'Zeus', gender: 'male', accent: 'American', accentVi: 'Mỹ' },
];

export const DEFAULT_VOICE = 'aura-asteria-en';
