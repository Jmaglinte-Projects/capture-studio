# Verification record

These notes are the checks recorded while the project was built. They describe the runs that passed at the time. They are not a substitute for trying a capture on your own machine. Real screen and camera permission prompts, and installing the unpacked extension, still need a person at the browser.

The extension manifest is currently 1.4.2. Earlier sections below keep the version labels they were written under.

## Reference evidence

REA controlled visit: `ev_4ebea9efe5b745c868de5150fc2f30556c53aae57e9d3e64db36c3e9819e779e`.

REA homepage DOM and accessibility inspection: `ev_4582aaa197a8151b52a5a260b7343da41f41105490c4e961053ac6ae5c86a521`. The public homepage promotes extension installation, recording screen and camera, local save, screenshots, annotation, sharing, and integrations. That visit does not establish extension internals or authenticated cloud behavior. The supplied screenshot establishes the recorder option layout. Implementation code is independently written.

## Website

Browser tests passed in Chrome 154 using synthetic media: MediaRecorder video and audio encoding at 1920 × 1080, pause and resume, PNG editing and undo, IndexedDB persistence and renaming, a narrow mobile width, and no page errors. A synthetic 2560 × 1440 display stream also checked canvas scaling, encoded video playback, custom-area recording, and permission-refusal cleanup.

`tests/editor.cjs` covers the editor with a synthetic display stream: new-tab handoff, redaction output pixels, drawing colors after cancelled crops, select/move/delete, multiline text, all drawing tools, reverse-direction crop with exact output dimensions, undo and redo across crops, clipboard PNG readback, PNG download, edited-image persistence and reload, popup-blocker recovery, clipboard-refusal feedback, and mobile width.

Stroke, text size, and zoom dropdowns share one styled select: consistent trigger height, reserved arrow spacing, a check on the selected item, a menu that stays in the viewport, keyboard navigation and typeahead, and dismissal on Escape or an outside click. Zoom plus and minus update the displayed selection. `tests/dropdown.cjs` checks selection, dismissal, output stroke pixels, and mobile positioning. The editor regression checks passed with it.

## Extension 1.1.0

The capture service worker stores an ID-scoped screenshot payload and opens `editor.html` directly. The editor assembles or crops the PNG, saves it to the extension IndexedDB library, and removes the temporary payload. No intermediate `index.html` tab is opened. Failures appear in the popup with an extension badge. A cancelled selection creates no tab.

`tests/extension.cjs` loads the extension into an isolated Chromium profile and calls `captureVisibleTab` against a local page. A disposable test manifest grants capture permissions for automation. The production manifest keeps `activeTab` and does not add broad host permissions. Checks passed for visible viewport pixels, a 200 × 160 selected area, a 1000 × 2600 stitched full page, one new editor tab per capture with no index tab, restored source scroll and style, editor reload persistence, and Escape cancellation. Editor, clipboard, and dropdown regression tests also passed.

## Extension 1.2.0 popup

That pass described a Record tab with desktop, camera, browser tab, and custom-area selection, microphone, source-audio, and camera-overlay switches, quality, frame rate, and output format, plus bitrate and countdown under More settings. Preferences persisted across reload. The checks also covered camera-overlay disabling, all four record modes, quality, audio, bitrate, and countdown handoff, one screenshot editor tab, and the synthetic MediaRecorder camera and audio path with pause, resume, and persistence.

The popup copy in that pass said recording continued in a recorder tab. Current builds start recording from the popup and keep it in an offscreen document, with a source-picker window for desktop capture. See [features.md](features.md).
