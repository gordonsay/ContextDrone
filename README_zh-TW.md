# Context Carry：跨 LLM 對話匯出與上下文管理工具 (Cross-LLM Context Manager)

> [🔙 Return to English Version](README.md)

[![Language](https://img.shields.io/badge/Language-English-blue)](README.md)
![Version](https://img.shields.io/badge/version-1.4.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**從任何地方建立完美上下文，再帶到任何 AI。**

**Context Carry** 是一款強大的 Chrome 擴充功能，專為：
- **AI 對話匯出**
- **提示詞管理（Prompt Management）**
- **跨 LLM 無縫上下文轉移**

你可以從不同 AI 平台（ChatGPT、Claude、Gemini、Grok）收集對話，  
或從**任何網站**擷取文字內容，重新排序成有邏輯的敘事流程，  
再一鍵自動填入到目標 AI 平台。

從此告別大量 `Ctrl + C / Ctrl + V`，  
只要選取 → 加入 → 點擊平台 → **自動填入完成！**

---

## 功能特色（Features）

- **全網站通用擷取（New!）**  
  不只支援 AI 聊天！在任何網站（文件、新聞、技術文章、論壇）選取文字，**右鍵即可加入採集籃**。

- **跨視窗採集籃（Context Basket）**  
  你可以：
  - 在 ChatGPT 分頁收集一段
  - 在文件分頁收集一段
  - 在 StackOverflow 收集一段  
  最後統一整理後一次轉移。

- **拖曳排序（New!）**  
  上下文順序影響 AI 理解！  
  可在採集籃中 **拖曳調整順序**，自由重組敘事流程。

- **Token 智慧估算（New!）**  
  即時顯示預估 Token 數量，並給出超限警告。  
  （如 Gemini 1M vs ChatGPT 32k 上限）

- **智慧自動填入（Magic Auto-Fill）**  
  自動開啟目標 AI 平台並填入內容，完全免貼上。

- **Markdown 轉換**  
  自動將 HTML 內容轉成乾淨 Markdown 格式（標題、粗體、程式碼區塊）。

- **跨平台無縫轉移（Cross-LLM）**  
  支援：
  - ChatGPT 🤖
  - Claude.ai 🧠
  - Google Gemini 💎
  - Grok ✖️

- **可拖曳懸浮面板（Draggable Panel）**  
  面板可自由移動，不會遮擋你的畫面。

---

## 操作截圖

![標準 UI](screenshots/screenshot_gpt.png)

![進階 UI](screenshots/screenshot_gpt_advanced.png)

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

---

### 方法一：擷取 AI 對話

1. 開啟任一支援平台（ChatGPT / Claude / Gemini / Grok）
2. 點擊 **Context Carry 懸浮面板**
3. 點擊 **➕** 選取單則訊息  
或使用 **Shift + 點擊** 進行區段選取
4. 點擊 **Add (+)** 加入採集籃

---

### 方法二：從任何網站擷取文字（New）

1. 在任意網站選取文字（文件、技術文章、新聞等）
2. **滑鼠右鍵**
3. 點擊 **「Add to Context Basket (+)」**
4. 擴充功能圖示會顯示目前項目數量

---

### 方法三：整理與轉移上下文

1. 點擊 Context Carry 面板
2. 點擊採集籃箭頭 **▼**  
→ 可 **拖曳重新排序**
3. 查看 **Est. Tokens（預估 Token）**
4. 選擇轉移方式：
- ✅ **New Chat**：開新分頁並自動填入
- ✅ **Existing Chat**：在目前視窗點擊 **Paste Here**

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

## 更新日誌

請參閱 [CHANGELOG.md](CHANGELOG.md) 以獲取更新日誌。


## 授權

本專案採用 MIT 授權 - 詳細內容請參考 [LICENSE](LICENSE) 檔案。


## 連絡方式

如需任何幫助，請在 [GitHub repository](https://github.com/gordonsay/Context-Carry) 上建立 Issue。


## 注意事項

由於瀏覽器安全性限制，檔案附件（PDF/圖片）無法自動轉移。