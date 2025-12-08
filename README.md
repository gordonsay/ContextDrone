# Context-Carry (AI Context Manager)

[![中文說明](https://img.shields.io/badge/Language-繁體中文-blue)](README_zh-TW.md)
![Version](https://img.shields.io/badge/version-1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**Context-Carry** is a lightweight Chrome extension designed to help you effortlessly transfer conversation context between different AI platforms (ChatGPT, Claude, Gemini, and Grok).

Stop manually copying and pasting massive walls of text. Select specific messages, add a custom system prompt, and carry the context to a new chat with one click.

> **[點此查看中文說明 (Traditional Chinese Version)](README_zh-TW.md)**

## Features

- **Multi-Platform Support**: Works seamlessly on:
  - ChatGPT
  - Claude.ai
  - Google Gemini
  - Grok (X.com)
- **Smart Selection**: Non-intrusive checkboxes allow you to pick exactly which messages to transfer.
- **Visual Fixes**: Smart padding ensures buttons never block your chat text (V1.0 Updated).
- **Custom Prefix**: Add your own "System Prompt" or instructions before the copied context.
- **Export Options**: 
  - **Copy to Clipboard**: Formatted for immediate pasting.
  - **Download as .txt**: Save the conversation history locally.
- **Privacy First**: Runs 100% locally in your browser. No data is sent to external servers.

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

1. Open a chat on any supported AI platform (e.g., Claude or Grok).
2. Click the **Context-Carry** icon in your browser toolbar.
3. Click **"Rescan Page"** if the selection buttons don't appear automatically.
4. Click the **➕** buttons next to the messages you want to keep. They will turn into green **✓** checks.
5. (Optional) Enter a custom instruction in the "Custom Prefix" box (e.g., *"Summarize the following context..."*).
6. Click **"Transfer to New Chat"** to copy the content and open a new tab, or **"Export to .txt"** to save it.

## Privacy

This extension respects your privacy.
- It operates entirely on the client side.
- It does **not** collect, store, or transmit any user data or chat content to any external servers.
- See [PRIVACY.md](PRIVACY.md) for full details.

## Development

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Clone the repo:
   ```bash
   git clone https://github.com/gordonsay/Context-Carry.git

## Disclaimer

This extension is not affiliated with OpenAI, Anthropic, Google, or xAI.  
All product names, logos, and brands are property of their respective owners.