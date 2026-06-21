import type {
  IeltsBandEvidenceSource,
  IeltsModule,
  IeltsSkill,
} from "@/lib/ielts/adaptive/contracts";

export interface IeltsPredictionObservation {
  skill: IeltsSkill;
  band: number | null;
  occurredAt: string;
  source: IeltsBandEvidenceSource;
  label: string;
  reliability: number;
  coverage: number;
  rawScore?: number | null;
  subskillKey?: string | null;
  questionType?: string | null;
  criterion?: string | null;
  reasonEn?: string;
  reasonVi?: string;
}

export interface IeltsPredictionSubskillState {
  skill: IeltsSkill;
  subskillKey: string;
  labelEn: string;
  labelVi: string;
  bandEstimate: number | null;
  masteryScore: number;
  confidence: number;
  weaknessWeight: number;
  evidenceCount: number;
  questionType?: string | null;
  criterion?: string | null;
  lastEvidenceAt?: string | null;
}

export interface BuildIeltsBandPredictionInput {
  userId: string;
  module: IeltsModule;
  asOf?: string;
  targetBand?: number;
  observations: readonly IeltsPredictionObservation[];
  skillStates?: readonly IeltsPredictionSubskillState[];
}
