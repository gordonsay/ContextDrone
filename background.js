chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.remove(['cc_basket', 'cc_transfer_payload'], () => {
        console.log("Context-Carry: Storage cleared on install/update.");
    });

    chrome.contextMenus.create({
        id: "cc-add-to-basket",
        title: "Add to Context Basket",
        contexts: ["selection"]
    });
});

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.remove(['cc_basket', 'cc_transfer_payload'], () => {
        console.log("Context-Carry: Privacy cleanup done. Storage cleared on startup.");
    });
});

async function ensureContentScript(tabId) {
    try {
        await chrome.tabs.sendMessage(tabId, { action: "PING" });
    } catch (err) {
        console.log("Injecting content script for tab:", tabId);
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

        addToBasketFromBackground(info.selectionText, tab);
    }
});

function addToBasketFromBackground(text, tab) {
    chrome.storage.local.get(['cc_basket'], (result) => {
        const basket = result.cc_basket || [];

        const newItem = {
            text: text.trim(),
            timestamp: Date.now(),
            source: tab.url || "External Source"
        };

        basket.push(newItem);

        chrome.storage.local.set({ 'cc_basket': basket }, () => {
            console.log("Context-Carry: Item added via Context Menu.");
            chrome.action.setBadgeText({ text: basket.length.toString() });
            chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });

            if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { action: "BASKET_UPDATED" }).catch(() => {
                });
            }
        });
    });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const targetDomains = ["chatgpt.com", "claude.ai", "gemini.google.com", "grok.com", "x.com"];
        const isTarget = targetDomains.some(domain => tab.url.includes(domain));

        if (isTarget) {
            chrome.storage.local.get(['cc_transfer_payload'], (result) => {
                if (result.cc_transfer_payload) {
                    const isFresh = (Date.now() - result.cc_transfer_payload.timestamp < 30000);

                    if (isFresh) {
                        console.log(`Context-Carry: Detected target LLM (${tab.url}) with pending payload. Injecting...`);
                        ensureContentScript(tabId);
                    }
                }
            });
        }
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GET_OLLAMA_MODELS") {
        fetch('http://localhost:11434/api/tags')
            .then(res => res.json())
            .then(data => {
                const modelNames = data.models.map(m => m.name);
                sendResponse({ success: true, models: modelNames });
            })
            .catch(err => {
                console.error("Failed to fetch Ollama models:", err);
                sendResponse({ success: false, error: err.message });
            });
        return true;
    }
});

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "cc-ai-stream") return;

    port.onMessage.addListener(async (request) => {
        const { text, config } = request;

        try {
            await handleAiRequest(text, config, port);
        } catch (error) {
            port.postMessage({ type: 'ERROR', error: error.message });
            port.disconnect();
        }
    });
});

async function handleAiRequest(text, config, port) {
    const provider = config.provider || 'openai';

    let model = (config.model || '').trim();
    const apiKey = (config.apiKey || '').trim();

    if (provider === 'gemini' && model.startsWith('gpt')) model = '';

    let url = config.endpoint ? config.endpoint.trim() : '';
    let headers = { 'Content-Type': 'application/json' };
    let body = {};

    console.log(`[Context-Carry] Provider: ${provider}, Model: ${model}, Custom URL: ${!!url}`);

    if (provider === 'gemini') {
        if (model.startsWith('models/')) model = model.replace('models/', '');
        const targetModel = model || 'gemini-2.0-flash';

        if (!url) {
            url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:streamGenerateContent`;
        }

        if (!url.includes('key=') && apiKey) {
            const separator = url.includes('?') ? '&' : '?';
            url += `${separator}key=${apiKey}`;
        }
        if (!url.includes('alt=sse')) {
            const separator = url.includes('?') ? '&' : '?';
            url += `${separator}alt=sse`;
        }

        body = { contents: [{ parts: [{ text: `Summarize:\n\n${text}` }] }] };
    }
    else if (provider === 'claude') {
        if (!url) url = 'https://api.anthropic.com/v1/messages';

        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';

        body = {
            model: model || 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            stream: true,
            messages: [{ role: "user", content: `Summarize this:\n\n${text}` }]
        };
    }
    else if (provider === 'openai') {
        if (!url) url = 'https://api.openai.com/v1/chat/completions';
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        body = {
            model: model || 'gpt-4o',
            stream: true,
            messages: [{ role: "system", content: "Summarize the content." }, { role: "user", content: text }]
        };
    }
    else if (provider === 'grok') {
        if (!url) url = 'https://api.x.ai/v1/chat/completions';
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        body = {
            model: model || 'grok-2-mini',
            stream: true,
            messages: [{ role: "system", content: "Summarize the content." }, { role: "user", content: text }]
        };
    }
    else if (provider === 'local') {
        if (!url) url = 'http://localhost:11434/api/chat';
        if (!url.endsWith('/api/chat') && !url.endsWith('/v1/chat/completions')) {
            if (url.match(/:\d+$/) || url.match(/:\d+\/$/)) {
                url = url.endsWith('/') ? url + 'api/chat' : url + '/api/chat';
            }
        }

        body = {
            model: model || 'llama3',
            stream: true,
            messages: [{ role: "system", content: "Summarize the content." }, { role: "user", content: text }]
        };
    }

    const safeUrl = apiKey ? url.replace(apiKey, 'HIDDEN_KEY') : url;
    console.log(`[Context-Carry] Fetching: ${safeUrl}`);

    let response;
    try {
        response = await fetch(url, {
            method: 'POST', headers, body: JSON.stringify(body)
        });
    } catch (netErr) {
        console.error("Context-Carry Network Error:", netErr);

        if (provider === 'local') {
            throw new Error(`Cannot connect to Local LLM (${url})。\nPlease check:\n1. Ollama/LM Studio is running?\n2. URL and port are correct?\n3. CORS is allowed?`);
        }

        throw new Error(`Network Connection Failed: ${netErr.message || 'Unknown network error'}`);
    }

    if (!response.ok) {
        let errText = `API Error: ${response.status} (${response.statusText})`;
        try {
            const errJson = await response.json();
            if (errJson.error) {
                errText += `\nMsg: ${errJson.error.message || JSON.stringify(errJson.error)}`;
            }
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

            let contentToSend = null;

            if (provider === 'gemini') {
                if (trimmed.startsWith('data: ')) {
                    const jsonStr = trimmed.slice(6);
                    if (jsonStr === '[DONE]') continue;
                    try {
                        const data = JSON.parse(jsonStr);
                        contentToSend = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    } catch (e) {
                        console.warn('JSON Parse Warning (Gemini):', e);
                    }
                }
            } else if (provider === 'claude') {
                if (trimmed.startsWith('data: ')) {
                    const jsonStr = trimmed.slice(6);
                    try {
                        const data = JSON.parse(jsonStr);
                        if (data.type === 'content_block_delta' && data.delta?.text) {
                            contentToSend = data.delta.text;
                        }
                    } catch (e) { }
                }
            } else if (provider === 'local') {
                let jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
                try {
                    const data = JSON.parse(jsonStr);
                    if (data.done) continue;
                    if (data.message?.content) contentToSend = data.message.content;
                    else if (data.choices?.[0]?.delta?.content) contentToSend = data.choices[0].delta.content;
                } catch (e) { }
            } else {
                if (trimmed.startsWith('data: ')) {
                    const jsonStr = trimmed.slice(6);
                    if (jsonStr === '[DONE]') break;
                    try {
                        const data = JSON.parse(jsonStr);
                        contentToSend = data.choices?.[0]?.delta?.content;
                    } catch (e) { }
                }
            }

            if (contentToSend) {
                port.postMessage({ type: 'TEXT', text: contentToSend });
            }
        }
    }

    port.postMessage({ type: 'DONE' });
    port.disconnect();
}