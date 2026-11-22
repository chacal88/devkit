---
name: screen-mockup
description: Draws the screens a change adds or changes as files the owner can open, with data from a real example, one file per screen under the change's mock/ folder, and lists them in mockup.md. Use when a change alters a screen and the owner must approve how it looks before the plan is written, or when the owner asked for changes to a mock-up — "draw the screen", "mock this page up", "redraw it with my notes".
---

# Screen mock-up

Draw what the owner will see, so the owner approves a screen and not a description of one. The drawing is a file the owner can open with no tool installed, made from data a real user could meet.

## When to use (and when not)

- **Use** when the change's classification lists `ui`, once the requirements are written and before the proposal.
- **Use** again when the owner asked for changes: the notes in `mockup.md` are the input.
- **Don't use** to design the code behind a screen: the plan's design settles that.
- **Don't use** for a change that alters no screen: its mock-up stage does not apply and no file is written.

## Method

1. **Find the screens.** From the requirements and the code: each page, panel, dialog, terminal output, CLI message or band the change adds or changes. One file per screen.
2. **Pick the form of each screen from its target.**
   - A web page or panel: `<screen>.html`, self-contained. Inline CSS; no script that fetches; no external font, stylesheet or image. It must open from the file system with no network.
   - A terminal, CLI or band: `<screen>.md`, a fenced monospaced block at the real width of the target.
3. **Take the data from a real example.** A fixture, a seed, the change's requirements, a recorded output: name where each value comes from. Never lorem ipsum, never `foo`/`bar`, never an invented user.
4. **Write the files** under `<change folder>/mock/`. Keep no image of a screen: the HTML or the text is the deliverable.
5. **Write `mockup.md`** from its template: each screen, its file under `mock/`, and the real example its data comes from. The header stays `result=pending`: only the owner's approval sets it to `passed`.
6. **On a redraw, read the owner's notes first.** They are appended to `mockup.md` by the session. Answer each one in the drawing, keep the notes in the file, and raise the attempt by one.

## Output

`mock/<screen>.html` or `mock/<screen>.md` for each screen, and `mockup.md`, with `Outcome: drawn`. When no screen can be found in the requirements, or the real example cannot be found, return `Outcome: failure` and say what is missing.
