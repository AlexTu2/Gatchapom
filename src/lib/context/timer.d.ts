export type TimerMode = 'work' | 'shortBreak' | 'longBreak';

export interface TimerSettings {
  work: number;
  shortBreak: number;
  longBreak: number;
  longBreakInterval: number;
  currentMode: TimerMode;
}

export interface TimerContextType {
  state: 'running' | 'paused' | 'idle';
  phase: 'work' | 'shortBreak' | 'longBreak';
  settings: TimerSettings;
  mode: TimerMode;
  setMode: (mode: TimerMode) => void;
  updateSettings: (settings: TimerSettings) => Promise<void>;
} 