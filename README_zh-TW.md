# Context Carry（AI 對話情境轉移工具）

> [🔙 Return to English Version](README.md)

**Context Carry** 是一款輕量級 Chrome 擴充功能，讓你可以輕鬆在不同 AI 平台之間轉移對話脈絡（ChatGPT、Claude、Gemini、Grok）。

不再需要手動複製貼上一大段對話內容，只要勾選你要保留的訊息，加上自訂的提示語，一鍵即可帶著完整上下文開啟新對話。

---

## 功能特色

- **多平台支援**：
  - ChatGPT
  - Claude.ai
  - Gemini
  - Grok
- **智慧選取**：透過不干擾畫面的勾選按鈕，自由選擇要保留的訊息。
- **視覺優化**：按鈕不遮擋聊天內容。
- **自訂前置提示**：可加入你自己的「System Prompt」或指令。
- **匯出方式**：
  - 複製到剪貼簿（格式化後可直接使用）
  - 下載為 `.txt` 檔案
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

1. 在任一支援的 AI 平台開啟對話（例如 Claude 或 Grok）
2. 點擊瀏覽器工具列上的 **Context Carry** 圖示
3. 若按鈕未自動出現，點擊 **「Rescan Page」**
4. 點擊訊息旁的 **➕** 按鈕選取要保留的內容（會變成綠色 ✅）
5. （選擇性）在「Custom Prefix」輸入你的前置指令（例如：「請摘要以下內容」）
6. 點擊 **「Transfer to New Chat」** 開啟新分頁，或 **「Export to .txt」** 匯出成文字檔

---

## 隱私說明

本擴充功能完全尊重使用者隱私：

- 所有功能皆在本機執行
- 不會蒐集、儲存或傳送任何聊天內容或個人資料
- 詳細內容請參考 [PRIVACY.md](PRIVACY.md)

---

## 開發說明

歡迎提交 Pull Request。若為重大改動，請先建立 Issue 討論。

1. Clone the repo:
   ```bash
   git clone https://github.com/gordonsay/Context-Carry.git

---

## 免責聲明

本擴充功能與 OpenAI、Anthropic、Google、xAI 無任何隸屬或合作關係。 所有產品名稱、商標與品牌皆屬於其各自擁有者。