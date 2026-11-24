// The dry run of proof/replay.mjs names the cut of a live replay (design D-13). Run: `node --test openspec/changes/forced-merge-path/proof/replay.test.mjs`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { dryRun } from './replay.mjs';

const opts = (over = {}) => ({ beforeRef: 'origin/main', fixture: null, pr: null, ...over });

test('dry run of a live case prints REPLAY_MAX_PR with the pull request number', () => {
  assert.match(dryRun('pr88', opts()), /REPLAY_MAX_PR=88/);
});

test('dry run of a resolve case prints the number given by --pr', () => {
  assert.match(dryRun('pr91', opts()), /REPLAY_MAX_PR=91/);
  assert.match(dryRun('delivery-train', opts({ pr: 95 })), /REPLAY_MAX_PR=95/);
});

test('dry run of a resolve case with no number says the cut is the number it resolves', () => {
  assert.match(dryRun('delivery-train', opts()), /REPLAY_MAX_PR=<the number the case resolves>/);
});

test('dry run of a fixture case prints no REPLAY_MAX_PR', () => {
  assert.doesNotMatch(dryRun('pr88-partial', opts()), /REPLAY_MAX_PR/);
});
