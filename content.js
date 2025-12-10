(function () {
    /* =========================================
       0. Global State Management & Guard
    ========================================= */
    if (typeof window.ccManager === 'undefined') {
        window.ccManager = {
            active: false,
            interval: null,
            lang: 'en',
            config: null,
            lastCheckedIndex: null,
            isPreviewOpen: false
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
            msgSelector: 'article',
            inputSelector: '#prompt-textarea',
            ignore: '.sr-only, button, .cb-buttons'
        },
        'google.com': {
            msgSelector: 'user-query, model-response',
            inputSelector: 'div[contenteditable="true"], .rich-textarea, textarea',
            ignore: '.mat-icon, .action-button, .button-label, .botones-acciones'
        },
        'claude.ai': {
            msgSelector: 'div[data-testid="user-message"], div.font-claude-response',
            inputSelector: 'div[contenteditable="true"]',
            ignore: 'button, .copy-icon, [data-testid="chat-message-actions"], .cursor-pointer'
        },
        'grok': {
            msgSelector: '.message-bubble',
            inputSelector: 'textarea, div[contenteditable="true"]',
            ignore: 'svg, span[role="button"], .action-buttons'
        }
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
            token_warn_msg: '預估內容 ({est}) 超過了 {platform} 的建議限制 ({limit})。\n\n強行轉移可能會導致記憶遺失。\n是否仍要繼續？'
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
            token_warn_msg: 'Content ({est}) exceeds recommended limit for {platform} ({limit}).\n\nTransferring may cause memory loss.\nDo you want to proceed?'
        }
    };

    function injectStyles() {
        if (document.getElementById('cc-styles')) return;
        const style = document.createElement('style');
        style.id = 'cc-styles';
        style.textContent = `
            /* Entry animation for the panel */
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

            /* Colour variables for light mode */
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

                /* platform specific colours */
                --gpt-bg: #ecfdf5; --gpt-text: #059669; --gpt-border: #a7f3d0;
                --cld-bg: #fffbeb; --cld-text: #d97706; --cld-border: #fde68a;
                --gem-bg: #eff6ff; --gem-text: #2563eb; --gem-border: #bfdbfe;
                --grk-bg: #f3f4f6; --grk-text: #1f2937; --grk-border: #e5e7eb;
            }
            /* Override variables for dark mode when data‑theme="dark" */
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

            /* Base panel styles */
            #cc-panel.cc-panel {
                width: 260px;
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

            /* Header */
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

            /* Status message */
            #cc-panel .cc-msg {
                font-size: 11px;
                color: var(--cc-text-sub);
                margin-bottom: 8px;
            }

            /* Platform grid */
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
            /* Platform colour variations */
            #cc-panel .p-chatgpt { background: var(--gpt-bg); color: var(--gpt-text); border-color: var(--gpt-border); }
            #cc-panel .p-claude { background: var(--cld-bg); color: var(--cld-text); border-color: var(--cld-border); }
            #cc-panel .p-gemini { background: var(--gem-bg); color: var(--gem-text); border-color: var(--gem-border); }
            #cc-panel .p-grok { background: var(--grk-bg); color: var(--grk-text); border-color: var(--grk-border); }

            /* Tools row */
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

            /* Drawer toggle */
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

            /* Drawer */
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

            /* Drawer internal elements */
            #cc-panel .cc-input {
                width: 100%;
                box-sizing: border-box;
                background: var(--cc-bg);
                color: var(--cc-text);
                border: 1px solid var(--cc-border);
                border-radius: 6px;
                padding: 8px;
                font-size: 11px;
                margin-bottom: 8px;
                resize: vertical;
                height: 50px;
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
            /* Basket item animations remain from original */
            #cc-panel .cc-basket-item {
                transition: all 0.3s ease;
                opacity: 1;
                transform: translateX(0);
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
            /* Scrollbar styling */
            #cc-panel ::-webkit-scrollbar { width: 6px; }
            #cc-panel ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
            #cc-panel ::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }
            #cc-panel ::-webkit-scrollbar-thumb:hover { background: #777; }
        `;
        document.head.appendChild(style);
    }

    /* =========================================
       2. Environment detection
    ========================================= */
    const host = window.location.hostname;
    let config = null;

    if (host.includes('chatgpt')) config = APP_CONFIG['chatgpt.com'];
    else if (host.includes('google')) config = APP_CONFIG['google.com'];
    else if (host.includes('claude')) config = APP_CONFIG['claude.ai'];
    else if (host.includes('x.com') || host.includes('grok.com')) config = APP_CONFIG['grok'];

    window.ccManager.config = config;

    if (!config) return;

    function convertToMarkdown(element) {
        const clone = element.cloneNode(true);
        if (config.ignore) {
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

        injectStyles();
        window.ccManager.active = true;

        console.log("Context-Carry: Enabled");
        createPanel();
        setTimeout(() => {
            const panel = document.getElementById('cc-panel');
            if (panel) panel.classList.add('cc-visible');
        }, 10);

        performScan();
        window.ccManager.interval = setInterval(performScan, 3000);
        checkAutoFill();
        updateBasketUI();
    }

    function closeInterface() {
        if (!window.ccManager.active) return;
        window.ccManager.active = false;

        console.log("Context-Carry: Disabled");
        if (window.ccManager.interval) {
            clearInterval(window.ccManager.interval);
            window.ccManager.interval = null;
        }

        const panel = document.getElementById('cc-panel');
        if (panel) {
            panel.classList.remove('cc-visible');
            setTimeout(() => {
                panel.remove();
                document.getElementById('cc-tooltip')?.remove();
            }, 300);
        }

        document.querySelectorAll('.cc-btn').forEach(e => e.remove());
        const processedElements = document.querySelectorAll('[data-cc-padding]');

        processedElements.forEach(el => {
            el.style.paddingLeft = '';
            const isSelected = el.dataset.ccSelected === 'true';
            if (isSelected || el.style.outline.includes('4CAF50')) {
                el.style.outline = '';
                el.style.outlineOffset = '';
                el.style.backgroundColor = el.dataset.originalBg || '';
            }
            delete el.dataset.ccPadding;
            delete el.dataset.ccSelected;
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
    let title, msg, prefixLabel, prefixInput, btnDl, btnCopy, btnScan, transferLabel, transferContainer, btnSelectAll, btnUnselectAll;
    let basketLabel, basketStatus, btnAddBasket, btnClearBasket, btnPasteBasket, basketPreviewList;
    let tooltip;

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
        const langBtn = document.createElement('button');
        langBtn.className = 'cc-icon-btn';
        langBtn.textContent = '🌐';
        langBtn.title = 'Switch language';
        langBtn.onclick = function () {
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
        };
        controls.appendChild(langBtn);

        const themeBtn = document.createElement('button');
        themeBtn.id = 'theme-btn';
        themeBtn.className = 'cc-icon-btn';
        themeBtn.textContent = '🌙';
        themeBtn.title = 'Toggle dark mode';
        themeBtn.onclick = function () {
            const isDark = panel.getAttribute('data-theme') === 'dark';
            if (isDark) {
                panel.removeAttribute('data-theme');
                themeBtn.textContent = '🌙';
            } else {
                panel.setAttribute('data-theme', 'dark');
                themeBtn.textContent = '☀️';
            }
        };
        controls.appendChild(themeBtn);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'cc-icon-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.title = 'Close';
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

        const drawerToggle = document.createElement('div');
        drawerToggle.className = 'cc-drawer-toggle';
        drawerToggle.innerHTML = `<span class="arrow">▼</span> Advanced & Basket`;
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
        basketPreviewList = document.createElement('div');
        basketPreviewList.className = 'basket-preview-list';
        basketPreviewList.style.display = 'none';
        const tokenDisplay = document.createElement('div');
        tokenDisplay.id = 'cc-token-display';
        tokenDisplay.style.fontSize = '11px';
        tokenDisplay.style.color = 'var(--cc-text-sub)';
        tokenDisplay.style.marginTop = '4px';
        tokenDisplay.style.marginBottom = '4px';
        tokenDisplay.style.textAlign = 'right';
        tokenDisplay.style.fontWeight = 'bold';
        tokenDisplay.textContent = `${t.token_est} 0`;

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
        extraActions.append(btnDl, btnScan);
        drawer.append(prefixLabel, prefixInput, basketInfo, basketBtnRow, basketPreviewList, tokenDisplay, extraActions);
        panel.append(header, msg, transferLabel, transferContainer, toolsRow, drawerToggle, drawer);
        document.body.appendChild(panel);
        makeDraggable(panel, header);
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

    /* =========================================
       5. Logic & Utilities
    ========================================= */
    function flashInput(el) {
        el.style.transition = 'background 0.2s';
        el.style.background = '#555';
        setTimeout(() => el.style.background = '#333', 200);
    }

    function updateUITexts() {
        const curLang = window.ccManager.lang;
        const t = LANG_DATA[curLang];

        if (title) title.innerText = t.title;

        if (msg) {
            if (!msg.innerText.includes('Selected') && !msg.innerText.includes('選取')) {
                msg.innerText = t.status_ready;
            }
            const selectedCount = document.querySelectorAll('.cc-btn[data-selected="true"]').length;
            if (selectedCount > 0) msg.innerText = t.msg_selected.replace('{n}', selectedCount);
        }

        if (prefixLabel) prefixLabel.innerText = t.label_prefix;
        if (prefixInput) prefixInput.placeholder = t.placeholder;
        if (btnSelectAll) btnSelectAll.innerText = t.btn_select_all;
        if (btnUnselectAll) btnUnselectAll.innerText = t.btn_unselect_all;
        if (btnDl) btnDl.innerText = t.btn_dl;
        if (btnCopy) btnCopy.innerText = t.btn_copy;
        if (basketLabel) basketLabel.innerText = t.label_basket;
        if (btnAddBasket) btnAddBasket.innerText = t.btn_add_basket;
        if (btnPasteBasket) btnPasteBasket.innerText = t.btn_paste_basket;
        if (btnClearBasket) btnClearBasket.title = t.btn_clear_basket;
        updateBasketUI();
        if (transferLabel) transferLabel.innerText = t.label_transfer;
        if (btnScan) btnScan.innerText = t.btn_scan;

        document.querySelectorAll('.cc-btn').forEach(b => {
            if (b.innerText === '➕') b.title = t.btn_add_title;
        });
    }

    function performScan() {
        if (!window.ccManager.active) return;

        const els = document.querySelectorAll(config.msgSelector);
        let count = 0;
        const curLang = window.ccManager.lang;
        const t = LANG_DATA[curLang];

        els.forEach(el => {
            if (el.querySelector('.cc-btn') || el.innerText.trim().length < 1) return;

            const style = window.getComputedStyle(el);
            if (style.position === 'static') {
                el.style.position = 'relative';
            }

            if (!el.dataset.ccPadding) {
                const currentPadLeft = parseInt(style.paddingLeft) || 0;
                el.style.paddingLeft = (currentPadLeft + 35) + 'px';
                el.dataset.ccPadding = 'true';
            }

            const btn = document.createElement('button');
            btn.className = 'cc-btn';
            btn.innerText = '➕';
            btn.title = t.btn_add_title;

            Object.assign(btn.style, {
                position: 'absolute', top: '8px', left: '6px', zIndex: '9999',
                background: '#fff', color: '#333', border: '1px solid #999',
                fontWeight: '900', padding: '0', fontSize: '14px', cursor: 'pointer',
                borderRadius: '4px', boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            });

            btn.onmouseenter = () => {
                btn.style.borderColor = '#4CAF50';
                btn.style.color = '#4CAF50';
                btn.style.transform = 'scale(1.1)';
                btn.style.transition = 'all 0.1s';
            };
            btn.onmouseleave = () => {
                if (btn.dataset.selected !== 'true') {
                    btn.style.borderColor = '#999';
                    btn.style.color = '#333';
                    btn.style.transform = 'scale(1)';
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
        btn.dataset.selected = 'true';
        el.dataset.ccSelected = 'true';
        el.style.outline = '2px solid #4CAF50';
        el.style.outlineOffset = '-2px';
        if (!el.dataset.originalBg) el.dataset.originalBg = el.style.backgroundColor;
        el.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
    }

    function unselectBtn(btn) {
        if (!btn || btn.dataset.selected !== 'true') return;
        const el = btn.parentElement;
        btn.innerText = '➕';
        btn.style.background = '#fff';
        btn.style.color = '#333';
        btn.style.borderColor = '#999';
        delete btn.dataset.selected;
        delete el.dataset.ccSelected;
        el.style.outline = 'none';
        el.style.backgroundColor = el.dataset.originalBg || '';
    }

    function updateStatus() {
        if (!msg) return;
        const curLang = window.ccManager.lang;
        const n = document.querySelectorAll('.cc-btn[data-selected="true"]').length;
        msg.innerText = LANG_DATA[curLang].msg_selected.replace('{n}', n);
    }

    function getSelectedText() {
        const selected = document.querySelectorAll('.cc-btn[data-selected="true"]');
        if (selected.length === 0) return null;

        const userPrefix = document.getElementById('cc-prefix-input').value;
        let combined = userPrefix + "\n\n====================\n\n";

        selected.forEach(btn => {
            const textContent = convertToMarkdown(btn.parentElement);
            combined += `--- Fragment ---\n${textContent}\n\n`;
        });
        combined += "====================\n[END OF CONTEXT]";
        return combined;
    }

    function handleDownload() {
        const curLang = window.ccManager.lang;
        const t = LANG_DATA[curLang];
        const text = getSelectedText();
        if (!text) { alert(t.alert_no_selection); return; }
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chat-context-' + new Date().toISOString().slice(0, 10) + '.txt';
        a.click();
        URL.revokeObjectURL(url);
    }

    function handleCopyOnly() {
        const curLang = window.ccManager.lang;
        const t = LANG_DATA[curLang];
        const text = getSelectedText();
        if (!text) { alert(t.alert_no_selection); return; }
        navigator.clipboard.writeText(text).then(() => {
            alert(t.alert_copy_done);
        }).catch(err => alert(t.alert_fail));
    }

    /* =========================================
       Basket & Cross-Transfer Logic
    ========================================= */
    function getBasket(cb) {
        chrome.storage.local.get(['cc_basket'], (result) => {
            const basket = result.cc_basket || [];
            cb(basket);
        });
    }

    function updateBasketUI() {
        if (!basketStatus) return;
        getBasket((basket) => {
            const count = basket.length;
            const t = LANG_DATA[window.ccManager.lang];

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

    function renderBasketPreview(basket) {
        basketPreviewList.innerHTML = '';
        const t = LANG_DATA[window.ccManager.lang];
        const currentPrefix = document.getElementById('cc-prefix-input').value;
        const hint = document.createElement('div');
        hint.innerText = t.preview_drag_hint;
        hint.style.fontSize = '10px';
        hint.style.color = '#888';
        hint.style.textAlign = 'right';
        hint.style.marginBottom = '6px';
        basketPreviewList.append(hint);

        basket.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'cc-basket-item';
            row.draggable = true;
            row.dataset.index = index;

            Object.assign(row.style, {
                background: '#333',
                padding: '8px',
                borderRadius: '6px',
                fontSize: '11px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'grab',
                border: '1px solid transparent',
                position: 'relative'
            });

            row.onmouseenter = (e) => {
                if (!tooltip) return;

                let fullClean = item.text;
                if (currentPrefix && fullClean.startsWith(currentPrefix)) fullClean = fullClean.replace(currentPrefix, '');
                fullClean = fullClean.replace(/={5,}/g, '').replace(/--- Fragment ---/g, '').replace(/\[END OF CONTEXT\]/g, '').trim();
                if (fullClean.length > 500) fullClean = fullClean.substring(0, 500) + "\n\n(......)";
                tooltip.innerText = `[Source: ${item.source}]\n\n${fullClean}`;
                tooltip.style.display = 'block';
                updateTooltipPosition(e);
            };

            row.onmousemove = (e) => {
                updateTooltipPosition(e);
            };

            row.onmouseleave = () => {
                if (tooltip) tooltip.style.display = 'none';
            };

            row.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', index);
                row.style.opacity = '0.5';
                if (tooltip) tooltip.style.display = 'none';
            };

            row.ondragend = (e) => {
                row.style.opacity = '1';
                document.querySelectorAll('#cc-panel [draggable="true"]').forEach(el => {
                    el.style.borderTop = '1px solid transparent';
                    el.style.borderBottom = '1px solid transparent';
                });
            };

            row.ondragover = (e) => { e.preventDefault(); };
            row.ondragenter = (e) => {
                e.preventDefault();
                row.style.border = '1px dashed #4CAF50';
            };
            row.ondragleave = (e) => {
                row.style.border = '1px solid transparent';
            };
            row.ondrop = (e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = index;
                if (fromIndex !== toIndex) {
                    handleReorderBasket(fromIndex, toIndex);
                }
            };
            let cleanText = item.text;
            if (currentPrefix && cleanText.startsWith(currentPrefix)) {
                cleanText = cleanText.replace(currentPrefix, '');
            }
            cleanText = cleanText.replace(/={5,}/g, '').replace(/--- Fragment ---/g, '').replace(/\[END OF CONTEXT\]/g, '').trim();
            let snippet = cleanText.substring(0, 50).replace(/[\r\n]+/g, ' ');
            if (cleanText.length > 50) snippet += '...';
            if (snippet.length === 0) snippet = "(System Prompt Only)";

            const info = document.createElement('div');
            info.style.overflow = 'hidden';
            info.style.pointerEvents = 'none';
            info.innerHTML = `
                <span style="color:#aaa; font-size:9px; font-weight:700;">${index + 1}. [${item.source}]</span><br/>
                <span style="color:#eee; opacity:0.9;">${snippet}</span>
            `;

            const delBtn = document.createElement('button');
            delBtn.innerHTML = '&times;';
            delBtn.title = t.preview_del_tooltip;
            Object.assign(delBtn.style, {
                background: 'rgba(255, 82, 82, 0.1)',
                border: 'none', color: '#ff5252',
                fontWeight: 'bold', cursor: 'pointer', marginLeft: '8px', fontSize: '16px',
                borderRadius: '4px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            });
            delBtn.onclick = (e) => {
                e.stopPropagation();
                row.classList.add('cc-deleting');
                setTimeout(() => {
                    handleDeleteSingleItem(index);
                }, 300);
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

    function handleAddToBasket() {
        const text = getSelectedText();
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
        getBasket((basket) => {
            const t = LANG_DATA[window.ccManager.lang];
            if (basket.length === 0) {
                alert("Basket is empty!");
                return;
            }

            const combinedText = basket.map((item, idx) =>
                `[Part ${idx + 1} from ${item.source}]\n${item.text}`
            ).join("\n\n");

            const currentPlatform = PLATFORMS.find(p => window.location.hostname.includes(p.id));
            if (currentPlatform) {
                const est = estimateTokens(combinedText);
                if (est > currentPlatform.limit) {
                    const msg = t.token_warn_msg
                        .replace('{est}', est.toLocaleString())
                        .replace('{platform}', currentPlatform.name)
                        .replace('{limit}', currentPlatform.limit.toLocaleString());
                    if (!confirm(msg)) return;
                }
            }

            const inputEl = document.querySelector(config.inputSelector);
            if (inputEl) {
                autoFillInput(inputEl, combinedText);
                showToast(t.toast_autofill);
            } else {
                alert("Cannot find input box.");
            }
        });
    }

    function handleCrossTransfer(platformObj) {
        const curLang = window.ccManager.lang;
        const t = LANG_DATA[curLang];

        getBasket((basket) => {
            let textToTransfer = null;
            if (basket.length > 0) {
                textToTransfer = basket.map((item, idx) =>
                    `[Part ${idx + 1} from ${item.source}]\n${item.text}`
                ).join("\n\n");
            } else {
                textToTransfer = getSelectedText();
            }

            if (!textToTransfer) { alert(t.alert_no_selection); return; }

            const est = estimateTokens(textToTransfer);
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
                    text: textToTransfer,
                    timestamp: Date.now(),
                    source: window.location.hostname
                }
            }, () => {
                window.open(platformObj.url, '_blank');
            });
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

        chrome.storage.local.get(['cc_transfer_payload'], (result) => {
            const data = result.cc_transfer_payload;
            if (data && (Date.now() - data.timestamp < 30000)) {

                console.log("Context-Carry: Found transfer data from " + data.source);
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
                            console.log("Context-Carry: Timeout waiting for input box.");
                        }
                    }
                }, 500);
            }
        });
    }

    function autoFillInput(element, text) {
        element.focus();
        if (element.contentEditable === "true") {
            element.textContent = text;
        } else {
            element.value = text;
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
        }
    });

    checkAutoFill();

})();