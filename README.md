# Context-Carry — Move Your Chat Context Between ChatGPT, Claude, Grok & Gemini in One Click

<details>
  <summary>Table of Contents</summary>

- [Quick Start](#quick-start)
- [Typical Use Cases](#typical-use-cases)
- [Key Features](#key-features-what-makes-context-carry-different)
- [Screenshots](#screenshots)
- [Installation](#installation)
- [How to Use](#how-to-use)
- [Privacy](#privacy)
- [Development](#development)
- [License](#license)

</details>

[![中文說明](https://img.shields.io/badge/Language-繁體中文-blue)](README_zh-TW.md)
![Version](https://img.shields.io/badge/version-1.4.2-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**Stop rewriting the same prompt. Carry your full context across AI platforms instantly.**

Context-Carry is a lightweight Chrome extension that lets you:

- ✅ Extract chat history from ChatGPT, Claude, Gemini, and Grok  
- ✅ **Visually select** text from any webpage using a paintbrush tool  
- ✅ Reorder everything into a clean, structured context  
- ✅ Auto-fill it into a new AI chat with one click  
- ✅ Avoid context limit errors with **cross-tab synchronized** token estimation

This tool is built for developers, researchers, and power users who constantly switch between AI platforms and hate rebuilding the same context again and again.

> If you use multiple AI tools daily, this extension saves you hours every week.

> **[點此查看中文說明 (Traditional Chinese Version)](README_zh-TW.md)**

## Quick Start

1. Open **ChatGPT / Claude / Gemini**
2. Click the floating **Context-Carry panel**
3. Click **➕** to capture messages  
   (or **Shift + Click** for batch selection)
4. Open another AI platform tab
5. Click **New Chat** → ✅ Auto-filled instantly

That’s it. No copy-paste. No reformatting.

## Typical Use Cases

- 🔁 Move a long ChatGPT discussion directly into Claude for deeper reasoning  
- 🖌️ Visually circle code snippets or paragraphs on a documentation site to capture them instantly  
- 🧪 Carry debugging conversations between multiple LLMs  
- 📚 Collect documentation + StackOverflow answers + chat history into one clean prompt  
- 📏 Avoid context limit crashes with real-time token calculation

## Key Features (What Makes Context-Carry Different)

- **Visual Area Selection (New! 🖌️)**: Activate the paintbrush mode to freely circle any area on a webpage. All text inside your drawing is automatically extracted and cleaned.
- **Smart Export Options (New!)**: When exporting, if you have both "Basket Items" and "Current Page Selection," the extension intelligently asks if you want to export **only the basket**, **only the page**, or **merge both**.
- **Clean Context Architecture**: System prompts (Prefixes) are now managed separately from content. Adding items to the basket creates "clean" data, ensuring you don't get repetitive system prompts when merging multiple sources.
- **Cross-Window Token Sync**: Token estimation is now synchronized across tabs. Adding an item in Tab A immediately updates the estimated token count in Tab B.
- **Cross-Window Context Basket**: The ultimate staging area. Collect snippets from ChatGPT in one tab, a documentation page in another, and a StackOverflow answer in a third.
- **Drag-and-Drop Reordering**: Context matters, and so does order. Open the basket preview to drag and rearrange your snippets before transferring.
- **Magic Auto-Fill**: Automatically opens the target AI platform and pastes your context.
- **Markdown Formatting**: Automatically converts HTML content (headers, bold text, code blocks) into clean Markdown for better AI comprehension.

## Screenshots

![Context-Carry Demo](screenshots/demo.gif)

![Context-Carry Demo](screenshots/circle.gif)

![Simple UI](screenshots/screenshot_gpt.png)

![Advanced UI](screenshots/screenshot_gpt_advanced.png)

## Keyboard Shortcuts

Work faster with these built-in hotkeys:

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| **Alt + M** | Toggle Panel | Open or close the Context-Carry interface |
| **Alt + Z** | Area Select | Activate the Paintbrush tool to circle text |
| **Alt + L** | Switch Language | Toggle UI language between English and Chinese |

## Installation

### From Chrome Web Store
Coming soon.

### Manual Installation (Developer Mode)
1. Download the latest release source code or clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Toggle **Developer mode** in the top right corner.
4. Click **Load unpacked**.
5. Select the folder containing this extension's files.

## How to Use

### Method 1: Capturing AI Chat History
1. Open a chat on any supported AI platform.
2. Click the **Context-Carry** floating panel.
3. Click **➕** to select messages (or **Shift + Click** for range selection).
4. Click **Add (+)** to send them to the Basket.

### Method 2: Visual Area Selection (Paintbrush)
1. Click the **Paintbrush 🖌️** icon in the panel (or press **Alt + Z**).
2. Draw a shape around any text on the screen.
3. A preview modal will appear showing the captured text.
4. Click **Add to Basket** to save it.

### Method 3: Capturing via Right-Click
1. Highlight text on any website.
2. **Right-Click** the selected text.
3. Choose **"Add to Context Basket (+)"** from the menu.

### Method 4: Exporting & Transferring
1. **Review**: Open the basket preview to reorder items if needed.
2. **Export**: Click "Export to .txt" or "Copy to Clipboard".
   - *Smart Choice*: If you have both a basket and a current selection, a popup will ask which one you want to export (or merge both).
3. **Transfer**: Click a platform icon (e.g., Claude 🧠) to open a new tab with the context pre-filled.

## Privacy

This extension respects your privacy.
- It operates entirely on the client side.
- It uses `chrome.storage.local` strictly for temporarily passing text between tabs.
- **Zero Data Collection**: We do not transmit any user data to external servers.
- **Auto-Cleanup**: All stored context is automatically cleared when you restart your browser.
- See [PRIVACY.md](PRIVACY.md) for full details.

## Development

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Clone the repo:
   ```bash
   git clone https://github.com/gordonsay/Context-Carry.git
   ```

## Disclaimer

This extension is not affiliated with OpenAI, Anthropic, Google, or xAI.  
All product names, logos, and brands are property of their respective owners.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes and updates.


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


## Contact

For questions or support, please open an issue on the [GitHub repository](https://github.com/gordonsay/Context-Carry).


## Note

Due to browser security restrictions, file attachments (PDF/Images) cannot be transferred automatically.

## Keywords

ChatGPT Chrome Extension, Claude Context Tool, Gemini Prompt Transfer, LLM Context Manager, Prompt Engineering Tool, AI Workflow Assistant, Cross-LLM Chat Transfer
