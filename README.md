# Context-Carry — Move Your Chat Context Between ChatGPT, Claude, Grok & Gemini in One Click

## Table of Contents

- [Quick Start](#quick-start)
- [Typical Use Cases](#typical-use-cases)
- [Key Features](#key-features-what-makes-context-carry-different)
- [Screenshots](#screenshots)
- [Installation](#installation)
- [Hpw to use](#how-to-use)
- [Privacy](#privacy)
- [Development](#development)
- [Disclaimer](#disclaimer)
- [Changelog](#changelog)
- [License](#license)
- [Contact](#contact)
- [Note](#note)
- [Keywords](#keywords)

[![中文說明](https://img.shields.io/badge/Language-繁體中文-blue)](README_zh-TW.md)
![Version](https://img.shields.io/badge/version-1.4.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**Stop rewriting the same prompt. Carry your full context across AI platforms instantly.**

Context-Carry is a lightweight Chrome extension that lets you:

- ✅ Extract chat history from ChatGPT, Claude, Gemini, and Grok  
- ✅ Capture important text from any website (docs, blogs, StackOverflow)  
- ✅ Reorder everything into a clean, structured context  
- ✅ Auto-fill it into a new AI chat with one click  
- ✅ Avoid context limit errors with real-time token estimation  

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
- 🧪 Carry debugging conversations between multiple LLMs  
- 📚 Collect documentation + StackOverflow answers + chat history into one clean prompt  
- 🧠 Reuse well-structured prompts without copy-pasting  
- 📏 Avoid context limit crashes with token-aware transfers  

## Key Features (What Makes Context-Carry Different)

- **Universal Web Capture (New!)**: Not just for AI chats! Right-click on any text on any website to add it to your Context Basket instantly.
- **Cross-Window Context Basket**: The ultimate staging area. Collect snippets from ChatGPT in one tab, a documentation page in another, and a StackOverflow answer in a third.
- **Drag-and-Drop Reordering (New!)**: Context matters, and so does order. Open the basket preview to drag and rearrange your snippets before transferring.
- **Token Intelligence (New!)**: Real-time token estimation and smart warnings ensure your context fits within the target AI's limits (e.g., Gemini's 1M window vs. ChatGPT's 32k).
- **Magic Auto-Fill**: Automatically opens the target AI platform and pastes your context.
- **Markdown Formatting**: Automatically converts HTML content (headers, bold text, code blocks) into clean Markdown for better AI comprehension.
- **Seamless Transfer**: Instantly move your curated context to ChatGPT 🤖, Claude.ai 🧠, Google Gemini 💎, and Grok ✖️.
- **Draggable Interface**: The panel is now draggable, so it never blocks your view.

## Screenshots

![Context-Carry Demo](screenshots/demo.gif)

![Simple UI](screenshots/screenshot_gpt.png)

![Advanced UI](screenshots/screenshot_gpt_advanced.png)

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
1. Open a chat on any supported AI platform (ChatGPT, Claude, Gemini, Grok).
2. Click the **Context-Carry** floating panel.
3. Click **➕** to select messages (or **Shift + Click** for range selection).
4. Click **Add (+)** to send them to the Basket.

### Method 2: Capturing from Any Website
1. Highlight text on any website (docs, news, blogs, coding forums).
2. **Right-Click** the selected text.
3. Choose **"Add to Context Basket (+)"** from the menu.
4. The extension icon badge will update to show the item count.

### Method 3: Organizing & Transferring
1. Open the Context-Carry panel.
2. **Review & Reorder**: Click the arrow (**▼**) in the Basket section. **Drag and drop** items to arrange the conversation flow logically.
3. **Check Tokens**: Glance at the "Est. Tokens" to ensure you are within limits.
4. **Transfer**:
   - **New Chat**: Click a platform icon (e.g., Claude 🧠) to open a new tab with the context pre-filled.
   - **Existing Chat**: Open an existing AI window and click "Paste Here" to inject the basket content.

## Privacy

This extension respects your privacy.
- It operates entirely on the client side.
- It uses `chrome.storage` strictly for temporarily passing text between tabs for the auto-fill feature.
- It does **not** collect, store, or transmit any user data to external servers.
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
