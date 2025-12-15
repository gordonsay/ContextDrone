# Privacy Policy for Context Carry

**Last Updated:** December 15, 2025

This Privacy Policy describes how **Context Carry** ("we", "us", or "our") handles your information when you use our browser extension.

## 1. Data Collection and Usage

**We do not collect, transfer, or share any of your personal data on remote servers.**

Context Carry is designed to function locally within your web browser.

- **No Remote Servers:** We do not operate any backend servers to process your conversations.
- **No Analytics:** We do not track your usage behavior or collect anonymous statistics.
- **Local Storage:** We use your browser's local storage (`chrome.storage`) for three specific purposes:
  1. To save your **user preferences** (such as your custom prompt templates).
  2. To **temporarily store selected conversation text** for the "Auto-Fill" and "Context Basket" features.
     - **Transfer Data:** Temporary text used for cross-tab transfer.
     - **Context Basket:** Text stored in the staging area allows you to aggregate content from multiple sources.
     - **Data Cleanup:** Basket data remains locally until you manually clear it or **restart your browser**. We implemented an auto-cleanup mechanism that wipes all temporary storage upon browser startup to ensure privacy.
  3. To save your **AI Configuration** (Optional).
     - If you use the AI features, your API Keys, model preferences, and custom endpoints are stored securely in your browser's local storage. They are never sent to us.

## 2. Permissions

To function correctly, Context Carry requires specific permissions in your browser. Here is an explanation of why each permission is needed:

* **`activeTab`**: This allows the extension to interact with the current tab when you click the extension icon. It is used to identify if you are on a supported AI platform.
* **`scripting`**: This is required to inject the content script into the webpage. This script creates the user interface (the buttons and panel) that allows you to select and copy text.
* **`storage`**: This is required to save your settings, API keys, and to temporarily hold text content during the cross-platform transfer process (Auto-Fill).
* **Host Permissions**:
  * **Platform Access**: We request access to specific domains (`chatgpt.com`, `claude.ai`, `gemini.google.com`, `grok.com`, `x.com`) solely to enable the functionality of selecting, copying, and pasting text on these sites.
  * **AI API Access**: We request access to API domains (`api.openai.com`, `api.anthropic.com`, `generativelanguage.googleapis.com`, `api.x.ai`, `localhost`) solely to allow the extension to send your selected text to the AI provider **you choose** for processing.

## 3. AI & Local LLM Features

Context Carry offers optional features to process text using Artificial Intelligence. This section explains how data is handled when you use these features:

### 3.1 Local LLM (Ollama)
If you choose to use a Local LLM (e.g., via Ollama):
* **Local Processing:** Your text data is sent directly from your browser to your local server (e.g., `http://localhost:11434`).
* **No External Transfer:** Data processed in this mode does not leave your local network.

### 3.2 Cloud AI Providers (OpenAI, Anthropic, Google, xAI)
If you choose to connect to a third-party AI provider:
* **Direct Connection:** Your text data and API Key are sent directly from your browser to the provider's official API endpoints. We do not act as a middleman.
* **API Keys:** Your API Keys are stored locally on your device. We do not have access to them.
* **Third-Party Policies:** By using these features, you acknowledge that your data is subject to the privacy policies and data retention practices of the respective providers (OpenAI, Anthropic, Google, or xAI).

## 4. Data Handling for Transfer Features

When you use the "Transfer", "Download", or "Auto-Fill" features:

1. The text you select is processed locally on your device.
2. For the **Auto-Fill** feature, the selected text is temporarily written to your browser's local storage.
3. Once the text is successfully pasted into the target platform (or after a short timeout), this temporary data is **permanently deleted** from storage.
4. This process happens entirely on your device; no data is sent to us or any third parties.

## 5. Changes to This Policy

We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.

## 6. Contact Information

For any questions regarding this Privacy Policy, please contact:
**GitHub Issues**: https://github.com/gordonsay/Context-Carry/issues
**Contact**: a0983828539@gmail.com
