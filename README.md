# Context-Carry: Cross-LLM Chat History Export & Context Manager

[![中文說明](https://img.shields.io/badge/Language-繁體中文-blue)](README_zh-TW.md)
![Version](https://img.shields.io/badge/version-1.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**Stop losing your context when switching AIs.**

**Context-Carry** is a powerful Chrome extension designed for **Chat History Export**, **Prompt Management**, and **Seamless Cross-LLM Transfer**.

It allows you to effortlessly transfer conversation threads between different AI platforms (**ChatGPT**, **Claude**, **Gemini**, and **Grok**) with **One-Click Auto-Fill**.

Stop manually copying and pasting massive walls of text. Select specific messages, attach your custom system prompt, click a target platform, and watch it **automatically fill** the context in the new chat.

> **[點此查看中文說明 (Traditional Chinese Version)](README_zh-TW.md)**

## Features

- **Seamless Cross-LLM Transfer**: Instantly move context between:
  - ChatGPT 🤖
  - Claude.ai 🧠
  - Google Gemini 💎
  - Grok (X.com) ✖️
- **Magic Auto-Fill**: No more `Ctrl+V`. The extension opens the new AI platform and **automatically pastes** your context into the input box.
- **Smart Selection**: Non-intrusive checkboxes allow you to pick exactly which messages to export.
- **Prompt Management**: Save and insert your own "System Prompt" to guide the new AI's behavior.
- **Save ChatGPT Conversation**:
  - **Copy to Clipboard**: Backup your chat history manually.
  - **Download as .txt**: Archive your valuable conversation locally.
- **Privacy First**: Runs 100% locally in your browser. No data is sent to external servers.

## Screenshots

![Selection UI](screenshots/screenshot_claude.png)

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

1. Open a chat on any supported AI platform (e.g., ChatGPT).
2. Click the **Context-Carry** icon in your browser toolbar.
3. Click **"Rescan Page"** if the selection buttons don't appear automatically.
4. Click the **➕** buttons next to the messages you want to keep. They will turn into green **✓** checks.
5. (Optional) Enter a custom instruction in the "Custom Prefix" box (e.g., *"Summarize the following context..."*).
6. **Transfer**: Click the icon of the **Target Platform** (e.g., click **Gemini 💎**).
7. The new platform will open, and the text will be **automatically filled** in the input box. Just press Enter to send!

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
   git clone [https://github.com/gordonsay/Context-Carry.git](https://github.com/gordonsay/Context-Carry.git)
   ```

## Disclaimer

This extension is not affiliated with OpenAI, Anthropic, Google, or xAI.  
All product names, logos, and brands are property of their respective owners.