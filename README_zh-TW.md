# Context-Carry  
### 在 ChatGPT、Claude、Gemini、Grok 與本地 LLM 之間，即刻轉移對話語境與程式碼片段。

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Available-blue?logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/okjnafabngnahdppmbnmefofokpegccm?utm_source=item-share-cb)
[![English](https://img.shields.io/badge/Language-English-blue)](README.md)
![Version](https://img.shields.io/badge/version-1.6.3-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**Context-Carry（語境傳輸器）** 是一款輕量 Chrome 擴充功能，讓你能擷取、清理、整理文字或程式碼片段，並直接拖放傳到不同 AI 工具或本地 LLM，避免格式混亂與重複複製貼上。

---

## 快速開始
1. **擷取**：點擊 **➕** 或使用畫筆模式（`Alt + C`）
2. **整理**：在 **Context Basket（語境籃）** 內編輯/重排
3. **發送**：拖到 **Transport Drone（懸浮傳輸器）**  
   → 發送至 ChatGPT / Claude / Gemini / Grok / Local LLM
4. **工作流**：最多支援 **10 個節點串接**
5. **比較模式**：最多 **3 個節點並排比較**

---

## 主要功能
- 📥 通用擷取（網頁或 AI 介面）
- 🖌 畫筆擷取（`Alt + C` 視覺圈選）
- 🧺 語境籃管理（編輯/排序/暫存）
- 🚁 懸浮傳輸器（拖放即用）
- 🤖 3 模型並排比較
- 🧠 10 模型串接工作流
- 📂 支援匯入 `.txt`, `.md`, `.json`, 程式碼檔案
- 🏠 本地 LLM（Ollama / LM Studio via `localhost`）
- 🔑 API Key 全本地保存，不會上傳

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

## 安裝方式
### Chrome 應用商店(推薦)
[前往 Chrome Web Store 安裝](https://chromewebstore.google.com/detail/okjnafabngnahdppmbnmefofokpegccm)

### 手動安裝 (開發者模式)
1. 下載此儲存庫 (Repo)
2. 在瀏覽器網址列輸入 `chrome://extensions/`
3. 開啟右上角的 **開發者模式 (Developer Mode)**
4. 點擊 **載入未封裝項目 (Load unpacked)** → 選擇資料夾

---

## 快捷鍵
| 快捷鍵 | 功能 |
|--------|------|
| **Alt + M** | 開/關面板 |
| **Alt + C** | 畫筆擷取 |
| **Alt + L** | 切換 UI 語言 |

---

## 隱私與安全
- 本地優先（資料不離開瀏覽器）
- 無中繼 Server，直接對接 API
- 不蒐集 Prompt、API Key、使用紀錄

---

## 參與貢獻
```bash
git clone https://github.com/gordonsay/Context-Carry.git
```

---

## 注意事項 (Important Development Notes)

### 關於 html2pdf.bundle.min.js 的修改
為了符合 Chrome Extension Manifest V3 的 **Blue Argon (禁止遠端程式碼)** 政策，`lib/html2pdf.bundle.min.js` 已進行手動修改，請勿直接更新或覆蓋此檔案。

* **修改內容**：移除了原始碼中指向 CDN (`https://cdnjs...`) 的 `pdfobject.min.js` 連結。
* **運作方式**：在 `content.js` 中透過 `opt.pdfObjectUrl` 動態傳入本地檔案路徑 (`lib/pdfobject.min.js`)。
* **未來更新指南**：若需更新此套件，必須重新執行上述修改步驟（搜尋並清空 CDN 網址）。

---

## 隱私與授權
[README (英文)](README.md) | [隱私](PRIVACY.md) | [授權](LICENSE)

---

## 支持開發
如果這個擴充功能幫您節省了時間，歡迎請我喝杯咖啡！

<a href="https://www.buymeacoffee.com/gordonsay">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="150" />
</a>
