#!/usr/bin/env node
// evidence-names: the demo's naming contract (design D11, AC-6 demo-contract).
//
// Pure functions from a change id and a screen id to the evidence paths the demo writes under
// openspec/changes/<id>/evidence/: one screenshot per screen for each theme (light, dark) and
// each width (desktop, phone) — the eight paths for two screens, four for one — plus one
// journey.webm per change. No I/O, no dependencies: this module only names paths, it never
// writes them.
//
//   openspec/changes/<id>/evidence/<screen-id>-<theme>-<width>.png
//   openspec/changes/<id>/evidence/journey.webm
//
// THEMES, WIDTHS and VIEWPORTS are exported so a project's demo spec (see
// templates/demo/screens.spec.ts) drives its loop and its browser contexts from the same matrix
// this module names, rather than repeating the four combinations by hand.

export const THEMES = ['light', 'dark'];
export const WIDTHS = ['desktop', 'phone'];

// The two viewport sizes the matrix fixes (design D11): desktop 1440x900, phone 390x844.
export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
};

export class InvalidEvidenceNameError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidEvidenceNameError';
  }
}

function assertTheme(theme) {
  if (!THEMES.includes(theme)) {
    throw new InvalidEvidenceNameError(`theme must be one of ${THEMES.join('|')}, got "${theme}"`);
  }
}

function assertWidth(width) {
  if (!WIDTHS.includes(width)) {
    throw new InvalidEvidenceNameError(`width must be one of ${WIDTHS.join('|')}, got "${width}"`);
  }
}

// The change's evidence folder: openspec/changes/<id>/evidence.
export function evidenceDir(changeId) {
  return `openspec/changes/${changeId}/evidence`;
}

// One screenshot's path for a screen, a theme and a width.
export function shotPath(changeId, screenId, theme, width) {
  assertTheme(theme);
  assertWidth(width);
  return `${evidenceDir(changeId)}/${screenId}-${theme}-${width}.png`;
}

// The four screenshot paths for one screen (both themes x both widths), in a fixed order:
// light-desktop, light-phone, dark-desktop, dark-phone.
export function shotPaths(changeId, screenId) {
  const paths = [];
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      paths.push(shotPath(changeId, screenId, theme, width));
    }
  }
  return paths;
}

// The one journey video path for a change.
export function videoPath(changeId) {
  return `${evidenceDir(changeId)}/journey.webm`;
}
