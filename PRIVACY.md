# Privacy Policy — ContextDrone

Your privacy matters. This document explains clearly how ContextDrone handles data.

---

## 🔒 1. Data Collection

- **General Use:** No user data is collected or uploaded to any developer server.
- **AI Requests:** Data is sent directly to your chosen AI provider (e.g., OpenAI, Gemini) without passing through our servers.
- **QR Code / Sharing Feature:** Only when you explicitly use the "Share via QR Code" feature, the specific text content is encrypted locally and uploaded to our secure relay server (`qrcode.doglab24.org`). **The server cannot read this data (see Section 3).**
- **No Third-Party Analytics:** We do not use Google Analytics or similar third-party trackers.
- **Voluntary Feedback:** If you explicitly click a feedback button (e.g., "Vote for Unlimited Access"), we log your IP address (to prevent duplicate votes), language preference, and timestamp. This data is used solely to gauge feature demand.

---

## 💾 2. Local Storage

The extension stores the following **locally only** using `chrome.storage.local`:

- Selected text saved to the **Context Basket**
- Prompts or instructions you input
- UI preferences and settings
- API keys for third-party AI providers

> These API keys are stored **only on your device**, and are **never sent to the developer or backend servers**.

---

## 🛡️ 3. Secure QR Code & Sharing (Zero-Knowledge)

When you generate a QR code or share link, we prioritize your privacy using **Client-Side Encryption (AES-GCM 256-bit)**:

1.  **Encryption:** Your content is encrypted **inside your browser** using a unique key generated on your device.
2.  **Upload:** Only the *encrypted* gibberish (ciphertext) is sent to our server (`qrcode.doglab24.org`).
3.  **Key Storage:** The decryption key is part of the generated link (after the `#` symbol). **This key is never sent to our server.**
4.  **Result:** Since our server never possesses the decryption key, **we technically cannot read or access your shared content.** Only someone with the full link/QR code can decrypt it.

---

## 🔑 4. How API Keys Are Used

- Keys are used only when you press a button that triggers an AI request.
- Requests go **directly from browser → AI provider (HTTPS)**.
- There are **no intermediate servers**.

---

## 🌐 5. Data Flow

| Connection Target | Purpose | Stored on Developer Server? |
|---|---|---|
| AI providers (HTTPS) | User-triggered AI requests | ❌ Never |
| `localhost` (e.g., Ollama) | Optional local LLM support | ❌ Never |
| Browser local storage | Context & settings | ❌ Never |
| `qrcode.doglab24.org` | **Secure QR Sharing** | ✅ **Yes (Encrypted Blob Only)** |
| `qrcode.doglab24.org` | **Feedback** | ✅ **Yes (IP & Vote Type Only)** |

---

## 🧹 6. Data Retention & Cleanup

- **Local Data:** Auto-fill or temporary text is cleared immediately after use. Context Basket can be cleared manually anytime.
- **Shared Content (Server-Side):** Encrypted data uploaded to `doglab24.org` is strictly temporary. It is automatically deleted based on the retention period (short-term) or upon expiration.
- **Uninstallation:** All locally stored data (including API keys) is removed when you uninstall the extension.

---

## 🧩 7. Permission Usage & Justification

| Permission | Why it’s needed |
|---|---|
| `storage` | Save settings, context, API keys locally |
| `activeTab` / `scripting` | Inject UI, auto-fill on supported AI platforms |
| `host_permissions` | Detect supported sites; communicate with AI APIs and the secure sharing server |
| `contextMenus` | Capture text from right-click menu |

---

## 📌 8. Policy Updates

We may update this privacy policy for clarity or compliance.  
Updates will be posted here and on the GitHub repository.

---

## 📬 9. Contact

If you have questions, feel free to reach out:

- **GitHub Issues:** `ContextDrone repository discussion`
- **Email:** a0983828539@gmail.com