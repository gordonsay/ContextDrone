/* ============================================================================
   1. CONFIGURATION & UTILITIES
   ============================================================================ */

const BG_MESSAGES = {
    'en': {
        local_err: "Cannot connect to Local LLM ({url}).\nPlease check:\n1. Is Ollama/LM Studio running?\n2. Are the URL and port correct?\n3. Is CORS allowed?",
        net_err: "Network Connection Failed: {msg}"
    },
    'zh': {
        local_err: "無法連線至本地 LLM ({url})。\n請檢查：\n1. Ollama/LM Studio 是否正在執行？\n2. URL 和連接埠是否正確？\n3. 是否已允許跨域資源共享 (CORS)？",
        net_err: "網路連線失敗：{msg}"
    }
};

const RELEASE_NOTES_URL = "https://doglab24.org";
const UPDATE_NOTES_URL = "https://doglab24.org/whatsnew";

/* ============================================================================
   2. MUTEX QUEUE & CENTRALIZED BASKET LOGIC (Data Consistency Layer)
   ============================================================================ */

class MutexQueue {
    constructor() {
        this.queue = [];
        this.locked = false;
    }

    enqueue(asyncTask) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task: asyncTask, resolve, reject });
            this._process();
        });
    }

    async _process() {
        if (this.locked || this.queue.length === 0) return;
        this.locked = true;
        const { task, resolve, reject } = this.queue.shift();
        try {
            resolve(await task());
        } catch (err) {
            reject(err);
        } finally {
            this.locked = false;
            this._process();
        }
    }
}

const basketQueue = new MutexQueue();

function makeId() {
    try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch (_) { }
    return `cc_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function broadcastBasketUpdated() {
    try {
        const tabs = await chrome.tabs.query({});
        for (const t of tabs) {
            if (!t.id) continue;
            chrome.tabs.sendMessage(t.id, { action: "BASKET_UPDATED" }).catch(() => { });
        }
    } catch (_) { }
}

async function handleBasketOperation(operation) {
    return basketQueue.enqueue(async () => {
        const result = await chrome.storage.local.get(['cc_basket', 'cc_basket_rev']);
        let basket = Array.isArray(result.cc_basket) ? result.cc_basket : [];
        let rev = Number.isFinite(result.cc_basket_rev) ? result.cc_basket_rev : 0;
        const now = Date.now();

        let migrated = false;
        basket = basket.map((it) => {
            if (it && typeof it === 'object' && !it.id) {
                migrated = true;
                return { ...it, id: makeId() };
            }
            return it;
        });

        switch (operation?.kind) {
            case 'ADD': {
                const item = operation.item || {};
                const newItem = {
                    id: item.id || makeId(),
                    text: (item.text || '').toString().trim(),
                    timestamp: item.timestamp || now,
                    source: item.source || item.url || 'External Source',
                    url: item.url || '',
                    ...item
                };
                basket.push(newItem);
                rev += 1;
                break;
            }
            case 'UPDATE': {
                const id = operation.id;
                if (!id) break;
                const idx = basket.findIndex(it => it.id === id);
                if (idx >= 0) {
                    const next = { ...basket[idx], ...operation.patch };
                    if (typeof next.text === 'string') next.text = next.text.trim();
                    basket[idx] = next;
                    rev += 1;
                }
                break;
            }
            case 'DELETE': {
                const id = operation.id;
                if (!id) break;
                basket = basket.filter(it => it.id !== id);
                rev += 1;
                break;
            }
            case 'REORDER': {
                const order = Array.isArray(operation.order) ? operation.order : [];
                if (order.length) {
                    const byId = new Map(basket.map(it => [it.id, it]));
                    const reordered = [];
                    const used = new Set();

                    for (const id of order) {
                        const it = byId.get(id);
                        if (it) { reordered.push(it); used.add(id); }
                    }
                    for (const it of basket) {
                        if (it.id && !used.has(it.id)) reordered.push(it);
                    }
                    basket = reordered;
                    rev += 1;
                }
                break;
            }
            case 'CLEAR': {
                basket = [];
                rev += 1;
                break;
            }
            default:
                if (migrated) rev += 1;
                break;
        }

        await chrome.storage.local.set({ cc_basket: basket, cc_basket_rev: rev });

        const hasItems = basket.length > 0;
        chrome.action.setBadgeText({ text: hasItems ? String(basket.length) : "" });
        chrome.action.setBadgeBackgroundColor({ color: hasItems ? "#4CAF50" : "#666666" });

        broadcastBasketUpdated();

        return { success: true, rev, basket };
    });
}

/* ============================================================================
   3. EVENT LISTENERS & UI INTERACTIONS
   ============================================================================ */

function getAppLanguage() {
    const uiLang = chrome.i18n.getUILanguage();

    if (uiLang.startsWith('zh')) {
        return (uiLang.includes('TW') || uiLang.includes('HK')) ? 'zh-TW' : 'zh-CN';
    }
    if (uiLang.startsWith('ja')) return 'ja';
    if (uiLang.startsWith('ko')) return 'ko';

    return 'en';
}

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.local.set({
            'cc_basket': [],
            'cc_basket_rev': 0,
            'cc_transfer_payload': null
        });
    }

    chrome.contextMenus.create({
        id: "cc-add-to-basket",
        title: "Add to Context Basket",
        contexts: ["selection"]
    });

    const targetLang = getAppLanguage();

    if (details.reason === 'install') {
        chrome.tabs.create({
            url: `${RELEASE_NOTES_URL}?lang=${targetLang}`
        });
    }
    else if (details.reason === 'update') {
        const currentVersion = chrome.runtime.getManifest().version;
        if (currentVersion !== details.previousVersion) {
            chrome.tabs.create({
                url: `${UPDATE_NOTES_URL}?v=${currentVersion}&lang=${targetLang}`
            });
            chrome.action.setBadgeText({ text: 'NEW' });
            chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
        }
    }
});

async function ensureContentScript(tabId) {
    try {
        await chrome.tabs.sendMessage(tabId, { action: "PING" });
    } catch (err) {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["content.js"]
        });
    }
}

chrome.action.onClicked.addListener(async (tab) => {
    const url = tab.url || "";
    if (url.startsWith("chrome://") || url.startsWith("edge://") || url.startsWith("about:") || url.startsWith("chromewebstore")) {
        return;
    }

    try {
        await ensureContentScript(tab.id);
        chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_INTERFACE" });
    } catch (e) {
        console.error("Failed to inject or toggle:", e);
    }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "cc-add-to-basket" && info.selectionText) {
        if (tab && tab.id && !tab.url.startsWith("chrome://")) {
            try { await ensureContentScript(tab.id); } catch (e) { }
        }

        const newItem = {
            id: makeId(),
            text: info.selectionText.trim(),
            source: tab.title || tab.url || "External Source",
            url: tab.url || ""
        };

        handleBasketOperation({ kind: 'ADD', item: newItem })
            .then(() => console.log("Context-Carry: Item added via Context Menu."))
            .catch(err => console.error("Context-Carry: Add failed:", err));
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const targetDomains = ["chatgpt.com", "claude.ai", "gemini.google.com", "grok.com", "x.com"];
        const isTarget = targetDomains.some(domain => tab.url.includes(domain));

        if (isTarget) {
            chrome.storage.local.get(['cc_transfer_payload'], (result) => {
                if (result.cc_transfer_payload) {
                    const isFresh = (Date.now() - result.cc_transfer_payload.timestamp < 30000);
                    if (isFresh) {
                        ensureContentScript(tabId);
                    }
                }
            });
        }
    }
});

/* ============================================================================
   4. LOCAL MODEL FETCHING
   ============================================================================ */

const LOCAL_PROVIDERS = {
    'ollama': {
        defaultBase: 'http://localhost:11434',
        checkPath: '/api/tags',
        parser: (json) => json.models ? json.models.map(m => m.name) : []
    },
    'lm-studio': {
        defaultBase: 'http://localhost:1234',
        checkPath: '/v1/models',
        parser: (json) => json.data ? json.data.map(m => m.id) : []
    }
};

const fetchLocalModels = async (provider, customEndpoint) => {
    const config = LOCAL_PROVIDERS[provider];
    if (!config) throw new Error("Unknown provider");

    let baseUrl = customEndpoint && customEndpoint.trim() ? customEndpoint.trim() : config.defaultBase;

    baseUrl = baseUrl.replace(/\/v1\/chat\/completions\/?$/, '').replace(/\/api\/chat\/?$/, '').replace(/\/+$/, '');

    let targetUrl = baseUrl;
    if (!targetUrl.endsWith(config.checkPath)) {
        targetUrl = `${baseUrl}${config.checkPath}`;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const res = await fetch(targetUrl, { method: 'GET', signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

        const data = await res.json();
        const models = config.parser(data);

        return {
            success: true,
            models: models,
            activeEndpoint: baseUrl,
            provider: provider
        };
    } catch (err) {
        console.error(`[Background] Fetch Error:`, err);
        throw new Error(`Connection to ${provider} failed at ${targetUrl}: ${err.message}`);
    }
};

/* ============================================================================
   5. MESSAGE HANDLING
   ============================================================================ */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "BASKET_OP") {
        handleBasketOperation(request.op)
            .then(res => sendResponse(res))
            .catch(err => sendResponse({ success: false, error: err.message || String(err) }));
        return true;
    }

    if (request.action === "GET_LOCAL_MODELS" || request.action === "GET_OLLAMA_MODELS") {
        const provider = request.provider || 'ollama';
        fetchLocalModels(provider, request.endpoint)
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (request.action === "CLEAR_BADGE") {
        chrome.action.setBadgeText({ text: '' });
        return false;
    }
});

/* ============================================================================
   6. AI STREAMING LOGIC
   ============================================================================ */

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "cc-ai-stream") return;

    port.onMessage.addListener(async (request) => {
        if (request.type === 'PING') return;

        const { text, config, lang } = request;
        try {
            await handleAiRequest(text, config, lang || 'en', port);
        } catch (error) {
            port.postMessage({ type: 'ERROR', error: error.message });
            port.disconnect();
        }
    });
});

function parseOpenAiChunk(line) {
    if (!line.startsWith('data: ')) return null;
    const jsonStr = line.slice(6).trim();
    if (jsonStr === '[DONE]') return null;
    try {
        const data = JSON.parse(jsonStr);
        return data.choices?.[0]?.delta?.content || null;
    } catch (e) { return null; }
}

function parseGeminiChunk(line) {
    if (!line.startsWith('data: ')) return null;
    const jsonStr = line.slice(6).trim();
    if (jsonStr === '[DONE]') return null;
    try {
        const data = JSON.parse(jsonStr);
        const candidate = data.candidates?.[0];
        if (candidate) {
            const text = candidate.content?.parts?.[0]?.text;
            if (text) return text;
            if (candidate.finishReason === 'SAFETY') return "\n\n[⚠️ Gemini Warning: Response blocked by Safety Filters.]\n";
            if (candidate.finishReason === 'RECITATION') return "\n\n[⚠️ Gemini Warning: Response blocked due to recitation/copyright.]\n";
        }
        return null;
    } catch (e) { return null; }
}

function parseClaudeChunk(line) {
    if (!line.startsWith('data: ')) return null;
    const jsonStr = line.slice(6).trim();
    try {
        const data = JSON.parse(jsonStr);
        if (data.type === 'content_block_delta' && data.delta?.text) {
            return data.delta.text;
        }
    } catch (e) { }
    return null;
}

function parseLocalChunk(line) {
    let jsonStr = line.startsWith('data: ') ? line.slice(6).trim() : line.trim();
    try {
        const data = JSON.parse(jsonStr);
        if (data.done) return null;
        if (data.message?.content) return data.message.content;
        if (data.choices?.[0]?.delta?.content) return data.choices[0].delta.content;
    } catch (e) { }
    return null;
}

function buildRequestParams(provider, model, apiKey, endpoint, text) {
    let url = endpoint ? endpoint.trim() : '';
    let headers = { 'Content-Type': 'application/json' };
    let body = {};
    const targetModel = (model || '').trim();
    const targetApiKey = apiKey;

    if (provider === 'gemini' && targetModel.startsWith('gpt')) model = '';

    if (provider === 'gemini') {
        let finalModel = targetModel;
        if (finalModel.startsWith('models/')) finalModel = finalModel.replace('models/', '');
        const defaultModel = finalModel || 'gemini-2.5-flash';

        if (!url) {
            url = `https://generativelanguage.googleapis.com/v1beta/models/${defaultModel}:streamGenerateContent`;
        }

        let urlObj;
        try {
            urlObj = new URL(url);
            if (targetApiKey && !urlObj.searchParams.has('key')) urlObj.searchParams.set('key', targetApiKey);
            if (!urlObj.searchParams.has('alt')) urlObj.searchParams.set('alt', 'sse');
            else if (urlObj.searchParams.get('alt') !== 'sse') urlObj.searchParams.set('alt', 'sse');
            url = urlObj.toString();
        } catch (e) {
            throw new Error(`Invalid Gemini API URL format: ${e.message}`);
        }
        body = { contents: [{ parts: [{ text: text }] }] };
    }
    else if (provider === 'claude') {
        if (!url) url = 'https://api.anthropic.com/v1/messages';
        headers['x-api-key'] = targetApiKey;
        headers['anthropic-version'] = '2023-06-01';
        body = {
            model: targetModel,
            max_tokens: 1024,
            stream: true,
            messages: [{ role: "user", content: text }]
        };
    }
    else if (provider === 'openai') {
        if (!url) url = 'https://api.openai.com/v1/chat/completions';
        if (targetApiKey) headers['Authorization'] = `Bearer ${targetApiKey}`;
        body = {
            model: targetModel,
            stream: true,
            messages: [{ role: "user", content: text }]
        };
    }
    else if (provider === 'grok') {
        if (!url) url = 'https://api.x.ai/v1/chat/completions';
        if (targetApiKey) headers['Authorization'] = `Bearer ${targetApiKey}`;
        body = {
            model: targetModel,
            stream: true,
            messages: [{ role: "user", content: text }]
        };
    }
    else if (['local', 'ollama', 'lm_studio', 'lm-studio'].includes(provider)) {
        if (!url) {
            if (provider.includes('lm-studio') || provider.includes('lm_studio')) url = 'http://localhost:1234/v1/chat/completions';
            else url = 'http://localhost:11434/v1/chat/completions';
        } else {
            try {
                if (!url.startsWith('http')) url = 'http://' + url;
                const urlObj = new URL(url);
                if (urlObj.pathname === '/' || urlObj.pathname === '') urlObj.pathname = '/v1/chat/completions';
                else if (urlObj.pathname === '/api/chat') urlObj.pathname = '/v1/chat/completions';
                url = urlObj.toString();
            } catch (e) { }
        }

        let requestModel = targetModel;
        if (!requestModel && (provider.includes('lm-studio') || provider.includes('lm_studio'))) {
            requestModel = "local-model";
        }
        body = {
            model: requestModel,
            stream: true,
            messages: [{ role: "user", content: text }]
        };
    }

    return { url, headers, body };
}

async function handleAiRequest(text, config, lang, port) {
    let apiUrl = config.endpoint || '';
    let provider = config.provider || 'openai';
    const originalProvider = provider;

    if (['lm_studio', 'lm-studio', 'ollama'].includes(provider)) {
        provider = 'local';
    }

    const safeApiKey = config.apiKey || '';
    if (!safeApiKey && provider !== 'local') {
        throw new Error("API Key is missing for non-local provider.");
    }

    if (apiUrl && apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);

    let { url, headers, body } = buildRequestParams(
        originalProvider, config.model, safeApiKey, apiUrl, text
    );

    const isOpenAIFormat = provider === 'local' && (
        originalProvider === 'ollama' ||
        originalProvider.includes('lm') ||
        url.includes('/v1/') ||
        url.includes('chat/completions')
    );

    if (isOpenAIFormat && body && !body.model) body.model = "llama3";

    const parserMap = {
        'openai': parseOpenAiChunk,
        'grok': parseOpenAiChunk,
        'claude': parseClaudeChunk,
        'gemini': parseGeminiChunk,
        'local': parseLocalChunk,
    };

    let parser = isOpenAIFormat ? parseOpenAiChunk : parserMap[provider];
    if (!parser) throw new Error(`Unsupported AI provider: ${provider}`);

    const safeUrl = safeApiKey ? url.replace(safeApiKey, 'HIDDEN_KEY') : url;


    let response;
    try {
        response = await fetch(url, {
            method: 'POST', headers, body: JSON.stringify(body)
        });
    } catch (netErr) {
        console.error("Context-Carry Network Error:", netErr);
        const t = BG_MESSAGES[lang] || BG_MESSAGES['en'];
        if (provider === 'local') throw new Error(t.local_err.replace('{url}', url));
        throw new Error(t.net_err.replace('{msg}', netErr.message || 'Unknown network error'));
    }

    if (!response.ok) {
        let errText = `API Error: ${response.status} (${response.statusText})`;
        try {
            const errJson = await response.json();
            if (errJson.error) errText += `\nMsg: ${errJson.error.message || JSON.stringify(errJson.error)}`;
        } catch (e) { }
        throw new Error(errText);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            let contentToSend = parser(trimmed);
            if (contentToSend) {
                port.postMessage({ type: 'TEXT', text: contentToSend });
            }
        }
    }

    port.postMessage({ type: 'DONE' });
    port.disconnect();
}