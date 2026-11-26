export type Theme = "letter" | "detective";
export type ModeName = "normal" | "high" | "custom";
export type VoiceStyle = "verbatim" | "voice" | "polish";
export type Source = "choice" | "keyboard" | "voice";
export type AbilityName = "returning" | "interpret";
export type Offer = AbilityName | "skip" | "toggle_returning" | "toggle_interpret" | "keep";
export interface Segment {
  id: string;
  text: string;
  locked: boolean;
  source: string;
  original?: string;
}
export interface Rules {
  trigger: "manual" | "response" | "automatic";
  action: "insert" | "rewrite" | "delete";
  lock: boolean;
  recoverable: boolean;
}
export interface Mode extends Rules { id: string; name: string }
export interface Run {
  id: string;
  version: number;
  theme: Theme;
  mode: ModeName;
  opening: string;
  segments: Segment[];
  choices: string[];
  offers: string[];
  abilities: Record<AbilityName, {level: number; enabled: boolean}>;
  lock_uses: number;
  turns: number;
  status: "active" | "finished";
  work_id?: string;
  finishing?: boolean;
  rules?: Rules;
  pending_intervention?: boolean;
  generation_pending?: boolean;
  interpretation_options?: string[];
  interpretations?: string[];
}
export interface Action {
  request_id: string;
  version: number;
  kind: "turn" | "ability" | "edit" | "unlock" | "replace" | "finish" | "begin_finish" | "resume" | "restore" | "intervene" | "cancel";
  source?: Source;
  text?: string;
  target?: string;
  style?: VoiceStyle;
  ability?: Offer;
  interpretation?: string;
  retain?: boolean;
}
export interface Work {
  id: string;
  version: number;
  title: string;
  text: string;
  theme: Theme;
  mode: ModeName;
  ai_generated: boolean;
}
export interface Card {
  id: string;
  title: string;
  text: string;
  theme: Theme;
  mode: ModeName;
  ai_generated: boolean;
  requires_consent: boolean;
  opening?: string;
}
export interface Progress {
  completed: number;
  detective: boolean;
  high: boolean;
  rewrite: boolean;
  delete: boolean;
}
export interface Library { runs: Run[]; works: Work[]; modes: Mode[]; progress: Progress }
