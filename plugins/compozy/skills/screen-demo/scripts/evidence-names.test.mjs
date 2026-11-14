// node --test plugins/compozy/skills/screen-demo/scripts/evidence-names.test.mjs
//
// Pins the demo's naming contract (design D11, AC-6 demo-contract): the eight evidence paths
// (four per screen: two themes x two widths) and the one journey video for a change, the two
// viewport sizes the matrix fixes, and that the shipped example spec declares the same contract
// in its own text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  THEMES,
  WIDTHS,
  VIEWPORTS,
  shotPath,
  shotPaths,
  videoPath,
  InvalidEvidenceNameError,
} from './evidence-names.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = join(here, '..', 'templates', 'demo', 'screens.spec.ts');

test('AC-6 demo-contract: shotPath names one screenshot under the change\'s evidence folder', () => {
  assert.equal(
    shotPath('compozy-loop-v2', 'chat-list', 'light', 'desktop'),
    'openspec/changes/compozy-loop-v2/evidence/chat-list-light-desktop.png',
  );
});

test('AC-6 demo-contract: shotPaths returns the four theme x width combinations for one screen', () => {
  assert.deepEqual(shotPaths('compozy-loop-v2', 'chat-list'), [
    'openspec/changes/compozy-loop-v2/evidence/chat-list-light-desktop.png',
    'openspec/changes/compozy-loop-v2/evidence/chat-list-light-phone.png',
    'openspec/changes/compozy-loop-v2/evidence/chat-list-dark-desktop.png',
    'openspec/changes/compozy-loop-v2/evidence/chat-list-dark-phone.png',
  ]);
});

test('AC-6 demo-contract: the eight paths for a change with two declared screens', () => {
  const screens = ['chat-list', 'chat-thread'];
  const paths = screens.flatMap((screen) => shotPaths('compozy-loop-v2', screen));
  assert.deepEqual(paths, [
    'openspec/changes/compozy-loop-v2/evidence/chat-list-light-desktop.png',
    'openspec/changes/compozy-loop-v2/evidence/chat-list-light-phone.png',
    'openspec/changes/compozy-loop-v2/evidence/chat-list-dark-desktop.png',
    'openspec/changes/compozy-loop-v2/evidence/chat-list-dark-phone.png',
    'openspec/changes/compozy-loop-v2/evidence/chat-thread-light-desktop.png',
    'openspec/changes/compozy-loop-v2/evidence/chat-thread-light-phone.png',
    'openspec/changes/compozy-loop-v2/evidence/chat-thread-dark-desktop.png',
    'openspec/changes/compozy-loop-v2/evidence/chat-thread-dark-phone.png',
  ]);
  assert.equal(paths.length, 8);
});

test('AC-6 demo-contract: videoPath names one journey.webm under the change\'s evidence folder', () => {
  assert.equal(videoPath('compozy-loop-v2'), 'openspec/changes/compozy-loop-v2/evidence/journey.webm');
});

test('AC-6 demo-contract: THEMES and WIDTHS are the two-by-two matrix, in the order the paths use', () => {
  assert.deepEqual(THEMES, ['light', 'dark']);
  assert.deepEqual(WIDTHS, ['desktop', 'phone']);
});

test('AC-6 demo-contract: VIEWPORTS fixes desktop at 1440x900 and phone at 390x844', () => {
  assert.deepEqual(VIEWPORTS, {
    desktop: { width: 1440, height: 900 },
    phone: { width: 390, height: 844 },
  });
});

test('AC-6 demo-contract: shotPath rejects a theme outside light|dark', () => {
  assert.throws(
    () => shotPath('compozy-loop-v2', 'chat-list', 'blue', 'desktop'),
    InvalidEvidenceNameError,
  );
});

test('AC-6 demo-contract: shotPath rejects a width outside desktop|phone', () => {
  assert.throws(
    () => shotPath('compozy-loop-v2', 'chat-list', 'light', 'tablet'),
    InvalidEvidenceNameError,
  );
});

// ---------------------------------------------------------------- the shipped example spec

test('AC-6 demo-contract: the shipped example spec declares both themes and both widths', () => {
  const text = readFileSync(SPEC_PATH, 'utf8');
  assert.match(text, /\blight\b/);
  assert.match(text, /\bdark\b/);
  assert.match(text, /\bdesktop\b/);
  assert.match(text, /\bphone\b/);
});

test('AC-6 demo-contract: the shipped example spec declares the journey video', () => {
  const text = readFileSync(SPEC_PATH, 'utf8');
  assert.match(text, /journey\.webm/);
});

test('AC-6 demo-contract: the shipped example spec declares the same screenshot name pattern as the helper', () => {
  const text = readFileSync(SPEC_PATH, 'utf8');
  const literalPattern = /<screen-id>-<theme>-<width>\.png/;
  const interpolatedPattern = /\$\{.*screen.*\}-\$\{.*theme.*\}-\$\{.*width.*\}\.png/i;
  // The spec is now self-contained (it inlines the helper's path builders), so both forms must
  // be present: the literal in the header prose, and the interpolated template literal in the
  // inlined shotPath function. Either alone would mean one of the two has gone missing.
  assert.ok(
    literalPattern.test(text),
    'expected the spec\'s header to state the <screen-id>-<theme>-<width>.png name pattern',
  );
  assert.ok(
    interpolatedPattern.test(text),
    'expected the spec\'s inlined shotPath to interpolate screen, theme and width into the name',
  );
});

// ----------------------------------------------- the spec's inlined contract equals the helper's

// The spec no longer imports evidence-names.mjs (a copied file must be self-contained); these
// tests are the drift protection that import used to give. They read the spec's text and compare
// its inlined THEMES, WIDTHS, VIEWPORTS and path builders against the helper's actual exports, so
// a change to one without the other fails here.

function extractBracketed(text, constName) {
  const match = text.match(new RegExp(`const ${constName} = \\[([^\\]]*)\\]`));
  assert.ok(match, `expected the spec to declare a ${constName} array`);
  return match[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

function extractTemplateLiteral(text, fnName) {
  const match = text.match(new RegExp(`function ${fnName}\\([^)]*\\)\\s*\\{\\s*return\\s*\`([^\`]*)\``));
  assert.ok(match, `expected the spec to declare a ${fnName} function returning a template literal`);
  return match[1];
}

test('AC-6 demo-contract: the spec inlines exactly THEMES', () => {
  const text = readFileSync(SPEC_PATH, 'utf8');
  assert.deepEqual(extractBracketed(text, 'THEMES'), THEMES);
});

test('AC-6 demo-contract: the spec inlines exactly WIDTHS', () => {
  const text = readFileSync(SPEC_PATH, 'utf8');
  assert.deepEqual(extractBracketed(text, 'WIDTHS'), WIDTHS);
});

test('AC-6 demo-contract: the spec inlines exactly VIEWPORTS (desktop 1440x900, phone 390x844)', () => {
  const text = readFileSync(SPEC_PATH, 'utf8');
  const desktopMatch = text.match(/desktop:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}/);
  const phoneMatch = text.match(/phone:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}/);
  assert.ok(desktopMatch, 'expected the spec to declare a desktop viewport size');
  assert.ok(phoneMatch, 'expected the spec to declare a phone viewport size');
  assert.deepEqual(
    {
      desktop: { width: Number(desktopMatch[1]), height: Number(desktopMatch[2]) },
      phone: { width: Number(phoneMatch[1]), height: Number(phoneMatch[2]) },
    },
    VIEWPORTS,
  );
});

test('AC-6 demo-contract: the spec\'s inlined shotPath and videoPath produce the same strings as the helper', () => {
  // This substitutes the sample values into the spec's own template-literal text (extracted by
  // regex, never executed as code) and compares the resulting strings to the helper's output for
  // the same inputs. It proves the inlined builders compose the same directory, separators,
  // field order and extension as the helper for a representative input. It does not prove the
  // inlined functions behave identically for every possible input, that they are type-correct,
  // or that they validate theme/width the way the helper does (the spec intentionally does not).
  const text = readFileSync(SPEC_PATH, 'utf8');
  const evidenceDirTemplate = extractTemplateLiteral(text, 'evidenceDir');
  const shotPathTemplate = extractTemplateLiteral(text, 'shotPath');
  const videoPathTemplate = extractTemplateLiteral(text, 'videoPath');

  const sample = { changeId: 'compozy-loop-v2', screenId: 'chat-list', theme: 'light', width: 'desktop' };
  const dirValue = evidenceDirTemplate.replace('${changeId}', sample.changeId);

  const shotValue = shotPathTemplate
    .replace('${evidenceDir(changeId)}', dirValue)
    .replace('${screenId}', sample.screenId)
    .replace('${theme}', sample.theme)
    .replace('${width}', sample.width);
  assert.equal(shotValue, shotPath(sample.changeId, sample.screenId, sample.theme, sample.width));

  const videoValue = videoPathTemplate.replace('${evidenceDir(changeId)}', dirValue);
  assert.equal(videoValue, videoPath(sample.changeId));
});

test('AC-6 demo-contract: the shipped example spec states, in its own header, that it is an example to copy and adapt', () => {
  const text = readFileSync(SPEC_PATH, 'utf8');
  const header = text.slice(0, text.indexOf('*/') > -1 ? text.indexOf('*/') : 400);
  assert.match(header, /example/i);
  assert.match(header, /copy|adapt/i);
});
