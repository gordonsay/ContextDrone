(function () {
    /* =========================================
       0. Global State Management & Guard
    ========================================= */
    if (typeof window.ccManager === 'undefined') {
        window.ccManager = {
            active: false,
            interval: null,
            lang: 'en',
            config: null
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
        { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/?model=gpt-4o', icon: '🤖' },
        { id: 'claude', name: 'Claude', url: 'https://claude.ai/new', icon: '🧠' },
        { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app', icon: '💎' },
        { id: 'grok', name: 'Grok', url: 'https://grok.com', icon: '✖️' }
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
            btn_dl: '輸出為 .txt',
            btn_copy: '複製到剪貼簿',
            label_transfer: '轉移並開啟 (Cross-LLM):',
            msg_detected: '偵測到 {n} 則訊息',
            msg_selected: '已選取: {n} 則',
            alert_no_selection: '請先選取對話！',
            alert_copy_done: '內容已複製！',
            alert_fail: '操作失敗，請檢查權限',
            btn_add_title: '加入此段落',
            toast_autofill: 'Context-Carry: 已自動填入轉移內容 ✨',
            default_prompt: `[SYSTEM: CONTEXT TRANSFER]\n以下是使用者篩選的對話歷史，請以此為背景繼續對話：`
        },
        'en': {
            title: 'Context-Carry',
            status_ready: 'Ready',
            status_scanning: 'Scanning...',
            label_prefix: 'Custom Prefix (System Prompt):',
            placeholder: 'Enter instructions for the AI here...',
            btn_scan: 'Rescan Page',
            btn_scan_done: 'Scanned',
            btn_dl: 'Export to .txt',
            btn_copy: 'Copy to Clipboard',
            label_transfer: 'Transfer to (Cross-LLM):',
            msg_detected: 'Detected {n} messages',
            msg_selected: 'Selected: {n}',
            alert_no_selection: 'Please select messages first!',
            alert_copy_done: 'Content copied!',
            alert_fail: 'Operation failed. Check permissions.',
            btn_add_title: 'Add this block',
            toast_autofill: 'Context-Carry: Content Auto-filled ✨',
            default_prompt: `[SYSTEM: CONTEXT TRANSFER]\nThe following is the conversation history selected by the user. Please use this as context to continue the conversation:`
        }
    };

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

    /* =========================================
       3. Main Functions: Open / Close / Toggle
    ========================================= */

    function openInterface() {
        if (window.ccManager.active) return;
        window.ccManager.active = true;

        console.log("Context-Carry: Enabled");
        createPanel();
        performScan();
        window.ccManager.interval = setInterval(performScan, 3000);
        checkAutoFill();
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
        if (panel) panel.remove();
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
    let title, msg, prefixLabel, prefixInput, btnDl, btnCopy, btnScan, transferLabel, transferContainer;

    function createPanel() {
        if (document.getElementById('cc-panel')) return;

        const curLang = window.ccManager.lang;
        const t = LANG_DATA[curLang];

        const panel = document.createElement('div');
        panel.id = 'cc-panel';
        Object.assign(panel.style, {
            position: 'fixed', top: '80px', right: '20px', zIndex: '2147483647',
            background: '#1e1e1e', color: '#fff', padding: '16px', borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)', fontFamily: 'sans-serif',
            width: '280px', border: '1px solid #444', textAlign: 'left', display: 'flex', flexDirection: 'column'
        });

        // Header
        const header = document.createElement('div');
        Object.assign(header.style, { display: 'flex', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #444', paddingBottom: '8px' });

        title = document.createElement('div');
        title.innerText = t.title;
        title.style.fontWeight = 'bold';
        title.style.fontSize = '14px';
        title.style.flexGrow = '1';

        const langBtn = document.createElement('button');
        langBtn.innerText = '🌐 中/En';
        Object.assign(langBtn.style, { background: 'transparent', border: '1px solid #555', color: '#aaa', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', padding: '2px 6px', marginRight: '8px' });

        langBtn.onclick = function () {
            const oldLang = window.ccManager.lang;
            const newLang = oldLang === 'zh' ? 'en' : 'zh';
            const currentInput = prefixInput.value.trim();
            const oldDefault = LANG_DATA[oldLang].default_prompt.trim();
            if (currentInput === oldDefault) {
                prefixInput.value = LANG_DATA[newLang].default_prompt;
                flashInput(prefixInput);
            }

            window.ccManager.lang = newLang;
            updateUITexts();
        };

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        Object.assign(closeBtn.style, {
            background: 'transparent', border: 'none', color: '#888',
            cursor: 'pointer', fontSize: '18px', padding: '0 4px', lineHeight: '1'
        });
        closeBtn.onclick = closeInterface;

        header.append(title, langBtn, closeBtn);

        // Status Message
        msg = document.createElement('div');
        msg.innerText = t.status_scanning;
        Object.assign(msg.style, { fontSize: '12px', color: '#aaa', marginBottom: '12px' });

        // Prompt Input
        prefixLabel = document.createElement('div');
        prefixLabel.innerText = t.label_prefix;
        Object.assign(prefixLabel.style, { fontSize: '12px', color: '#ccc', marginBottom: '6px', fontWeight: 'bold' });

        prefixInput = document.createElement('textarea');
        prefixInput.id = 'cc-prefix-input';
        prefixInput.value = t.default_prompt;
        prefixInput.placeholder = t.placeholder;
        Object.assign(prefixInput.style, {
            width: '100%', height: '120px', background: '#333', color: '#eee',
            border: '1px solid #555', borderRadius: '6px', padding: '8px',
            marginBottom: '12px', fontFamily: 'sans-serif', fontSize: '12px',
            resize: 'vertical', boxSizing: 'border-box'
        });

        // Basic Actions Row (Download & Copy)
        const actionRow = document.createElement('div');
        Object.assign(actionRow.style, { display: 'flex', gap: '8px', marginBottom: '12px' });

        function createBtn(textKey, bg, onClick) {
            const b = document.createElement('button');
            b.innerText = t[textKey];
            b.dataset.key = textKey; // for updateUITexts
            Object.assign(b.style, {
                flex: '1', background: bg, color: '#fff', border: 'none',
                padding: '8px', borderRadius: '6px', cursor: 'pointer',
                fontSize: '12px', fontWeight: 'bold'
            });
            b.onclick = onClick;
            return b;
        }

        btnDl = createBtn('btn_dl', '#2E7D32', handleDownload);
        btnCopy = createBtn('btn_copy', '#555', handleCopyOnly);
        actionRow.append(btnDl, btnCopy);

        // Transfer Label
        transferLabel = document.createElement('div');
        transferLabel.innerText = t.label_transfer;
        Object.assign(transferLabel.style, { fontSize: '12px', color: '#ccc', marginBottom: '6px', fontWeight: 'bold' });

        // Cross-LLM Buttons Row
        transferContainer = document.createElement('div');
        Object.assign(transferContainer.style, { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px', marginBottom: '8px' });

        PLATFORMS.forEach(p => {
            const btn = document.createElement('button');
            btn.innerHTML = `${p.icon} <br/> ${p.name}`;
            btn.title = `Transfer to ${p.name}`;
            Object.assign(btn.style, {
                background: '#333', border: '1px solid #555', color: '#fff',
                padding: '6px 2px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px'
            });
            btn.onmouseover = () => btn.style.borderColor = '#1565C0';
            btn.onmouseout = () => btn.style.borderColor = '#555';
            btn.onclick = () => handleCrossTransfer(p.url);

            transferContainer.appendChild(btn);
        });

        const hr = document.createElement('hr');
        Object.assign(hr.style, { border: '0', borderTop: '1px solid #333', margin: '8px 0', width: '100%' });

        btnScan = createBtn('btn_scan', '#444', function () {
            performScan();
            this.innerText = LANG_DATA[window.ccManager.lang].btn_scan_done;
            setTimeout(() => this.innerText = LANG_DATA[window.ccManager.lang].btn_scan, 1000);
        });
        btnScan.style.border = '1px solid #666';

        panel.append(header, msg, prefixLabel, prefixInput, actionRow, transferLabel, transferContainer, hr, btnScan);
        document.body.appendChild(panel);
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
        if (btnDl) btnDl.innerText = t.btn_dl;
        if (btnCopy) btnCopy.innerText = t.btn_copy;
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
                const isSelected = this.dataset.selected === 'true';
                if (!isSelected) {
                    this.innerText = '✓';
                    this.style.background = '#4CAF50';
                    this.style.color = '#fff';
                    this.style.borderColor = '#4CAF50';
                    this.dataset.selected = 'true';
                    el.dataset.ccSelected = 'true';

                    el.style.outline = '2px solid #4CAF50';
                    el.style.outlineOffset = '-2px';
                    if (!el.dataset.originalBg) el.dataset.originalBg = el.style.backgroundColor;
                    el.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
                } else {
                    this.innerText = '➕';
                    this.style.background = '#fff';
                    this.style.color = '#333';
                    this.style.borderColor = '#999';
                    delete this.dataset.selected;
                    delete el.dataset.ccSelected;

                    el.style.outline = 'none';
                    el.style.backgroundColor = el.dataset.originalBg || '';
                }
                updateStatus();
            };

            el.appendChild(btn);
            count++;
        });

        const total = document.querySelectorAll('.cc-btn').length;
        if ((count > 0 || total > 0) && msg) {
            msg.innerText = t.msg_detected.replace('{n}', total);
        }
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
            const parent = btn.parentElement;
            const clone = parent.cloneNode(true);
            const myBtn = clone.querySelector('.cc-btn');
            if (myBtn) myBtn.remove();
            if (config.ignore) {
                clone.querySelectorAll(config.ignore).forEach(bad => bad.remove());
            }

            let textContent = clone.innerText.trim();
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

    function handleCrossTransfer(targetUrl) {
        const curLang = window.ccManager.lang;
        const t = LANG_DATA[curLang];
        const text = getSelectedText();
        if (!text) { alert(t.alert_no_selection); return; }

        navigator.clipboard.writeText(text).catch(() => { });

        try {
            chrome.storage.local.set({
                'cc_transfer_payload': {
                    text: text,
                    timestamp: Date.now(),
                    source: window.location.hostname
                }
            }, () => {
                window.open(targetUrl, '_blank');
            });
        } catch (e) {
            console.error("Storage Error:", e);
            alert("Storage access failed. Please update extension permissions.");
            window.open(targetUrl, '_blank');
        }
    }

    /* =========================================
       6. Receiver Logic (Auto-Fill)
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

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "TOGGLE_INTERFACE") {
            toggleInterface();
        }
    });

    checkAutoFill();

})();