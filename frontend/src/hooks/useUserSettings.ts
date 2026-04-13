import { useState, useEffect, useCallback } from 'react';

export interface UserSettings {
  // Markup Defaults
  defaultColor: string;
  defaultStrokeWidth: number;
  defaultLineStyle: string;
  defaultFontSize: number;
  defaultSubject: string;
  defaultStatus: string;
  recentColors: string[];
  // Permissions
  allowOthersEdit: boolean;
  allowOthersDelete: boolean;
  // Behavior
  autoSelectAfterDraw: boolean;
  confirmOnDelete: boolean;
  snapToGrid: boolean;
  gridSize: number;
  measurementUnits: 'metric' | 'imperial';
  // Interface
  showPolylineLength: boolean;
  // Collaboration
  showCursors: boolean;
  autoImportAnnotations: boolean;
  // Visual
  pulseReviewMarkups: boolean;
  pulseColor: string;
  pulseIntensity: 'low' | 'medium' | 'high';
  showAuthorOnMarkup: boolean;
  // Wheel
  wheelItems: string[]; // tool IDs in the wheel
}

const DEFAULTS: UserSettings = {
  defaultColor: '#d32f2f',
  defaultStrokeWidth: 2,
  defaultLineStyle: 'solid',
  defaultFontSize: 14,
  defaultSubject: '',
  defaultStatus: 'none',
  recentColors: [],
  allowOthersEdit: false,
  allowOthersDelete: false,
  autoSelectAfterDraw: true,
  confirmOnDelete: false,
  snapToGrid: false,
  gridSize: 10,
  measurementUnits: 'metric',
  showPolylineLength: true,
  showCursors: true,
  autoImportAnnotations: true,
  pulseReviewMarkups: false,
  pulseColor: '#00e5ff',
  pulseIntensity: 'medium',
  showAuthorOnMarkup: false,
  wheelItems: ['select', 'pen', 'rect', 'cloud', 'callout', 'text', 'arrow', 'measure'],
};

const MAX_RECENT_COLORS = 8;

function loadSettings(userId?: string): UserSettings {
  if (!userId) return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(`userSettings-${userId}`);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* */ }
  return { ...DEFAULTS };
}

function saveSettings(userId: string, settings: UserSettings) {
  try { localStorage.setItem(`userSettings-${userId}`, JSON.stringify(settings)); } catch { /* */ }
}

export function useUserSettings(userId?: string): [UserSettings, (patch: Partial<UserSettings>) => void] {
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings(userId));

  useEffect(() => { setSettings(loadSettings(userId)); }, [userId]);

  // Sync across components: listen for custom event when settings change
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.userId === userId) setSettings(loadSettings(userId));
    };
    window.addEventListener('userSettingsChanged', handler);
    return () => window.removeEventListener('userSettingsChanged', handler);
  }, [userId]);

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      // Auto-manage recent colors
      if (patch.defaultColor && patch.defaultColor !== prev.defaultColor) {
        const colors = [patch.defaultColor, ...prev.recentColors.filter(c => c !== patch.defaultColor)].slice(0, MAX_RECENT_COLORS);
        next.recentColors = colors;
      }
      if (userId) {
        saveSettings(userId, next);
        // Notify all useUserSettings instances across components
        window.dispatchEvent(new CustomEvent('userSettingsChanged', { detail: { userId } }));
      }
      return next;
    });
  }, [userId]);

  return [settings, updateSettings];
}
