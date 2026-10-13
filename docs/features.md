# Features

Capture Studio has two entry points that share the same capture ideas. The website in `dist/` runs as a normal page. The extension in `extension/` can see the current tab, stitch a scrolling page, and keep recording after its popup closes.

## Website

Open the page, pick Desktop, Camera only, Browser tab, or Custom area, then set microphone, system audio, camera overlay, resolution, frame rate, format, bitrate, and countdown.

Quality is applied on a canvas. The output follows the source aspect ratio, uses even dimensions, and leaves a smaller source at its own size. Pause, resume, and stop are on the page. Finished captures go into an IndexedDB library in that browser, where you can rename, delete, or download them. Settings persist in the browser.

A website cannot capture another tab on its own or stitch a full scrolling page. Those actions are in the extension. The page always goes through the browser's source picker.

Screenshot capture and library Edit open `editor.html` in a separate tab. The editor includes pen, rectangle, ellipse, directional arrows, inline multiline text, opaque redaction, select/move/delete, stroke and font size, zoom, undo/redo, and Apply/Cancel crop. Copy image writes the rendered PNG through the Clipboard API. Download PNG exports the file. Save to library updates the existing capture. Edits stay in the editor until you save them. Closing with unsaved edits asks for confirmation. Screenshots are stored in the local library first so the editor can reload on its own.

The capture click reserves an editor tab in a way that keeps the browser's user-activation for the capture request. If a popup blocker stops that tab, use the Open screenshot editor link. If the clipboard refuses the image, the editor offers a download instead. The editor and the studio pass capture updates through IndexedDB and a same-origin message. Screenshots are not uploaded.

## Extension

Load `extension/` unpacked. The popup has two tabs.

Screenshot:

- **Visible part** captures the current tab viewport.
- **Full page** scrolls the current tab, captures PNG slices, restores the original scroll position, and opens the editor.
- **Selected area** lets you drag on the source page. Escape cancels and opens no tab.

Each successful screenshot opens exactly one editor tab. The service worker stores an ID-scoped payload, `editor.html` assembles or crops the PNG, saves it to the extension IndexedDB library, and removes the temporary payload. Failures show in the popup with an extension badge.

Keep the source tab active during a full-page capture. The extension uses `activeTab` and does not request permission to read every website. Installation and the real screen-sharing picker need a person at the browser.

Record:

- Desktop, Camera only, Browser tab, and Custom area.
- Microphone, source audio, and camera overlay. Camera-only disables the overlay and source audio.
- Quality, frame rate, format, and, under More settings, bitrate and countdown.

Preferences persist in extension storage. **Start recording** starts the capture from the popup. Camera, current-tab, and selected-area recordings continue in an offscreen document, so the popup can close. Desktop capture uses a small source-picker window that minimizes while recording and closes after saving. Reopen the popup to pause, resume, or stop. A saved recording opens a local preview with rename and download. The recorder is omitted from its own screen-sharing suggestions.

## Storage

Website captures live in that origin's IndexedDB. Extension captures live in the extension's IndexedDB. Neither copy is uploaded. Download anything you need outside the browser.
