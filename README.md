# Context-Carry
### Move your context across ChatGPT, Claude, Gemini & Grok — instantly.

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Available-blue?logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/okjnafabngnahdppmbnmefofokpegccm)
[![中文說明](https://img.shields.io/badge/Language-繁體中文-blue)](README_zh-TW.md)
![Version](https://img.shields.io/badge/version-1.6.3-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**Context-Carry** is a lightweight Chrome extension that helps you capture, clean, organize, and send text or code between AI tools — no messy formatting, no painful copy-paste.

---

## Quick Start
1. **Select & Capture** — use **➕ button** or **Paintbrush (`Alt + C`)**
2. **Organize** — reorder or edit snippets in the **Context Basket**
3. **Drop & Send**
   - Drag to the **Transport Drone** widget
   - Send to **ChatGPT / Claude / Gemini / Grok / Local LLM**
4. **Workflow (Canvas)** — connect nodes to run up to **10 models** in a chain
5. **Compare (Multi-Node View)** — run up to **3 models side-by-side**

---

## Features
- 📥 **Universal Capture** (any webpage or AI chat)
- 🖌️ **Visual Paintbrush Select** (`Alt + C`)
- 🧺 **Context Basket** (edit, reorder, stage)
- 🚁 **Transport Drone** (floating drag-and-drop widget)
- 🤖 **Multi-Node Compare** (max 3 parallel models)
- 🧠 **Workflow Canvas** (max 10 model pipeline)
- 📂 **File Import** (`.txt`, `.md`, `.json`, code files)
- 🏠 **Local LLM Support** (Ollama / LM Studio via `localhost`)
- 🔑 **BYO API Keys** (stored locally, never uploaded)

---

## Demo

<table>
  <tr>
    <td width="48%">
      <h3 align="center">Multi-Node View</h3>
      <img src="screenshots_git/node.webp" width="100%" />
    </td>
    <td width="48%">
      <h3 align="center">PIP Mode</h3>
      <img src="screenshots_git/pip.webp" width="100%" />
    </td>
  </tr>

  <tr>
    <td width="48%">
      <h3 align="center">Circle Select</h3>
      <img src="screenshots_git/circle.webp" width="100%" />
    </td>
    <td width="48%">
      <h3 align="center">Drag & Drop</h3>
      <img src="screenshots_git/drag.webp" width="100%" />
    </td>
  </tr>

  <tr>
    <td width="48%">
      <h3 align="center">Cross-Window</h3>
      <img src="screenshots_git/cross_window.webp" width="100%" />
    </td>
    <td width="48%">
      <h3 align="center">Cross-Window Input</h3>
      <img src="screenshots_git/cross_input.webp" width="100%" />
    </td>
  </tr>
</table>

---

## Installation
### 1) From Chrome Web Store (Recommended)
[Install from Chrome Web Store](https://chromewebstore.google.com/detail/okjnafabngnahdppmbnmefofokpegccm)

### 2) Manual Install (Developer Mode)
1. Download this repo
2. Open Extensions page
3. Enable **Developer Mode**
4. Click **Load unpacked**
5. Select the extension folder

---

## Shortcuts
| Hotkey | Action |
|--------|--------|
| **Alt + M** | Toggle panel |
| **Alt + C** | Paintbrush capture |
| **Alt + L** | Switch UI language |

---

## Contribute
```bash
git clone https://github.com/gordonsay/Context-Carry.git
```

---

## Important Development Notes

### Modifications to `html2pdf.bundle.min.js`
To comply with the Chrome Extension Manifest V3 **Blue Argon (Remote Hosted Code)** policy, `lib/html2pdf.bundle.min.js` has been manually patched. **Do not directly update or overwrite this file.**

* **Modification Details**: The hardcoded CDN link (`https://cdnjs...`) for `pdfobject.min.js` was removed from the source code.
* **Mechanism**: The local file path (`lib/pdfobject.min.js`) is injected dynamically via the `opt.pdfObjectUrl` parameter in `content.js`.
* **Update Instructions**: If this library needs to be updated in the future, you must re-apply this patch (search for the CDN URL in the source code and clear it).

## Privacy & License
[README (繁體中文)](README_zh-TW.md) | [Privacy Policy](PRIVACY.md) | [License (MIT)](LICENSE)

## Support
If this extension saved you time, consider buying me a coffee!

<a href="https://www.buymeacoffee.com/gordonsay">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="150" />
</a>