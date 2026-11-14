/*
 * This is an example Playwright spec. A project copies and adapts it: it is not run by this
 * kit, this repository installs no Playwright, and the kit must not impose one (design D11,
 * OD-4). Adapt the per-screen navigation (the `gotoScreen` call below) to the project's own
 * routes, and wire `demo_command` (in the loop's inputs) to a script that runs this spec, for
 * example `playwright test demo/screens.spec.ts`.
 *
 * This file is deliberately self-contained: it imports nothing from this kit, so a project
 * copies this one file wherever its Playwright specs live. scripts/evidence-names.mjs remains
 * the authority for the naming contract; evidence-names.test.mjs asserts that this file's
 * inlined copy equals that module's exports, so neither can drift.
 *
 * It takes its inputs from the environment the demo step sets:
 *   - DEMO_CHANGE_ID    the OpenSpec change id, used for the evidence path
 *                       (openspec/changes/<DEMO_CHANGE_ID>/evidence/).
 *   - DEMO_SCREENS      the screens the change declares, comma-separated screen ids
 *                       (e.g. "chat-list,chat-thread").
 *   - DEMO_URL          the base URL to run the demo against (the loop's demo_url input).
 *
 * For every screen, in both themes (light, dark) and both widths (desktop, phone), it writes one
 * screenshot named with the same pattern evidence-names.mjs computes:
 *
 *   openspec/changes/<DEMO_CHANGE_ID>/evidence/<screen-id>-<theme>-<width>.png
 *
 * and records one video of the journey across all screens at
 * openspec/changes/<DEMO_CHANGE_ID>/evidence/journey.webm.
 */
import { test, type Page } from '@playwright/test';

// The same matrix and path builders as scripts/evidence-names.mjs, inlined so this file has no
// dependency on this kit. Keep these in lockstep with that module: evidence-names.test.mjs fails
// if they drift.
const THEMES = ['light', 'dark'] as const;
const WIDTHS = ['desktop', 'phone'] as const;

// The two viewport sizes the matrix fixes (design D11): desktop 1440x900, phone 390x844.
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
};

function evidenceDir(changeId: string) {
  return `openspec/changes/${changeId}/evidence`;
}

function shotPath(changeId: string, screenId: string, theme: string, width: string) {
  return `${evidenceDir(changeId)}/${screenId}-${theme}-${width}.png`;
}

function videoPath(changeId: string) {
  return `${evidenceDir(changeId)}/journey.webm`;
}

const changeId = process.env.DEMO_CHANGE_ID ?? '';
const baseUrl = process.env.DEMO_URL ?? '';
const screens = (process.env.DEMO_SCREENS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

// One screen's own navigation. A project adapts this to its own routes; the example assumes a
// screen id doubles as a path segment.
async function gotoScreen(page: Page, screenId: string) {
  await page.goto(`${baseUrl}/${screenId}`);
}

test.describe('demo evidence', () => {
  test.use({ video: { mode: 'on', size: VIEWPORTS.desktop } });

  test('records the journey and a screenshot per screen, theme and width', async ({ page, context }) => {
    for (const screenId of screens) {
      for (const theme of THEMES) {
        await page.emulateMedia({ colorScheme: theme });
        for (const width of WIDTHS) {
          const { width: w, height: h } = VIEWPORTS[width];
          await page.setViewportSize({ width: w, height: h });
          await gotoScreen(page, screenId);
          await page.screenshot({ path: shotPath(changeId, screenId, theme, width) });
        }
      }
    }

    const video = page.video();
    if (video) {
      await context.close();
      await video.saveAs(videoPath(changeId));
    }
  });
});
