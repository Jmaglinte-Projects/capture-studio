# Capture Studio

A working, independent browser recorder inspired by the supplied Awesome Screenshot recorder UI. Open the hosted HTTPS URL in desktop Chrome or Edge. To run locally: `python3 -m http.server 5173 --directory dist`, then open http://localhost:5173.

Implemented: screen/window/tab selection, camera-only, screen with camera overlay, cropped-region recording; 720p/1080p/1440p/4K target heights, 24/30/60 fps, 2–32 Mbps; microphone and available system/tab audio mixed together; countdown, pause/resume, stop; WebM and browser-supported MP4; screenshots with pen, rectangle, arrow, text, solid pixel redaction, crop and undo; IndexedDB library, rename, delete and downloads; persistent settings and responsive UI.

Quality uses a canvas to enforce output dimensions and cropping. Source aspect ratio is retained, dimensions are even, and smaller sources are not upscaled. Requested fps and bitrate are targets, not guarantees. Actual throughput depends on the device. Keep the page open while recording; browsers may throttle background tabs. Long recordings consume memory, and browser storage quota varies. Download important captures.

The browser always asks the user to select a source. Screen/tab audio depends on platform and picker settings. MP4 is disabled if MediaRecorder cannot encode it. This version has local storage; no account, cloud upload, remote sharing, integrations, or automatic full scrolling page capture. Those require backend services or extension permissions and are not represented as working features.

## Reference evidence

REA controlled visit: ev_4ebea9efe5b745c868de5150fc2f30556c53aae57e9d3e64db36c3e9819e779e.
REA homepage DOM/accessibility inspection: ev_4582aaa197a8151b52a5a260b7343da41f41105490c4e961053ac6ae5c86a521. Observed public homepage promotes extension installation, recording screen/camera, local save, screenshots, annotation, sharing and integrations. This does not establish extension internals or authenticated cloud behavior. The supplied screenshot establishes the recorder option layout. Implementation code is independently written.

## Companion Chrome / Edge extension

In `chrome://extensions` (or `edge://extensions`), enable Developer mode, choose **Load unpacked**, and select this project's `extension` folder. Pin Capture Studio. **Open recorder** opens the same functional studio as an extension page. The **Screenshot** popup offers **Visible part**, **Full page**, **Selected area**, and **Visible part after 3 seconds**. Each mode opens exactly one editor tab; it does not open the studio. Full page scrolls the current tab, captures PNG slices, restores the original scroll position, and opens the annotation editor. Selected area lets you drag directly on the source page; Escape cancels without opening a tab. Full-page capture is capped at 16,000 CSS pixels per dimension to bound memory; unusually large output is resized to at most 40 million pixels. Keep the source tab active during capture. Browser-internal pages are not capturable; Fixed and sticky elements are hidden after the first full-page slice and restored afterward. Dynamic pages and independently scrolling containers may still require manual capture. The extension uses activeTab rather than permission to read all websites; captured images are stored locally. The installation and real screen sharing picker require user interaction.

## Verification

Browser tests passed in Chrome 154 using synthetic media: actual MediaRecorder video/audio encoding at 1920 × 1080, pause/resume, PNG editing and undo, IndexedDB persistence and renaming, responsive mobile width, and no page errors. A synthetic 2560 × 1440 display stream additionally verified canvas scaling, encoded video playback, custom-area recording, and permission refusal cleanup. Real screen/camera hardware permission prompts and installation of the companion extension remain manual checks.

## Dedicated screenshot editor

Screenshot capture and library Edit now open `editor.html` in a separate tab. The editor provides pen, rectangle, ellipse, directional arrows, inline multiline text, opaque redaction, select/move/delete, stroke and font size controls, zoom, undo/redo, and explicit Apply/Cancel crop. Copy image writes the rendered PNG to the clipboard through the browser Clipboard API; Download PNG exports it, and Save to library updates the existing capture. Edits remain in the editor until saved; closing with unsaved edits asks for confirmation. Screenshots are initially stored in the local library so the editor can reload independently.

A waiting tab is reserved during the capture click to accommodate popup restrictions; the browser's capture request is invoked before opening it so transient user activation is preserved. If a browser blocks the editor tab, use the Open screenshot editor link. Clipboard denial and unsupported image-copy APIs show a download alternative. The editor and studio exchange capture updates through IndexedDB and a same-origin message handoff; screenshots are not uploaded.

Additional browser verification: new-tab handoff, redaction output pixels, drawing colors after cancelled crops, select/move/delete, multiline text, all drawing tools, reverse-direction crop with exact output dimensions, undo/redo across crops, real clipboard PNG readback, PNG download, edited-image persistence and reload, popup blocker recovery, clipboard refusal feedback, and mobile width. `tests/editor.cjs` exercises these paths with a synthetic display stream.

Editor Stroke, Text size, and Zoom dropdowns now share a styled select component with consistent trigger heights, reserved arrow spacing, selected checks, viewport-aware floating menus, keyboard navigation/typeahead, and Escape/outside-click dismissal. Zoom +/- updates the displayed selection. `tests/dropdown.cjs` verifies selection, dismissal, output stroke pixels, and mobile positioning; the existing editor regression checks also passed.

## Extension 1.1.0 verification

The capture service worker now stores an ID-scoped screenshot payload and opens editor.html directly. The editor assembles/crops the PNG, saves it to the extension IndexedDB library, and removes the temporary payload. No intermediate index.html tab is opened. Failures appear in the popup with an extension badge; cancelled selections create no tabs.

`tests/extension.cjs` loads the actual extension into an isolated Chromium profile and exercises real captureVisibleTab against a local page. A disposable test manifest grants capture permissions for automation; the production manifest retains activeTab without broad host permissions. Checks passed for visible viewport pixels, a 200 × 160 selected area, a 1000 × 2600 stitched full page, one new editor tab per capture with no index tab, restored source scroll/style, editor reload persistence, and Escape cancellation. Editor/clipboard and dropdown regression tests also passed.
