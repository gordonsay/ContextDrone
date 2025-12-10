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

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "cc-add-to-basket" && info.selectionText) {
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

chrome.action.onClicked.addListener(async (tab) => {
    const url = tab.url || "";
    const isSupported = url.includes("chatgpt.com") ||
        url.includes("gemini.google.com") ||
        url.includes("claude.ai") ||
        url.includes("grok.com") ||
        url.includes("x.com");

    if (isSupported) {
        try {
            await chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_INTERFACE" });
            console.log("Toggle signal sent.");
        } catch (err) {
            console.log("First time click, injecting content script...");
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["content.js"]
            });
        }

    } else {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => alert("Context Carry supports：\n ChatGPT\n Gemini\n Claude\n Grok (X)")
        });
    }
});


chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.remove(['cc_basket', 'cc_transfer_payload'], () => {
        console.log("Context-Carry: Privacy cleanup done. Storage cleared on startup.");
    });
});