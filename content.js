(function () {
    /* =========================================
       0. Global State Management & Guard
    ========================================= */
    if (typeof window.ccManager === 'undefined') {
        window.ccManager = {
            active: false,
            uiMode: 'standard',
            interval: null,
            lang: 'en',
            config: null,
            lastCheckedIndex: null,
            isPreviewOpen: false,
            aiConfig: null,
            lastAiContext: "",
            unreadAi: false,
            lastAiText: "",
            lastAiConfig: null,
        };
    } else {
        if (window.ccManager.toggleFn) {
            window.ccManager.toggleFn();
        }
        return;
    }


    /* =========================================
       1. Language dictionary and settings
    ========================================= */
    const PLATFORMS = [
        { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/?model=gpt-4o', icon: '🤖', limit: 30000 },
        { id: 'claude', name: 'Claude', url: 'https://claude.ai/new', icon: '🧠', limit: 180000 },
        { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app', icon: '💎', limit: 1000000 },
        { id: 'grok', name: 'Grok', url: 'https://grok.com', icon: '✖️', limit: 100000 }
    ];

    const APP_CONFIG = {
        'chatgpt.com': {
            msgSelector: '[data-message-author-role="assistant"].text-message, .user-message-bubble-color',
            inputSelector: '#prompt-textarea',
            ignore: '.sr-only, button, .cb-buttons'
        },
        'gemini.google.com': {
            msgSelector: 'user-query, model-response',
            inputSelector: 'div[contenteditable="true"], .rich-textarea, textarea',
            ignore: '.mat-icon, .action-button, .button-label, .botones-acciones'
        },
        'claude.ai': {
            msgSelector: '.font-user-message, .font-claude-response, div[data-testid="user-message"]',
            inputSelector: '.ProseMirror[contenteditable="true"]',
            ignore: 'button, .copy-icon, [data-testid="chat-message-actions"], .cursor-pointer, [role="button"], [aria-haspopup], .text-xs, [data-testid="model-selector-dropdown"]'
        },
        'grok': {
            msgSelector: '.message-bubble',
            inputSelector: 'textarea, div[contenteditable="true"]',
            ignore: 'svg, span[role="button"], .action-buttons'
        }
    };

    const MODEL_PRESETS = {
        'openai': [
            'gpt-4o-mini', 'gpt-3.5-turbo', 'gpt-4.1-mini',
            'gpt-4o', 'o1', 'gpt-4.1'
        ],

        'claude': [
            'claude-3-haiku', 'claude-3-sonnet', 'claude-3.5-haiku',
            'claude-3.5-sonnet', 'claude-3-opus', 'claude-3.5-opus'
        ],

        'gemini': [
            'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro',
            'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-pro',
        ],

        'grok': [
            'grok-2-mini', 'grok-2', 'grok-3-mini',
            'grok-3', 'grok-4', 'grok-4-fast'
        ],

        'local': ['llama3', 'mistral', 'gemma']
    };

    const LANG_DATA = {
        'zh': {
            title: 'Context-Carry',
            status_ready: '準備就緒',
            status_scanning: '正在掃描...',
            label_prefix: '自訂前綴提示詞 (Title):',
            placeholder: '在此輸入要給 AI 的前導指令...',
            btn_scan: '重新掃描頁面',
            btn_scan_done: '已重新掃描',
            btn_select_all: '全選所有訊息',
            btn_unselect_all: '取消全選',
            btn_dl: '輸出為 .txt',
            btn_copy: '複製到剪貼簿',
            label_transfer: '轉移並開啟 (Cross-LLM):',
            msg_detected: '偵測到 {n} 則訊息',
            msg_selected: '已選取: {n} 則',
            alert_no_selection: '請先選取對話或加入採集籃！',
            alert_copy_done: '內容已複製！',
            alert_fail: '操作失敗，請檢查權限',
            btn_add_title: '加入此段落 (Shift 可連選)',
            toast_autofill: 'Context-Carry: 已自動填入內容 ✨',
            default_prompt: `[SYSTEM: CONTEXT TRANSFER]\n以下是使用者篩選的對話歷史，請以此為背景繼續對話：`,
            label_basket: '🧺 跨視窗採集籃 (Basket):',
            btn_add_basket: '加入 (+)',
            btn_clear_basket: '清空',
            btn_paste_basket: '填入此視窗',
            basket_status: '目前有 {n} 筆資料 (點擊預覽 ▼)',
            basket_status_empty: '採集籃是空的',
            toast_basket_add: '已加入採集籃 🧺',
            toast_basket_clear: '採集籃已清空 🗑️',
            preview_del_tooltip: '刪除此筆資料',
            preview_drag_hint: '可拖曳排序 ⇅ (懸停可看詳情)',
            token_est: '📊 預估 Token:',
            token_warn_title: '⚠️ Token 數量警告',
            token_warn_msg: '預估內容 ({est}) 超過了 {platform} 的建議限制 ({limit})。\n\n強行轉移可能會導致記憶遺失。\n是否仍要繼續？',
            btn_paint: '🖌️ 圈選',
            paint_tooltip: '圈選畫面區域文字',
            toast_enter_paint: '進入圈選模式 (按 ESC 退出)',
            paint_no_text: '未選取到任何文字',
            preview_title: '📝 <b>確認擷取內容 (Preview)</b>',
            preview_words: '字數',
            preview_cancel: '取消',
            preview_confirm: '加入採集籃',
            source_area_select: ' (圈選)',
            alert_llm_only: '自動填入功能 (Auto-fill) 僅支援(ChatGPT, Claude, Gemini, Grok)',
            btn_summary: 'AI 總結',
            btn_new_doc: '建立筆記',
            enter_new_doc: '請輸入內容：',
            ai_settings_title: 'AI 設定',
            ai_settings_endpoint: 'API 網址 (Endpoint)',
            ai_settings_api_key: 'API 金鑰 (Key)',
            ai_settings_save: '儲存設定',
            ai_unconfigured: '尚未設定 AI，請先進行設定。',
            ai_response_title: 'AI 回應',
            ai_response_tab_response: '回應',
            ai_response_tab_context: '上下文',
            ai_summary_sending: 'AI 正在總結中...',
            ai_summary_error: 'AI 請求失敗',
            drawer_toggle: '進階選項 & 採集籃',
            ai_setting_tab: 'AI 設定',
            ai_response_tab: 'AI 回應',
            ai_config_title: 'AI 設定',
            ai_provider: '模型供應商 (Provider)',
            ai_api_key: 'API 金鑰 (Key)',
            ai_model: '模型名稱 (Model)',
            ai_endpoint_toggle: 'API 網址 (Endpoint)',
            ai_save: '儲存設定',
            ai_modal_title: 'AI 回應',
            ai_modal_processing: 'AI 思考中...',
            ai_modal_done: '✅ 完成',
            ai_tab_res: 'AI 回應',
            ai_tab_ctx: '發送內容 (編輯)',
            btn_resend: '🔄 更新內容並重試',
            btn_save_file: '⬇️ 存為檔案',
            btn_paste: '📋 填入目前視窗',
            btn_send_all: '🚀 轉發全部',
            btn_copy_res: '複製',
            btn_clear_res: '清空',
            btn_min_restore: '還原視窗',
            btn_lang_title: '切換語言',
            btn_theme_title: '切換深色模式',
            btn_close_title: '關閉面板',
            hint_shortcut_lang: ' (Alt+L)',
            hint_shortcut_paint: ' (Alt+C)',
            hint_shortcut_toggle: ' (Alt+M)',
            btn_switch_ui: '切換介面風格',
            hatch_expand: '▼ 展開貨艙',
            hatch_retract: '▲ 收起貨艙',
            btn_quick_settings: '⚙️ AI 設定'
        },
        'en': {
            title: 'Context-Carry',
            status_ready: 'Ready',
            status_scanning: 'Scanning...',
            label_prefix: 'Custom Prefix (System Prompt):',
            placeholder: 'Enter instructions for the AI here...',
            btn_scan: 'Rescan Page',
            btn_select_all: 'Select All',
            btn_unselect_all: 'Unselect All',
            btn_scan_done: 'Scanned',
            btn_dl: 'Export to .txt',
            btn_copy: 'Copy to Clipboard',
            label_transfer: 'Transfer to (Cross-LLM):',
            msg_detected: 'Detected {n} messages',
            msg_selected: 'Selected: {n}',
            alert_no_selection: 'Please select messages or add to basket first!',
            alert_copy_done: 'Content copied!',
            alert_fail: 'Operation failed. Check permissions.',
            btn_add_title: 'Add this block (Shift for range)',
            toast_autofill: 'Context-Carry: Content Auto-filled ✨',
            default_prompt: `[SYSTEM: CONTEXT TRANSFER]\nThe following is the conversation history selected by the user. Please use this as context to continue the conversation:`,
            label_basket: '🧺 Context Basket:',
            btn_add_basket: 'Add (+)',
            btn_clear_basket: 'Clear',
            btn_paste_basket: 'Paste Here',
            basket_status: '{n} items in basket (Click to View ▼)',
            basket_status_empty: 'Basket is empty',
            toast_basket_add: 'Added to Basket 🧺',
            toast_basket_clear: 'Basket Cleared 🗑️',
            preview_del_tooltip: 'Remove item',
            preview_drag_hint: 'Drag to reorder ⇅ (Hover for details)',
            token_est: '📊 Est. Tokens:',
            token_warn_title: '⚠️ Token Limit Warning',
            token_warn_msg: 'Content ({est}) exceeds recommended limit for {platform} ({limit}).\n\nTransferring may cause memory loss.\nDo you want to proceed?',
            btn_paint: '🖌️ Select',
            paint_tooltip: 'Select area of text',
            toast_enter_paint: 'Entered selection mode (Press ESC to exit)',
            paint_no_text: 'No text selected',
            preview_title: '📝 <b>Confirm selection (Preview)</b>',
            preview_words: 'Chars',
            preview_cancel: 'Cancel',
            preview_confirm: 'Add to Basket',
            source_area_select: ' (Area Select)',
            alert_llm_only: 'Auto-fill is only available on supported(ChatGPT, Claude, Gemini, Grok)',
            btn_summary: 'AI Summary',
            btn_new_doc: 'New Doc',
            enter_new_doc: 'Enter content',
            ai_settings_title: 'AI Settings',
            ai_settings_endpoint: 'API Endpoint',
            ai_settings_api_key: 'API Key',
            ai_settings_save: 'Save Settings',
            ai_unconfigured: 'AI is not configured yet. Please set it up.',
            ai_response_title: 'AI Response',
            ai_response_tab_response: 'Response',
            ai_response_tab_context: 'Context',
            ai_summary_sending: 'Summarizing...',
            ai_summary_error: 'Summarization failed',
            drawer_toggle: 'Advanced & Basket',
            ai_setting_tab: 'AI Settings',
            ai_response_tab: 'AI Response',
            ai_config_title: 'AI Configuration',
            ai_provider: 'Provider',
            ai_api_key: 'API Key',
            ai_model: 'Model Name',
            ai_endpoint_toggle: 'Advanced Endpoint',
            ai_save: 'Save Settings',
            ai_modal_title: 'AI Response',
            ai_modal_processing: 'AI Processing...',
            ai_modal_done: '✅ AI Done',
            ai_tab_res: 'Response',
            ai_tab_ctx: 'Sent Context (Edit)',
            btn_resend: '🔄 Re-send with edited context',
            btn_save_file: '⬇️ Save',
            btn_paste: '📋 Paste to Window',
            btn_send_all: '🚀 Send All',
            btn_copy_res: 'Copy',
            btn_clear_res: 'Clear',
            btn_min_restore: 'Restore',
            btn_lang_title: 'Switch Language',
            btn_theme_title: 'Toggle Dark Mode',
            btn_close_title: 'Close Panel',
            hint_shortcut_lang: ' (Alt+L)',
            hint_shortcut_paint: ' (Alt+C)',
            hint_shortcut_toggle: ' (Alt+M)',
            btn_switch_ui: 'Switch UI Style',
            hatch_expand: '▼ DEPLOY BASKET',
            hatch_retract: '▲ RETRACT BASKET',
            btn_quick_settings: '⚙️ AI Settings'
        }
    };

    function injectStyles() {
        if (document.getElementById('cc-styles')) return;
        try {
            const style = document.createElement('style');
            style.id = 'cc-styles';
            style.appendChild(document.createTextNode(`
                #cc-panel {
                    transform: translateX(30px);
                    opacity: 0;
                    transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.3s ease;
                    position: fixed;
                    top: 80px;
                    right: 20px;
                    z-index: 2147483647;
                }
                #cc-panel.cc-visible {
                    transform: translateX(0);
                    opacity: 1;
                }
                #cc-panel {
                    --cc-bg: #ffffff;
                    --cc-text: #334155;
                    --cc-text-sub: #64748b;
                    --cc-border: #e2e8f0;
                    --cc-shadow: 0 10px 30px rgba(0,0,0,0.12);
                    --cc-btn-bg: #f8fafc;
                    --cc-btn-hover: #f1f5f9;
                    --cc-primary: #3b82f6;
                    --cc-drawer-bg: #f8fafc;

                    --gpt-bg: #ecfdf5; --gpt-text: #059669; --gpt-border: #a7f3d0;
                    --cld-bg: #fffbeb; --cld-text: #d97706; --cld-border: #fde68a;
                    --gem-bg: #eff6ff; --gem-text: #2563eb; --gem-border: #bfdbfe;
                    --grk-bg: #f3f4f6; --grk-text: #1f2937; --grk-border: #e5e7eb;
                }
                #cc-panel[data-theme="dark"] {
                    --cc-bg: #1e1e1e;
                    --cc-text: #e2e8f0;
                    --cc-text-sub: #94a3b8;
                    --cc-border: #333333;
                    --cc-shadow: 0 10px 40px rgba(0,0,0,0.5);
                    --cc-btn-bg: #2d2d2d;
                    --cc-btn-hover: #3d3d3d;
                    --cc-primary: #60a5fa;
                    --cc-drawer-bg: #252525;
                    --gpt-bg: rgba(16,185,129,0.15); --gpt-text: #34d399; --gpt-border: rgba(16,185,129,0.3);
                    --cld-bg: rgba(245,158,11,0.15); --cld-text: #fbbf24; --cld-border: rgba(245,158,11,0.3);
                    --gem-bg: rgba(59,130,246,0.15); --gem-text: #60a5fa; --gem-border: rgba(59,130,246,0.3);
                    --grk-bg: rgba(255,255,255,0.1); --grk-text: #e5e7eb; --grk-border: rgba(255,255,255,0.2);
                }

                #cc-panel.cc-panel {
                    width: 260px;
                    min-height: 200px;
                    background: var(--cc-bg);
                    color: var(--cc-text);
                    border: 1px solid var(--cc-border);
                    border-radius: 16px;
                    box-shadow: var(--cc-shadow);
                    padding: 16px;
                    font-size: 13px;
                    display: flex;
                    flex-direction: column;
                }

                #cc-panel .cc-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--cc-border);
                    cursor: move;
                    user-select: none;
                }
                #cc-panel .cc-title {
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                #cc-panel .cc-status {
                    font-size: 10px;
                    background: var(--cc-primary);
                    color: #fff;
                    padding: 2px 6px;
                    border-radius: 10px;
                }
                #cc-panel .cc-controls {
                    display: flex;
                    gap: 6px;
                }
                #cc-panel .cc-icon-btn {
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    color: var(--cc-text-sub);
                    font-size: 14px;
                    padding: 2px;
                    border-radius: 4px;
                    transition: 0.2s;
                }
                #cc-panel .cc-icon-btn:hover {
                    background: var(--cc-btn-hover);
                    color: var(--cc-text);
                }

                #cc-panel .cc-msg {
                    font-size: 11px;
                    color: var(--cc-text-sub);
                    margin-bottom: 8px;
                }

                #cc-panel .cc-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                    margin-bottom: 12px;
                }
                #cc-panel .platform-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                    font-weight: 600;
                    font-size: 12px;
                }
                #cc-panel .platform-btn:hover {
                    transform: translateY(-1px);
                    filter: brightness(1.05);
                }
                #cc-panel .platform-btn i {
                    font-style: normal;
                    font-size: 16px;
                }
                #cc-panel .p-chatgpt { background: var(--gpt-bg); color: var(--gpt-text); border-color: var(--gpt-border); }
                #cc-panel .p-claude { background: var(--cld-bg); color: var(--cld-text); border-color: var(--cld-border); }
                #cc-panel .p-gemini { background: var(--gem-bg); color: var(--gem-text); border-color: var(--gem-border); }
                #cc-panel .p-grok { background: var(--grk-bg); color: var(--grk-text); border-color: var(--grk-border); }

                #cc-panel .cc-tools {
                    display: flex;
                    gap: 6px;
                    margin-bottom: 8px;
                }
                #cc-panel .tool-btn {
                    flex: 1;
                    padding: 6px;
                    background: var(--cc-btn-bg);
                    border: 1px solid var(--cc-border);
                    color: var(--cc-text);
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 11px;
                    font-weight: 500;
                    transition: 0.2s;
                }
                #cc-panel .tool-btn:hover {
                    background: var(--cc-btn-hover);
                    border-color: var(--cc-text-sub);
                }

                #cc-panel .cc-drawer-toggle {
                    text-align: center;
                    color: var(--cc-text-sub);
                    font-size: 10px;
                    cursor: pointer;
                    padding: 4px;
                    user-select: none;
                    margin-top: 4px;
                }
                #cc-panel .cc-drawer-toggle:hover {
                    color: var(--cc-text);
                }

                #cc-panel .cc-drawer {
                    max-height: 0;
                    overflow: hidden;
                    opacity: 0;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    background: var(--cc-drawer-bg);
                    margin: 0 -16px -16px -16px;
                    border-radius: 0 0 16px 16px;
                    border-top: 1px solid var(--cc-border);
                }
                #cc-panel.expanded .cc-drawer {
                    max-height: 600px;
                    opacity: 1;
                    padding: 12px 16px;
                    margin-top: 8px;
                }
                #cc-panel.expanded .arrow {
                    transform: rotate(180deg);
                    display: inline-block;
                }

                #cc-panel .cc-input {
                    width: 100%;
                    box-sizing: border-box;
                    background: var(--cc-bg);
                    color: var(--cc-text);
                    border: 1px solid var(--cc-border);
                    border-radius: 6px;
                    font-size: 11px;
                    margin-bottom: 8px;
                    line-height: 1.4;
                }
                #cc-panel textarea.cc-input {
                    padding: 8px;
                    resize: vertical;
                    height: 120px;
                    min-height: 80px;
                }

                #cc-panel input.cc-input, 
                #cc-panel select.cc-input {
                    height: 36px !important;
                    min-height: 36px !important;
                    padding: 0 8px;
                    display: flex;
                    align-items: center;
                }

                #cc-panel .basket-info {
                    display: flex;
                    justify-content: space-between;
                    font-size: 11px;
                    color: var(--cc-text-sub);
                    margin-bottom: 4px;
                }
                #cc-panel .basket-preview-list {
                    margin-top: 4px;
                    max-height: 150px;
                    overflow-y: auto;
                    font-size: 11px;
                    color: var(--cc-text);
                }
                #cc-panel .empty-basket {
                    font-size: 10px;
                    color: var(--cc-text-sub);
                    text-align: center;
                    padding: 10px;
                    border: 1px dashed var(--cc-border);
                    border-radius: 6px;
                }
                #cc-panel .cc-basket-item {
                    transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
                    opacity: 1;
                    transform: translate3d(0,0,0);
                    max-height: 60px;
                    margin-bottom: 4px;
                }
                #cc-panel .cc-basket-item.cc-deleting {
                    opacity: 0;
                    transform: translateX(30px);
                    max-height: 0;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: hidden;
                }

                .cc-ai-tab {
                    position: absolute;
                    left: -28px;
                    top: 10px;
                    width: 28px;
                    height: 80px;
                    background: var(--cc-bg);
                    border: 1px solid var(--cc-border);
                    border-right: 1px solid var(--cc-bg);
                    border-radius: 8px 0 0 8px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: -2px 2px 5px rgba(0,0,0,0.05);
                    z-index: 0;
                    transition: all 0.2s ease;
                    color: var(--cc-text-sub);
                    font-weight: bold;
                    font-size: 12px;
                    writing-mode: vertical-rl;
                    text-orientation: mixed;
                    user-select: none;
                }
                .cc-ai-tab:hover {
                    left: -32px;
                    width: 32px;
                    color: var(--cc-primary);
                }
                .cc-ai-tab.active {
                    opacity: 0;
                    pointer-events: none;
                    left: 0;
                }

                .cc-res-tab {
                    position: absolute;
                    left: -28px;
                    top: 100px;
                    width: 28px;
                    height: 80px;
                    background: var(--cc-bg);
                    border: 1px solid var(--cc-border);
                    border-right: 1px solid var(--cc-bg);
                    border-radius: 8px 0 0 8px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: -2px 2px 5px rgba(0,0,0,0.05);
                    z-index: 0;
                    transition: all 0.2s ease;
                    color: var(--cc-text-sub);
                    font-weight: bold;
                    font-size: 12px;
                    writing-mode: vertical-rl;
                    text-orientation: mixed;
                    user-select: none;
                }
                .cc-res-tab:hover {
                    left: -32px;
                    width: 32px;
                    color: #4CAF50;
                }
                .cc-res-tab.active {
                    opacity: 0;
                    pointer-events: none;
                    left: 0;
                }

                .cc-ai-drawer {
                    position: absolute;
                    top: 0;
                    right: 100%; 
                    width: 0;
                    height: auto; 
                    min-height: 250px; 
                    
                    border-radius: 12px;
                    margin-right: 12px; 
                    
                    background: var(--cc-bg);
                    border: 1px solid var(--cc-border);
                    
                    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                    overflow: hidden;
                    opacity: 0;
                    z-index: -1;
                    box-shadow: -5px 5px 20px rgba(0,0,0,0.15); 
                    display: flex;
                    flex-direction: column;
                }
                .cc-ai-drawer.open {
                    width: 240px;
                    opacity: 1;
                    padding: 12px;
                    margin-right: -1px; 
                }
                .cc-ai-drawer.open::after {
                    content: '';
                    position: absolute;
                    top: 1px; bottom: 1px; right: -2px; width: 4px;
                    background: var(--cc-bg);
                    z-index: 10;
                }
                .cc-ai-content {
                    min-width: 216px; 
                    opacity: 0;
                    transition: opacity 0.2s 0.1s;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    flex: 1;
                    overflow-y: auto;
                    padding-bottom: 20px;
                }
                .cc-ai-drawer.open .cc-ai-content { opacity: 1; }
                .cc-ai-dot {
                    position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
                    width: 6px; height: 6px; background: #ff5252; border-radius: 50%; display: none;
                }
                .cc-ai-dot.visible { display: block; }
                .btn-ai-low {
                    border: 1px dashed var(--cc-border) !important;
                    opacity: 0.8;
                    color: var(--cc-text-sub);
                }
                .btn-ai-high {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                    color: #fff !important;
                    border: none !important;
                    box-shadow: 0 4px 12px rgba(118, 75, 162, 0.5);
                    font-weight: bold;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
                    animation: pulse-border 2s infinite;
                }
                @keyframes pulse-border {
                    0% { box-shadow: 0 0 0 0 rgba(118, 75, 162, 0.7); }
                    70% { box-shadow: 0 0 0 6px rgba(118, 75, 162, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(118, 75, 162, 0); }
                }

                .cc-modal-mask {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background-color: rgba(0,0,0,0.7); z-index: 2147483650;
                    display: flex; align-items: center; justify-content: center;
                    backdrop-filter: blur(3px);
                }
                .cc-modal-card {
                    background: rgba(20, 20, 25, 0.9);
                    backdrop-filter: blur(10px);
                    
                    border: 1px solid var(--c-accent);
                    box-shadow: 0 0 20px rgba(0, 210, 255, 0.15), inset 0 0 20px rgba(0, 0, 0, 0.8);
                    color: var(--c-text);
                    border-radius: 8px;
                    box-sizing: border-box;
                    overflow: hidden;
                    
                    clip-path: polygon(
                        10px 0, 100% 0, 
                        100% calc(100% - 10px), calc(100% - 10px) 100%, 
                        0 100%, 0 10px
                    );
                    
                    display: flex; flex-direction: column;
                    width: 600px; max-width: 90%; min-height: 400px;
                }

                .cc-modal-header {
                    background: rgba(0, 210, 255, 0.1);
                    border-bottom: 1px solid var(--c-border);
                    padding: 10px 15px;
                    display: flex; justify-content: space-between; align-items: center;
                    font-family: monospace; letter-spacing: 1px; color: var(--c-accent);
                }

                .cc-modal-content {
                    background: transparent;
                    font-family: 'Segoe UI', sans-serif;
                    line-height: 1.6;
                    padding: 20px;
                    color: #e0e6ed;
                    box-sizing: border-box;
                    width: 100%;
                }

                .cc-modal-card::before {
                    content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    background-image: linear-gradient(rgba(0, 210, 255, 0.03) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0, 210, 255, 0.03) 1px, transparent 1px);
                    background-size: 20px 20px;
                    pointer-events: none; z-index: -1;
                }
                .cc-modal-tabs {
                    display: flex; background: #252525; border-bottom: 1px solid #333;
                }
                .cc-modal-tab {
                    flex: 1; padding: 10px; cursor: pointer; text-align: center;
                    background: transparent; border: none; color: #888;
                    border-bottom: 2px solid transparent; font-size: 12px; font-weight: 600;
                }
                .cc-modal-tab.active {
                    color: #fff; background: rgba(255,255,255,0.05);
                    border-bottom-color: #764ba2;
                }
                .cc-modal-footer {
                    padding: 12px 16px; border-top: 1px solid #333;
                    background: #252525; display: flex; justify-content: flex-end; gap: 8px;
                    flex-wrap: wrap;
                }

                .cc-minimized {
                    width: 200px !important; height: 40px !important;
                    position: fixed !important; bottom: 20px !important; right: 20px !important;
                    top: auto !important; left: auto !important;
                    border-radius: 20px !important;
                    cursor: pointer; overflow: hidden;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                    z-index: 2147483651 !important;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.3) !important;
                }
                .cc-minimized .cc-modal-header { background: transparent; border: none; padding: 0 15px; height: 100%; }
                .cc-minimized .cc-modal-tabs, .cc-minimized .cc-modal-content, .cc-minimized .cc-modal-footer { display: none !important; }
                .cc-minimized .min-title { display: block !important; color: #fff; font-weight: bold; font-size: 12px; }
                .cc-minimized .min-controls { display: none; }

                #cc-panel ::-webkit-scrollbar { width: 6px; }
                #cc-panel ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
                #cc-panel ::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }
                #cc-panel ::-webkit-scrollbar-thumb:hover { background: #777; }

                [data-cc-hover="true"]::after {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    border: 2px dashed rgba(76, 175, 80, 0.6);
                    border-radius: inherit;
                    pointer-events: none;
                    z-index: 2000;
                }

                [data-cc-selected="true"]::after {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    border: 2px solid #4CAF50;
                    background-color: rgba(76, 175, 80, 0.05);
                    border-radius: inherit;
                    pointer-events: none;
                    z-index: 2000;
                }

                :root {
                    --mech-bg: #1a1b1e;
                    --mech-panel: #25262b;
                    --mech-border: #444;
                    --mech-accent: #00d2ff;
                    --mech-accent-glow: rgba(0, 210, 255, 0.3);
                    --mech-text: #e0e6ed;
                    --mech-text-dim: #888;
                    --mech-cable: #555;
                }

                .mech-container {
                    position: fixed;
                    top: 20px; right: 20px;
                    width: 320px;
                    z-index: 2147483647;
                    font-family: 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    filter: drop-shadow(0 20px 30px rgba(0,0,0,0.4));
                    transition: opacity 0.3s;
                    padding-top: 0;
                }

                .mech-container.cc-visible {
                    display: flex;
                    animation: hoverDrone 4s ease-in-out infinite;
                }

                .mech-container * {
                    box-sizing: border-box;
                    line-height: normal;
                }

                .mech-head {
                    width: 240px;
                    background: var(--mech-bg);
                    border: 2px solid var(--mech-border);
                    border-radius: 12px;
                    padding: 12px;
                    position: relative;
                    z-index: 20;
                    transition: border-color 0.3s, background 0.3s;
                }

                .winch-bay {
                    position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%);
                    width: 60px; height: 4px; background: var(--mech-panel);
                    border: 1px solid var(--mech-border); border-top: none;
                    border-radius: 0 0 4px 4px; z-index: 5;
                }

                .visor {
                    background: #000;
                    border: 1px solid #333; border-radius: 4px;
                    padding: 0 4px 0 10px; height: 36px;
                    display: flex; justify-content: space-between; align-items: center;
                    color: var(--mech-accent);
                    font-family: monospace; font-size: 11px; letter-spacing: 1px;
                    position: relative; overflow: hidden;
                    cursor: move;
                    margin-bottom: 10px;
                }

                .visor::after {
                    content: ''; position: absolute; top:0; left:0; width:100%; height:100%;
                    background: linear-gradient(90deg, transparent, var(--mech-accent-glow), transparent);
                    transform: translateX(-100%); animation: scan 4s infinite linear; pointer-events: none;
                }

                .visor-status { display: flex; align-items: center; gap: 8px; z-index: 2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; }
                .status-dot {
                    width: 6px; height: 6px; background: var(--mech-accent);
                    border-radius: 50%; box-shadow: 0 0 5px var(--mech-accent);
                    animation: pulse 2s infinite;
                }

                .comms-btn {
                    background: rgba(255,255,255,0.1); border: 1px solid #444; border-radius: 3px;
                    color: #888; cursor: pointer; display: flex; align-items: center; gap: 6px;
                    padding: 0 8px; height: 24px; font-family: monospace; font-size: 10px; transition: 0.2s;
                    z-index: 10;
                }
                .comms-btn:hover { background: #222; color: #fff; border-color: #666; }

                .input-deck { position: relative; }
                .main-input {
                    width: 100%; background: var(--mech-panel); border: 1px solid var(--mech-border);
                    color: var(--mech-text); padding: 8px 30px 8px 8px; border-radius: 4px;
                    font-size: 12px; height: 60px; resize: none; font-family: inherit; transition: 0.3s;
                }
                .main-input:focus { outline: none; border-color: var(--mech-accent); }

                .ai-trigger-btn {
                    position: absolute; right: 6px; bottom: 8px;
                    background: var(--mech-accent); color: #000; border: none;
                    width: 24px; height: 24px; border-radius: 4px;
                    cursor: pointer; display: flex; align-items: center; justify-content: center;
                    transition: 0.2s; font-weight: bold;
                }
                .ai-trigger-btn:hover { transform: scale(1.1); box-shadow: 0 0 10px var(--mech-accent); }

                .hatch-trigger {
                    width: 100%; text-align: center; color: var(--mech-text-dim); font-size: 9px;
                    padding-top: 8px; cursor: pointer; user-select: none; letter-spacing: 0.5px;
                    transition: color 0.2s;
                }
                .hatch-trigger:hover { color: var(--mech-accent); }

                .suspension-system {
                    position: relative; display: flex; flex-direction: column; align-items: center;
                    width: 220px; z-index: 10; margin-top: -10px;
                    transition: margin-top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                    pointer-events: none;
                }
                .mech-container.deployed .suspension-system { margin-top: 0; pointer-events: auto; }

                .cable-line {
                    width: 6px; height: 0px;
                    background: repeating-linear-gradient(45deg, var(--mech-cable), var(--mech-cable) 4px, var(--mech-border) 4px, var(--mech-border) 8px);
                    border-left: 1px solid #111; border-right: 1px solid #111;
                    transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1); position: relative;
                }
                .mech-container.deployed .cable-line { height: 50px; }

                .connector-joint {
                    width: 24px; height: 8px; background: var(--mech-border);
                    border-radius: 2px; position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%);
                    opacity: 0; transition: opacity 0.2s; z-index: 5;
                }
                .mech-container.deployed .connector-joint { opacity: 1; }

                .mech-basket {
                    width: 100%; background: var(--mech-bg);
                    border: 2px solid var(--mech-border); border-top: 4px solid var(--mech-accent);
                    border-radius: 4px 4px 8px 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.6);
                    height: 0; opacity: 0; overflow: hidden; transform: scale(0.95);
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); position: relative;
                }
                .mech-container.deployed .mech-basket {
                    height: auto;
                    min-height: 200px;
                    opacity: 1;
                    transform: scale(1);
                    padding-bottom: 10px;
                }
                .cargo-content {
                    padding: 15px;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }

                .basket-hook {
                    position: absolute; top: -6px; left: 50%; transform: translateX(-50%);
                    width: 12px; height: 6px; background: var(--mech-accent); border-radius: 4px;
                }
                .cargo-content { padding: 15px; }

                .basket-tools { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 8px; }
                .tiny-btn { font-size: 10px; color: var(--mech-text-dim); cursor: pointer; background: none; border: none; padding: 0; }
                .tiny-btn:hover { color: var(--mech-accent); text-decoration: underline; }

                /* Reuse existing basket item style logic but override colors */
                .mech-basket .cc-basket-item {
                    background: rgba(0,0,0,0.3) !important;
                    border-left: 2px solid var(--mech-text-dim) !important;
                    color: var(--mech-text) !important;
                    margin-bottom: 6px;
                }

                .thruster-pack {
                    display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
                    margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--mech-border);
                }
                .thruster-btn {
                    background: var(--mech-panel); border: 1px solid var(--mech-border);
                    color: var(--mech-text); padding: 8px; border-radius: 4px;
                    cursor: pointer; font-size: 11px; font-weight: bold;
                    display: flex; align-items: center; justify-content: center; gap: 6px; transition: 0.2s;
                }
                .thruster-btn:hover { background: var(--mech-accent-glow); border-color: var(--mech-accent); color: #fff; }

                body[data-theme="light"] {
                    --mech-bg: #e0e5ec;
                    --mech-panel: #f0f2f5;
                    --mech-border: #b0b8c4;
                    --mech-accent: #f97316;
                    --mech-accent-glow: rgba(249, 115, 22, 0.3);
                    --mech-text: #334155;
                    --mech-text-dim: #64748b;
                    --mech-cable: #94a3b8;
                }

                .antenna-group {
                    position: absolute; 
                    top: 0px;
                    left: 45%; 
                    transform: translateX(-50%);
                    z-index: 5; 
                    display: flex;
                    flex-direction: column;
                    align-items: center; 
                    cursor: pointer;
                    width: 40px;
                    opacity: 0;
                    transition: top 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.3s;
                    transition-delay: 0.3s;
                    pointer-events: none;
                }

                .mech-container:hover .antenna-group,
                .mech-container.deployed .antenna-group { 
                    top: -38px;
                    opacity: 1;
                    
                    transition-delay: 0s;
                    pointer-events: auto;
                }

                .antenna-group:hover .antenna-tip {
                    box-shadow: 0 0 15px var(--mech-accent);
                    background: #fff;
                }
                
                .antenna-tip {
                    width: 8px; height: 8px; background: var(--mech-accent); border-radius: 50%;
                    box-shadow: 0 0 10px var(--mech-accent); 
                    transition: all 0.2s;
                    margin-bottom: -1px;
                }
                .antenna-rod { width: 2px; height: 25px; background: var(--mech-border); }
                .antenna-base {
                    width: 30px; 
                    height: 12px; 
                    background: var(--mech-panel);
                    border-radius: 4px 4px 0 0; 
                    border: 1px solid var(--mech-border); 
                    border-bottom: none;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.5); 
                }

                .shoulder-pad {
                    position: absolute; top: 45px; width: 40px;
                    display: flex; flex-direction: column; gap: 6px; z-index: 15;
                }
                .shoulder-left { left: 0; align-items: flex-end; }
                .shoulder-right { right: 0; align-items: flex-start; }

                .mech-btn {
                    width: 36px; height: 36px; background: var(--mech-panel);
                    border: 1px solid var(--mech-border); color: var(--mech-text-dim);
                    border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;
                    font-size: 14px; transition: 0.2s; position: relative;
                }
                .mech-btn:hover {
                    background: var(--mech-bg); color: var(--mech-text); border-color: var(--mech-accent);
                    box-shadow: 0 0 8px var(--mech-accent-glow); transform: scale(1.1); z-index: 10;
                }
                .mech-head-controls {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                    padding-bottom: 6px;
                    border-bottom: 1px dashed #333;
                    width: 100%;
                }
                #mech-basket-list {
                    display: block !important;
                    flex: 1;
                    min-height: 50px;
                    max-height: 300px;
                    overflow-y: auto;
                    margin-top: 8px;
                    padding: 8px;
                    background: rgba(0, 0, 0, 0.4) !important;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                    box-sizing: border-box;
                }
                #mech-basket-list .cc-basket-item {
                    background: #2c2e33 !important;
                    border: 1px solid #444 !important;
                    border-left: 3px solid var(--mech-accent) !important;
                    color: #e0e6ed !important;
                    margin-bottom: 6px !important;
                    padding: 8px 10px !important;
                    opacity: 1 !important;
                    transform: none !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    min-height: auto !important;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
                }
                #mech-basket-list .cc-basket-item:hover {
                    background: #303136 !important;
                    border-color: var(--mech-accent) !important;
                    box-shadow: 0 0 8px var(--mech-accent-glow) !important;
                }
                .mech-container .shoulder-pad,
                .mech-container .antenna-group {
                    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                    opacity: 1;
                    transform: scale(1);
                }
                
                .mech-container.mech-retracting .shoulder-pad.shoulder-left {
                    transform: translateX(20px) scale(0.5);
                    opacity: 0;
                }
                .mech-container.mech-retracting .shoulder-pad.shoulder-right {
                    transform: translateX(-20px) scale(0.5);
                    opacity: 0;
                }
                .mech-container.mech-retracting .antenna-group {
                    transform: translateY(20px) scale(0.5) translateX(-50%);
                    opacity: 0;
                }

                .mech-container.mech-departing {
                    animation: mechDepart 2.5s forwards cubic-bezier(0.6, -0.28, 0.735, 0.045);
                    pointer-events: none;
                }
                
                @keyframes mechDepart {
                    0% {
                        transform: translate(0, 0) rotate(0deg);
                        opacity: 1;
                        filter: brightness(1);
                    }
                    15% {
                        transform: translate(40px, -10px) rotate(-5deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translate(150vw, -20px) rotate(10deg) scale(0.6);
                        opacity: 0;
                        filter: brightness(1.5);
                    }
                }

                #mech-basket-list div[style*="font-size: 10px"] { 
                    color: var(--mech-text-dim) !important; 
                    text-align: right; 
                    margin-bottom: 4px;
                }

                .mech-container.mech-shutdown {
                    animation: mechShutdown 1.5s forwards cubic-bezier(0.68, -0.55, 0.27, 1.55);
                    pointer-events: none;
                }
                @keyframes mechShutdown {
                    0% {
                        transform: scale(1) translate(0, 0);
                        opacity: 1;
                        filter: brightness(1);
                    }
                    20% {
                        transform: scale(0.95) translate(0, 10px);
                    }
                    40% {
                        transform: scale(0.8) translate(-20px, -10px) rotate(-5deg);
                        opacity: 1;
                    }
                    100% {
                        transform: scale(0.1) translate(120vw, -80vh) rotate(15deg);
                        opacity: 0;
                        filter: brightness(2);
                    }
                }

                .mech-config-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    z-index: 2147483660;
                    display: flex; align-items: center; justify-content: center;
                    opacity: 0; animation: fadeIn 0.3s forwards;
                }

                .mech-config-card {
                    width: 400px;
                    background: #1a1b1e;
                    border: 2px solid var(--mech-border);
                    border-top: 4px solid var(--mech-accent);
                    box-shadow: 0 0 30px rgba(0, 210, 255, 0.15);
                    color: var(--mech-text);
                    font-family: 'Segoe UI', monospace;
                    position: relative;
                    padding: 20px;
                    clip-path: polygon(
                        0 0, 100% 0, 
                        100% calc(100% - 20px), calc(100% - 20px) 100%, 
                        0 100%
                    );
                    transform: scale(0.9); animation: mechPopOpen 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
                @keyframes fadeIn { to { opacity: 1; } }
                @keyframes mechPopOpen { to { transform: scale(1); } }

                .mech-config-header {
                    font-size: 16px; font-weight: bold; color: var(--mech-accent);
                    text-transform: uppercase; letter-spacing: 2px;
                    border-bottom: 1px dashed var(--mech-border);
                    padding-bottom: 10px; margin-bottom: 20px;
                    display: flex; justify-content: space-between; align-items: center;
                }

                .mech-field { margin-bottom: 15px; }
                .mech-label {
                    display: block; font-size: 10px; color: var(--mech-text-dim);
                    margin-bottom: 5px; letter-spacing: 1px;
                }
                .mech-input, .mech-select {
                    width: 100%; background: #000;
                    border: 1px solid var(--mech-border); color: #fff;
                    padding: 8px 10px; font-family: monospace; font-size: 12px;
                    transition: 0.3s; box-sizing: border-box;
                }
                .mech-input:focus, .mech-select:focus {
                    border-color: var(--mech-accent);
                    box-shadow: 0 0 10px var(--mech-accent-glow);
                    outline: none;
                }

                .mech-btn-group { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
                .mech-action-btn {
                    background: transparent; border: 1px solid var(--mech-accent);
                    color: var(--mech-accent); padding: 8px 16px;
                    cursor: pointer; font-family: monospace; font-weight: bold;
                    text-transform: uppercase; transition: 0.2s;
                }
                .mech-action-btn:hover {
                    background: var(--mech-accent); color: #000;
                    box-shadow: 0 0 15px var(--mech-accent-glow);
                }
                .mech-cancel-btn {
                    background: transparent; border: 1px solid #555; color: #888;
                    padding: 8px 16px; cursor: pointer; font-family: monospace;
                }
                .mech-cancel-btn:hover { border-color: #888; color: #ccc; }

                .mech-deco-line {
                    position: absolute; bottom: 5px; right: 25px;
                    width: 30px; height: 2px; background: var(--mech-accent);
                    opacity: 0.5;
                }

                .power-group {
                    display: flex;
                    gap: 6px;
                }

                .power-btn {
                    width: 32px; height: 18px;
                    background: #000;
                    border: 1px solid #444;
                    border-radius: 2px;
                    cursor: pointer;
                    position: relative;
                    transition: all 0.2s;
                }
                .power-btn::after {
                    content: ''; position: absolute; top: 2px; left: 2px; bottom: 2px; width: 10px;
                    background: #555; transition: all 0.2s;
                }
                .power-btn:hover { border-color: #666; }
                .power-btn.active { border-color: var(--mech-accent); box-shadow: 0 0 5px rgba(0, 210, 255, 0.2); }
                .power-btn.active::after { left: 16px; background: var(--mech-accent); box-shadow: 0 0 5px var(--mech-accent); }

                .mech-close-btn {
                    width: 18px; height: 18px;
                    background: #200;
                    border: 1px solid #800;
                    color: #f00;
                    font-size: 10px;
                    font-weight: bold;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer;
                    border-radius: 50%;
                    transition: all 0.2s;
                }
                .mech-close-btn:hover { background: #f00; color: #fff; box-shadow: 0 0 8px #f00; }
                .linkage { position: absolute; top: 12px; width: 12px; height: 6px; background: var(--mech-border); z-index: -1; }
                .shoulder-left .linkage { right: -10px; }
                .shoulder-right .linkage { left: -10px; }

                @keyframes hoverDrone { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
                @keyframes scan { 0% { left: -50%; } 100% { left: 150%; } }
                @keyframes pulse { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.3); } }

            `));
            (document.head || document.documentElement).appendChild(style);
        } catch (e) {
            console.error("Context-Carry: Style injection failed:", e);
        }
    }

    /* =========================================
       2. Environment detection
    ========================================= */
    const host = window.location.hostname;
    let config = null;

    if (host.includes('chatgpt')) config = APP_CONFIG['chatgpt.com'];
    else if (host.includes('gemini.google.com')) config = APP_CONFIG['gemini.google.com'];
    else if (host.includes('claude')) config = APP_CONFIG['claude.ai'];
    else if (host.includes('x.com') || host.includes('grok.com')) config = APP_CONFIG['grok'];

    window.ccManager.config = config;


    function convertToMarkdown(element) {
        const clone = element.cloneNode(true);
        if (config && config.ignore) {
            clone.querySelectorAll(config.ignore).forEach(el => el.remove());
        }
        clone.querySelectorAll('.cc-btn').forEach(el => el.remove());
        clone.querySelectorAll('pre, code').forEach(code => {
            const isBlock = code.tagName === 'PRE' || (code.parentElement && code.parentElement.tagName === 'PRE');
            const content = code.innerText;
            if (isBlock) {
                let lang = '';
                const classes = code.className || '';
                const match = classes.match(/language-(\w+)/);
                if (match) lang = match[1];
                code.replaceWith(document.createTextNode(`\n\`\`\`${lang}\n${content}\n\`\`\`\n`));
            } else {
                code.replaceWith(document.createTextNode(`\`${content}\``));
            }
        });
        clone.querySelectorAll('b, strong').forEach(el => el.replaceWith(document.createTextNode(`**${el.innerText}**`)));
        clone.querySelectorAll('i, em').forEach(el => el.replaceWith(document.createTextNode(`*${el.innerText}*`)));
        ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach((h, i) => {
            const hashes = '#'.repeat(i + 1);
            clone.querySelectorAll(h).forEach(el => el.replaceWith(document.createTextNode(`\n${hashes} ${el.innerText}\n`)));
        });
        clone.querySelectorAll('a').forEach(a => {
            const href = a.getAttribute('href');
            if (href && !href.startsWith('#')) a.replaceWith(document.createTextNode(`[${a.innerText}](${href})`));
        });
        clone.querySelectorAll('li').forEach(li => li.replaceWith(document.createTextNode(`\n- ${li.innerText}`)));
        clone.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode('\n')));
        clone.querySelectorAll('p, div').forEach(p => p.append(document.createTextNode('\n')));

        return clone.innerText.trim();
    }

    function estimateTokens(text) {
        if (!text) return 0;
        return Math.ceil(text.length / 3.5);
    }

    function calculateTotalTokens() {
        const prefix = document.getElementById('cc-prefix-input')?.value || "";
        let selectedContent = "";

        document.querySelectorAll('.cc-btn[data-selected="true"]').forEach(btn => {
            selectedContent += convertToMarkdown(btn.parentElement) + "\n";
        });

        getBasket(basket => {
            let basketContent = "";
            basket.forEach(item => basketContent += item.text);

            const totalText = prefix + selectedContent + basketContent;
            const count = estimateTokens(totalText);

            const display = document.getElementById('cc-token-display');
            if (display) {
                const label = LANG_DATA[window.ccManager.lang].token_est;
                display.innerText = `${label} ${count.toLocaleString()}`;

                display.style.color = count > 30000 ? '#ff9800' : '#aaa';
            }
        });
    }

    /* =========================================
       3. Main Functions: Open / Close / Toggle
    ========================================= */

    function openInterface() {
        if (window.ccManager.active) return;

        try {
            injectStyles();
        } catch (e) {
            console.error("Context-Carry: Critical error in injectStyles", e);
        }
        window.ccManager.active = true;

        try {
            if (window.ccManager.uiMode === 'robot') {
                createRobotPanel();
            } else {
                createPanel();
            }
        } catch (e) {
            console.error("Panel creation failed", e);
            window.ccManager.active = false;
            return;
        }
        setTimeout(() => {
            const panel = document.getElementById('cc-panel');
            if (panel) panel.classList.add('cc-visible');
        }, 10);

        if (window.ccManager.config) {
            performScan();
            window.ccManager.interval = setInterval(performScan, 3000);
        }
        try {
            checkAutoFill();
            updateBasketUI();
        } catch (e) {
            console.error("Context-Carry: Error in post-panel logic", e);
        }
    }

    function closeInterface() {
        if (!window.ccManager.active) return;
        window.ccManager.active = false;

        if (window.ccManager.interval) {
            clearInterval(window.ccManager.interval);
            window.ccManager.interval = null;
        }

        const panel = document.getElementById('cc-panel') || document.getElementById('cc-robot-panel');

        if (panel) {
            if (panel.id === 'cc-robot-panel') {
                panel.classList.remove('deployed');
                setTimeout(() => {
                    panel.classList.add('mech-retracting');
                }, 200);

                setTimeout(() => {
                    panel.classList.remove('cc-visible');
                    panel.classList.add('mech-departing');
                    setTimeout(() => {
                        cleanupDOM(panel);
                    }, 2000);
                }, 800);

            } else {
                panel.classList.remove('cc-visible');
                setTimeout(() => {
                    cleanupDOM(panel);
                }, 300);
            }
        } else {
            cleanupDOM(null);
        }
    }

    function cleanupDOM(panel) {
        if (panel) panel.remove();
        document.getElementById('cc-tooltip')?.remove();

        if (paintSvg) {
            paintSvg.remove(); paintSvg = null;
            document.removeEventListener('keydown', onEscKey);
        }

        document.querySelectorAll('.cc-btn').forEach(e => e.remove());
        const processedElements = document.querySelectorAll('[data-cc-listening], [data-cc-selected], [data-cc-hover]');
        processedElements.forEach(el => {
            if (el._ccHandlers) {
                el.removeEventListener('mouseenter', el._ccHandlers.onMouseEnter);
                el.removeEventListener('mouseleave', el._ccHandlers.onMouseLeave);
                el.removeEventListener('click', el._ccHandlers.onClick);
                el.removeEventListener('dragstart', el._ccHandlers.onDragStart);
                el.removeEventListener('dragend', el._ccHandlers.onDragEnd);
                delete el._ccHandlers;
            }
            el.style.boxShadow = '';
            el.style.outline = '';
            el.style.backgroundColor = el.dataset.originalBg || '';
            el.removeAttribute('draggable');
            el.style.cursor = '';
            delete el.dataset.ccListening;
            delete el.dataset.ccSelected;
            delete el.dataset.ccHover;
            delete el.dataset.originalBg;
        });

        window.ccManager.lastCheckedIndex = null;
    }

    function toggleInterface() {
        if (window.ccManager.active) {
            closeInterface();
        } else {
            openInterface();
        }
    }
    window.ccManager.toggleFn = toggleInterface;

    /* =========================================
       4. UI Construction
    ========================================= */
    let title, msg, prefixLabel, prefixInput, btnDl, btnCopy, btnScan, btnPaint, transferLabel, transferContainer, btnSelectAll, btnUnselectAll;
    let basketLabel, basketStatus, btnAddBasket, btnClearBasket, btnPasteBasket, basketPreviewList;
    let tooltip;
    let btnSummary, btnNewDoc;

    function createPanel() {
        if (document.getElementById('cc-panel')) return;
        const curLang = window.ccManager.lang;
        const t = LANG_DATA[curLang];

        tooltip = document.createElement('div');
        tooltip.id = 'cc-tooltip';
        Object.assign(tooltip.style, {
            position: 'fixed', display: 'none', zIndex: '2147483648',
            background: 'rgba(20, 20, 20, 0.95)', color: '#fff',
            padding: '8px 12px', borderRadius: '6px', fontSize: '12px',
            maxWidth: '300px', maxHeight: '200px', overflowY: 'auto',
            border: '1px solid #555', boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
            pointerEvents: 'none', whiteSpace: 'pre-wrap', fontFamily: 'monospace'
        });
        document.body.appendChild(tooltip);

        const panel = document.createElement('div');
        panel.id = 'cc-panel';
        panel.classList.add('cc-panel');

        const aiDrawer = document.createElement('div');
        aiDrawer.className = 'cc-ai-drawer';
        aiDrawer.id = 'cc-ai-drawer-panel';
        const aiContent = document.createElement('div');
        aiContent.className = 'cc-ai-content';
        aiDrawer.appendChild(aiContent);

        aiContent.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--cc-border); padding-bottom:8px;">
                <div style="font-weight:bold; font-size:14px;">🤖 AI 助手</div>
                <button id="btn-close-drawer" style="background:none; border:none; cursor:pointer; font-size:16px; color:var(--cc-text-sub); padding:0 4px;">
                    ◀
                </button>
            </div>
            
            <div id="ai-response-area" style="flex:1; overflow-y:auto; font-size:12px; margin-bottom:8px; white-space:pre-wrap; color:var(--cc-text);">
                尚未設定 AI 或尚無回應...
            </div>
            <div style="border-top:1px solid var(--cc-border); padding-top:8px;">
                <button id="btn-ai-config" style="width:100%; padding:6px; background:var(--cc-btn-bg); border:1px solid var(--cc-border); border-radius:6px; cursor:pointer; font-size:11px; color:var(--cc-text);">⚙️ 設定 API Key</button>
            </div>
        `;

        setTimeout(() => {
            const closeBtn = aiContent.querySelector('#btn-close-drawer');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    aiDrawer.classList.remove('open');
                    aiTab.classList.remove('active');
                };
            }
        }, 0);

        const aiTab = document.createElement('div');
        aiTab.className = 'cc-ai-tab';
        aiTab.innerHTML = `<span>${t.ai_setting_tab}</span>`;
        aiTab.title = t.ai_setting_tab;

        const resTab = document.createElement('div');
        resTab.className = 'cc-res-tab';
        resTab.innerHTML = `<span>${t.ai_response_tab}</span>`;

        function openDrawer(mode) {
            aiDrawer.classList.add('open');

            if (mode === 'settings') {
                aiTab.classList.add('active');
                resTab.classList.remove('active');
                resTab.style.display = 'none';
                renderCompactSettings(aiContent);
            } else {
                resTab.classList.add('active');
                aiTab.classList.remove('active');
                resTab.style.display = 'flex';
                renderResponsePanel(aiContent);
            }
        }

        function closeDrawer() {
            aiDrawer.classList.remove('open');
            aiTab.classList.remove('active');
            resTab.classList.remove('active');
            resTab.style.display = 'flex';
        }

        aiTab.onclick = (e) => {
            e.stopPropagation();
            if (aiDrawer.classList.contains('open') && aiTab.classList.contains('active')) {
                closeDrawer();
            } else {
                openDrawer('settings');
            }
        };

        resTab.onclick = (e) => {
            e.stopPropagation();
            const drawer = document.getElementById('cc-ai-drawer-panel');
            if (drawer && drawer.classList.contains('open')) {
                drawer.classList.remove('open');
                document.querySelector('.cc-ai-tab')?.classList.remove('active');
            }
            if (window.ccManager.streamingModal && window.ccManager.streamingModal.element) {
                window.ccManager.streamingModal.restore();
            } else {
                const modal = showStreamingResponseModal("", window.ccManager.lastAiConfig);
                if (window.ccManager.lastAiText) {
                    modal.append(window.ccManager.lastAiText);
                    modal.done();
                }
            }
        };

        panel.appendChild(aiDrawer);
        panel.appendChild(aiTab);
        panel.appendChild(resTab);

        window.renderCompactSettings = function (container) {
            if (!container) container = document.querySelector('.cc-ai-content');
            if (!container) return;

            const config = window.ccManager.aiConfig || {};
            const t = LANG_DATA[window.ccManager.lang];
            const MODEL_PRESETS = {
                'openai': [
                    'gpt-4o-mini', 'gpt-3.5-turbo', 'gpt-4.1-mini',
                    'gpt-4o', 'o1', 'gpt-4.1'
                ],

                'claude': [
                    'claude-3-haiku', 'claude-3-sonnet', 'claude-3.5-haiku',
                    'claude-3.5-sonnet', 'claude-3-opus', 'claude-3.5-opus'
                ],

                'gemini': [
                    'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro',
                    'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-pro',
                ],

                'grok': [
                    'grok-2-mini', 'grok-2', 'grok-3-mini',
                    'grok-3', 'grok-4', 'grok-4-fast'
                ],

                'local': ['llama3', 'mistral', 'gemma']
            };

            container.innerHTML = `
                <div style="height:100%; display:flex; flex-direction:column; padding:10px 4px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-weight:bold; font-size:13px; border-bottom:1px solid var(--cc-border); padding-bottom:6px;">
                        <span>⚙️ ${t.ai_config_title}</span>
                        <span id="btn-close-drawer-compact" style="cursor:pointer; opacity:0.6; font-size:14px;">✕</span>
                    </div>

                    <div style="flex:1; display:flex; flex-direction:column; gap:10px;">
                        <div>
                            <label style="font-size:10px; color:var(--cc-text-sub); display:block; margin-bottom:2px;">${t.ai_provider}</label>
                            <select id="drawer-ai-provider" class="cc-input" style="height:28px !important; margin:0;">
                                <option value="openai">OpenAI (ChatGPT)</option>
                                <option value="claude">Anthropic (Claude)</option>
                                <option value="gemini">Google (Gemini)</option>
                                <option value="grok">xAI (Grok)</option>
                                <option value="local">Local (Ollama)</option>
                            </select>
                        </div>

                        <div>
                            <label style="font-size:10px; color:var(--cc-text-sub); display:block; margin-bottom:2px;">${t.ai_api_key}</label>
                            <input type="password" id="drawer-ai-key" class="cc-input" style="height:28px !important; margin:0;" placeholder="sk-...">
                        </div>

                        <div>
                            <label style="font-size:10px; color:var(--cc-text-sub); display:block; margin-bottom:2px;">${t.ai_model}</label>
                            <div style="display:flex; gap:6px;">
                                <select id="drawer-ai-model-select" class="cc-input" style="width:24px; padding:0 4px; flex:0 0 auto; cursor:pointer;" title="Quick Select">
                                    <option value="">▼</option>
                                </select>
                                <input type="text" id="drawer-ai-model" class="cc-input" style="height:28px !important; margin:0; flex:1;" placeholder="e.g., gpt-4o">
                            </div>
                        </div>

                        <div>
                            <div id="toggle-advanced" style="font-size:10px; color:var(--cc-text-sub); cursor:pointer; display:flex; align-items:center; gap:4px;">
                                <span>▶</span> ${t.ai_endpoint_toggle}
                            </div>
                            <input type="text" id="drawer-ai-endpoint" class="cc-input" 
                                style="display:none; height:28px !important; margin-top:4px; font-size:11px;" 
                                placeholder="https://api...">
                        </div>
                    </div>

                    <button id="drawer-save" style="margin-top:12px; width:100%; background:var(--cc-primary); color:#fff; border:none; padding:8px; border-radius:6px; font-weight:bold; cursor:pointer;">
                        ${t.ai_save}
                    </button>
                </div>
            `;

            const providerSel = container.querySelector('#drawer-ai-provider');
            const epInput = container.querySelector('#drawer-ai-endpoint');
            const modelInput = container.querySelector('#drawer-ai-model');
            const modelSelect = container.querySelector('#drawer-ai-model-select');
            const advToggle = container.querySelector('#toggle-advanced');
            const keyInput = container.querySelector('#drawer-ai-key');

            keyInput.value = config.apiKey || '';
            modelInput.value = config.model || '';
            epInput.value = config.endpoint || '';

            const updateModelList = async (provider) => {
                modelSelect.innerHTML = '<option value="">Loading...</option>';

                let models = MODEL_PRESETS[provider] || [];
                if (provider === 'local') {
                    try {
                        const response = await new Promise(resolve => {
                            chrome.runtime.sendMessage({ action: "GET_OLLAMA_MODELS" }, resolve);
                        });

                        if (response && response.success && response.models.length > 0) {
                            models = response.models;
                        } else {
                            const opt = document.createElement('option');
                            opt.value = "";
                            opt.textContent = "⚠️ Connection failed (please check Ollama)";
                            opt.disabled = true;
                            modelSelect.appendChild(opt);
                        }
                    } catch (e) {
                        console.warn("Could not fetch local models", e);
                    }
                }

                modelSelect.innerHTML = '<option value="">▼</option>';
                models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m;
                    opt.textContent = m;
                    modelSelect.appendChild(opt);
                });
            };

            providerSel.value = config.provider || 'openai';
            updateModelList(providerSel.value);

            if (!epInput.value) {
                const val = providerSel.value;
                const currentModel = modelInput.value || (MODEL_PRESETS[val] ? MODEL_PRESETS[val][0] : '');
                if (val === 'openai') epInput.value = 'https://api.openai.com/v1/chat/completions';
                else if (val === 'gemini') epInput.value = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:streamGenerateContent`;
                else if (val === 'claude') epInput.value = 'https://api.anthropic.com/v1/messages';
                else if (val === 'grok') epInput.value = 'https://api.x.ai/v1/chat/completions';
                else if (val === 'local') epInput.value = 'http://localhost:11434/api/chat';
            }

            if (!modelInput.value) {
                const val = providerSel.value;
                if (MODEL_PRESETS[val] && MODEL_PRESETS[val].length > 0) {
                    modelInput.value = MODEL_PRESETS[val][0];
                }
            }

            providerSel.onchange = async () => {
                const val = providerSel.value;
                let defEp = epInput.value;
                let defModel = MODEL_PRESETS[val] ? MODEL_PRESETS[val][0] : '';

                if (val === 'openai') {
                    defEp = 'https://api.openai.com/v1/chat/completions';
                }
                else if (val === 'gemini') {
                    defEp = `https://generativelanguage.googleapis.com/v1beta/models/${defModel}:streamGenerateContent`;
                }
                else if (val === 'claude') {
                    defEp = 'https://api.anthropic.com/v1/messages';
                }
                else if (val === 'grok') {
                    defEp = 'https://api.x.ai/v1/chat/completions';
                }
                else if (val === 'local') {
                    defEp = 'http://localhost:11434/api/chat';
                    advToggle.click();
                }

                epInput.value = defEp;
                await updateModelList(val);
                if (modelSelect.options.length > 1) {
                    const firstModel = modelSelect.options[1].value;
                    modelInput.value = firstModel;
                }

            };

            modelSelect.onchange = () => {
                if (modelSelect.value) {
                    modelInput.value = modelSelect.value;
                    if (providerSel.value === 'gemini') {
                        epInput.value = `https://generativelanguage.googleapis.com/v1beta/models/${modelSelect.value}:streamGenerateContent`;
                    }
                    flashInput(modelInput);
                }
            };

            modelInput.oninput = () => {
                if (providerSel.value === 'gemini') {
                    const typedModel = modelInput.value.trim();
                    if (typedModel) {
                        epInput.value = `https://generativelanguage.googleapis.com/v1beta/models/${typedModel}:streamGenerateContent`;
                    }
                }
            };

            advToggle.onclick = () => {
                const isHidden = epInput.style.display === 'none';
                epInput.style.display = isHidden ? 'block' : 'none';
                advToggle.querySelector('span').innerText = isHidden ? '▼' : '▶';
            };

            container.querySelector('#drawer-save').onclick = function () {
                const newConfig = {
                    configured: true,
                    provider: providerSel.value,
                    endpoint: epInput.value.trim(),
                    apiKey: container.querySelector('#drawer-ai-key').value.trim(),
                    model: modelInput.value.trim()
                };

                const btn = this;
                chrome.storage.local.set({ 'cc_ai_config': newConfig }, () => {
                    window.ccManager.aiConfig = newConfig;
                    btn.innerText = "OK!";

                    setTimeout(() => {
                        const drawer = document.getElementById('cc-ai-drawer-panel');
                        if (drawer) drawer.classList.remove('open');
                        document.querySelector('.cc-ai-tab')?.classList.remove('active');
                        const resTab = document.querySelector('.cc-res-tab');
                        if (resTab) resTab.style.display = 'flex';

                        btn.innerText = t.ai_settings_save || 'Save Settings';
                    }, 500);

                    loadAiConfig();
                });
            };

            container.querySelector('#btn-close-drawer-compact').onclick = () => {
                document.getElementById('cc-ai-drawer-panel').classList.remove('open');
                document.querySelector('.cc-ai-tab').classList.remove('active');

                const resTab = document.querySelector('.cc-res-tab');
                if (resTab) resTab.style.display = 'flex';
            };
        };

        const configBtn = aiContent.querySelector('#btn-ai-config');
        configBtn.onclick = () => {
            renderCompactSettings(aiContent);
        };

        panel.appendChild(aiDrawer);
        panel.appendChild(aiTab);
        panel.classList.add('cc-panel');

        const header = document.createElement('div');
        header.className = 'cc-header';
        const titleWrapper = document.createElement('div');
        titleWrapper.className = 'cc-title';
        title = document.createElement('span');
        title.textContent = t.title;
        titleWrapper.appendChild(title);
        const statusBadge = document.createElement('span');
        statusBadge.id = 'status-badge';
        statusBadge.className = 'cc-status';
        statusBadge.textContent = '0';
        titleWrapper.appendChild(statusBadge);

        const controls = document.createElement('div');
        controls.className = 'cc-controls';
        const robotBtn = document.createElement('button');
        robotBtn.className = 'cc-icon-btn';
        robotBtn.innerText = '🚁';
        robotBtn.title = "Switch to Sky-Crane UI";
        robotBtn.onclick = () => toggleUIMode('robot');
        controls.appendChild(robotBtn);
        const langBtn = document.createElement('button');
        langBtn.id = 'cc-btn-lang';
        langBtn.className = 'cc-icon-btn';
        langBtn.textContent = '🌐';
        langBtn.title = t.btn_lang_title + t.hint_shortcut_lang;
        langBtn.onclick = function () {
            const oldLang = window.ccManager.lang;
            const newLang = oldLang === 'zh' ? 'en' : 'zh';
            const currentInput = prefixInput?.value?.trim() || '';
            const oldDefault = LANG_DATA[oldLang].default_prompt.trim();
            if (currentInput === oldDefault) {
                prefixInput.value = LANG_DATA[newLang].default_prompt;
            }
            window.ccManager.lang = newLang;
            updateUITexts();
        };
        controls.appendChild(langBtn);
        const themeBtn = document.createElement('button');
        themeBtn.id = 'cc-btn-theme';
        themeBtn.className = 'cc-icon-btn';
        themeBtn.textContent = '🌙';
        themeBtn.title = t.btn_theme_title;
        themeBtn.onclick = function () {
            const isDark = panel.getAttribute('data-theme') === 'dark';
            const targets = [
                document.getElementById('cc-panel'),
                document.getElementById('cc-ai-settings-panel'),
                document.getElementById('cc-ai-response-panel')
            ];

            if (isDark) {
                targets.forEach(el => el && el.removeAttribute('data-theme'));
                themeBtn.textContent = '🌙';
            } else {
                targets.forEach(el => el && el.setAttribute('data-theme', 'dark'));
                themeBtn.textContent = '☀️';
            }
        };
        controls.appendChild(themeBtn);

        const closeBtn = document.createElement('button');
        closeBtn.id = 'cc-btn-close';
        closeBtn.className = 'cc-icon-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.title = t.btn_close_title + t.hint_shortcut_toggle;
        closeBtn.onclick = closeInterface;
        controls.appendChild(closeBtn);

        header.appendChild(titleWrapper);
        header.appendChild(controls);

        msg = document.createElement('div');
        msg.className = 'cc-msg';
        msg.textContent = t.status_scanning;

        transferContainer = document.createElement('div');
        transferContainer.className = 'cc-grid';

        transferLabel = document.createElement('div');
        transferLabel.style.display = 'none';

        PLATFORMS.forEach(p => {
            const btn = document.createElement('div');
            btn.classList.add('platform-btn');
            if (p.id === 'chatgpt') btn.classList.add('p-chatgpt');
            if (p.id === 'claude') btn.classList.add('p-claude');
            if (p.id === 'gemini') btn.classList.add('p-gemini');
            if (p.id === 'grok') btn.classList.add('p-grok');
            btn.innerHTML = `<i>${p.icon}</i> ${p.name}`;
            btn.title = `Transfer to ${p.name}`;
            btn.onclick = () => handleCrossTransfer(p);
            transferContainer.appendChild(btn);
        });

        const toolsRow = document.createElement('div');
        toolsRow.className = 'cc-tools';

        btnSelectAll = document.createElement('button');
        btnSelectAll.className = 'tool-btn';
        btnSelectAll.textContent = t.btn_select_all;
        btnSelectAll.onclick = handleSelectAll;

        btnUnselectAll = document.createElement('button');
        btnUnselectAll.className = 'tool-btn';
        btnUnselectAll.textContent = t.btn_unselect_all;
        btnUnselectAll.onclick = handleUnselectAll;

        btnCopy = document.createElement('button');
        btnCopy.className = 'tool-btn';
        btnCopy.textContent = t.btn_copy;
        btnCopy.onclick = handleCopyOnly;

        toolsRow.append(btnSelectAll, btnUnselectAll, btnCopy);
        const aiToolsRow = document.createElement('div');
        aiToolsRow.className = 'cc-tools';
        aiToolsRow.style.marginTop = '4px';

        btnSummary = document.createElement('button');
        btnSummary.className = 'tool-btn btn-ai-low';
        btnSummary.textContent = t.btn_summary;
        btnSummary.onclick = () => {
            if (window.ccManager.streamingModal && window.ccManager.streamingModal.isMinimized) {
                window.ccManager.streamingModal.restore();
                return;
            }
            handleAiSummary();
        };
        aiToolsRow.appendChild(btnSummary);

        const drawerToggle = document.createElement('div');
        drawerToggle.className = 'cc-drawer-toggle';
        drawerToggle.innerHTML = `<span class="arrow">▼</span>${t.drawer_toggle}`;
        drawerToggle.onclick = () => {
            panel.classList.toggle('expanded');
        };
        const drawer = document.createElement('div');
        drawer.className = 'cc-drawer';

        prefixLabel = document.createElement('div');
        prefixLabel.textContent = t.label_prefix;
        prefixLabel.style.fontWeight = '600';
        prefixLabel.style.fontSize = '12px';
        prefixLabel.style.marginBottom = '4px';

        prefixInput = document.createElement('textarea');
        prefixInput.id = 'cc-prefix-input';
        prefixInput.className = 'cc-input';
        prefixInput.value = t.default_prompt;
        prefixInput.placeholder = t.placeholder;
        prefixInput.addEventListener('input', calculateTotalTokens);

        const basketInfo = document.createElement('div');
        basketInfo.className = 'basket-info';
        basketLabel = document.createElement('span');
        basketLabel.style.display = 'none';
        basketInfo.appendChild(basketLabel);
        basketStatus = document.createElement('span');
        basketStatus.textContent = t.basket_status_empty;
        basketStatus.style.cursor = 'pointer';
        basketStatus.onclick = toggleBasketPreview;
        basketInfo.appendChild(basketStatus);
        btnClearBasket = document.createElement('span');
        btnClearBasket.textContent = t.btn_clear_basket;
        btnClearBasket.style.cursor = 'pointer';
        btnClearBasket.style.color = 'var(--cc-primary)';
        btnClearBasket.onclick = handleClearBasket;
        basketInfo.appendChild(btnClearBasket);

        const basketBtnRow = document.createElement('div');
        basketBtnRow.className = 'cc-tools';
        btnAddBasket = document.createElement('button');
        btnAddBasket.className = 'tool-btn';
        btnAddBasket.textContent = t.btn_add_basket;
        btnAddBasket.onclick = handleAddToBasket;
        btnPasteBasket = document.createElement('button');
        btnPasteBasket.className = 'tool-btn';
        btnPasteBasket.textContent = t.btn_paste_basket;
        btnPasteBasket.onclick = handlePasteBasket;
        basketBtnRow.append(btnAddBasket, btnPasteBasket);
        btnNewDoc = document.createElement('button');
        btnNewDoc.className = 'tool-btn';
        btnNewDoc.textContent = t.btn_new_doc;
        btnNewDoc.onclick = handleNewDoc;
        basketBtnRow.append(btnNewDoc);
        const basketContainer = document.createElement('div');
        Object.assign(basketContainer.style, {
            position: 'relative',
            minHeight: '60px',
            marginTop: '8px',
            borderRadius: '8px',
            transition: 'all 0.2s'
        });
        basketPreviewList = document.createElement('div');
        basketPreviewList.className = 'basket-preview-list';
        basketPreviewList.style.display = 'none';
        const dropOverlay = document.createElement('div');
        dropOverlay.className = 'cc-drop-overlay';
        dropOverlay.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 4px;">📥</div>
            <div style="font-size: 12px; font-weight: bold;">Drop to Add to Basket</div>
        `;
        Object.assign(dropOverlay.style, {
            position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(76, 175, 80, 0.9)',
            color: '#fff',
            display: 'none',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            borderRadius: '8px', zIndex: '10', backdropFilter: 'blur(2px)',
            pointerEvents: 'none'
        });
        basketContainer.append(basketPreviewList, dropOverlay);
        const tokenDisplay = document.createElement('div');
        tokenDisplay.id = 'cc-token-display';
        tokenDisplay.style.fontSize = '11px';
        tokenDisplay.style.color = 'var(--cc-text-sub)';
        tokenDisplay.style.marginTop = '4px';
        tokenDisplay.style.marginBottom = '4px';
        tokenDisplay.style.textAlign = 'right';
        tokenDisplay.style.fontWeight = 'bold';
        tokenDisplay.textContent = `${t.token_est} 0`;

        btnPaint = document.createElement('button');
        btnPaint.className = 'tool-btn';
        btnPaint.innerText = t.btn_paint;
        btnPaint.title = t.paint_tooltip + t.hint_shortcut_paint;
        btnPaint.onclick = () => {
            toggleSelectionMode();
            const p = document.getElementById('cc-panel');
            if (p) p.style.opacity = '0.2';
        };

        const extraActions = document.createElement('div');
        extraActions.className = 'cc-tools';
        btnDl = document.createElement('button');
        btnDl.className = 'tool-btn';
        btnDl.textContent = t.btn_dl;
        btnDl.onclick = handleDownload;
        btnScan = document.createElement('button');
        btnScan.className = 'tool-btn';
        btnScan.textContent = t.btn_scan;
        btnScan.onclick = function () {
            performScan();
            this.textContent = LANG_DATA[window.ccManager.lang].btn_scan_done;
            setTimeout(() => {
                this.textContent = LANG_DATA[window.ccManager.lang].btn_scan;
            }, 1000);
        };
        extraActions.append(btnPaint, btnDl, btnScan);
        drawer.append(prefixLabel, prefixInput, basketInfo, basketBtnRow, basketContainer, tokenDisplay, extraActions);
        panel.append(header, msg, transferLabel, transferContainer, toolsRow, aiToolsRow, drawerToggle, drawer);
        panel.addEventListener('dragover', (e) => {
            if (e.dataTransfer.types.includes('application/cc-sort')) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            if (!panel.classList.contains('expanded')) {
                panel.classList.add('expanded');
            }
            if (basketPreviewList.style.display === 'none') {
                toggleBasketPreview();
            }
            dropOverlay.style.display = 'flex';
            basketContainer.style.boxShadow = '0 0 15px rgba(76, 175, 80, 0.5)';
            basketContainer.style.transform = 'scale(1.02)';
        });
        panel.addEventListener('dragleave', (e) => {
            if (panel.contains(e.relatedTarget)) return;
            dropOverlay.style.display = 'none';
            basketContainer.style.boxShadow = 'none';
            basketContainer.style.transform = 'scale(1)';
        });

        panel.addEventListener('drop', (e) => {
            dropOverlay.style.display = 'none';
            basketContainer.style.boxShadow = 'none';
            basketContainer.style.transform = 'scale(1)';
            if (e.dataTransfer.types && e.dataTransfer.types.includes('application/cc-sort')) return;
            e.preventDefault();

            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                Array.from(files).forEach((file) => {
                    if (file.type && file.type.includes('text') || /\.md$/i.test(file.name) || /\.txt$/i.test(file.name)) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            const content = (ev.target.result || '').trim();
                            if (!content) return;
                            getBasket((basket) => {
                                basket.push({
                                    text: content,
                                    timestamp: Date.now(),
                                    source: file.name + " (Local File)"
                                });
                                chrome.storage.local.set({ 'cc_basket': basket }, () => {
                                    showToast(LANG_DATA[window.ccManager.lang].toast_basket_add || 'Added to basket');
                                    updateBasketUI();
                                });
                            });
                        };
                        reader.readAsText(file);
                    }
                });
                return;
            }

            const text = e.dataTransfer.getData('text');
            if (text && text.trim().length > 0) {
                getBasket((basket) => {
                    basket.push({
                        text: text.trim(),
                        timestamp: Date.now(),
                        source: window.location.hostname + " (Drag & Drop)"
                    });
                    chrome.storage.local.set({ 'cc_basket': basket }, () => {
                        showToast(LANG_DATA[window.ccManager.lang].toast_basket_add || "已拖曳加入籃子 🧺");
                        updateBasketUI();
                    });
                });
            }
        });

        if (!window.ccManager.config) {
            if (msg) msg.style.display = 'none';
            if (btnSelectAll) btnSelectAll.style.display = 'none';
            if (btnUnselectAll) btnUnselectAll.style.display = 'none';
            if (transferContainer) transferContainer.style.display = 'none';
            if (transferLabel) transferLabel.style.display = 'none';
            if (btnScan) btnScan.style.display = 'none';
            const curLang = window.ccManager.lang;
            title.textContent = curLang === 'zh' ? 'Context-Carry' : 'Context-Carry';
        }

        document.body.appendChild(panel);
        makeDraggable(panel, header);
    }

    function createRobotPanel() {
        if (document.getElementById('cc-robot-panel')) return;
        const t = LANG_DATA[window.ccManager.lang];
        if (!document.getElementById('cc-tooltip')) {
            tooltip = document.createElement('div');
            tooltip.id = 'cc-tooltip';
            Object.assign(tooltip.style, {
                position: 'fixed', display: 'none', zIndex: '2147483648',
                background: 'rgba(20, 20, 20, 0.95)', color: '#fff',
                padding: '8px 12px', borderRadius: '6px', fontSize: '12px',
                maxWidth: '300px', maxHeight: '200px', overflowY: 'auto',
                border: '1px solid #555', boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                pointerEvents: 'none', whiteSpace: 'pre-wrap', fontFamily: 'monospace'
            });
            document.body.appendChild(tooltip);
        }

        const container = document.createElement('div');
        container.id = 'cc-robot-panel';
        container.className = 'mech-container';

        container.style.marginTop = '40px';

        const antenna = document.createElement('div');
        antenna.className = 'antenna-group';
        antenna.title = t.ai_setting_tab;
        antenna.innerHTML = `<div class="antenna-tip"></div><div class="antenna-rod"></div><div class="antenna-base"></div>`;
        antenna.onclick = () => {
            openRobotSettings();
        };

        const leftShoulder = document.createElement('div');
        leftShoulder.className = 'shoulder-pad shoulder-left';
        leftShoulder.innerHTML = `<div class="linkage"></div>`;

        const btnSelectAll = document.createElement('button');
        btnSelectAll.id = 'mech-btn-select-all';
        btnSelectAll.className = 'mech-btn'; btnSelectAll.innerText = '⚃'; btnSelectAll.title = t.btn_select_all;
        btnSelectAll.onclick = handleSelectAll;

        const btnUnselect = document.createElement('button');
        btnUnselect.id = 'mech-btn-unselect';
        btnUnselect.className = 'mech-btn'; btnUnselect.innerText = '⊖'; btnUnselect.title = t.btn_unselect_all;
        btnUnselect.onclick = handleUnselectAll;

        const btnPaint = document.createElement('button');
        btnPaint.id = 'mech-btn-paint';
        btnPaint.className = 'mech-btn'; btnPaint.innerText = '🖌️'; btnPaint.title = t.btn_paint + t.hint_shortcut_paint;
        btnPaint.onclick = () => { toggleSelectionMode(); container.style.opacity = '0.2'; };

        leftShoulder.append(btnSelectAll, btnUnselect, btnPaint);

        const rightShoulder = document.createElement('div');
        rightShoulder.className = 'shoulder-pad shoulder-right';
        rightShoulder.innerHTML = `<div class="linkage"></div>`;

        const btnCopy = document.createElement('button');
        btnCopy.id = 'mech-btn-copy';
        btnCopy.className = 'mech-btn'; btnCopy.innerText = '📋'; btnCopy.title = t.btn_copy;
        btnCopy.onclick = handleCopyOnly;

        const btnDownload = document.createElement('button');
        btnDownload.id = 'mech-btn-download';
        btnDownload.className = 'mech-btn'; btnDownload.innerText = '💾'; btnDownload.title = t.btn_dl;
        btnDownload.onclick = handleDownload;

        const btnScan = document.createElement('button');
        btnScan.id = 'mech-btn-scan';
        btnScan.className = 'mech-btn'; btnScan.innerText = '↻'; btnScan.title = t.btn_scan;
        btnScan.onclick = () => { performScan(); btnScan.style.color = '#00d2ff'; setTimeout(() => btnScan.style.color = '', 500); };

        rightShoulder.append(btnCopy, btnDownload, btnScan);

        const head = document.createElement('div');
        head.className = 'mech-head';

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'mech-head-controls';

        const powerGroup = document.createElement('div');
        powerGroup.className = 'power-group';

        const uiSwitch = document.createElement('div');
        uiSwitch.id = 'mech-btn-ui-switch';
        uiSwitch.className = 'power-btn active';
        uiSwitch.title = t.btn_switch_ui;
        uiSwitch.onclick = () => toggleUIMode('standard');

        const themeSwitch = document.createElement('div');
        themeSwitch.id = 'mech-btn-theme';
        themeSwitch.className = 'power-btn';
        if (document.body.getAttribute('data-theme') === 'light') themeSwitch.classList.add('active');
        themeSwitch.title = t.btn_theme_title;
        themeSwitch.style.borderColor = '#ff9800';
        themeSwitch.onclick = function () {
            this.classList.toggle('active');
            const body = document.body;
            if (body.getAttribute('data-theme') === 'light') {
                body.removeAttribute('data-theme');
            } else {
                body.setAttribute('data-theme', 'light');
            }
        };

        const langSwitch = document.createElement('div');
        langSwitch.className = 'power-btn';
        langSwitch.id = 'mech-btn-lang';
        if (window.ccManager.lang === 'en') langSwitch.classList.add('active');
        langSwitch.title = t.btn_lang_title + t.hint_shortcut_lang;
        langSwitch.style.borderColor = '#4CAF50';
        langSwitch.onclick = function () {
            const oldLang = window.ccManager.lang;
            const newLang = oldLang === 'zh' ? 'en' : 'zh';
            const currentInput = prefixInput?.value?.trim() || '';
            const oldDefault = LANG_DATA[oldLang].default_prompt.trim();
            if (currentInput === oldDefault) {
                prefixInput.value = LANG_DATA[newLang].default_prompt;
            }

            window.ccManager.lang = newLang;
            this.classList.toggle('active');
            updateUITexts();
            const statusText = document.getElementById('mech-status-text');
            if (statusText) statusText.innerText = LANG_DATA[newLang].status_ready;
        };

        powerGroup.append(uiSwitch, themeSwitch, langSwitch);

        const closeBtn = document.createElement('div');
        closeBtn.className = 'mech-close-btn';
        closeBtn.id = 'mech-btn-close';
        closeBtn.innerText = '✕';
        closeBtn.title = t.btn_close_title + t.hint_shortcut_toggle;
        closeBtn.onclick = closeInterface;

        controlsDiv.append(powerGroup, closeBtn);

        const visor = document.createElement('div');
        visor.className = 'visor';
        makeDraggable(container, visor);

        const statusDiv = document.createElement('div');
        statusDiv.className = 'visor-status';
        statusDiv.innerHTML = `<span class="status-dot"></span><span id="mech-status-text">${t.status_ready}</span>`;
        msg = statusDiv.querySelector('#mech-status-text');

        const commsBtn = document.createElement('button');
        commsBtn.id = 'mech-comms-btn';
        commsBtn.className = 'comms-btn';
        commsBtn.innerHTML = `<span class="icon">📶</span> COMMS`;
        commsBtn.title = t.ai_response_tab;
        commsBtn.onclick = () => {
            if (window.ccManager.streamingModal && window.ccManager.streamingModal.element) {
                window.ccManager.streamingModal.restore();
            } else {
                const modal = showStreamingResponseModal("", window.ccManager.lastAiConfig);
                if (window.ccManager.lastAiText) {
                    modal.append(window.ccManager.lastAiText);
                    modal.done();
                }
            }
        };

        visor.append(statusDiv, commsBtn);

        const inputDeck = document.createElement('div');
        inputDeck.className = 'input-deck';
        const robotInput = document.createElement('textarea');
        robotInput.className = 'main-input';
        robotInput.id = 'cc-prefix-input';
        robotInput.placeholder = t.placeholder;
        robotInput.value = document.getElementById('cc-prefix-input') ? document.getElementById('cc-prefix-input').value : t.default_prompt;
        robotInput.addEventListener('input', calculateTotalTokens);
        prefixInput = robotInput;

        const aiTrigger = document.createElement('button');
        aiTrigger.id = 'mech-ai-trigger';
        aiTrigger.className = 'ai-trigger-btn';
        aiTrigger.innerText = '✨';
        aiTrigger.title = t.btn_summary;
        aiTrigger.onclick = handleAiSummary;

        inputDeck.append(robotInput, aiTrigger);

        const hatch = document.createElement('div');
        hatch.className = 'hatch-trigger';
        hatch.id = 'mech-hatch-trigger';
        hatch.innerText = "▼ DEPLOY CARGO BASKET ▼";
        hatch.onclick = () => {
            container.classList.toggle('deployed');
            updateRobotBasketText();
        };

        basketStatus = document.createElement('span');
        basketStatus.style.display = 'none';
        container.appendChild(basketStatus);

        const winch = document.createElement('div');
        winch.className = 'winch-bay';

        head.append(controlsDiv, visor, inputDeck, hatch, winch);

        const suspension = document.createElement('div');
        suspension.className = 'suspension-system';
        suspension.innerHTML = `<div class="cable-line"><div class="connector-joint"></div></div>`;

        const basketContainer = document.createElement('div');
        basketContainer.className = 'mech-basket';
        const dropOverlay = document.createElement('div');
        dropOverlay.className = 'cc-drop-overlay';
        dropOverlay.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 4px;">📥</div>
            <div style="font-size: 10px; font-weight: bold; letter-spacing:1px;">ACQUIRING DATA...</div>
        `;
        Object.assign(dropOverlay.style, {
            position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0, 210, 255, 0.85)',
            color: '#000',
            display: 'none',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            borderRadius: '4px', zIndex: '100', backdropFilter: 'blur(2px)',
            pointerEvents: 'none'
        });
        basketContainer.appendChild(dropOverlay);

        const cargoContent = document.createElement('div');
        cargoContent.className = 'cargo-content';

        const hook = document.createElement('div');
        hook.className = 'basket-hook';
        basketContainer.appendChild(hook);

        const tools = document.createElement('div');
        tools.className = 'basket-tools';
        const btnAdd = document.createElement('button'); btnAdd.className = 'tiny-btn'; btnAdd.innerText = t.btn_add_basket; btnAdd.onclick = handleAddToBasket; btnAdd.id = 'mech-basket-add';
        const btnPaste = document.createElement('button'); btnPaste.className = 'tiny-btn'; btnPaste.innerText = t.btn_paste_basket; btnPaste.onclick = handlePasteBasket; btnPaste.id = 'mech-basket-paste';
        const btnNewDoc = document.createElement('button'); btnNewDoc.className = 'tiny-btn'; btnNewDoc.id = 'mech-basket-new'; btnNewDoc.innerText = t.btn_new_doc; btnNewDoc.onclick = handleNewDoc;
        const btnClear = document.createElement('button'); btnClear.className = 'tiny-btn'; btnClear.innerText = t.btn_clear_basket; btnClear.style.color = '#ff5555'; btnClear.onclick = handleClearBasket; btnClear.id = 'mech-basket-clear';
        tools.append(btnAdd, btnPaste, btnNewDoc, btnClear);

        const list = document.createElement('div');
        list.id = 'mech-basket-list';
        basketPreviewList = list;

        const tokenDisplay = document.createElement('div');
        tokenDisplay.id = 'cc-token-display';
        Object.assign(tokenDisplay.style, {
            fontSize: '10px', color: 'var(--mech-text-dim)',
            textAlign: 'right', marginTop: '8px', paddingRight: '4px',
            fontFamily: 'monospace', letterSpacing: '1px'
        });
        tokenDisplay.innerText = `${t.token_est} 0`;

        const thrusters = document.createElement('div');
        thrusters.className = 'thruster-pack';
        PLATFORMS.forEach(p => {
            const btn = document.createElement('div');
            btn.className = 'thruster-btn';
            btn.innerHTML = `<i>${p.icon}</i> ${p.name}`;
            btn.onclick = () => handleCrossTransfer(p);
            thrusters.appendChild(btn);
        });

        cargoContent.append(tools, list, tokenDisplay, thrusters);
        basketContainer.appendChild(cargoContent);
        suspension.appendChild(basketContainer);

        container.append(antenna, leftShoulder, rightShoulder, head, suspension);
        document.body.appendChild(container);

        container.addEventListener('dragover', (e) => {
            if (e.dataTransfer.types.includes('application/cc-sort')) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';

            if (!container.classList.contains('deployed')) {
                container.classList.add('deployed');
                updateRobotBasketText();
            }

            dropOverlay.style.display = 'flex';
            basketContainer.style.boxShadow = '0 0 20px var(--mech-accent)';
        });

        container.addEventListener('dragleave', (e) => {
            if (container.contains(e.relatedTarget)) return;
            dropOverlay.style.display = 'none';
            basketContainer.style.boxShadow = '';
        });

        container.addEventListener('drop', (e) => {
            dropOverlay.style.display = 'none';
            basketContainer.style.boxShadow = '';

            if (e.dataTransfer.types && e.dataTransfer.types.includes('application/cc-sort')) return;
            e.preventDefault();
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                Array.from(files).forEach((file) => {
                    if (file.type && file.type.includes('text') || /\.md$/i.test(file.name) || /\.txt$/i.test(file.name) || /\.js$/i.test(file.name) || /\.py$/i.test(file.name)) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            const content = (ev.target.result || '').trim();
                            if (!content) return;
                            getBasket((basket) => {
                                basket.push({
                                    text: content,
                                    timestamp: Date.now(),
                                    source: file.name + " (File)"
                                });
                                chrome.storage.local.set({ 'cc_basket': basket }, () => {
                                    showToast("File loaded: " + file.name);
                                    updateBasketUI();
                                });
                            });
                        };
                        reader.readAsText(file);
                    }
                });
                return;
            }

            const text = e.dataTransfer.getData('text');
            if (text && text.trim().length > 0) {
                getBasket((basket) => {
                    basket.push({
                        text: text.trim(),
                        timestamp: Date.now(),
                        source: window.location.hostname + " (Drop)"
                    });
                    chrome.storage.local.set({ 'cc_basket': basket }, () => {
                        showToast(LANG_DATA[window.ccManager.lang].toast_basket_add || "Data Acquired 📥");
                        updateBasketUI();
                    });
                });
            }
        });

        setTimeout(() => container.classList.add('cc-visible'), 10);
        updateBasketUI();
        updateUITexts();
    }

    function openRobotSettings() {
        if (document.querySelector('.mech-config-overlay')) return;

        const t = LANG_DATA[window.ccManager.lang];
        const config = window.ccManager.aiConfig || {};
        const MODEL_PRESETS = {
            'openai': [
                'gpt-4o-mini', 'gpt-3.5-turbo', 'gpt-4.1-mini',
                'gpt-4o', 'o1', 'gpt-4.1'
            ],

            'claude': [
                'claude-3-haiku', 'claude-3-sonnet', 'claude-3.5-haiku',
                'claude-3.5-sonnet', 'claude-3-opus', 'claude-3.5-opus'
            ],

            'gemini': [
                'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro',
                'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-pro'
            ],

            'grok': [
                'grok-2-mini', 'grok-2', 'grok-3-mini',
                'grok-3', 'grok-4', 'grok-4-fast'
            ],

            'local': ['llama3', 'mistral', 'gemma']
        };

        const overlay = document.createElement('div');
        overlay.className = 'mech-config-overlay';
        const card = document.createElement('div');
        card.className = 'mech-config-card';

        card.innerHTML = `
            <div class="mech-config-header">
                <span>// NEURAL UPLINK CONFIG</span>
                <span style="font-size:12px; opacity:0.7">oAo</span>
            </div>
            
            <div class="mech-field">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="mech-label">UPLINK PROVIDER</span>
                    <span id="mech-endpoint-toggle" style="font-size:10px; cursor:pointer; color:var(--mech-accent); letter-spacing:1px; opacity:0.8;">[ EDIT ENDPOINT ]</span>
                </div>
                <select id="mech-provider" class="mech-select">
                    <option value="openai">OpenAI (ChatGPT)</option>
                    <option value="claude">Anthropic (Claude)</option>
                    <option value="gemini">Google (Gemini)</option>
                    <option value="grok">xAI (Grok)</option>
                    <option value="local">Local (Ollama/LM Studio)</option>
                </select>
            </div>

            <div class="mech-field" id="field-key">
                <span class="mech-label">ACCESS KEY (ENCRYPTED)</span>
                <input type="password" id="mech-key" class="mech-input" placeholder="sk-...">
            </div>

            <div class="mech-field" id="field-endpoint" style="display:none;">
                <span class="mech-label">TARGET ENDPOINT (URL)</span>
                <input type="text" id="mech-endpoint" class="mech-input" placeholder="e.g. https://generativelanguage.googleapis.com...">
                <div style="font-size:9px; color:#666; margin-top:4px;">* Leave empty to use auto-generated default URL</div>
            </div>

            <div class="mech-field">
                <span class="mech-label">TARGET MODEL</span>
                <div style="display:flex; gap:6px;">
                    <select id="mech-model-select" class="mech-select" style="width:30px; padding:0 4px; flex:0 0 auto; text-align:center;">
                        <option value="">▼</option>
                    </select>
                    <input type="text" id="mech-model" class="mech-input" placeholder="e.g. gpt-4o" style="flex:1;">
                </div>
            </div>

            <div class="mech-deco-line"></div>

            <div class="mech-btn-group">
                <button id="mech-cancel" class="mech-cancel-btn">ABORT</button>
                <button id="mech-save" class="mech-action-btn">ESTABLISH LINK</button>
            </div>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        const providerSel = card.querySelector('#mech-provider');
        const fieldKey = card.querySelector('#field-key');
        const keyInput = card.querySelector('#mech-key');
        const fieldEndpoint = card.querySelector('#field-endpoint');
        const endpointInput = card.querySelector('#mech-endpoint');
        const modelInput = card.querySelector('#mech-model');
        const modelSelect = card.querySelector('#mech-model-select');
        const btnSave = card.querySelector('#mech-save');
        const btnCancel = card.querySelector('#mech-cancel');
        const epToggle = card.querySelector('#mech-endpoint-toggle');

        providerSel.value = config.provider || 'openai';
        keyInput.value = config.apiKey || '';
        endpointInput.value = config.endpoint || '';
        modelInput.value = config.model || '';

        const updateModelList = async (provider) => {
            modelSelect.innerHTML = '<option value="">Loading...</option>';
            let models = MODEL_PRESETS[provider] || [];
            if (provider === 'local') {
                try {
                    const response = await new Promise(resolve => {
                        chrome.runtime.sendMessage({ action: "GET_OLLAMA_MODELS" }, resolve);
                    });

                    if (response && response.success && response.models.length > 0) {
                        models = response.models;
                    } else {
                        const opt = document.createElement('option');
                        opt.value = "";
                        opt.textContent = "⚠️ Connection failed (check Ollama)";
                        opt.disabled = true;
                        modelSelect.appendChild(opt);
                    }
                } catch (e) {
                    console.warn("Local model fetch failed", e);
                }
            }

            modelSelect.innerHTML = '<option value="">▼</option>';
            models.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                modelSelect.appendChild(opt);
            });
        };

        epToggle.onclick = () => {
            const isHidden = fieldEndpoint.style.display === 'none';
            fieldEndpoint.style.display = isHidden ? 'block' : 'none';
            epToggle.innerText = isHidden ? '[ HIDE ENDPOINT ]' : '[ EDIT ENDPOINT ]';
            epToggle.style.color = isHidden ? '#fff' : 'var(--mech-accent)';
        };

        const updateUIState = (isInit = false) => {
            const val = providerSel.value;

            if (!isInit) {
                let defEp = '';
                let defModel = MODEL_PRESETS[val] ? MODEL_PRESETS[val][0] : '';

                if (val === 'openai') {
                    defEp = 'https://api.openai.com/v1/chat/completions';
                }
                else if (val === 'gemini') {
                    defEp = `https://generativelanguage.googleapis.com/v1beta/models/${defModel}:streamGenerateContent`;
                }
                else if (val === 'claude') {
                    defEp = 'https://api.anthropic.com/v1/messages';
                }
                else if (val === 'grok') {
                    defEp = 'https://api.x.ai/v1/chat/completions';
                }
                else if (val === 'local') {
                    defEp = 'http://localhost:11434/api/chat';
                }

                endpointInput.value = defEp;
                modelInput.value = defModel;
            }

            if (val === 'local') {
                fieldKey.style.display = 'none';
                fieldEndpoint.style.display = 'block';
                epToggle.style.display = 'none';
            } else {
                fieldKey.style.display = 'block';
                epToggle.style.display = 'block';

                if (isInit && config.endpoint && config.endpoint.trim() !== '') {
                    fieldEndpoint.style.display = 'block';
                    epToggle.innerText = '[ HIDE ENDPOINT ]';
                }
            }
            updateModelList(val);
        };

        providerSel.addEventListener('change', async () => {
            updateUIState(false);
            await updateModelList(providerSel.value);
            if (providerSel.value === 'local' && modelSelect.options.length > 1) {
                modelInput.value = modelSelect.options[1].value;
                modelInput.style.borderColor = 'var(--mech-accent)';
                setTimeout(() => modelInput.style.borderColor = '', 300);
            }
        });
        modelSelect.addEventListener('change', () => {
            if (modelSelect.value) {
                modelInput.value = modelSelect.value;
                if (providerSel.value === 'gemini') {
                    endpointInput.value = `https://generativelanguage.googleapis.com/v1beta/models/${modelSelect.value}:streamGenerateContent`;
                }
                modelInput.style.borderColor = 'var(--mech-accent)';
                setTimeout(() => modelInput.style.borderColor = '', 300);
            }
        });

        modelInput.addEventListener('input', () => {
            if (providerSel.value === 'gemini') {
                const typedModel = modelInput.value.trim();
                if (typedModel) {
                    endpointInput.value = `https://generativelanguage.googleapis.com/v1beta/models/${typedModel}:streamGenerateContent`;
                }
            }
        });

        updateUIState(true);
        updateModelList(config.provider || 'openai');

        btnSave.onclick = () => {
            const provider = providerSel.value;
            const finalEndpoint = endpointInput.value.trim();
            const finalKey = (provider === 'local') ? '' : keyInput.value.trim();
            const finalModel = modelInput.value.trim();

            const newConfig = {
                configured: true,
                provider: provider,
                endpoint: finalEndpoint,
                apiKey: finalKey,
                model: finalModel
            };

            btnSave.innerText = "LINKING...";
            btnSave.style.opacity = "0.7";

            chrome.storage.local.set({ 'cc_ai_config': newConfig }, () => {
                window.ccManager.aiConfig = newConfig;

                if (window.ccManager.streamingModal && window.ccManager.streamingModal.element) {
                    const headerTitle = window.ccManager.streamingModal.element.querySelector('.cc-modal-header div');
                    if (headerTitle) {
                        const baseText = `🤖 ${t.ai_modal_title}`;
                        headerTitle.textContent = '';
                        headerTitle.append(document.createTextNode(baseText));

                        const small = document.createElement('small');
                        small.style.cssText = "font-weight:normal; opacity:0.7; margin-left:8px; font-size:11px; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px;";
                        small.textContent = `${provider} · ${finalModel}`;
                        headerTitle.append(small);
                    }
                }

                setTimeout(() => {
                    btnSave.innerText = "LINK ESTABLISHED";
                    btnSave.style.background = "#fff";
                    btnSave.style.color = "#000";

                    setTimeout(() => {
                        overlay.style.opacity = '0';
                        setTimeout(() => overlay.remove(), 300);
                    }, 600);
                }, 500);
            });
        };

        btnCancel.onclick = () => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
        };

        const protectInput = (el) => {
            el.onmousedown = (e) => e.stopPropagation();
            el.onmouseup = (e) => e.stopPropagation();
            el.onclick = (e) => e.stopPropagation();
            el.ondblclick = (e) => e.stopPropagation();
        };

        protectInput(endpointInput);
        protectInput(keyInput);
        protectInput(modelInput);
        card.onmousedown = (e) => e.stopPropagation();
        card.onclick = (e) => e.stopPropagation();
        let mouseDownTarget = null;

        overlay.onmousedown = (e) => {
            mouseDownTarget = e.target;
        };

        overlay.onclick = (e) => {
            if (e.target === overlay && mouseDownTarget === overlay) {
                btnCancel.click();
            }
            mouseDownTarget = null;
        };
    }

    function updateRobotBasketText(count) {
        const hatch = document.getElementById('mech-hatch-trigger');
        const panel = document.getElementById('cc-robot-panel');
        if (!hatch || !panel) return;
        const t = LANG_DATA[window.ccManager.lang];
        if (typeof count === 'undefined') {
        }

        const isDeployed = panel.classList.contains('deployed');
        const textExpand = t.hatch_expand || "▼ DEPLOY BASKET";
        const textRetract = t.hatch_retract || "▲ RETRACT BASKET";
        const baseText = isDeployed ? textRetract : textExpand;

        if (typeof count === 'number') {
            hatch.innerText = `${baseText} (${count}) ${isDeployed ? '▲' : '▼'}`;
        } else {
            hatch.innerText = `${baseText} ${isDeployed ? '▲' : '▼'}`;
        }
    }

    function toggleUIMode(mode) {
        const oldPanel = document.getElementById('cc-panel') || document.getElementById('cc-robot-panel');
        let lastRect = null;

        let currentPrompt = "";
        if (prefixInput) currentPrompt = prefixInput.value;

        if (oldPanel) {
            lastRect = oldPanel.getBoundingClientRect();
            oldPanel.remove();
        }
        document.getElementById('cc-tooltip')?.remove();

        if (mode) {
            window.ccManager.uiMode = mode;
        } else {
            window.ccManager.uiMode = (window.ccManager.uiMode === 'robot') ? 'standard' : 'robot';
        }

        if (window.ccManager.uiMode === 'robot') {
            createRobotPanel();
        } else {
            createPanel();
        }

        const newPanel = document.getElementById('cc-panel') || document.getElementById('cc-robot-panel');
        if (newPanel) {
            if (prefixInput && currentPrompt) prefixInput.value = currentPrompt;
            if (lastRect) {
                newPanel.style.position = 'fixed';
                newPanel.style.left = lastRect.left + 'px';
                newPanel.style.top = lastRect.top + 'px';
                newPanel.style.right = 'auto';
                newPanel.style.bottom = 'auto';
                newPanel.style.transform = 'none';
            }

            setTimeout(() => {
                newPanel.classList.add('cc-visible');
            }, 10);
        }
    }

    function makeDraggable(element, handle) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        handle.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
            isDragging = true;
            const rect = element.getBoundingClientRect();
            element.style.right = 'auto';
            element.style.bottom = 'auto';
            element.style.left = `${rect.left}px`;
            element.style.top = `${rect.top}px`;
            element.style.transform = 'none';
            element.style.transition = 'none';
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = rect.left;
            initialTop = rect.top;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            element.style.left = `${initialLeft + dx}px`;
            element.style.top = `${initialTop + dy}px`;
        });
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
            }
        });
    }

    window.renderResponsePanel = function (container) {
        if (!container) return;
        const t = LANG_DATA[window.ccManager.lang];

        container.innerHTML = `
            <div style="height:100%; display:flex; flex-direction:column; padding:10px 4px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-weight:bold; font-size:13px; border-bottom:1px solid var(--cc-border); padding-bottom:6px;">
                    <span>🤖 AI Response</span>
                    <span id="btn-close-drawer" style="cursor:pointer; opacity:0.6; font-size:14px;">✕</span>
                </div>

                <div id="cc-streaming-area" style="flex:1; overflow-y:auto; font-size:12px; line-height:1.6; white-space:pre-wrap; background:rgba(0,0,0,0.1); padding:8px; border-radius:6px; margin-bottom:8px;"></div>

                <div id="cc-response-actions" style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button id="btn-copy-res" style="flex:1; padding:6px; background:var(--cc-btn-bg); border:1px solid var(--cc-border); border-radius:4px; cursor:pointer;">Copy</button>
                    <button id="btn-clear-res" style="flex:1; padding:6px; background:var(--cc-btn-bg); border:1px solid var(--cc-border); border-radius:4px; cursor:pointer;">Clear</button>
                </div>
            </div>
        `;
        const streamArea = container.querySelector('#cc-streaming-area');
        streamArea.textContent = window.ccManager.lastAiText || "Waiting for request...";

        container.querySelector('#btn-close-drawer').onclick = () => {
            document.getElementById('cc-ai-drawer-panel').classList.remove('open');
            document.querySelectorAll('.cc-ai-tab, .cc-res-tab').forEach(el => el.classList.remove('active'));
        };

        container.querySelector('#btn-copy-res').onclick = () => {
            const text = streamArea.innerText;
            navigator.clipboard.writeText(text);
            showToast("Copied!");
        };

        container.querySelector('#btn-clear-res').onclick = () => {
            streamArea.innerText = "";
            window.ccManager.lastAiText = "";
        };
    };

    /* =========================================
       5. Logic & Utilities
    ========================================= */
    function flashInput(el) {
        el.style.transition = 'background 0.2s';
        el.style.background = '#aaa';
        setTimeout(() => {
            el.style.background = '';
        }, 200);
    }

    function updateUITexts() {
        const curLang = window.ccManager.lang;
        const t = LANG_DATA[curLang];

        if (title) title.innerText = t.title;
        if (msg && window.ccManager.uiMode !== 'robot') {
            if (!msg.innerText.includes('Selected') && !msg.innerText.includes('選取')) {
                msg.innerText = t.status_ready;
            }
            const selectedCount = document.querySelectorAll('.cc-btn[data-selected="true"]').length;
            if (selectedCount > 0) msg.innerText = t.msg_selected.replace('{n}', selectedCount);
        }

        const aiTabEl = document.querySelector('.cc-ai-tab');
        if (aiTabEl) {
            aiTabEl.title = t.ai_setting_tab;
            const span = aiTabEl.querySelector('span');
            if (span) span.innerText = t.ai_setting_tab;
        }

        const resTabEl = document.querySelector('.cc-res-tab');
        if (resTabEl) {
            const span = resTabEl.querySelector('span');
            if (span) span.innerText = t.ai_response_tab;
        }

        const stdPanel = document.getElementById('cc-panel');
        if (stdPanel) {
            if (prefixLabel) prefixLabel.innerText = t.label_prefix;
            if (prefixInput) prefixInput.placeholder = t.placeholder;
            if (btnSelectAll) btnSelectAll.innerText = t.btn_select_all;
            if (btnUnselectAll) btnUnselectAll.innerText = t.btn_unselect_all;
            if (btnDl) btnDl.innerText = t.btn_dl;
            if (btnCopy) btnCopy.innerText = t.btn_copy;

            if (btnScan) {
                btnScan.textContent = t.btn_scan;
            }
            if (basketLabel) basketLabel.innerText = t.label_basket;
            if (btnAddBasket) btnAddBasket.innerText = t.btn_add_basket;
            if (btnPasteBasket) btnPasteBasket.innerText = t.btn_paste_basket;
            if (btnClearBasket) {
                btnClearBasket.innerText = t.btn_clear_basket;
                btnClearBasket.title = t.btn_clear_basket;
            }
            if (btnSummary) btnSummary.innerText = t.btn_summary;
            if (btnNewDoc) btnNewDoc.innerText = t.btn_new_doc;
            if (transferLabel) transferLabel.innerText = t.label_transfer;
            if (btnPaint) {
                btnPaint.innerText = t.btn_paint;
                btnPaint.title = t.paint_tooltip + t.hint_shortcut_paint;
            }

            const langBtn = document.getElementById('cc-btn-lang');
            if (langBtn) langBtn.title = t.btn_lang_title + t.hint_shortcut_lang;
            const themeBtn = document.getElementById('cc-btn-theme');
            if (themeBtn) themeBtn.title = t.btn_theme_title;
            const closeBtn = document.getElementById('cc-btn-close');
            if (closeBtn) closeBtn.title = t.btn_close_title + t.hint_shortcut_toggle;
            const robotBtn = stdPanel.querySelector('.cc-controls button:first-child');
            if (robotBtn && robotBtn.innerText === '🤖') {
                robotBtn.title = t.btn_switch_ui || "Switch UI";
            }

            const drawerToggle = document.querySelector('.cc-drawer-toggle');
            if (drawerToggle) {
                const isExpanded = stdPanel.classList.contains('expanded');
                drawerToggle.innerHTML = `<span class="arrow" style="${isExpanded ? 'transform: rotate(180deg); display: inline-block;' : ''}">▼</span>${t.drawer_toggle}`;
            }
        }

        const robotPanel = document.getElementById('cc-robot-panel');
        if (robotPanel) {
            const btnSel = document.getElementById('mech-btn-select-all');
            if (btnSel) btnSel.title = t.btn_select_all;

            const btnUnsel = document.getElementById('mech-btn-unselect');
            if (btnUnsel) btnUnsel.title = t.btn_unselect_all;

            const btnPnt = document.getElementById('mech-btn-paint');
            if (btnPnt) btnPnt.title = t.btn_paint + t.hint_shortcut_paint;

            const btnCpy = document.getElementById('mech-btn-copy');
            if (btnCpy) btnCpy.title = t.btn_copy;

            const btnDload = document.getElementById('mech-btn-download');
            if (btnDload) btnDload.title = t.btn_dl;

            const btnScn = document.getElementById('mech-btn-scan');
            if (btnScn) btnScn.title = t.btn_scan;

            const uiSw = document.getElementById('mech-btn-ui-switch');
            if (uiSw) uiSw.title = t.btn_switch_ui;

            const themeSw = document.getElementById('mech-btn-theme');
            if (themeSw) themeSw.title = t.btn_theme_title;

            const langSw = document.getElementById('mech-btn-lang');
            if (langSw) langSw.title = t.btn_lang_title + t.hint_shortcut_lang;

            const closeBtn = document.getElementById('mech-btn-close');
            if (closeBtn) closeBtn.title = t.btn_close_title + t.hint_shortcut_toggle;

            const rInput = document.getElementById('cc-prefix-input');
            if (rInput) rInput.placeholder = t.placeholder;

            const stText = document.getElementById('mech-status-text');
            if (stText) stText.innerText = t.status_ready;

            const comms = document.getElementById('mech-comms-btn');
            if (comms) comms.title = t.ai_response_tab;

            const antenna = document.querySelector('.antenna-group');
            if (antenna) antenna.title = t.ai_setting_tab;

            const aiTrig = document.getElementById('mech-ai-trigger');
            if (aiTrig) aiTrig.title = t.btn_summary;

            const bAdd = document.getElementById('mech-basket-add');
            if (bAdd) bAdd.innerText = t.btn_add_basket;

            const bPaste = document.getElementById('mech-basket-paste');
            if (bPaste) bPaste.innerText = t.btn_paste_basket;

            const bClear = document.getElementById('mech-basket-clear');
            if (bClear) bClear.innerText = t.btn_clear_basket;

            const bNew = document.getElementById('mech-basket-new');
            if (bNew) bNew.innerText = t.btn_new_doc || "New Doc";
            updateRobotBasketText();
        }

        document.querySelectorAll('.cc-btn').forEach(b => {
            if (b.innerText === '➕') b.title = t.btn_add_title;
        });

        const aiContent = document.querySelector('.cc-ai-content');
        if (aiContent && document.getElementById('cc-ai-drawer-panel') && document.getElementById('cc-ai-drawer-panel').classList.contains('open')) {
            if (document.querySelector('.cc-ai-tab') && document.querySelector('.cc-ai-tab').classList.contains('active')) {
                renderCompactSettings(aiContent);
            }
        }

        if (window.ccManager.streamingModal && window.ccManager.streamingModal.element) {
            const m = window.ccManager.streamingModal.element;
            const mTitle = m.querySelector('.cc-modal-header div');
            if (mTitle) mTitle.innerHTML = `🤖 ${t.ai_modal_title}`;

            const mTabs = m.querySelectorAll('.cc-modal-tab');
            if (mTabs.length >= 2) {
                mTabs[0].innerText = t.ai_tab_res;
                mTabs[1].innerText = t.ai_tab_ctx;
            }
            const btnResend = m.querySelector('#cc-btn-resend');
            if (btnResend) btnResend.innerText = t.btn_resend;
            const btnSave = m.querySelector('#cc-btn-save');
            if (btnSave) btnSave.innerHTML = t.btn_save_file;
            const btnPaste = m.querySelector('#cc-btn-paste');
            if (btnPaste) btnPaste.innerHTML = t.btn_paste;
            const btnSendAll = m.querySelector('#cc-btn-sendall');
            if (btnSendAll) btnSendAll.innerHTML = t.btn_send_all;
        }

        calculateTotalTokens();
        updateBasketUI();
    }

    function performScan() {
        if (!window.ccManager.active) return;
        if (!window.ccManager.config || !window.ccManager.config.msgSelector) return;

        const els = document.querySelectorAll(window.ccManager.config.msgSelector);
        let count = 0;
        const curLang = window.ccManager.lang;
        const t = LANG_DATA[curLang];

        els.forEach(el => {
            if (el.querySelector('.cc-btn') || el.dataset.ccListening === 'true' || el.innerText.trim().length < 1) return;

            if (window.ccManager.config.ignore && el.closest(window.ccManager.config.ignore)) {
                return;
            }

            const style = window.getComputedStyle(el);
            if (style.position === 'static') {
                el.style.position = 'relative';
            }

            if (style.borderRadius === '0px') {
            }
            el.setAttribute('draggable', 'true');
            const onDragStart = (e) => {
                const cleanText = convertToMarkdown(el);
                e.dataTransfer.setData('text/plain', cleanText);
                e.dataTransfer.effectAllowed = 'copy';
                el.style.opacity = '0.5';
            };

            const onDragEnd = (e) => {
                el.style.opacity = '1';
            };

            el.addEventListener('dragstart', onDragStart);
            el.addEventListener('dragend', onDragEnd);

            const btn = document.createElement('button');
            btn.className = 'cc-btn';
            btn.innerText = '➕';
            btn.title = t.btn_add_title;

            Object.assign(btn.style, {
                position: 'absolute',
                top: '6px', right: '6px', left: 'auto',
                zIndex: '9999',
                background: 'rgba(255, 255, 255, 0.9)',
                color: '#2196F3',
                border: '2px solid #2196F3',
                fontWeight: '900',
                padding: '0', fontSize: '16px', cursor: 'pointer',
                borderRadius: '50%',
                boxShadow: '0 2px 8px rgba(33, 150, 243, 0.4)',
                width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: '1', transform: 'scale(1)',
                transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)'
            });

            const onMouseEnter = () => {
                if (!window.ccManager.active) return;
                if (btn.dataset.selected !== 'true') {
                    el.dataset.ccHover = 'true';
                    btn.style.transform = 'scale(1.1)';
                }
            };

            const onMouseLeave = () => {
                if (btn.dataset.selected !== 'true') {
                    delete el.dataset.ccHover;
                    btn.style.transform = 'scale(1)';
                }
            };

            const onClick = (e) => {
                if (!window.ccManager.active) return;
                const selection = window.getSelection();
                if (selection && selection.toString().length > 0) return;
                if (e.target.closest('a, button, input, textarea, [role="button"], .cc-btn')) return;
                btn.click();
            };

            el.addEventListener('mouseenter', onMouseEnter);
            el.addEventListener('mouseleave', onMouseLeave);
            el.addEventListener('click', onClick);

            el._ccHandlers = { onMouseEnter, onMouseLeave, onClick, onDragStart, onDragEnd };
            el.dataset.ccListening = 'true';

            btn.onmouseenter = () => {
                if (btn.dataset.selected !== 'true') {
                    btn.style.background = '#2196F3';
                    btn.style.color = '#fff';
                    btn.style.transform = 'scale(1.1)';
                    btn.style.boxShadow = '0 4px 12px rgba(33, 150, 243, 0.6)';
                }
            };
            btn.onmouseleave = () => {
                if (btn.dataset.selected !== 'true') {
                    btn.style.background = 'rgba(255, 255, 255, 0.9)';
                    btn.style.color = '#2196F3';
                    btn.style.transform = 'scale(1)';
                    btn.style.boxShadow = '0 2px 8px rgba(33, 150, 243, 0.4)';
                }
            };

            btn.onclick = function (e) {
                e.stopPropagation();
                const allBtns = Array.from(document.querySelectorAll('.cc-btn'));
                const currentIndex = allBtns.indexOf(this);
                const lastIndex = window.ccManager.lastCheckedIndex;

                if (e.shiftKey && lastIndex !== null && lastIndex !== -1) {
                    const start = Math.min(currentIndex, lastIndex);
                    const end = Math.max(currentIndex, lastIndex);
                    const shouldSelect = (this.dataset.selected !== 'true');
                    for (let i = start; i <= end; i++) {
                        if (shouldSelect) selectBtn(allBtns[i]);
                        else unselectBtn(allBtns[i]);
                    }
                } else {
                    if (this.dataset.selected !== 'true') selectBtn(this);
                    else unselectBtn(this);
                }
                window.ccManager.lastCheckedIndex = currentIndex;
                updateStatus();
                calculateTotalTokens();
            };

            el.appendChild(btn);
            count++;
        });

        const total = document.querySelectorAll('.cc-btn').length;
        if ((count > 0 || total > 0) && msg) {
            msg.innerText = t.msg_detected.replace('{n}', total);
        }
    }

    function selectBtn(btn) {
        if (!btn || btn.dataset.selected === 'true') return;
        const el = btn.parentElement;

        btn.innerText = '✓';
        btn.style.background = '#4CAF50';
        btn.style.color = '#fff';
        btn.style.borderColor = '#4CAF50';
        btn.style.boxShadow = '0 2px 8px rgba(76, 175, 80, 0.5)';
        btn.style.transform = 'scale(1.1)';

        btn.dataset.selected = 'true';
        el.dataset.ccSelected = 'true';
        delete el.dataset.ccHover;

        el.style.boxShadow = '';
        el.style.outline = '';
        el.style.backgroundColor = '';
    }

    function unselectBtn(btn) {
        if (!btn || btn.dataset.selected !== 'true') return;
        const el = btn.parentElement;

        btn.innerText = '➕';
        btn.style.background = 'rgba(255, 255, 255, 0.9)';
        btn.style.color = '#2196F3';
        btn.style.borderColor = '#2196F3';
        btn.style.boxShadow = '0 2px 8px rgba(33, 150, 243, 0.4)';
        btn.style.transform = 'scale(1)';

        delete btn.dataset.selected;

        delete el.dataset.ccSelected;
        el.style.boxShadow = '';
        el.style.outline = '';
        el.style.backgroundColor = '';
    }

    function updateStatus() {
        if (!msg) return;
        const curLang = window.ccManager.lang;
        const n = document.querySelectorAll('.cc-btn[data-selected="true"]').length;
        msg.innerText = LANG_DATA[curLang].msg_selected.replace('{n}', n);
    }

    function getSelectedText(includePrefix = true) {
        const selected = document.querySelectorAll('.cc-btn[data-selected="true"]');
        if (selected.length === 0) return null;

        let combined = "";
        if (includePrefix) {
            const userPrefix = document.getElementById('cc-prefix-input').value;
            if (userPrefix) combined += userPrefix + "\n\n====================\n\n";
        }

        selected.forEach(btn => {
            const textContent = convertToMarkdown(btn.parentElement);
            combined += `--- Fragment ---\n${textContent}\n\n`;
        });

        if (includePrefix) {
            combined += "====================\n[END OF CONTEXT]";
        }
        return combined;
    }

    function constructFinalContent(pageSelection, basketItems) {
        const prefix = document.getElementById('cc-prefix-input')?.value || "";
        let finalContent = "";

        if (prefix) {
            finalContent += prefix + "\n\n====================\n\n";
        }

        if (pageSelection) {
            finalContent += pageSelection + "\n\n";
        }

        if (basketItems && basketItems.length > 0) {
            if (pageSelection) finalContent += "\n========== [ BASKET CONTENT ] ==========\n\n";

            const basketText = basketItems.map((item, idx) =>
                `[Basket Item ${idx + 1} from ${item.source}]\n${item.text}`
            ).join("\n\n--------------------\n\n");

            finalContent += basketText;
        }

        finalContent += "\n\n====================\n[END OF CONTEXT]";
        return finalContent;
    }

    function resolveContentToExport(callback) {
        const t = LANG_DATA[window.ccManager.lang];

        getBasket((basket) => {
            const pageText = getSelectedText(false);
            const hasBasket = (basket && basket.length > 0);
            const hasPage = (pageText && pageText.length > 0);

            if (!hasPage && !hasBasket) {
                alert(t.alert_no_selection);
                return;
            }

            if (hasPage && hasBasket) {
                showExportChoiceModal(pageText, basket, (choice) => {
                    let finalContent = "";
                    if (choice === 'page') {
                        finalContent = constructFinalContent(pageText, []);
                    } else if (choice === 'basket') {
                        finalContent = constructFinalContent(null, basket);
                    } else {
                        finalContent = constructFinalContent(pageText, basket);
                    }
                    callback(finalContent);
                });
            }
            else {
                const finalContent = constructFinalContent(pageText, basket);
                callback(finalContent);
            }
        });
    }

    function showExportChoiceModal(pageText, basket, onConfirm) {
        const modalMask = document.createElement('div');
        Object.assign(modalMask.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.7)', zIndex: '2147483649', display: 'flex',
            alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)'
        });

        const card = document.createElement('div');
        Object.assign(card.style, {
            width: '320px', backgroundColor: '#1e1e1e', color: '#fff',
            borderRadius: '12px', padding: '20px', boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
            display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid #444', textAlign: 'center'
        });

        const title = document.createElement('h3');
        title.innerText = "Select Content to Export";
        title.style.margin = '0 0 10px 0';

        const createBtn = (text, val, color) => {
            const btn = document.createElement('button');
            btn.innerText = text;
            Object.assign(btn.style, {
                padding: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                fontWeight: 'bold', backgroundColor: '#333', color: '#fff', border: '1px solid #555',
                transition: 'all 0.2s'
            });
            btn.onmouseover = () => { btn.style.backgroundColor = color; btn.style.borderColor = color; };
            btn.onmouseout = () => { btn.style.backgroundColor = '#333'; btn.style.borderColor = '#555'; };
            btn.onclick = () => {
                modalMask.remove();
                onConfirm(val);
            };
            return btn;
        };

        const btnPage = createBtn(`Clipboard Only`, 'page', '#2196F3');
        const btnBasket = createBtn(`Basket Only (Number:${basket.length})`, 'basket', '#FF9800');
        const btnBoth = createBtn(`Merge Both (Append)`, 'both', '#4CAF50');

        const btnCancel = document.createElement('button');
        btnCancel.innerText = "Cancel";
        Object.assign(btnCancel.style, {
            marginTop: '8px', background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '12px'
        });
        btnCancel.onclick = () => modalMask.remove();

        card.append(title, btnBasket, btnPage, btnBoth, btnCancel);
        modalMask.appendChild(card);
        document.body.appendChild(modalMask);
    }

    function handleDownload() {
        resolveContentToExport((finalContent) => {
            const blob = new Blob([finalContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'chat-context-' + new Date().toISOString().slice(0, 10) + '.txt';
            document.body.appendChild(a);
            a.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    function handleCopyOnly() {
        const t = LANG_DATA[window.ccManager.lang];

        getBasket((basket) => {
            const pageText = getSelectedText(false);
            if (!pageText && (!basket || basket.length === 0)) {
                alert(t.alert_no_selection);
                return;
            }
            const finalContent = constructFinalContent(pageText, basket);
            navigator.clipboard.writeText(finalContent).then(() => {
                showToast(t.alert_copy_done);
            }).catch(err => alert("Copy failed"));
        });
    }

    function getBasket(cb) {
        chrome.storage.local.get(['cc_basket'], (result) => {
            const basket = result.cc_basket || [];
            cb(basket);
        });
    }

    function updateBasketUI() {
        getBasket((basket) => {
            const count = basket.length;
            const t = LANG_DATA[window.ccManager.lang];
            if (basketStatus && basketStatus.style.display !== 'none') {
                if (count === 0) {
                    basketStatus.innerText = t.basket_status_empty;
                    basketStatus.style.color = '#aaa';
                    if (basketPreviewList) basketPreviewList.style.display = 'none';
                    window.ccManager.isPreviewOpen = false;
                } else {
                    basketStatus.innerText = t.basket_status.replace('{n}', count);
                    basketStatus.style.color = '#4CAF50';
                    if (window.ccManager.isPreviewOpen) {
                        renderBasketPreview(basket);
                    }
                }
            }
            else if (window.ccManager.uiMode === 'robot') {
                updateRobotBasketText(count);
                if (basketPreviewList) {
                    basketPreviewList.style.display = 'block';
                    if (count === 0) {
                        basketPreviewList.innerHTML = `<div style="text-align:center; color:var(--mech-text-dim); padding:15px; font-size:11px; letter-spacing:1px; border:1px dashed var(--mech-border); border-radius:4px;">[ CARGO BAY EMPTY ]</div>`;
                    } else {
                        renderBasketPreview(basket);
                    }
                }
            }

            calculateTotalTokens();
        });
    }

    function toggleBasketPreview() {
        if (!basketPreviewList) return;
        const isHidden = basketPreviewList.style.display === 'none';

        getBasket((basket) => {
            if (basket.length === 0) return;

            if (isHidden) {
                basketPreviewList.style.display = 'block';
                window.ccManager.isPreviewOpen = true;
                renderBasketPreview(basket);
            } else {
                basketPreviewList.style.display = 'none';
                window.ccManager.isPreviewOpen = false;
            }
        });
    }

    let draggingIndex = null;
    function renderBasketPreview(basket) {
        basketPreviewList.innerHTML = '';
        const t = LANG_DATA[window.ccManager.lang];
        const prefixEl = document.getElementById('cc-prefix-input');
        const currentPrefix = prefixEl ? prefixEl.value : "";
        let isDraggingRow = false;
        const hint = document.createElement('div');
        hint.innerText = t.preview_drag_hint;
        Object.assign(hint.style, { fontSize: '10px', color: '#888', textAlign: 'right', marginBottom: '6px' });
        basketPreviewList.append(hint);

        basket.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'cc-basket-item';
            row.draggable = true;
            row.dataset.index = index;

            Object.assign(row.style, {
                background: '#333', padding: '8px', borderRadius: '6px', fontSize: '11px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'grab', border: '2px solid transparent',
                position: 'relative', marginBottom: '4px',
                transition: 'transform 0.1s'
            });

            row.onmouseenter = (e) => {
                if (!tooltip || draggingIndex !== null) return;
                let fullClean = item.text;
                if (currentPrefix && fullClean.startsWith(currentPrefix)) fullClean = fullClean.replace(currentPrefix, '');
                fullClean = fullClean.replace(/={5,}/g, '').replace(/--- Fragment ---/g, '').replace(/\[END OF CONTEXT\]/g, '').trim();
                if (fullClean.length > 500) fullClean = fullClean.substring(0, 500) + "\n\n(......)";
                tooltip.innerText = `[Source: ${item.source}]\n\n${fullClean}`;
                tooltip.style.display = 'block';
                updateTooltipPosition(e);
            };
            row.onmousemove = (e) => updateTooltipPosition(e);
            row.onmouseleave = () => { if (tooltip) tooltip.style.display = 'none'; };
            row.ondragstart = (e) => {
                e.stopPropagation();
                isDraggingRow = true;
                draggingIndex = index;
                e.dataTransfer.setData('text/plain', item.text);
                e.dataTransfer.setData('application/cc-index', index.toString());
                e.dataTransfer.setData('application/cc-sort', 'true');
                e.dataTransfer.effectAllowed = 'copyMove';

                row.style.opacity = '0.5';
                if (tooltip) tooltip.style.display = 'none';
            };

            row.ondragend = (e) => {
                draggingIndex = null;
                row.style.opacity = '1';
                setTimeout(() => { isDraggingRow = false; }, 200);
                document.querySelectorAll('.cc-basket-item').forEach(el => {
                    el.style.borderTopColor = 'transparent';
                    el.style.borderBottomColor = 'transparent';
                });
            };
            row.ondragover = (e) => {
                e.preventDefault();
                if (!e.dataTransfer.types.includes('application/cc-sort')) {
                    e.dataTransfer.dropEffect = 'copy';
                    return;
                }

                if (draggingIndex === index || draggingIndex === null) return;

                e.dataTransfer.dropEffect = 'move';

                const rect = row.getBoundingClientRect();
                const midY = rect.top + (rect.height / 2);
                if (e.clientY < midY) {
                    row.style.borderTopColor = '#4CAF50';
                    row.style.borderBottomColor = 'transparent';
                } else {
                    row.style.borderBottomColor = '#4CAF50';
                    row.style.borderTopColor = 'transparent';
                }
            };

            row.ondragleave = (e) => {
                row.style.borderTopColor = 'transparent';
                row.style.borderBottomColor = 'transparent';
            };

            row.ondrop = (e) => {
                if (!e.dataTransfer.types.includes('application/cc-sort')) return;

                e.preventDefault();
                e.stopPropagation();
                row.style.borderTopColor = 'transparent';
                row.style.borderBottomColor = 'transparent';
                const fromIndex = parseInt(e.dataTransfer.getData('application/cc-index'));
                if (fromIndex !== index && !isNaN(fromIndex)) {
                    handleReorderBasket(fromIndex, index);
                }
            };

            row.onclick = (e) => {
                if (isDraggingRow) return;
                if (e.target.closest('button')) return;

                showEditorModal("Edit Item", item.text, (newText) => {
                    getBasket((currentBasket) => {
                        if (currentBasket[index]) {
                            currentBasket[index].text = newText;
                            currentBasket[index].timestamp = Date.now();
                            chrome.storage.local.set({ 'cc_basket': currentBasket }, () => {
                                updateBasketUI();
                                showToast("Content updated ✨");
                            });
                        }
                    });
                });
            };
            let cleanText = item.text;
            if (currentPrefix && cleanText.startsWith(currentPrefix)) cleanText = cleanText.replace(currentPrefix, '');
            cleanText = cleanText.replace(/={5,}/g, '').replace(/--- Fragment ---/g, '').replace(/\[END OF CONTEXT\]/g, '').trim();
            let snippet = cleanText.substring(0, 50).replace(/[\r\n]+/g, ' ');
            if (cleanText.length > 50) snippet += '...';
            if (snippet.length === 0) snippet = "(System Prompt Only)";

            const info = document.createElement('div');
            info.style.overflow = 'hidden';
            info.style.pointerEvents = 'none';
            const lineSource = document.createElement('div');
            lineSource.style.cssText = "color:#aaa; font-size:9px; font-weight:700; margin-bottom:2px;";
            lineSource.textContent = `${index + 1}. [${item.source}]`;

            const lineSnippet = document.createElement('div');
            lineSnippet.style.cssText = "color:#eee; opacity:0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;";
            lineSnippet.textContent = snippet;

            info.appendChild(lineSource);
            info.appendChild(lineSnippet);

            const delBtn = document.createElement('button');
            delBtn.textContent = '×';
            delBtn.title = t.preview_del_tooltip;
            Object.assign(delBtn.style, {
                background: 'rgba(255, 82, 82, 0.1)', border: 'none', color: '#ff5252',
                fontWeight: 'bold', cursor: 'pointer', marginLeft: '8px',
                width: '24px', height: '24px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'auto', fontSize: '16px'
            });
            delBtn.onclick = (e) => {
                e.stopPropagation();
                row.classList.add('cc-deleting');
                setTimeout(() => handleDeleteSingleItem(index), 300);
            };

            row.append(info, delBtn);
            basketPreviewList.append(row);
        });
    }

    function updateTooltipPosition(e) {
        if (!tooltip) return;
        const x = e.clientX - 315;
        const y = e.clientY + 10;

        if (x < 10) {
            tooltip.style.left = (e.clientX + 15) + 'px';
        } else {
            tooltip.style.left = x + 'px';
        }

        if (y + tooltip.offsetHeight > window.innerHeight) {
            tooltip.style.top = (window.innerHeight - tooltip.offsetHeight - 10) + 'px';
        } else {
            tooltip.style.top = y + 'px';
        }
    }

    function handleReorderBasket(fromIndex, toIndex) {
        getBasket((basket) => {
            const [movedItem] = basket.splice(fromIndex, 1);
            basket.splice(toIndex, 0, movedItem);
            chrome.storage.local.set({ 'cc_basket': basket }, () => {
                updateBasketUI();
            });
        });
    }

    function handleDeleteSingleItem(index) {
        getBasket((basket) => {
            basket.splice(index, 1);
            chrome.storage.local.set({ 'cc_basket': basket }, () => {
                updateBasketUI();
            });
        });
    }

    function handleNewDoc() {
        const t = LANG_DATA[window.ccManager.lang];
        showEditorModal(t.btn_new_doc || "New Document", "", (text) => {
            if (text && text.trim().length > 0) {
                getBasket((basket) => {
                    basket.push({
                        text: text.trim(),
                        timestamp: Date.now(),
                        source: "Manual Entry (New Doc)"
                    });
                    chrome.storage.local.set({ 'cc_basket': basket }, () => {
                        showToast(t.toast_basket_add || "Added to basket");
                        updateBasketUI();
                    });
                });
            }
        });
    }

    function handleAddToBasket() {
        const text = getSelectedText(false);
        const t = LANG_DATA[window.ccManager.lang];
        if (!text) { alert(t.alert_no_selection); return; }

        getBasket((basket) => {
            basket.push({
                text: text,
                timestamp: Date.now(),
                source: window.location.hostname
            });
            chrome.storage.local.set({ 'cc_basket': basket }, () => {
                showToast(t.toast_basket_add);
                handleUnselectAll();
            });
        });
    }

    function handleClearBasket() {
        chrome.storage.local.remove('cc_basket', () => {
            const t = LANG_DATA[window.ccManager.lang];
            showToast(t.toast_basket_clear);
            updateBasketUI();
        });
    }

    function handlePasteBasket() {
        const t = LANG_DATA[window.ccManager.lang];
        if (!window.ccManager.config) {
            alert(t.alert_llm_only);
            return;
        }
        getBasket((basket) => {
            if (basket.length === 0) { alert("Basket is empty!"); return; }
            const finalContent = constructFinalContent(null, basket);
            const currentPlatform = PLATFORMS.find(p => window.location.hostname.includes(p.id));
            if (currentPlatform) {
                const est = estimateTokens(finalContent);
                if (est > currentPlatform.limit) {
                    const msg = t.token_warn_msg.replace('{est}', est).replace('{platform}', currentPlatform.name).replace('{limit}', currentPlatform.limit);
                    if (!confirm(msg)) return;
                }
            }

            const inputEl = document.querySelector(config.inputSelector);
            if (inputEl) {
                autoFillInput(inputEl, finalContent);
                showToast(t.toast_autofill);
            } else alert("Cannot find input box.");
        });
    }

    function handleCrossTransfer(platformObj) {
        resolveContentToExport((finalContent) => {
            const t = LANG_DATA[window.ccManager.lang];
            const est = estimateTokens(finalContent);
            const limit = platformObj.limit || 30000;

            if (est > limit) {
                const warnMsg = t.token_warn_msg
                    .replace('{est}', est.toLocaleString())
                    .replace('{platform}', platformObj.name)
                    .replace('{limit}', limit.toLocaleString());
                if (!confirm(warnMsg)) return;
            }

            chrome.storage.local.set({
                'cc_transfer_payload': {
                    text: finalContent,
                    timestamp: Date.now(),
                    source: window.location.hostname
                }
            }, () => window.open(platformObj.url, '_blank'));
        });
    }

    function handleSelectAll() {
        const btns = document.querySelectorAll('.cc-btn');
        let changed = false;

        btns.forEach(btn => {
            if (btn.dataset.selected !== 'true') {
                btn.click();
                changed = true;
            }
        });

        if (changed) updateStatus();
        calculateTotalTokens();
    }

    function handleUnselectAll() {
        const btns = document.querySelectorAll('.cc-btn');
        let changed = false;

        btns.forEach(btn => {
            if (btn.dataset.selected === 'true') {
                btn.click();
                changed = true;
            }
        });

        if (changed) updateStatus();
        window.ccManager.lastCheckedIndex = null;
        calculateTotalTokens();
    }

    /* =========================================
       6. Receiver Logic (Auto-Fill) & Listeners
    ========================================= */
    function checkAutoFill() {
        if (!chrome.storage) return;
        if (!window.ccManager.config) return;

        chrome.storage.local.get(['cc_transfer_payload'], (result) => {
            const data = result.cc_transfer_payload;
            if (data && (Date.now() - data.timestamp < 30000)) {
                let attempts = 0;
                const maxAttempts = 20;

                const fillInterval = setInterval(() => {
                    const inputEl = document.querySelector(config.inputSelector);
                    if (inputEl) {
                        clearInterval(fillInterval);
                        autoFillInput(inputEl, data.text);
                        chrome.storage.local.remove('cc_transfer_payload');
                        showToast(LANG_DATA[window.ccManager.lang].toast_autofill);
                    } else {
                        attempts++;
                        if (attempts >= maxAttempts) {
                            clearInterval(fillInterval);
                        }
                    }
                }, 500);
            }
        });
    }

    function autoFillInput(element, text) {
        element.focus();
        if (element.contentEditable === "true") {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(element);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
            const success = document.execCommand('insertText', false, text);

            if (!success) {
                if (element.innerText.trim() === '') {
                    element.innerHTML = `<p>${text}</p>`;
                } else {
                    element.textContent += text;
                }
            }
        } else {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
            if (nativeInputValueSetter) {
                nativeInputValueSetter.call(element, text);
            } else {
                element.value = text;
            }
        }

        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        const originalBg = element.style.backgroundColor;
        element.style.transition = "background-color 0.5s";
        element.style.backgroundColor = "rgba(76, 175, 80, 0.2)";
        setTimeout(() => {
            element.style.backgroundColor = originalBg;
        }, 1000);
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.innerText = message;
        Object.assign(toast.style, {
            position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
            background: '#333', color: '#fff', padding: '10px 20px', borderRadius: '20px',
            zIndex: '2147483647', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', fontSize: '14px',
            opacity: '0', transition: 'opacity 0.3s'
        });
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.style.opacity = '1');
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.cc_basket) {
            updateBasketUI();
            calculateTotalTokens();
        }
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "TOGGLE_INTERFACE") {
            toggleInterface();
            sendResponse({ status: "done" });
        }
        else if (request.action === "PING") {
            sendResponse({ status: "pong" });
        }
        else if (request.action === "BASKET_UPDATED") {
            updateBasketUI();
            calculateTotalTokens();
        }
        return false;
    });

    checkAutoFill();

    /* =========================================
       7. Keyboard Shortcuts
    ========================================= */
    document.addEventListener('keydown', function (e) {
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) {
            return;
        }
        if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
            const key = e.code;
            // Alt+C: activate area selection mode
            if (key === 'KeyC') {
                e.preventDefault();
                if (!window.ccManager.active) {
                    openInterface();
                }
                toggleSelectionMode();
                const p = document.getElementById('cc-panel');
                if (p) p.style.opacity = '0.2';
            }
            // Alt+L: toggle language between zh and en
            if (key === 'KeyL') {
                e.preventDefault();
                const oldLang = window.ccManager.lang;
                const newLang = oldLang === 'zh' ? 'en' : 'zh';
                const currentInput = prefixInput?.value?.trim() || '';
                const oldDefault = LANG_DATA[oldLang].default_prompt.trim();
                if (currentInput === oldDefault) {
                    prefixInput.value = LANG_DATA[newLang].default_prompt;
                    flashInput(prefixInput);
                }
                window.ccManager.lang = newLang;
                updateUITexts();
            }
            // Alt+M: toggle the panel visibility
            if (key === 'KeyM') {
                e.preventDefault();
                toggleInterface();
            }
        }
    });

    /* =========================================
       8. Paintbrush / Area Selection Logic
    ========================================= */
    let paintSvg = null;
    let paintPath = null;
    let points = [];
    let isDrawing = false;

    function toggleSelectionMode() {
        if (paintSvg) {
            closeSelectionMode();
            return;
        }

        paintSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        Object.assign(paintSvg.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            zIndex: '2147483646', cursor: 'crosshair', pointerEvents: 'auto'
        });

        paintPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        paintPath.setAttribute("stroke", "#4CAF50");
        paintPath.setAttribute("stroke-width", "3");
        paintPath.setAttribute("fill", "none");
        paintPath.setAttribute("stroke-linejoin", "round");
        paintPath.setAttribute("stroke-linecap", "round");

        paintSvg.appendChild(paintPath);
        document.body.appendChild(paintSvg);

        paintSvg.addEventListener('mousedown', startDraw);
        document.addEventListener('keydown', onEscKey);

        const t = LANG_DATA[window.ccManager.lang];
        showToast(t.toast_enter_paint || "Draw to select text (ESC to exit)");
    }

    function closeSelectionMode() {
        if (paintSvg) paintSvg.remove();
        paintSvg = null;
        paintPath = null;
        resetDrawingState();
        document.removeEventListener('keydown', onEscKey);
        const p = document.getElementById('cc-panel') || document.getElementById('cc-robot-panel');
        if (p) p.style.opacity = '1';
    }

    function resetDrawingState() {
        points = [];
        isDrawing = false;
        if (paintPath) paintPath.setAttribute('d', '');
    }

    function onEscKey(e) {
        if (e.key === 'Escape') closeSelectionMode();
    }

    function startDraw(e) {
        e.preventDefault();
        resetDrawingState();
        isDrawing = true;
        points.push({ x: e.clientX, y: e.clientY });
        updatePath();

        paintSvg.addEventListener('mousemove', draw);
        window.addEventListener('mouseup', endDraw);
    }

    function draw(e) {
        if (!isDrawing) return;
        const lastPoint = points[points.length - 1];
        if (lastPoint) {
            const dist = Math.hypot(e.clientX - lastPoint.x, e.clientY - lastPoint.y);
            if (dist < 5) return;
        }
        points.push({ x: e.clientX, y: e.clientY });
        updatePath();
    }

    function updatePath() {
        if (points.length < 2) return;
        const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        paintPath.setAttribute('d', d);
    }

    function endDraw(e) {
        if (!isDrawing) return;
        isDrawing = false;
        paintSvg.removeEventListener('mousemove', draw);
        window.removeEventListener('mouseup', endDraw);
        if (points.length < 2) {
            resetDrawingState();
            return;
        }

        const d = paintPath.getAttribute('d') + " Z";
        paintPath.setAttribute('d', d);
        paintPath.setAttribute("fill", "rgba(76, 175, 80, 0.1)");

        const capturedText = extractTextFromPolygon(points);
        if (capturedText && capturedText.length > 0) {
            showPreviewModal(capturedText);
        } else {
            const t = LANG_DATA[window.ccManager.lang];
            showToast(t.paint_no_text);
            setTimeout(closeSelectionMode, 500);
        }
    }

    function onSegment(p, q, r) {
        return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
            q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
    }

    function orientation(p, q, r) {
        const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
        if (val === 0) return 0;
        return (val > 0) ? 1 : 2;
    }

    function doIntersect(p1, q1, p2, q2) {
        const o1 = orientation(p1, q1, p2);
        const o2 = orientation(p1, q1, q2);
        const o3 = orientation(p2, q2, p1);
        const o4 = orientation(p2, q2, q1);

        if (o1 !== o2 && o3 !== o4) return true;
        if (o1 === 0 && onSegment(p1, p2, q1)) return true;
        if (o2 === 0 && onSegment(p1, q2, q1)) return true;
        if (o3 === 0 && onSegment(p2, p1, q2)) return true;
        if (o4 === 0 && onSegment(p2, q1, q2)) return true;

        return false;
    }

    function isPointInPolygon(point, vs) {
        let x = point.x, y = point.y;
        let inside = false;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            let xi = vs[i].x, yi = vs[i].y;
            let xj = vs[j].x, yj = vs[j].y;

            let intersect = ((yi > y) != (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    function extractTextFromPolygon(polygonPoints) {
        const minX = Math.min(...polygonPoints.map(p => p.x));
        const maxX = Math.max(...polygonPoints.map(p => p.x));
        const minY = Math.min(...polygonPoints.map(p => p.y));
        const maxY = Math.max(...polygonPoints.map(p => p.y));

        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
                    const parent = node.parentElement;
                    if (!parent || parent.closest('#cc-panel') || parent.closest('svg')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    if (parent.offsetParent === null) return NodeFilter.FILTER_REJECT;

                    const range = document.createRange();
                    range.selectNode(node);
                    const rect = range.getBoundingClientRect();

                    if (rect.right < minX || rect.left > maxX || rect.bottom < minY || rect.top > maxY) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    const centerY = rect.top + rect.height / 2;

                    const step = 30;

                    if (rect.width < step) {
                        const centerX = rect.left + rect.width / 2;
                        if (isPointInPolygon({ x: centerX, y: centerY }, polygonPoints)) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                    } else {
                        for (let x = rect.left + 5; x < rect.right; x += step) {
                            if (isPointInPolygon({ x: x, y: centerY }, polygonPoints)) {
                                return NodeFilter.FILTER_ACCEPT;
                            }
                        }
                        if (isPointInPolygon({ x: rect.right - 5, y: centerY }, polygonPoints)) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                    }

                    return NodeFilter.FILTER_REJECT;
                }
            }
        );

        let resultText = "";
        let lastParent = null;

        while (walker.nextNode()) {
            const node = walker.currentNode;
            const parent = node.parentElement;
            let text = node.textContent;

            const isBlock = isBlockElement(parent);

            if (isBlock && parent !== lastParent && resultText.length > 0) {
                resultText += "\n";
                if (parent.tagName === 'P') resultText += "\n";
            } else if (!isBlock && parent !== lastParent && resultText.length > 0) {
                if (!resultText.endsWith(' ') && !resultText.endsWith('\n') && !text.startsWith(' ')) {
                    resultText += " ";
                }
            }

            text = text.replace(/\s+/g, ' ');
            resultText += text;
            lastParent = parent;
        }

        return resultText.trim();
    }

    function onMouseDown(e) {
        e.preventDefault();
        startX = e.clientX;
        startY = e.clientY;

        Object.assign(selectionBox.style, {
            left: startX + 'px', top: startY + 'px', width: '0', height: '0', display: 'block'
        });

        selectionOverlay.addEventListener('mousemove', onMouseMove);
        selectionOverlay.addEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(e) {
        const currentX = e.clientX;
        const currentY = e.clientY;
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        const left = Math.min(currentX, startX);
        const top = Math.min(currentY, startY);

        Object.assign(selectionBox.style, {
            width: width + 'px', height: height + 'px',
            left: left + 'px', top: top + 'px'
        });
    }

    function onMouseUp(e) {
        selectionOverlay.removeEventListener('mousemove', onMouseMove);
        selectionOverlay.removeEventListener('mouseup', onMouseUp);

        const rect = selectionBox.getBoundingClientRect();
        selectionBox.style.display = 'none';
        const capturedText = extractTextFromRect(rect);
        if (capturedText && capturedText.length > 0) {
            showPreviewModal(capturedText);
        } else {
            const t = LANG_DATA[window.ccManager.lang];
            showToast(t.paint_no_text);
            closeSelectionMode();
        }
    }

    function extractTextFromRect(selectionRect) {
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;

                    const parent = node.parentElement;
                    if (!parent || parent.closest('#cc-panel') || parent.closest('#cc-selection-overlay') || parent.closest('#cc-tooltip')) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    if (parent.offsetParent === null) return NodeFilter.FILTER_REJECT;

                    const range = document.createRange();
                    range.selectNode(node);
                    const rect = range.getBoundingClientRect();

                    return (rect.bottom > selectionRect.top &&
                        rect.top < selectionRect.bottom &&
                        rect.right > selectionRect.left &&
                        rect.left < selectionRect.right)
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_REJECT;
                }
            }
        );

        let resultText = "";
        let lastParent = null;

        while (walker.nextNode()) {
            const node = walker.currentNode;
            const parent = node.parentElement;
            let text = node.textContent;

            const isBlock = isBlockElement(parent);
            if (isBlock && parent !== lastParent && resultText.length > 0) {
                resultText += "\n";
                if (parent.tagName === 'P') resultText += "\n";
            } else if (!isBlock && parent !== lastParent && resultText.length > 0) {
                if (!resultText.endsWith(' ') && !resultText.endsWith('\n') && !text.startsWith(' ')) {
                    resultText += " ";
                }
            }
            text = text.replace(/\s+/g, ' ');

            resultText += text;
            lastParent = parent;
        }

        return resultText.trim();
    }

    function isBlockElement(el) {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        if (['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'BLOCKQUOTE', 'ARTICLE', 'SECTION'].includes(el.tagName)) {
            return true;
        }
        if (style.display === 'block' || style.display === 'flex' || style.display === 'grid') {
            return true;
        }
        return false;
    }

    function showPreviewModal(text) {
        const t = LANG_DATA[window.ccManager.lang];
        const modalMask = document.createElement('div');
        Object.assign(modalMask.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.6)', zIndex: '2147483648',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(2px)'
        });

        const card = document.createElement('div');
        Object.assign(card.style, {
            width: '800px', maxWidth: '65vw',
            height: '75vh',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            overflow: 'hidden',
            backgroundColor: '#1e1e1e',
            color: '#e2e8f0',
            borderRadius: '12px', padding: '20px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', gap: '12px',
            border: '1px solid #333'
        });

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';

        const title = document.createElement('div');
        title.innerHTML = t.preview_title;
        title.style.fontSize = '16px';

        const stats = document.createElement('div');
        stats.style.fontSize = '12px';
        stats.style.color = '#aaa';

        header.append(title, stats);

        const textarea = document.createElement('textarea');
        textarea.value = text;
        Object.assign(textarea.style, {
            width: '100%', padding: '12px',
            border: '1px solid #444', borderRadius: '8px',
            fontSize: '13px', lineHeight: '1.6', fontFamily: 'monospace',
            backgroundColor: '#2d2d2d', color: '#fff',
            resize: 'none', outline: 'none', boxSizing: 'border-box',
            flex: '1', marginBottom: '8px'
        });

        const updateStats = () => {
            const len = textarea.value.length;
            const estTokens = Math.ceil(len / 3.5);
            stats.textContent = '';
            stats.append(document.createTextNode(`${t.preview_words}: ${len} | ${t.token_est} `));
            const tokenSpan = document.createElement('span');
            tokenSpan.style.color = estTokens > 1000 ? '#ff9800' : '#4CAF50';
            tokenSpan.textContent = estTokens;
            stats.appendChild(tokenSpan);
        };

        textarea.addEventListener('input', updateStats);
        updateStats();

        const btnRow = document.createElement('div');
        btnRow.style.display = 'flex';
        btnRow.style.justifyContent = 'flex-end';
        btnRow.style.gap = '10px';
        btnRow.style.marginTop = '8px';

        const btnCancel = document.createElement('button');
        btnCancel.innerText = t.preview_cancel;
        Object.assign(btnCancel.style, {
            padding: '8px 16px', border: '1px solid #555', borderRadius: '6px',
            cursor: 'pointer', background: 'transparent', color: '#ccc'
        });
        btnCancel.onmouseover = () => btnCancel.style.borderColor = '#888';
        btnCancel.onmouseout = () => btnCancel.style.borderColor = '#555';
        btnCancel.onclick = () => {
            modalMask.remove();
            closeSelectionMode();
        };

        const btnConfirm = document.createElement('button');
        btnConfirm.innerText = t.preview_confirm;
        Object.assign(btnConfirm.style, {
            padding: '8px 20px', border: 'none', background: '#4CAF50', color: '#fff',
            borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
        });
        btnConfirm.onmouseover = () => btnConfirm.style.filter = 'brightness(1.1)';
        btnConfirm.onmouseout = () => btnConfirm.style.filter = 'brightness(1)';

        btnConfirm.onclick = () => {
            const finalText = textarea.value.trim();
            if (finalText) {
                getBasket((basket) => {
                    basket.push({
                        text: finalText,
                        timestamp: Date.now(),
                        source: window.location.hostname + t.source_area_select
                    });
                    chrome.storage.local.set({ 'cc_basket': basket }, () => {
                        showToast(t.toast_basket_add);
                        updateBasketUI();
                        calculateTotalTokens();
                    });
                });
            }
            modalMask.remove();
            closeSelectionMode();
        };

        btnRow.append(btnCancel, btnConfirm);
        card.append(header, textarea, btnRow);
        modalMask.append(card);
        document.body.appendChild(modalMask);
        textarea.focus();
    }

    /* =========================================
       9. AI Drawer Logic & Helpers (New Integrated UI)
    ========================================= */

    window.toggleAiSettingsInDrawer = function (container) {
        if (window.renderCompactSettings) {
            window.renderCompactSettings(container);
        } else {
            console.error("renderCompactSettings not found");
        }
    };

    window.restoreDrawerContent = function (container) {
        if (!container) container = document.querySelector('.cc-ai-content');
        if (!container) return;
        const t = LANG_DATA[window.ccManager.lang];
        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--cc-border); padding-bottom:8px;">
                <div style="font-weight:bold; font-size:14px;">🤖 AI 助手</div>
                <button id="btn-close-drawer" style="background:none; border:none; cursor:pointer; font-size:16px; color:var(--cc-text-sub); padding:0 4px;">◀</button>
            </div>

            <div id="ai-response-area" style="flex:1; overflow-y:auto; font-size:12px; margin-bottom:8px; white-space:pre-wrap; color:var(--cc-text); line-height:1.5;"></div>
            
            <div style="border-top:1px solid var(--cc-border); padding-top:8px;">
                 <button id="btn-ai-config" style="width:100%; padding:6px; background:var(--cc-btn-bg); border:1px solid var(--cc-border); border-radius:6px; cursor:pointer; font-size:11px; color:var(--cc-text);">⚙️ 設定 API Key</button>
            </div>
        `;

        const responseArea = container.querySelector('#ai-response-area');
        if (responseArea) {
            responseArea.textContent = window.ccManager.lastAiResponse || t.status_ready;
        }

        const configBtn = container.querySelector('#btn-ai-config');
        if (configBtn) configBtn.onclick = () => window.toggleAiSettingsInDrawer(container);

        const closeBtn = container.querySelector('#btn-close-drawer');
        if (closeBtn) {
            closeBtn.onclick = () => {
                const drawer = document.getElementById('cc-ai-drawer-panel');
                const tab = document.querySelector('.cc-ai-tab');
                if (drawer) drawer.classList.remove('open');
                if (tab) tab.classList.remove('active');
                const resTab = document.querySelector('.cc-res-tab');
                if (resTab) resTab.style.display = 'flex';
            };
        }
    };

    function loadAiConfig() {
        chrome.storage.local.get(['cc_ai_config'], (result) => {
            const config = result.cc_ai_config || {};
            window.ccManager.aiConfig = config;
            const btn = document.querySelector('.tool-btn.btn-ai-low, .tool-btn.btn-ai-high');
            if (btn) {
                if (config.configured) {
                    btn.classList.remove('btn-ai-low');
                    btn.classList.add('btn-ai-high');
                    btn.innerHTML = '✨ AI Summary';
                } else {
                    btn.classList.remove('btn-ai-high');
                    btn.classList.add('btn-ai-low');
                    btn.textContent = LANG_DATA[window.ccManager.lang].btn_summary;
                }
            }
        });
    }

    function handleAiSummary() {
        const t = LANG_DATA[window.ccManager.lang];

        if (!window.ccManager.aiConfig || !window.ccManager.aiConfig.configured) {
            if (window.ccManager.uiMode === 'robot') {
                openRobotSettings();
                showToast("Please configure AI uplink first. 📡");
            } else {
                const drawer = document.getElementById('cc-ai-drawer-panel');
                if (drawer) {
                    const aiTab = document.querySelector('.cc-ai-tab');
                    if (aiTab) aiTab.click();
                }
                alert(t.ai_unconfigured || "Please configure AI settings first.");
            }
            return;
        }

        resolveContentToExport((finalContent) => {
            if (!finalContent) return;
            const controller = showStreamingResponseModal(finalContent, window.ccManager.aiConfig);
            callAiStreaming(finalContent, window.ccManager.aiConfig, controller);
        });
    }

    function validateApiKey(provider, key) {
        if (!key) {
            return { ok: false, msg: 'API Key is empty' };
        }

        if (provider === 'local') {
            return { ok: true };
        }

        if (key.length < 20) {
            return { ok: false, msg: 'API Key looks too short' };
        }

        if (provider === 'openai' && !key.startsWith('sk-')) {
            return { ok: false, msg: 'OpenAI key should start with "sk-"' };
        }

        if (provider === 'claude' && !key.startsWith('sk-') && !key.startsWith('claude-')) {
            return { ok: false, msg: 'Claude key format looks invalid' };
        }

        return { ok: true };
    }

    function showStreamingResponseModal(originalContext, aiConfig) {
        const t = LANG_DATA[window.ccManager.lang];
        if (window.ccManager.streamingModal && window.ccManager.streamingModal.element) {
            if (window.ccManager.streamingModal.isMinimized) {
                window.ccManager.streamingModal.restore();
            }
            window.ccManager.streamingModal.element.remove();
        }

        const createModelInfoEl = (cfg) => {
            if (!cfg) return document.createTextNode('');
            const p = cfg.provider || 'AI';
            const m = cfg.model || 'Auto';
            const small = document.createElement('small');
            small.style.cssText = "font-weight:normal; opacity:0.7; margin-left:8px; font-size:11px; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px;";
            small.textContent = `${p} · ${m}`;
            return small;
        };

        const commonTextStyle = `
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 13px;
            line-height: 1.6;
            color: #e0e6ed;
            letter-spacing: 0.3px;
        `;
        const mask = document.createElement('div');
        mask.className = 'cc-modal-mask';

        const card = document.createElement('div');
        card.className = 'cc-modal-card';

        Object.assign(card.style, {
            width: '900px',
            maxWidth: '95vw',
            height: '80vh',
            display: 'flex',
            flexDirection: 'column'
        });

        const header = document.createElement('div');
        header.className = 'cc-modal-header';

        const titleDiv = document.createElement('div');
        titleDiv.style.fontWeight = 'bold';
        titleDiv.style.display = 'flex';
        titleDiv.style.alignItems = 'center';
        titleDiv.append(document.createTextNode(`🤖 ${t.ai_modal_title}`));
        titleDiv.append(createModelInfoEl(aiConfig));
        const minTitle = document.createElement('span');
        minTitle.className = 'min-title';
        minTitle.style.display = 'none';
        minTitle.innerText = '🤖 AI Processing...';

        const controls = document.createElement('div');
        controls.className = 'min-controls';

        const btnMin = document.createElement('button');
        btnMin.innerHTML = '─';
        Object.assign(btnMin.style, { background: 'transparent', border: 'none', color: '#ccc', fontSize: '16px', cursor: 'pointer', padding: '0 8px' });
        btnMin.onclick = (e) => {
            e.stopPropagation();
            mask.style.display = 'none';
            window.ccManager.streamingModal.isMinimized = true;
        };

        const btnClose = document.createElement('button');
        btnClose.innerHTML = '✕';
        Object.assign(btnClose.style, { background: 'transparent', border: 'none', color: '#ccc', fontSize: '16px', cursor: 'pointer', padding: '0 8px' });
        btnClose.onclick = (e) => {
            e.stopPropagation();
            mask.remove();
            window.ccManager.streamingModal = null;
        };

        controls.append(btnMin, btnClose);
        header.append(titleDiv, minTitle, controls);

        const tabs = document.createElement('div');
        tabs.className = 'cc-modal-tabs';

        const tabRes = document.createElement('button');
        tabRes.className = 'cc-modal-tab active';
        tabRes.innerText = t.ai_tab_res;

        const tabCtx = document.createElement('button');
        tabCtx.className = 'cc-modal-tab';
        tabCtx.innerText = t.ai_tab_ctx;

        tabs.append(tabRes, tabCtx);
        const resContainer = document.createElement('div');
        resContainer.className = 'cc-modal-content';
        resContainer.style.padding = '0';
        resContainer.style.display = 'flex';
        resContainer.style.flexDirection = 'column';
        resContainer.style.position = 'relative';
        resContainer.style.flex = '1';
        const btnCopyIcon = document.createElement('button');
        btnCopyIcon.textContent = '📋';
        btnCopyIcon.title = "Copy Response";
        Object.assign(btnCopyIcon.style, {
            position: 'absolute', top: '10px', right: '10px',
            background: 'rgba(0,0,0,0.5)', border: '1px solid #555', borderRadius: '4px',
            color: '#fff', cursor: 'pointer', padding: '4px 8px', zIndex: '10'
        });
        btnCopyIcon.onclick = () => {
            const text = resContent.innerText;
            navigator.clipboard.writeText(text).then(() => {
                btnCopyIcon.innerHTML = '✅';
                setTimeout(() => btnCopyIcon.innerHTML = '📋', 1500);
            });
        };

        const resContent = document.createElement('div');
        resContent.style.cssText = `flex: 1; overflow-y: auto; padding: 20px; white-space: pre-wrap; ${commonTextStyle}`;
        resContent.innerText = "Connecting to AI...";

        resContainer.append(btnCopyIcon, resContent);

        const ctxContainer = document.createElement('div');
        ctxContainer.className = 'cc-modal-content';
        ctxContainer.style.display = 'none';
        ctxContainer.style.flexDirection = 'column';
        ctxContainer.style.flex = '1';
        ctxContainer.style.padding = '10px';

        const ctxTextarea = document.createElement('textarea');
        ctxTextarea.style.cssText = `
            flex: 1; 
            background: #111; 
            border: 1px solid #333;
            resize: none; 
            padding: 20px; 
            margin-bottom: 8px;
            outline: none;
            border-radius: 4px;
            ${commonTextStyle}
        `;

        ctxTextarea.value = window.ccManager.lastAiContext || originalContext || "";
        const actionRow = document.createElement('div');
        actionRow.style.display = 'flex';
        actionRow.style.gap = '8px';
        actionRow.style.marginTop = '0';
        const btnSettings = document.createElement('button');
        btnSettings.innerText = t.btn_quick_settings || "⚙️ AI Settings";
        Object.assign(btnSettings.style, {
            padding: '10px', background: '#333', color: '#ccc',
            border: '1px solid #555', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold',
            flex: '0 0 auto', width: '120px'
        });
        btnSettings.onclick = () => {
            openRobotSettings();
        };

        const btnResend = document.createElement('button');
        btnResend.id = 'cc-btn-resend';
        btnResend.innerText = t.btn_resend;
        Object.assign(btnResend.style, {
            padding: '10px', background: '#2196F3', color: '#fff',
            border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold',
            flex: '1'
        });

        btnResend.onclick = () => {
            const newContext = ctxTextarea.value;
            const currentConfig = window.ccManager.aiConfig;
            titleDiv.innerHTML = '';
            titleDiv.append(document.createTextNode(`🤖 ${t.ai_modal_title}`));
            titleDiv.append(createModelInfoEl(currentConfig));

            tabRes.click();
            resContent.innerText = "Restarting AI...";
            let isFirstChunk = true;

            callAiStreaming(newContext, currentConfig, {
                append: (txt) => {
                    if (isFirstChunk) { resContent.innerText = ''; isFirstChunk = false; }
                    resContent.innerText += txt;
                    resContent.scrollTop = resContent.scrollHeight;
                    window.ccManager.lastAiText = resContent.innerText;
                },
                done: () => {
                    footer.style.display = 'flex';
                    minTitle.innerText = "✅ AI Done";
                    window.ccManager.lastAiText = resContent.innerText;
                },
                error: (e) => {
                    if (isFirstChunk) resContent.innerText = '';
                    const errSpan = document.createElement('div');
                    errSpan.style.cssText = "color:#ff5252; margin-top:10px;";
                    errSpan.textContent = `❌ Error: ${e}`;
                    resContent.appendChild(errSpan);
                    footer.style.display = 'flex';
                    window.ccManager.lastAiText = resContent.innerText;
                }
            });
        };

        actionRow.append(btnSettings, btnResend);
        ctxContainer.append(ctxTextarea, actionRow);

        tabRes.onclick = () => {
            tabRes.classList.add('active'); tabCtx.classList.remove('active');
            resContainer.style.display = 'flex'; ctxContainer.style.display = 'none';
        };
        tabCtx.onclick = () => {
            tabCtx.classList.add('active'); tabRes.classList.remove('active');
            ctxContainer.style.display = 'flex'; resContainer.style.display = 'none';
        };

        const footer = document.createElement('div');
        footer.className = 'cc-modal-footer';
        footer.style.display = 'none';
        footer.style.justifyContent = 'space-between';
        footer.style.alignItems = 'center';

        const leftGroup = document.createElement('div');
        leftGroup.style.display = 'flex';
        leftGroup.style.gap = '8px';
        leftGroup.style.alignItems = 'center';

        const fmtSelect = document.createElement('select');
        fmtSelect.style.cssText = "background:#333; color:#fff; border:1px solid #555; padding:4px; border-radius:4px; font-size:12px; outline:none;";
        const optTxt = document.createElement('option'); optTxt.value = 'txt'; optTxt.innerText = '.txt';
        const optMd = document.createElement('option'); optMd.value = 'md'; optMd.innerText = '.md';
        fmtSelect.append(optTxt, optMd);

        const btnDownload = document.createElement('button');
        btnDownload.id = 'cc-btn-save';
        btnDownload.innerHTML = t.btn_save_file;
        btnDownload.style.cssText = "background:#4CAF50; color:#fff; border:none; padding:5px 10px; border-radius:4px; font-size:12px; cursor:pointer; font-weight:bold;";
        btnDownload.onclick = () => {
            const ext = fmtSelect.value;
            const text = resContent.innerText;
            if (!text) return;
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai-response-${Date.now()}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        const currentPlatform = PLATFORMS.find(p => window.location.hostname.includes(p.id));
        if (currentPlatform) {
            const btnPaste = document.createElement('button');
            btnPaste.id = 'cc-btn-paste';
            btnPaste.innerHTML = t.btn_paste;
            btnPaste.style.cssText = "background:#ff9800; color:#fff; border:none; padding:5px 10px; border-radius:4px; font-size:12px; cursor:pointer; font-weight:bold; margin-left: 8px;";
            btnPaste.onclick = () => {
                const text = resContent.innerText;
                const inputEl = document.querySelector(window.ccManager.config.inputSelector);
                if (inputEl) {
                    inputEl.focus();
                    if (inputEl.contentEditable === "true") inputEl.textContent = text;
                    else inputEl.value = text;
                    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                    mask.remove();
                } else {
                    alert("Cannot find input box on this page.");
                }
            };
            leftGroup.appendChild(btnPaste);
        }

        leftGroup.prepend(fmtSelect, btnDownload);
        const rightGroup = document.createElement('div');
        rightGroup.style.display = 'flex';
        rightGroup.style.gap = '6px';
        const transferTo = (url, text) => {
            chrome.storage.local.set({
                'cc_transfer_payload': {
                    text: text,
                    timestamp: Date.now(),
                    source: 'AI Summary'
                }
            }, () => window.open(url, '_blank'));
        };

        const btnSendAll = document.createElement('button');
        btnSendAll.id = 'cc-btn-sendall';
        btnSendAll.innerHTML = t.btn_send_all;
        Object.assign(btnSendAll.style, {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '4px',
            cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', marginRight: '4px'
        });
        btnSendAll.onclick = () => {
            const text = resContent.innerText;
            PLATFORMS.forEach(p => transferTo(p.url, text));
        };
        rightGroup.appendChild(btnSendAll);
        PLATFORMS.forEach(p => {
            const btn = document.createElement('button');
            btn.innerHTML = p.icon;
            btn.title = `Send to ${p.name}`;
            Object.assign(btn.style, {
                background: '#333', border: '1px solid #555', color: '#fff',
                padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px'
            });
            btn.onmouseover = () => btn.style.background = '#444';
            btn.onmouseout = () => btn.style.background = '#333';
            btn.onclick = () => transferTo(p.url, resContent.innerText);
            rightGroup.appendChild(btn);
        });

        footer.append(leftGroup, rightGroup);
        card.append(header, tabs, resContainer, ctxContainer, footer);
        mask.appendChild(card);
        document.body.appendChild(mask);

        window.ccManager.streamingModal = {
            element: mask,
            isMinimized: false,
            restore: () => {
                mask.style.display = 'flex';
                card.style.width = '900px';
                card.style.height = '80vh';
                window.ccManager.streamingModal.isMinimized = false;
            }
        };

        let hasStarted = false;
        return {
            append: (text) => {
                if (!hasStarted) { resContent.innerText = ''; hasStarted = true; }
                resContent.innerText += text;
                window.ccManager.lastAiText = resContent.innerText;
                resContent.scrollTop = resContent.scrollHeight;
            },
            done: () => {
                console.log("Stream finished");
                footer.style.display = 'flex';
                minTitle.innerText = "✅ AI Done";
                window.ccManager.lastAiText = resContent.innerText;
            },
            error: (err) => {
                const errDiv = document.createElement('div');
                errDiv.style.cssText = "color:#ff5252; margin-top:10px; border-top:1px solid #444; padding-top:10px;";
                errDiv.textContent = `❌ Error: ${err}`;
                resContent.appendChild(errDiv);

                footer.style.display = 'flex';
                window.ccManager.lastAiText = resContent.innerText;
            }
        };
    }

    setTimeout(() => {
        try {
            injectStyles();
            loadAiConfig();
        } catch (e) {
            console.error('Error initializing AI module', e);
        }
    }, 1000);

    function showEditorModal(title, initialValue, onSaveCallback) {
        const mask = document.createElement('div');
        mask.className = 'cc-modal-mask';

        const card = document.createElement('div');
        card.className = 'cc-modal-card';

        Object.assign(card.style, {
            width: '800px',
            maxWidth: '95vw',
            height: '75vh',
            display: 'flex',
            flexDirection: 'column'
        });

        const header = document.createElement('div');
        header.className = 'cc-modal-header';
        const titleDiv = document.createElement('div');
        titleDiv.style.fontWeight = 'bold';
        titleDiv.textContent = `📝 ${title}`;
        header.appendChild(titleDiv);

        const btnClose = document.createElement('button');
        btnClose.innerHTML = '✕';
        btnClose.style.cssText = "background:none; border:none; color:#aaa; cursor:pointer; font-size:16px;";
        btnClose.onclick = () => mask.remove();
        header.appendChild(btnClose);

        const textarea = document.createElement('textarea');
        textarea.className = 'cc-modal-content';

        Object.assign(textarea.style, {
            background: '#252525',
            border: 'none',
            resize: 'none',
            color: '#fff',
            outline: 'none',
            flex: '1',
            padding: '16px',
            fontSize: '14px',
            lineHeight: '1.6',
            fontFamily: 'monospace'
        });

        textarea.value = initialValue || "";
        textarea.placeholder = "Enter content here...";

        const footer = document.createElement('div');
        footer.className = 'cc-modal-footer';

        const btnCancel = document.createElement('button');
        btnCancel.innerText = "Cancel";
        btnCancel.style.cssText = "padding:6px 12px; background:transparent; border:1px solid #555; color:#ccc; border-radius:4px; cursor:pointer;";
        btnCancel.onclick = () => mask.remove();

        const btnSave = document.createElement('button');
        btnSave.innerText = "Save";
        btnSave.style.cssText = "padding:6px 16px; background:#4CAF50; border:none; color:#fff; border-radius:4px; cursor:pointer; font-weight:bold;";
        btnSave.onclick = () => {
            const val = textarea.value;
            if (onSaveCallback) onSaveCallback(val);
            mask.remove();
        };

        footer.append(btnCancel, btnSave);
        card.append(header, textarea, footer);
        mask.appendChild(card);
        document.body.appendChild(mask);

        setTimeout(() => textarea.focus(), 100);
    }

    async function callAiStreaming(text, config, controller) {
        window.ccManager.lastAiContext = text;
        window.ccManager.lastAiConfig = config;
        const port = chrome.runtime.connect({ name: "cc-ai-stream" });
        port.postMessage({ text, config });
        port.onMessage.addListener((msg) => {
            if (msg.type === 'TEXT') {
                controller.append(msg.text);
            } else if (msg.type === 'DONE') {
                controller.done();
                port.disconnect();
            } else if (msg.type === 'ERROR') {
                controller.error(msg.error);
                port.disconnect();
            }
        });

        port.onDisconnect.addListener(() => {
            if (chrome.runtime.lastError) {
                controller.error("Connection failed: " + chrome.runtime.lastError.message);
            }
        });
    }

    /* =========================================
       10. Global Drop Listener for LLMs
    ========================================= */
    document.addEventListener('drop', (e) => {
        if (!e.dataTransfer.types.includes('application/cc-sort')) return;
        if (!window.ccManager.config || !window.ccManager.config.inputSelector) return;
        let inputEl = e.target.closest(window.ccManager.config.inputSelector);
        if (!inputEl && (e.target.tagName === 'DIV' || e.target.tagName === 'P')) {
            inputEl = e.target.querySelector(window.ccManager.config.inputSelector);
        }
        if (!inputEl && window.location.hostname.includes('claude.ai')) {
            inputEl = document.querySelector(window.ccManager.config.inputSelector);
        }
        if (inputEl) {
            e.preventDefault();
            e.stopPropagation();
            const text = e.dataTransfer.getData('text/plain');
            if (text) {
                autoFillInput(inputEl, text);
            }
            if (window.location.hostname.includes('claude.ai')) {
                console.log("Context-Carry: Cleaning up Claude overlay...");
                const dragLeave = new DragEvent('dragleave', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: e.clientX,
                    clientY: e.clientY
                });
                document.body.dispatchEvent(dragLeave);
                setTimeout(() => {
                    const overlays = document.querySelectorAll('div');
                    overlays.forEach(el => {
                        if (el.innerText && el.innerText.includes('Drop files here')) {
                            const container = el.closest('.fixed') || el.closest('.absolute') || el;
                            if (container) container.remove();
                        }
                    });
                }, 50);
            }
        }
    }, true);

})();