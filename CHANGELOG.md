# Changelog

All notable changes to this project will be documented in this file.
------------------------------------------------------------------------
## [1.6.2] - 2026-01-04

### 🐛 Fixes
- **Modified to html to PDF function path:**
  According to Chrome extension V3 policy, modified contents with CDN export. 

------------------------------------------------------------------------
## [1.6.1] - 2025-12-29

### 🚀 New Features

#### Transport Drone (Floating Collector)
- **Save Button in Drone Mode:**
  Added a dedicated **Save / Export** button directly in **Drone Mode** for quick exporting without opening the main panel.
- **PDF Direct Download (html2pdf):**
  Extended the Save options to include **PDF (Direct Download)** powered by `html2pdf.bundle.min.js` for one-click PDF export.

### 🐛 Fixes
- **Basket Preview Residue:**
  Fixed an issue where the Basket preview window/overlay could remain on screen after closing or switching modes.
  
------------------------------------------------------------------------
## [1.6.0] - 2025-12-25

### 🚀 New Features

#### Visual Workflow Canvas (Node Editor)
- **Freestyle Node Interface:**
  Introduced a fully interactive **Canvas Mode** where users can drag, drop, and connect multiple AI nodes visually.
- **Prompt Chaining:**
  Implemented logical connections where the output of one node (Parent) automatically feeds into the context of connected nodes (Child).
- **Workflow Templates:**
  Added built-in templates for common tasks:
  - **Summary & Keywords:** Chains a summarizer node into a keyword extractor.
  - **Translate & Polish:** Chains a translator into a tone polisher.
  - **Code Review:** Splits code into a "Bug Finder" and "Optimizer" running in parallel, feeding into a "Documenter".

#### "Neural Data Pod" (Dedicated PiP Window)
- **Detached Interface:**
  Added support for the Document Picture-in-Picture API, allowing users to pop out the extension into a persistent, independent window (`Alt + P` or via menu).
- **Dual View Modes:**
  - **Collect View:** Dedicated interface for managing the Context Basket and organizing data tags.
  - **Flow View:** A maximized version of the Workflow Canvas for complex node orchestration.

#### Semantic Tagging System
- **Custom Tags:**
  Users can now tag basket items (e.g., `#Important`, `#ToDo`, `#Reference`) for better organization.
- **Filtering:**
  Added a filter bar in both the Drone and PiP windows to view basket items by specific tags.

#### Universal Export & PDF
- **PDF Support:**
  Added **PDF (Print View)** to the export options, rendering basket content into a clean, printable format.
- **Import/Export Basket:**
  Users can now export the entire basket state or import external datasets into the current session.

### 🛠️ Improvements

- **Task Queue Engine:**
  Implemented `AI_QUEUE` to manage concurrent AI requests and prevent browser throttling when running complex multi-node flows.
- **Loop Control:**
  Added iteration controls (Run 1x, 2x... 10x) allowing workflows to self-loop for iterative refinement or bulk generation.
- **Cycle Detection:**
  Added intelligent safeguards to prevent infinite loops when connecting nodes in circular dependencies.

### ⚡ Core Architecture

- **Theme Consistency:**
  Unified theming logic across the Main Panel, Robot Interface, Drone, and PiP Window (Dark/Light mode synchronization).
- **Local Model Fetching:**
  Enhanced the configuration modal to dynamically fetch and list available models from local endpoints (Ollama/LM Studio) automatically.

------------------------------------------------------------------------
## [1.5.1] - 2025-12-17

### 🚀 New Features

#### Multi-Model Arena (Quad-View)
- **4-Split Screen:**
  Added a powerful **Quad-View** mode allowing users to run up to 4 AI models simultaneously in a single window.
- **Context Sync:**
  Implemented a **"Align All"** button (`btn_align`) to instantly replicate the context from one panel to all active panels for consistent testing.
- **Model Comparison:**
  Users can now configure different models (e.g., GPT-4o vs Claude 3.5 vs Local Llama 3) in each quadrant to compare reasoning capabilities side-by-side.

#### Transport Drone (Floating Collector)
- **Draggable FAB:**
  Introduced the **"Transport Drone"** (`cc-drone-fab`), a persistent floating icon that remains on screen when the main panel is closed.
- **Quick Drop:**
  Users can drag text directly onto the Drone to save it to the Basket without interrupting their reading flow.
- **Position Memory:**
  The Drone remembers its last screen position between sessions (`cc_drone_position`).

#### Configuration Management
- **JSON Import/Export:**
  Added support for exporting and importing AI configurations (API Keys, Endpoints, Model names) as JSON files. Users can now easily backup or switch between different setups.

### 🔒 Privacy & Security

#### "Bring Your Own Key" (BYO Key) Gate
- **Unlock Protocol:**
  Implemented a strict **Feature Unlock** modal that explicitly informs users about the "Client-Side Only" architecture and local storage of API keys before enabling AI features.
- **Safety Checks:**
  Added validation logic for API Keys (checking prefixes like `sk-` for OpenAI/Anthropic) to prevent configuration errors.

### 🛠️ Improvements

- **Local LLM Robustness:**
  - Expanded `manifest.json` host permissions to support a wide range of local development ports (`11434`, `1234`, `8080`, `5000`, `7860`, `3000`) for tools like Ollama, LM Studio, and LocalAI.
  - Improved the `GET_OLLAMA_MODELS` action in `background.js` to intelligently fallback between `/api/tags` and `/v1/models` endpoints for better compatibility.
- **UI Refinements:**
  - Added specific styling for **Quad-View** grids (`cc-multi-panel-grid`) and responsive layouts.
  - Improved the "Saved" indicator animations in the AI settings panel.

------------------------------------------------------------------------

## [1.5.0] - 2025-12-15

### 🚀 New Features

#### Enhanced Drag-and-Drop Ecosystem
- **Local File Import:**  
  Added support for dragging local `.txt` and `.md` files directly onto the panel to import them into the Context Basket.
- **Web-to-Basket Drop:**  
  Users can now drag conversation bubbles from LLM pages directly into the Context Basket for quick capturing.
- **Basket-to-Anywhere:**  
  Basket items are now draggable text objects, allowing users to drag and drop stored context into text input fields on any webpage (not limited to supported LLMs).

#### Smart Local AI Integration (Ollama)
- **Auto-Discovery:**  
  Automatically detects and lists installed models (e.g., `llama3`, `mistral`) from the local Ollama server (`localhost:11434`), eliminating manual input.
- **Dynamic Fallback:**  
  Displays connection status and helpful error hints when the local server is unreachable.

#### xAI (Grok) API Support
- **Native Integration:**  
  Added full support for the xAI API (`api.x.ai`) with standardized request handling.

#### Robot Mode "Neural Uplink"
- **Dedicated UI:**  
  Introduced a standalone, Cyberpunk-themed configuration panel designed specifically for the Robot / Mechanic interface.

#### Context Management Tools
- **Custom Context:**  
  Added **"New Doc"** feature, allowing users to manually create, write, and edit custom context snippets directly in the Basket.
- **Visual Feedback:**  
  Implemented **Green Box Hints** (green outlines) for selected conversation blocks to clearly indicate active selections.

#### User Convenience
- **Area Selection Shortcut:**  
  Changed to `Alt + C` hotkey to quickly toggle the Paintbrush / Area Selection mode.
- **Multilingual Support:**  
  Enhanced **Cross-language Hints** with a fully functional English / Traditional Chinese toggle (`Alt + L`).

### ⚡ Core Architecture
- **Port-based Streaming:**  
  Refactored AI communication to use long-lived connections (`chrome.runtime.connect`), resolving timeout issues during long generations (e.g., DeepSeek-R1 chains).
- **State Persistence:**  
  Optimized global state management to preserve API configurations and context data when switching UI modes or tabs.

### 🛠️ Improvements & Fixes
- **Async Settings:**  
  Settings panel now loads model lists asynchronously to prevent UI freezing.
- **Auto-Select Logic:**  
  Automatically selects the first available model when switching AI providers.
- **Visual Tweaks:**  
  Added flash effects to input fields for clearer interaction feedback.

------------------------------------------------------------------------

## [1.4.3] - 2025-12-11

### Added
- **Drag-and-Drop Capture:**
  - Users can now drag selected text directly from the webpage and drop it onto the Context-Carry panel to instantly add it to the Basket.
  - Added a visual **"Drop to Add"** overlay effect when dragging content over the panel.
- **Universal Collector Mode:**
  - **Adaptive UI:** The interface now automatically switches to a specialized "Collector Mode" on non-AI websites (e.g., Gmail, StackOverflow, GitLab).
  - **Focused Layout:** Hides irrelevant transfer buttons on unsupported sites while keeping the **Context Basket**, **Area Selection**, and **Export tools** fully accessible via the Advanced drawer.

### Changed
- **Basket UX Improvements:**
  - Refined the drag-and-drop sorting logic within the Basket Preview list for smoother reordering and better visual feedback.
  - Improved the delete animation for basket items.
- **Stability & Compatibility:**
  - **Critical Fix:** Resolved a crash issue on websites with strict Content Security Policies (CSP) or specific DOM structures (e.g., Gmail, GitLab, StackOverflow) where the UI failed to initialize.
  - **Error Handling:** Removed intrusive alert popups in favor of non-blocking toast notifications and console logging for a seamless user experience.
- **Performance:** Removed debug logs and optimized the initialization sequence to prevent race conditions on page load.

------------------------------------------------------------------------

## [1.4.2] - 2025-12-11

### Added
- **Visual Area Selection (Area Select / Brush Mode):**
  - Introduced a brush-based freeform selection mode that allows users to visually select any region on the page.
  - Automatically extracts all readable text within the selected area.
  - Supports all websites, not limited to LLM or AI-related pages.
  - Includes a real-time preview window before adding content to the Basket.

- **Keyboard Shortcuts:**
  - `Alt + M` — Toggle main Context-Carry panel.
  - `Alt + Z` — Activate Area Selection (Brush Mode).
  - `Alt + L` — Toggle UI language (EN / ZH).
  - All shortcuts use two-key combinations to avoid conflicts with common system shortcuts.

- **Cross-Tab Token Synchronization (Est Token Sync):**
  - Estimated token count is now synchronized across all open tabs.
  - When content is added in one tab, all other tabs instantly reflect the updated token count.

- **Smart Export Scheduling (Multi-Source Output Choice):**
  - When both Page Selection and Basket content exist:
    - Users are prompted to choose how to export:
      - Export Page content only
      - Export Basket content only
      - Merge and export both (Append mode)

- **Clean System Prompt Architecture:**
  - System Prompt (Prefix) is now fully separated from user content.
  - Basket content no longer includes duplicated system prompts.
  - Prevents prompt pollution when merging content from multiple sources.

### Changed
- Refactored export structure into the following unified format:
  - `System Prefix`
  - `Page Selection`
  - `Basket Content`
  - `[END OF CONTEXT]`
- Improved long-context stability and output readability.

------------------------------------------------------------------------

## [1.4] - 2025-12-10

### Added
- **Context Menu Integration:** Added **Add to Context Basket (+)** to the browser's right-click menu. Users can now capture text segments directly from any webpage without opening the main panel.
- **Token Intelligence:**
  - **Real-time Estimation:** Added a **Est. Tokens** display in the panel to track the combined size of selected messages and basket items.
  - **Smart Warnings:** Implemented platform-specific safeguards (for ChatGPT, Gemini, Claude, Grok) to warn users when the transferred context exceeds recommended limits.
- **Markdown Engine:**
  - **Rich Text Support:** The extraction logic now preserves bold, italics, headers, and links by converting HTML to Markdown.
  - **Code Block Optimization:** Automatically detects code snippets and converts them into Markdown fenced code blocks with language identifiers.
- **Visual Enhancements:**
  - **Animations:** Added smooth slide-in/out transitions for the panel and swipe effects when deleting items.
  - **Glassmorphism:** Updated the UI with a **backdrop-filter blur** effect for a modern aesthetic.
  - **Live Badge:** The extension icon now displays a real-time count of items currently in the basket.

### Changed
- **Data Extraction:** Refactored the core capture mechanism to output structured Markdown instead of raw text for better LLM readability.
- **Privacy:** Extended the auto-cleanup logic to clear temporary storage on extension installation and updates, ensuring a clean slate across versions.
- **Typography:** Updated the font stack to prioritize system UI fonts for better OS integration.

------------------------------------------------------------------------

## [1.3] - 2025-12-10

### Added
- **Context Basket (Staging Area):** Introduced a cross-window "Basket" system. Users can now collect conversation fragments from multiple tabs/windows and aggregate them into a single transfer.
- **Draggable Interface:** The control panel is now draggable via the header, preventing it from blocking underlying page content.
- **Range Selection:** Added **Shift + Click** functionality to select a continuous range of messages instantly.
- **Basket Management:**
  - **Preview List:** Added a collapsible preview area to manage items in the basket.
  - **Drag-and-Drop Sorting:** Users can reorder basket items by dragging them in the preview list.
  - **Smart Tooltips:** Added floating tooltips to preview the full content of basket items on hover.

### Changed
- **UI UX:** Updated the main panel layout to include the new **Context Basket** section.
- **Privacy:** Implemented auto-cleanup logic to clear basket data on browser startup for better security.

------------------------------------------------------------------------

## [1.2] - 2025-12-09

### Added
- **Bulk Selection:** Added **"Select All"** and **"Unselect All"** buttons to the control panel, allowing users to quickly select or deselect all detected messages.
- **Localization:** Updated language files to support Chinese/English switching for the new selection buttons.

### Changed
- **UI Layout:** Refactored the control panel layout to insert the selection toolbar above the action buttons.
- **Code Refactoring:** Optimized `createBtn` function in `content.js` for better reusability across UI components.

------------------------------------------------------------------------

## [1.1] - 2025-12-09

### Added
- **Cross-LLM Auto-Fill:** Implemented one-click context transfer. The extension now automatically opens the target AI platform and pastes the selected text.
- **Platform Buttons:** Added direct transfer icons for ChatGPT, Claude, Gemini, and Grok in the UI.
- **Auto-Injection:** Content scripts now load automatically to support the auto-fill receiver logic.

### Changed
- **Permissions:** Added `storage` permission to `manifest.json` to handle temporary data passing between tabs.
- **UI UX:** Replaced the single "Transfer" button with platform-specific options for better workflow.
- **Privacy Policy:** Updated to reflect the usage of local storage for temporary transfer data.

------------------------------------------------------------------------

## [1.0] - 2025-12-08

### Added
- Added Chrome Web Store compliance updates.
- Added legal disclaimer for all third-party AI platforms.
- Added **GitHub Issues** link as the primary contact channel in Privacy Policy.
- Added optimized extension icons with **transparent backgrounds** (16px, 32px, 48px, 128px).

### Changed
- Refactored documentation: **Split README into separate English and Traditional Chinese files** for better readability.
- Updated extension scanning mechanism to use `MutationObserver` instead of fixed polling interval.
- Updated version alignment across `manifest.json`, `package.json`, and documentation.
- Restricted host permissions to only required AI platforms.
- Improved UI injection stability across supported platforms.

### Security & Privacy
- **Updated Privacy Policy:** Clarified usage of local storage (`chrome.storage`) for user preferences and confirmed zero remote data collection.
- Enforced minimum permission policy for Chrome Web Store review.

### Documentation
- Improved installation and usage instructions with clearer steps.
- Added formal contribution guidelines.

------------------------------------------------------------------------

## \[0.0\] - Initial Release

-   Initial release with support for:
    -   ChatGPT
    -   Claude
    -   Gemini
    -   Grok
-   Message selection and context transfer.
-   Clipboard copy and TXT export.
-   Fully client-side privacy design.
