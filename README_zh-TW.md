# Context Carry：AI 對話紀錄匯出與跨平台轉移工具 (Cross-LLM)

> [🔙 Return to English Version](README.md)

**Context Carry** 是一款 Chrome 擴充功能，解決 AI 使用者最大的痛點：**切換模型時遺失對話脈絡**。

這款工具具備 **AI 對話匯出 (Chat History Export)** 與 **自動填入 (Auto-Fill)** 功能，讓你在不同 AI 平台之間無縫轉移上下文（支援 ChatGPT、Claude、Gemini、Grok）。

不再需要手動複製貼上！只要勾選你要保留的訊息，點擊目標平台圖示，Context Carry 就會自動開啟新分頁並將內容**自動填入**對話框。

---

## 截圖

![Selection UI](screenshots/screenshot_claude.png)

## 功能特色

- **跨平台無縫轉移 (Cross-LLM)**：支援雙向轉移：
  - ChatGPT 🤖
  - Claude.ai 🧠
  - Google Gemini 💎
  - Grok (X.com) ✖️
- **智慧自動填入 (Auto-Fill)**：告別 `Ctrl+V`。點擊轉移後，內容會自動出現在目標 AI 的輸入框中。
- **提示詞管理 (Prompt Management)**：可加入你自己的「System Prompt」或指令（例如：「請摘要以下內容...」）。
- **對話備份**：
  - **複製到剪貼簿**：手動貼到 Notion 或筆記軟體。
  - **下載為 .txt**：將珍貴的對話紀錄存成檔案。
- **隱私優先**：所有操作 100% 在本機瀏覽器內完成，不會傳送任何資料到外部伺服器。

---

## 安裝方式

### Chrome 線上應用程式商店
即將上架。

### 手動安裝（開發者模式）

1. 下載最新原始碼或 clone 本專案
2. 在 Chrome 開啟：`chrome://extensions/`
3. 開啟右上角「開發者模式」
4. 點擊「載入未封裝項目」
5. 選擇此擴充功能所在資料夾

---

## 使用方式

1. 在任一支援的 AI 平台開啟對話（例如 ChatGPT）。
2. 點擊瀏覽器工具列上的 **Context Carry** 圖示。
3. 若按鈕未自動出現，點擊 **「Rescan Page」**。
4. 點擊訊息旁的 **➕** 按鈕選取要保留的內容（會變成綠色 ✅）。
5. （選擇性）在上方輸入框自訂你的前置指令 (Prompt)。
6. **開始轉移**：點擊下方的 **目標平台圖示**（例如點擊 **Claude 🧠**）。
7. 新的分頁會自動開啟，內容會 **自動填入** 到輸入框中，你只需按下發送鍵即可！

---

## 隱私說明

本擴充功能完全尊重使用者隱私：

- 所有功能皆在本機執行。
- 使用 `chrome.storage` 僅是為了在分頁間暫存轉移的文字（用於自動填入功能）。
- **絕不** 蒐集、儲存或傳送任何聊天內容或個人資料到外部伺服器。
- 詳細內容請參考 [PRIVACY.md](PRIVACY.md)

---

## 開發說明

歡迎提交 Pull Request。若為重大改動，請先建立 Issue 討論。

1. Clone the repo:
   ```bash
   git clone https://github.com/gordonsay/Context-Carry.git
   ```

---

## 免責聲明

本擴充功能與 OpenAI、Anthropic、Google、xAI 無任何隸屬或合作關係。 所有產品名稱、商標與品牌皆屬於其各自擁有者。