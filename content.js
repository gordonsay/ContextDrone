(async function () {
    /* =========================================
       0. Global State Management & Guard
    ========================================= */
    const IS_STORE_BUILD = true;

    if (window._cc_is_injected) return;
    window._cc_is_injected = true;

    const navLang = (navigator.language || 'en').toLowerCase();
    let userLang = 'en';
    if (navLang.startsWith('zh-cn') || navLang.startsWith('zh-sg')) {
        userLang = 'zh-CN';
    } else if (navLang.startsWith('zh')) {
        userLang = 'zh-TW';
    } else if (navLang.startsWith('ja')) {
        userLang = 'ja';
    } else if (navLang.startsWith('ko')) {
        userLang = 'ko';
    }

    const timestamp = new Date().getTime();
    const LLM_CONFIG_URL = `https://gist.githubusercontent.com/gordonsay/aaf67705332b0e6d522424fbbf1f5ce4/raw/llm_config.json`;

    async function getRuntimeConfig() {
        const localConfig = window.CC_CONFIG || { PLATFORMS: [], APP_CONFIG: {}, MODEL_PRESETS: {}, API_ENDPOINTS: {} };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(LLM_CONFIG_URL, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const remoteData = await response.json();
            console.log('[ContextDrone] Remote config loaded:', remoteData.version);

            return {
                ...localConfig,
                APP_CONFIG: remoteData.APP_CONFIG || localConfig.APP_CONFIG,
                MODEL_PRESETS: remoteData.MODEL_PRESETS || localConfig.MODEL_PRESETS,
                PLATFORMS: remoteData.PLATFORMS || localConfig.PLATFORMS,
                API_ENDPOINTS: remoteData.API_ENDPOINTS || localConfig.API_ENDPOINTS || {}
            };

        } catch (error) {
            console.warn('[ContextDrone] Remote config fetch failed, using local backup.', error);
            return localConfig;
        }
    }

    const CONFIG = await getRuntimeConfig();
    const { PLATFORMS, APP_CONFIG, MODEL_PRESETS, API_ENDPOINTS } = CONFIG;

    const state = {
        active: false,
        uiMode: 'standard',
        interval: null,
        lang: userLang,
        langData: (typeof CC_LANG_DATA !== 'undefined') ? CC_LANG_DATA : {},
        config: null,
        lastCheckedIndex: null,
        isPreviewOpen: false,
        aiConfig: null,
        lastAiContext: "",
        unreadAi: false,
        lastAiText: "",
        lastAiConfig: null,
        allAiConfigs: [],
        hasShownQuadWarning: false,
        multiPanelConfigs: [],
        isUnlocked: false,
        aiLayoutMode: 'single',
        activeContextPanelIndex: 0,
        aiModalTab: 'response',
        theme: 'dark',
        basketListeners: new Set(),
        viewMode: 'basket',
        activeFolderId: 'inbox',
        includeSource: true,
        basketSelectionState: {},
        contentPanelTab: 'basket'
    };

    let basket = [];
    let draggedItem = null;
    state.workflowConnections = [];
    let updateHoverCardUI = () => { };

    const pinManager = {
        pins: [],
        overlay: null,
        onChange: null,
        _onChangeCallbacks: [],

        registerOnChange(callback) {
            if (callback && typeof callback === 'function') {
                this._onChangeCallbacks = this._onChangeCallbacks.filter(cb => cb !== callback);
                this._onChangeCallbacks.push(callback);
            }
        },

        _notifyChange() {
            if (this.onChange) this.onChange();
            this._onChangeCallbacks.forEach(cb => {
                try { cb(); } catch (e) { console.warn('[pinManager] callback error:', e); }
            });
        },

        init() {
            if (this.overlay) return;
            this.overlay = document.createElement('div');
            this.overlay.id = 'cc-pin-overlay';
            Object.assign(this.overlay.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                zIndex: '2147483650', pointerEvents: 'none', overflow: 'hidden'
            });
            document.body.appendChild(this.overlay);
            this.startSync();
        },

        addPin(targetEl, offsetX = 0, offsetY = 0) {
            attemptFeatureUsage('pin', () => {
                this.init();

                let text = (targetEl.innerText || "").substring(0, 30).replace(/[\n\r]/g, '');
                if (!text) text = "Location " + (this.pins.length + 1);
                else text += "...";

                const pin = document.createElement('div');
                pin.className = 'cc-chat-pin-marker';
                pin.innerHTML = '📌';
                pin.title = "Click to remove";
                pin.style.pointerEvents = 'auto';
                pin.style.position = 'absolute';
                pin.style.cursor = 'pointer';
                pin.style.filter = 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))';

                const id = Date.now() + Math.random();

                pin.onclick = (e) => {
                    e.stopPropagation();
                    this.removePin(id);
                };

                this.overlay.appendChild(pin);

                this.pins.push({ id, pinEl: pin, targetEl, text, offsetX, offsetY });

                this.updatePositions();
                this._notifyChange();
            }, this.pins.length);
        },

        removePin(id) {
            const index = this.pins.findIndex(p => p.id === id);
            if (index !== -1) {
                const { pinEl } = this.pins[index];
                pinEl.style.transform = 'scale(0)';
                setTimeout(() => pinEl.remove(), 200);
                this.pins.splice(index, 1);

                this._notifyChange();
            }
        },

        scrollToPin(id) {
            const pinObj = this.pins.find(p => p.id === id);
            if (pinObj && pinObj.targetEl) {
                pinObj.targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

                const originalTrans = pinObj.targetEl.style.transition;
                const originalBg = pinObj.targetEl.style.backgroundColor;

                pinObj.targetEl.style.transition = "background-color 0.5s";
                pinObj.targetEl.style.backgroundColor = "rgba(255, 152, 0, 0.3)";

                setTimeout(() => {
                    pinObj.targetEl.style.backgroundColor = originalBg;
                    setTimeout(() => {
                        pinObj.targetEl.style.transition = originalTrans;
                    }, 500);
                }, 1000);
            }
        },

        updatePositions() {
            let changed = false;
            this.pins = this.pins.filter(p => {
                if (!document.body.contains(p.targetEl)) {
                    p.pinEl.remove();
                    changed = true;
                    return false;
                }
                return true;
            });

            if (changed) this._notifyChange();

            this.pins.forEach(p => {
                const rect = p.targetEl.getBoundingClientRect();
                if (rect.width === 0 && rect.height === 0) {
                    p.pinEl.style.display = 'none';
                    return;
                }
                p.pinEl.style.display = 'block';

                const relX = p.offsetX || -10;
                const relY = p.offsetY || -25;

                const pinTop = rect.top + relY;
                const pinLeft = rect.left + relX;

                p.pinEl.style.top = `${pinTop}px`;
                p.pinEl.style.left = `${pinLeft}px`;
            });
        },

        startSync() {
            const loop = () => {
                if (this.pins.length > 0) this.updatePositions();
                requestAnimationFrame(loop);
            };
            loop();
        }
    };

    function shouldShowAI() {
        if (!IS_STORE_BUILD) return true;
        if (state && state.isUnlocked) return true;
        return state.allAiConfigs &&
            state.allAiConfigs.length > 0 &&
            state.allAiConfigs.some(c => c.configured);
    }

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag])
        );
    }

    function syncPiPIfOpen() {
        if (!state.pipWindow || state.pipWindow.closed) return;

        try {
            if (typeof renderPiPList === 'function') {
                renderPiPList(state.pipWindow);
            }
            const mb = state.pipWindow.document.getElementById('mini-basket');
            if (mb && mb.classList.contains('open')) {
                if (typeof renderMiniBasket === 'function') {
                    renderMiniBasket(state.pipWindow);
                }
            }

            if (typeof updatePiPUITexts === 'function') {
                updatePiPUITexts(state.pipWindow);
            }
        } catch (e) {
            console.warn('[cc] syncPiPIfOpen failed:', e);
        }
    }

    function updateBasketItemPatch(id, patch, done) {
        if (!id) return;
        basketOp({
            kind: 'UPDATE',
            id,
            patch: { ...patch, timestamp: Date.now() }
        }, () => {
            updateBasketUI();
            calculateTotalTokens();
            syncPiPIfOpen();
            if (typeof done === 'function') done();
        });
    }

    function updateBasketItemText(id, newText, done) {
        return updateBasketItemPatch(id, { text: newText }, done);
    }

    function failDownstream(sourceId, reason, isPiP = false) {
        const sid = parseInt(sourceId);

        const outgoing = state.workflowConnections.filter(c => parseInt(c.from) === sid);

        outgoing.forEach(conn => {
            const childId = parseInt(conn.to);
            const childNode = state.multiPanelConfigs.find(p => p.id === childId);

            if (childNode && !childNode.hasUpstreamError) {
                childNode.isFinished = true;
                childNode.hasUpstreamError = true;

                const errorMsg = `[System] Canceled: Upstream node #${String(sid).slice(-3)} failed/stopped.`;
                childNode.responseText = (childNode.responseText || "") + "\n" + errorMsg;

                const panelEl = document.getElementById(`panel-${childId}`);
                if (panelEl) {
                    const statusTag = panelEl.querySelector('.cc-status-tag');
                    const outArea = panelEl.querySelector('.output-area');

                    if (panelEl) {
                        panelEl.classList.remove('active');
                        panelEl.classList.remove('processing');
                    }

                    if (statusTag) {
                        statusTag.innerText = "Canceled";
                        statusTag.style.color = "#ff9800";
                    }
                    if (outArea) {
                        outArea.innerText = childNode.responseText;
                        outArea.scrollTop = outArea.scrollHeight;
                    }
                }

                if (isPiP && state.pipWindow && state.pipWindow.document) {
                    const pipNode = state.pipWindow.document.getElementById(`pip-node-${childId}`);
                    if (pipNode) {
                        const statusTxt = pipNode.querySelector('.node-status');
                        const outArea = pipNode.querySelector('.node-output');

                        if (statusTxt) {
                            statusTxt.innerText = "CANCELED";
                            statusTxt.className = "node-status busy";
                            statusTxt.style.color = "#ff9800";
                        }
                        if (outArea) {
                            outArea.value = childNode.responseText;
                        }
                    }
                }

                failDownstream(childId, reason, isPiP);
            }
        });
    }


    /* =========================================
       0-1. Usage Limits & Tiers
    ========================================= */
    const GROWTH_CONFIG = {
        LIMITS: {
            qrcode: { tier1: 5, tier2: 15 },
            pin: { tier1: 5, tier2: 12 },
            context: { tier1: 10, tier2: 40 },
            workflow: { tier1: 10, tier2: 80 }
        },
        BONUS: {
            qrcode: 10,
            pin: 8,
            workflow: 100,
            context: 20
        },
        TOAST_THROTTLE_MS: 60 * 1000
    };

    async function getGrowthStats() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['cc_growth_stats_v2'], (result) => {
                const defaultStats = {
                    counts: { qrcode: 0, pin: 0, context: 0, workflow: 0 },
                    unlocked: { qrcode: false, pin: false, context: false, workflow: false },
                    bonusGranted: { qrcode: false, pin: false, context: false, workflow: false },
                    tier2Pref: { qrcode: null, pin: null, context: null, workflow: null },
                    lastLimitToastAt: { qrcode: 0, pin: 0, context: 0, workflow: 0 }
                };
                resolve(result.cc_growth_stats_v2 || defaultStats);
            });
        });
    }

    function saveGrowthStats(stats) {
        chrome.storage.local.set({ 'cc_growth_stats_v2': stats });
    }

    function shouldThrottleLimitToast(stats, feature) {
        const last = (stats.lastLimitToastAt && stats.lastLimitToastAt[feature]) || 0;
        return (Date.now() - last) < GROWTH_CONFIG.TOAST_THROTTLE_MS;
    }

    function markLimitToast(stats, feature) {
        if (!stats.lastLimitToastAt) stats.lastLimitToastAt = {};
        stats.lastLimitToastAt[feature] = Date.now();
        saveGrowthStats(stats);
    }

    function getEffectiveTier2Limit(stats, feature, baseTier2) {
        const bonus = (stats.bonusGranted && stats.bonusGranted[feature]) ? (GROWTH_CONFIG.BONUS[feature] || 0) : 0;
        return baseTier2 + bonus;
    }

    function notifySuperHeavyUser(feature, stats) {
        const payload = {
            event: 'beta_superheavy_user_limit_hit',
            feature,
            tier2_pref: (stats.tier2Pref && stats.tier2Pref[feature]) || null,
            timestamp: Date.now(),
            lang: (typeof state !== 'undefined' && state.lang) ? state.lang : 'en'
        };

        fetch('https://qrcode.doglab24.org/api/feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-secret-token': 'dogegg-qrcode-generator'
            },
            body: JSON.stringify(payload)
        }).catch(() => { });
    }

    async function attemptFeatureUsage(feature, onSuccess, currentCapacity = null) {
        const t = LANG_DATA[state.lang] || LANG_DATA['en'];

        const stats = await getGrowthStats();
        const limits = GROWTH_CONFIG.LIMITS[feature];
        const isCapacityMode = (currentCapacity !== null);

        const valueToCheck = isCapacityMode
            ? currentCapacity
            : (stats.counts[feature] || 0);

        const isUnlocked = !!(stats.unlocked && stats.unlocked[feature]);
        const baseTier2 = limits.tier2;
        const effectiveTier2 = getEffectiveTier2Limit(stats, feature, baseTier2);
        const hasBonus = !!(stats.bonusGranted && stats.bonusGranted[feature]);

        if (valueToCheck >= baseTier2 && !hasBonus) {
            showGrowthTier2BetaModal(feature, (payload) => {
                if (!stats.bonusGranted) stats.bonusGranted = {};
                stats.bonusGranted[feature] = true;

                if (!stats.tier2Pref) stats.tier2Pref = {};
                stats.tier2Pref[feature] = payload.topFeature || null;

                if (!isCapacityMode) {
                    stats.counts[feature] = (stats.counts[feature] || 0) + 1;
                }

                saveGrowthStats(stats);
                showToast(t.gl_tier2_bonus_granted || `Thanks! Bonus unlocked for ${feature}. 🎉`);

                onSuccess(stats, 3);
            });
            return;
        }

        if (valueToCheck >= effectiveTier2) {
            notifySuperHeavyUser(feature, stats);

            if (!shouldThrottleLimitToast(stats, feature)) {
                showToast(t.gl_limit_thanks || `Reached beta limit ${feature}. Thanks 🙏`);
                markLimitToast(stats, feature);
            }
            return;
        }

        if (valueToCheck >= limits.tier1 && !isUnlocked) {
            showGrowthFeedbackModal(feature, () => {
                if (!stats.unlocked) stats.unlocked = {};
                stats.unlocked[feature] = true;

                if (!isCapacityMode) {
                    stats.counts[feature] = (stats.counts[feature] || 0) + 1;
                }

                saveGrowthStats(stats);
                showToast(t.gl_tier_unlocked);

                onSuccess(stats, 2);
            });
            return;
        }

        if (!isCapacityMode) {
            stats.counts[feature] = (stats.counts[feature] || 0) + 1;
            saveGrowthStats(stats);
        }

        const currentTier = (valueToCheck >= limits.tier1) ? 2 : 1;
        onSuccess(stats, currentTier);
    }

    function showGrowthTier2BetaModal(featureName, onSubmit) {
        const t = LANG_DATA[state.lang] || LANG_DATA['en'];

        const overlay = document.createElement('div');
        overlay.id = 'cc-growth-overlay-tier2';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.6); z-index: 2147483661;
            backdrop-filter: blur(3px);
            display: flex; justify-content: center; align-items: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: #fff; width: 440px; max-height: 90vh; overflow-y: auto;
            padding: 22px; border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3); color: #333; text-align: left;
        `;

        const options = t.gl_tier2_options || [
            { key: 'export', label: '資料匯出' },
            { key: 'collect', label: '資料收集' },
            { key: 'workflow', label: '節點工作流模式' },
            { key: 'pin_jump', label: 'pin針跳轉功能' },
            { key: 'notes', label: '轉移到筆記軟體' },
            { key: 'sync', label: '跨裝置同步共享內容' }
        ];

        modal.innerHTML = `
            <style>
            .cc-form-group { margin-bottom: 14px; }
            .cc-label-title { font-size: 13px; font-weight: 700; display:block; margin-bottom: 8px; color:#444; }
            .cc-input { width:100%; padding:10px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box; font-size:13px; }
            .cc-input:focus { border-color:#00d2ff; outline:none; }
            .cc-radio-item { display:flex; align-items:center; gap:8px; margin-bottom:8px; font-size:13px; cursor:pointer; color:#555; }
            .cc-radio-item input { accent-color:#00d2ff; }
            .cc-hint { font-size: 12px; color:#777; line-height:1.4; }
            .cc-error { border:1px solid #ff3b30 !important; }
            .cc-btn { padding:10px 18px; border:none; border-radius:6px; cursor:pointer; font-weight:700; font-size:13px; }
            .cc-btn-primary { background: linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%); color:#fff; }
            .cc-btn-ghost { background:none; color:#888; }
            </style>

            <h3 style="margin:0 0 8px 0;">${t.gl_tier2_title || '你已達 Beta 上限'}</h3>
            <p class="cc-hint" style="margin:0 0 14px 0;">
            ${t.gl_tier2_msg || `目前是 Beta 測試版，${featureName} 暫時有使用上限。填 30 秒問卷，我們會破例給你一次性加量。`}
            </p>

            <div class="cc-form-group">
            <label class="cc-label-title">${t.gl_tier2_email || 'Email（必填）'} <span style="color:red">*</span></label>
            <input id="t2-email" type="email" class="cc-input" placeholder="${t.gl_ph_email || 'name@example.com'}">
            <div class="cc-hint" style="margin-top:6px;">${t.gl_tier2_email_hint || '僅用於 Beta 通知與上限調整。'}</div>
            </div>

            <div class="cc-form-group" id="t2-pref-group">
            <label class="cc-label-title">${t.gl_tier2_fav || '你最期待我們先做哪個功能？（必選）'} <span style="color:red">*</span></label>
            ${options.map(o => `
                <label class="cc-radio-item">
                <input type="radio" name="t2-pref" value="${o.key}">
                <span>${o.label}</span>
                </label>
            `).join('')}
            </div>

            <div class="cc-form-group">
            <label class="cc-label-title">${t.gl_tier2_reason || '原因（可不填）'}</label>
            <textarea id="t2-reason" rows="2" class="cc-input" placeholder="${t.gl_tier2_reason_ph || '例如：我想把摘要直接匯出到 Obsidian 做專案筆記…'}"></textarea>
            </div>

            <div class="cc-form-group">
            <label class="cc-label-title">${t.gl_tier2_other || '其他意見（可不填）'}</label>
            <textarea id="t2-other" rows="2" class="cc-input" placeholder="${t.gl_ph_comment || ''}"></textarea>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; border-top:1px solid #eee; padding-top:14px;">
            <button id="t2-cancel" class="cc-btn cc-btn-ghost">${t.gl_btn_later || 'Later'}</button>
            <button id="t2-submit" class="cc-btn cc-btn-primary">${t.gl_tier2_submit || '送出並獲得加量'}</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const btnCancel = modal.querySelector('#t2-cancel');
        const btnSubmit = modal.querySelector('#t2-submit');
        const emailEl = modal.querySelector('#t2-email');
        const prefGroup = modal.querySelector('#t2-pref-group');

        btnCancel.onclick = () => overlay.remove();

        btnSubmit.onclick = () => {
            const email = (emailEl.value || '').trim();
            const pref = modal.querySelector('input[name="t2-pref"]:checked');

            let ok = true;
            emailEl.classList.remove('cc-error');
            prefGroup.classList.remove('cc-error');

            if (!email) { emailEl.classList.add('cc-error'); ok = false; }
            if (!pref) { prefGroup.classList.add('cc-error'); ok = false; }

            if (!ok) return;

            btnSubmit.innerText = "Processing...";
            btnSubmit.disabled = true;
            btnSubmit.style.opacity = "0.7";

            const payload = {
                event: 'growth_tier2_beta_survey',
                feature: featureName,
                email,
                topFeature: pref.value,
                reason: (modal.querySelector('#t2-reason').value || '').trim(),
                other: (modal.querySelector('#t2-other').value || '').trim(),
                timestamp: Date.now(),
                lang: (typeof state !== 'undefined' && state.lang) ? state.lang : 'en',
                bonus: GROWTH_CONFIG.BONUS[featureName] || 0
            };

            fetch('https://qrcode.doglab24.org/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-secret-token': 'dogegg-qrcode-generator'
                },
                body: JSON.stringify(payload)
            })
                .catch(() => { })
                .finally(() => {
                    btnSubmit.innerText = t.gl_btn_sent || 'Sent';
                    btnSubmit.style.background = "#4CAF50";
                    setTimeout(() => {
                        overlay.remove();
                        if (onSubmit) onSubmit(payload);
                    }, 500);
                });
        };
    }

    function showGrowthFeedbackModal(featureName, onSubmit, customEventType = null) {
        const t = LANG_DATA[state.lang] || LANG_DATA['en'];
        const overlay = document.createElement('div');
        overlay.id = 'cc-growth-overlay';
        overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.6); z-index: 2147483661;
        backdrop-filter: blur(3px);
        display: flex; justify-content: center; align-items: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

        const modal = document.createElement('div');
        modal.style.cssText = `
        background: #fff; width: 400px; max-height: 90vh; overflow-y: auto;
        padding: 25px; border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3); position: relative;
        animation: cc-fade-in 0.2s ease-out; color: #333; text-align: left;
    `;

        const isLimitRequest = !!customEventType;
        const title = isLimitRequest ? t.gl_limit_title : t.gl_feedback_title;

        const rawMsg = isLimitRequest ? t.gl_limit_msg : t.gl_feedback_msg;
        const msg = rawMsg.replace('{feature}', featureName);

        const btnText = isLimitRequest ? t.gl_btn_req_unlimit : t.gl_btn_upgrade;

        const roles = t.gl_roles;

        const sourcesDict = t.gl_sources;
        const sources = [
            { label: sourcesDict.store, val: "chrome_store" },
            { label: sourcesDict.official, val: "official_site", link: "https://contextdrone.com" },
            { label: sourcesDict.referral, val: "referral" },
            { label: sourcesDict.youtube, val: "youtube" },
            { label: sourcesDict.other, val: "other", isOther: true }
        ];

        modal.innerHTML = `
        <style>
            @keyframes cc-fade-in { from {opacity:0; transform:scale(0.95);} to {opacity:1; transform:scale(1);} }
            .cc-form-group { margin-bottom: 15px; }
            .cc-label-title { font-size: 13px; font-weight: bold; display: block; margin-bottom: 8px; color: #444; }
            .cc-radio-item, .cc-check-item { display: flex; align-items: center; margin-bottom: 6px; font-size: 13px; cursor: pointer; color: #555; }
            .cc-radio-item input, .cc-check-item input { margin-right: 8px; accent-color: #00d2ff; }
            .cc-input-text { 
                width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; 
                box-sizing: border-box; font-size: 13px; color: #333 !important; background: #fff !important; 
            }
            .cc-input-text:focus { border-color: #00d2ff; outline: none; }
            a.cc-link { color: #00d2ff; text-decoration: none; font-weight: bold; }
            a.cc-link:hover { text-decoration: underline; }
            #cc-other-source-wrap { display: none; margin-top: 5px; margin-left: 24px; }
            .cc-error-shake { animation: cc-shake 0.4s; border: 1px solid red; padding: 5px; border-radius: 4px; }
            @keyframes cc-shake { 0% {transform: translateX(0);} 25% {transform: translateX(-5px);} 50% {transform: translateX(5px);} 75% {transform: translateX(-5px);} 100% {transform: translateX(0);} }
        </style>

        <h3 style="margin: 0 0 10px 0; color: #333;">${title}</h3>
        <p style="font-size: 13px; color: #666; line-height: 1.5; margin-bottom: 20px;">${msg}</p>
        
        <div class="cc-form-group" id="group-role">
            <label class="cc-label-title">${t.gl_lbl_role} <span style="color:red">*</span></label>
            ${roles.map((r, i) => `
                <label class="cc-radio-item">
                    <input type="radio" name="cc_role" value="${r}"> ${r}
                </label>
            `).join('')}
        </div>

        <div class="cc-form-group">
            <label class="cc-label-title">${t.gl_lbl_source}</label>
            ${sources.map((s, i) => `
                <label class="cc-check-item">
                    <input type="checkbox" name="cc_source" value="${s.val}" ${s.isOther ? 'id="cc-check-other"' : ''}>
                    ${s.link ? `<a href="${s.link}" target="_blank" class="cc-link" onclick="event.stopPropagation()">${s.label} ↗</a>` : s.label}
                </label>
            `).join('')}
            <div id="cc-other-source-wrap">
                <input type="text" id="cc-source-other-input" class="cc-input-text" placeholder="${t.gl_ph_specify}">
            </div>
        </div>

        <div class="cc-form-group">
            <label class="cc-label-title">${t.gl_lbl_email}</label>
            <input type="email" id="gf-email" class="cc-input-text" placeholder="${t.gl_ph_email}">
        </div>

        <div class="cc-form-group">
            <label class="cc-label-title">${t.gl_lbl_comment}</label>
            <textarea id="gf-comment" rows="2" class="cc-input-text" placeholder="${t.gl_ph_comment}"></textarea>
        </div>

        <div style="text-align:right; margin-top:20px; border-top: 1px solid #eee; padding-top: 15px;">
            <button id="gf-cancel" style="padding:8px 15px; background:none; border:none; color:#888; cursor:pointer; margin-right:10px; font-size:13px;">${t.gl_btn_later}</button>
            <button id="gf-submit" style="padding:10px 20px; background: linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%); color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px; box-shadow: 0 4px 10px rgba(0, 210, 255, 0.2);">${btnText}</button>
        </div>
    `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const btnSubmit = modal.querySelector('#gf-submit');
        const btnCancel = modal.querySelector('#gf-cancel');
        const checkOther = modal.querySelector('#cc-check-other');
        const otherInputDiv = modal.querySelector('#cc-other-source-wrap');
        const roleGroup = modal.querySelector('#group-role');

        checkOther.onchange = (e) => {
            otherInputDiv.style.display = e.target.checked ? 'block' : 'none';
            if (e.target.checked) {
                setTimeout(() => modal.querySelector('#cc-source-other-input').focus(), 100);
            }
        };

        btnCancel.onclick = () => overlay.remove();

        btnSubmit.onclick = () => {
            const selectedRole = modal.querySelector('input[name="cc_role"]:checked');
            if (!selectedRole) {
                roleGroup.classList.remove('cc-error-shake');
                void roleGroup.offsetWidth;
                roleGroup.classList.add('cc-error-shake');
                return;
            }

            const sourceCheckboxes = modal.querySelectorAll('input[name="cc_source"]:checked');
            let selectedSources = Array.from(sourceCheckboxes).map(cb => cb.value);

            if (checkOther.checked) {
                const otherText = modal.querySelector('#cc-source-other-input').value.trim();
                if (otherText) {
                    selectedSources = selectedSources.filter(s => s !== 'other');
                    selectedSources.push(`Other: ${otherText}`);
                }
            }

            const email = modal.querySelector('#gf-email').value.trim();
            const comment = modal.querySelector('#gf-comment').value.trim();

            btnSubmit.innerText = "Processing...";
            btnSubmit.disabled = true;
            btnSubmit.style.opacity = "0.7";

            const payload = {
                event: customEventType || 'growth_unlock_tier2_survey',
                feature: featureName,
                role: selectedRole.value,
                sources: selectedSources,
                email: email,
                comment: comment,
                timestamp: Date.now(),
                lang: (typeof state !== 'undefined' && state.lang) ? state.lang : 'en'
            };

            fetch('https://qrcode.doglab24.org/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-secret-token': 'dogegg-qrcode-generator'
                },
                body: JSON.stringify(payload)
            })
                .then(() => console.log("Survey sent"))
                .catch(err => console.error("Survey err", err))
                .finally(() => {
                    btnSubmit.innerText = t.gl_btn_sent;
                    btnSubmit.style.background = "#4CAF50";

                    setTimeout(() => {
                        overlay.remove();
                        if (onSubmit) onSubmit(payload);
                    }, 800);
                });
        };
    }

    /* =========================================
       1. Settings
    ========================================= */

    const WORKFLOW_TEMPLATES = {
        'clean': {
            name: 'Empty Canvas',
            nodes: []
        },
        'summary_keywords': {
            name: 'Summary & Keywords',
            nodes: [
                { id: 1, x: 50, y: 100, title: '📑 Summarizer', context: 'Please summarize the following content in 3 bullet points:' },
                { id: 2, x: 400, y: 100, title: '🏷️ Key Extractor', context: 'Extract 5 main keywords from the summary:' }
            ],
            connections: [{ from: 1, to: 2 }]
        },
        'translator_polish': {
            name: 'Translate & Polish',
            nodes: [
                { id: 1, x: 50, y: 100, title: '🌐 Translator', context: 'Translate the following text into English:' },
                { id: 2, x: 400, y: 100, title: '✨ Polisher', context: 'Improve the grammar and tone of the translation to be more professional:' }
            ],
            connections: [{ from: 1, to: 2 }]
        },
        'code_review': {
            name: 'Code Reviewer',
            nodes: [
                { id: 1, x: 50, y: 50, title: '🐞 Bug Finder', context: 'Find potential bugs in this code:' },
                { id: 2, x: 50, y: 350, title: '⚡ Optimizer', context: 'Suggest performance improvements for this code:' },
                { id: 3, x: 400, y: 200, title: '📝 Documenter', context: 'Write documentation and comments for the code:' }
            ],
            connections: [{ from: 1, to: 3 }, { from: 2, to: 3 }]
        }
    };

    function simpleMarkdownParser(text) {
        if (!text) return '';

        let safeText = escapeHTML(text);
        let html = safeText
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
            .replace(/\*(.*)\*/gim, '<i>$1</i>')
            .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
            .replace(/`([^`]+)`/gim, '<code>$1</code>')
            .replace(/^\- (.*$)/gim, '<li>$1</li>')
            .replace(/\n/gim, '<br>');
        return html;
    }

    function injectStyles() {
        if (typeof CC_STYLES === 'undefined') {
            console.error('ContextDrone: CSS assets (CC_STYLES) not loaded.');
            return;
        }

        if (document.getElementById('cc-styles')) return;

        try {
            const style = document.createElement('style');
            style.id = 'cc-styles';


            style.textContent = CC_STYLES + LANG_MENU_CSS;

            (document.head || document.documentElement).appendChild(style);
        } catch (e) {
            console.error("ContextDrone: Style injection failed:", e);
        }
    }

    /* =========================================
       2. Environment detection
    ========================================= */
    const host = window.location.hostname;
    let config = null;

    const AI_QUEUE = {
        queue: [],
        activeCount: 0,
        MAX_CONCURRENT: 3,

        add: function (taskFn) {
            return new Promise((resolve, reject) => {
                this.queue.push({ taskFn, resolve, reject });
                this.process();
            });
        },

        process: async function () {
            if (this.activeCount >= this.MAX_CONCURRENT || this.queue.length === 0) return;

            const { taskFn, resolve, reject } = this.queue.shift();
            this.activeCount++;

            try {
                const result = await taskFn();
                resolve(result);
            } catch (error) {
                console.error("Queue Task Error:", error);
                reject(error);
            } finally {
                this.activeCount--;
                this.process();
            }
        }
    };

    if (host.includes('chatgpt')) config = APP_CONFIG['chatgpt.com'];
    else if (host.includes('gemini.google.com')) config = APP_CONFIG['gemini.google.com'];
    else if (host.includes('claude')) config = APP_CONFIG['claude.ai'];
    else if (host.includes('x.com') || host.includes('grok.com')) config = APP_CONFIG['grok'];
    else if (host.includes('deepseek')) config = APP_CONFIG['chat.deepseek.com'];
    else if (host.includes('perplexity')) config = APP_CONFIG['www.perplexity.ai'];
    state.config = config;

    function getCustomPrompts(cb) {
        chrome.storage.local.get(['cc_custom_sys_prompt', 'cc_custom_prompts'], (res) => {
            let list = res.cc_custom_prompts || [];
            if (!list.length && res.cc_custom_sys_prompt) {
                list.push({
                    id: Date.now(),
                    name: 'Default Custom',
                    text: res.cc_custom_sys_prompt
                });
                chrome.storage.local.remove('cc_custom_sys_prompt');
                chrome.storage.local.set({ cc_custom_prompts: list });
            }
            cb(list);
        });
    }

    function handleSavePromptClick() {
        if (!prefixInput) return;
        const currentText = prefixInput.value.trim();
        if (!currentText) return;

        const t = LANG_DATA[state.lang];

        getCustomPrompts((list) => {
            const existing = document.querySelector('.mech-config-overlay');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.className = 'mech-config-overlay';
            overlay.style.opacity = '1';

            const card = document.createElement('div');
            card.className = 'mech-config-card';
            card.style.width = '350px';

            card.innerHTML = `
                <div class="mech-config-header">
                    <span>💾 ${t.prompt_save_title}</span>
                </div>
                
                <div class="mech-field">
                    <span class="mech-label">NAME</span>
                    <input type="text" id="prompt-name" class="mech-input" placeholder="${t.prompt_save_name_ph}">
                </div>

                <div class="mech-field">
                    <span class="mech-label">EXISTING SLOTS (${list.length}/3)</span>
                    <div id="prompt-list" style="
                        background: var(--input-bg); 
                        border: 1px solid var(--mech-border); 
                        border-radius: 4px; 
                        max-height: 150px; 
                        overflow-y: auto; 
                        display: flex; 
                        flex-direction: column; 
                        gap: 2px; 
                        padding: 4px;">
                        </div>
                </div>

                <div class="mech-btn-group">
                    <button id="btn-cancel" class="mech-cancel-btn">${t.unlock_cancel || 'Cancel'}</button>
                    <button id="btn-save" class="mech-action-btn">${t.prompt_save_btn_new}</button>
                </div>
            `;

            overlay.appendChild(card);
            document.body.appendChild(overlay);

            const nameInput = card.querySelector('#prompt-name');
            const listContainer = card.querySelector('#prompt-list');
            const btnSave = card.querySelector('#btn-save');
            const btnCancel = card.querySelector('#btn-cancel');

            let selectedId = null;

            const renderList = () => {
                listContainer.innerHTML = '';
                if (list.length === 0) {
                    listContainer.innerHTML = `<div style="padding:10px; text-align:center; color:var(--text-dim); font-size:10px;">${t.prompt_load_empty}</div>`;
                    return;
                }

                list.forEach(item => {
                    const row = document.createElement('div');
                    row.textContent = item.name;
                    Object.assign(row.style, {
                        padding: '8px 10px',
                        border: '1px solid transparent',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        color: 'var(--text)',
                        transition: 'all 0.2s',
                        background: 'rgba(255,255,255,0.02)'
                    });

                    if (selectedId === item.id) {
                        row.style.borderColor = 'var(--accent)';
                        row.style.background = 'var(--accent-glow)';
                        row.style.color = 'var(--accent)';
                        row.style.fontWeight = 'bold';
                    }

                    row.onmouseover = () => { if (selectedId !== item.id) row.style.background = 'var(--hover-bg)'; };
                    row.onmouseout = () => { if (selectedId !== item.id) row.style.background = 'rgba(255,255,255,0.02)'; };

                    row.onclick = () => {
                        selectedId = item.id;
                        nameInput.value = item.name;
                        updateButtonState();
                        renderList();
                    };
                    listContainer.appendChild(row);
                });
            };

            const updateButtonState = () => {
                if (selectedId) {
                    btnSave.innerText = t.prompt_save_btn_overwrite;
                    btnSave.style.borderColor = '#ff9800';
                    btnSave.style.color = '#ff9800';
                    btnSave.disabled = false;
                    btnSave.style.opacity = '1';
                } else {
                    btnSave.style.borderColor = '';
                    btnSave.style.color = '';
                    if (list.length >= 3) {
                        btnSave.innerText = t.prompt_save_limit;
                        btnSave.disabled = true;
                        btnSave.style.opacity = '0.5';
                        btnSave.style.fontSize = '10px';
                        nameInput.placeholder = "Select an item to overwrite";
                    } else {
                        btnSave.innerText = t.prompt_save_btn_new;
                        btnSave.disabled = false;
                        btnSave.style.opacity = '1';
                        btnSave.style.fontSize = '';
                    }
                }
            };

            renderList();
            updateButtonState();

            btnCancel.onclick = () => overlay.remove();

            btnSave.onclick = () => {
                const name = nameInput.value.trim() || `Prompt ${list.length + 1}`;

                if (selectedId) {
                    const idx = list.findIndex(i => i.id === selectedId);
                    if (idx !== -1) {
                        list[idx].name = name;
                        list[idx].text = currentText;
                    }
                } else {
                    if (list.length >= 3) return;
                    list.push({ id: Date.now(), name: name, text: currentText });
                }

                chrome.storage.local.set({ cc_custom_prompts: list }, () => {
                    showToast(t.prompt_toast_saved);
                    overlay.remove();
                });
            };

            nameInput.focus();
        });
    }

    function handleLoadPromptClick(btnElement) {
        const t = LANG_DATA[state.lang];
        getCustomPrompts((list) => {
            if (list.length === 0) {
                showToast(t.prompt_load_empty);
                return;
            }
            const existing = document.getElementById('cc-prompt-menu');
            if (existing) { existing.remove(); return; }

            const menu = document.createElement('div');
            menu.id = 'cc-prompt-menu';
            const rect = btnElement.getBoundingClientRect();
            const menuLeft = Math.max(0, rect.left - 100);

            Object.assign(menu.style, {
                position: 'fixed',
                top: (rect.bottom + 5) + 'px',
                left: menuLeft + 'px',
                minWidth: '150px',
                background: '#252525',
                border: '1px solid #444',
                borderRadius: '6px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                zIndex: '2147483660',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden'
            });

            list.forEach(item => {
                const menuItem = document.createElement('div');
                menuItem.innerText = item.name;
                Object.assign(menuItem.style, {
                    padding: '8px 12px', cursor: 'pointer', color: '#e0e0e0', fontSize: '12px', borderBottom: '1px solid #333'
                });
                menuItem.onmouseover = () => { menuItem.style.background = '#2196F3'; menuItem.style.color = '#fff'; };
                menuItem.onmouseout = () => { menuItem.style.background = 'transparent'; menuItem.style.color = '#e0e0e0'; };

                menuItem.onclick = () => {
                    if (prefixInput) {
                        prefixInput.value = item.text;
                        calculateTotalTokens();
                        flashInput(prefixInput);
                    }
                    menu.remove();
                };
                menu.appendChild(menuItem);
            });

            document.body.appendChild(menu);

            const closeMenu = (e) => {
                if (!menu.contains(e.target) && e.target !== btnElement) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            };
            setTimeout(() => document.addEventListener('click', closeMenu), 0);
        });
    }

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

        let text = clone.innerText;
        text = text.replace(/\n{3,}/g, '\n\n');

        return text.trim();
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
                const label = LANG_DATA[state.lang].token_est;
                display.innerText = `${label} ${count.toLocaleString()}`;

                display.style.color = count > 30000 ? '#ff9800' : '#aaa';
            }
        });
    }

    function switchPromptLanguage(oldLang, newLang) {
        if (!prefixInput) return;

        const currentText = prefixInput.value.trim();
        const oldD = LANG_DATA[oldLang];
        const newD = LANG_DATA[newLang];

        const promptMap = {
            [oldD.default_prompt.trim()]: newD.default_prompt,
            [oldD.sys_prompt_summary.trim()]: newD.sys_prompt_summary,
            [oldD.sys_prompt_translate.trim()]: newD.sys_prompt_translate,
            [oldD.sys_prompt_explain.trim()]: newD.sys_prompt_explain
        };

        if (promptMap[currentText]) {
            prefixInput.value = promptMap[currentText];
            flashInput(prefixInput);
        }
    }

    /* =========================================
       3. Main Functions
    ========================================= */
    function openInterface() {
        if (state.active) return;
        state.active = true;

        const host = window.location.hostname;
        chrome.storage.local.get(['cc_disabled_domains'], (res) => {
            let domains = res.cc_disabled_domains || [];
            if (domains.includes(host)) {
                domains = domains.filter(d => d !== host);
                chrome.storage.local.set({ cc_disabled_domains: domains });
            }
        });

        const drone = document.getElementById('cc-drone-fab');
        if (drone) drone.classList.add('cc-hidden');


        chrome.storage.local.get(['cc_feature_unlock', 'cc_theme'], (result) => {

            state.isUnlocked = !!result.cc_feature_unlock;

            if (result.cc_theme) {
                state.theme = result.cc_theme;
            }

            if (typeof applyTheme === 'function') {
                applyTheme(state.theme);
            }

            try {
                injectStyles();
            } catch (e) {
                console.error("ContextDrone: Critical error in injectStyles", e);
            }

            try {
                if (state.uiMode === 'robot') {
                    createRobotPanel();
                } else {
                    createPanel();
                }
            } catch (e) {
                console.error("Panel creation failed", e);
                state.active = false;
                return;
            }

            setTimeout(() => {
                const panel = document.getElementById('cc-panel');
                if (panel) panel.classList.add('cc-visible');
            }, 10);

            if (state.config) {
                if (state.interval) {
                    clearInterval(state.interval);
                }
                state.interval = setInterval(performScan, 3000);
                performScan();
            }

            chrome.runtime.sendMessage({ action: "CLEAR_BADGE" });

            try {
                checkAutoFill();
                updateBasketUI((basket) => {
                    const panelEl = document.getElementById('cc-panel');
                    if (state.uiMode === 'standard' && panelEl) {
                        if (basket && basket.length > 0) {
                            panelEl.classList.add('expanded');
                            toggleBasketPreview(true);
                        }
                    }
                });
            } catch (e) {
                console.error("ContextDrone: Error in post-panel logic", e);
            }
        });
    }

    function closeInterface() {
        if (!state.active) return;
        state.active = false;

        const currentPanel = document.getElementById('cc-panel') || document.getElementById('cc-robot-panel');
        let savedPos = null;

        if (currentPanel) {
            const rect = currentPanel.getBoundingClientRect();
            savedPos = { top: rect.top, left: rect.left };
        }

        const spawnDrone = () => {
            if (state.config) {
                const afterSave = () => {
                    const drone = document.getElementById('cc-drone-fab');
                    if (drone) {
                        drone.classList.remove('cc-hidden');
                        if (savedPos) {
                            drone.style.top = savedPos.top + 'px';
                            drone.style.left = savedPos.left + 'px';
                            drone.style.bottom = 'auto';
                            drone.style.right = 'auto';
                        }
                        updateDroneUI();
                    } else {
                        createTransportDrone();
                    }
                };

                if (savedPos) {
                    chrome.storage.local.set({ 'cc_drone_position': savedPos }, afterSave);
                } else {
                    afterSave();
                }
            }
        };

        if (state.interval) {
            clearInterval(state.interval);
            state.interval = null;
        }

        if (currentPanel) {
            if (currentPanel.id === 'cc-robot-panel') {
                currentPanel.classList.remove('deployed');
                setTimeout(() => {
                    currentPanel.classList.add('mech-retracting');
                }, 200);

                setTimeout(() => {
                    currentPanel.classList.remove('cc-visible');
                    currentPanel.classList.add('mech-departing');
                    setTimeout(() => {
                        cleanupDOM(currentPanel);
                        spawnDrone();
                    }, 2000);
                }, 800);

            } else {
                currentPanel.classList.remove('cc-visible');
                setTimeout(() => {
                    cleanupDOM(currentPanel);
                    spawnDrone();
                }, 300);
            }
        } else {
            cleanupDOM(null);
            spawnDrone();
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

        setTimeout(() => {
            const processedElements = document.querySelectorAll('[data-cc-listening], [data-cc-selected], [data-cc-hover]');

            if (processedElements.length > 50) {
                let index = 0;
                const chunkSize = 50;

                const processChunk = () => {
                    const end = Math.min(index + chunkSize, processedElements.length);
                    for (let i = index; i < end; i++) {
                        const el = processedElements[i];
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
                    }
                    index = end;

                    if (index < processedElements.length) {
                        setTimeout(processChunk, 0);
                    }
                };
                processChunk();
            } else {
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
            }

            state.lastCheckedIndex = null;
            document.querySelectorAll('[style*="box-shadow"], [style*="outline"], [style*="background-color"]').forEach(el => {
                el.style.boxShadow = '';
                el.style.outline = '';
                el.style.backgroundColor = '';
            });
        }, 10);
    }

    function cleanUpSiteOverlays() {
        const targetDomains = ['claude.ai', 'chatgpt.com', 'gemini.google.com'];
        const host = window.location.hostname;

        if (targetDomains.some(d => host.includes(d))) {
            setTimeout(() => {
                const dragLeave = new DragEvent('dragleave', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: 0,
                    clientY: 0,
                    relatedTarget: null
                });

                document.dispatchEvent(dragLeave);
                document.body.dispatchEvent(dragLeave);

                const gptOverlay = document.querySelector('div[class*="drag-overlay"]');
                if (gptOverlay) gptOverlay.dispatchEvent(dragLeave);

                if (host.includes('claude.ai')) {
                    const inputArea = document.querySelector('[data-testid="chat-input"]') ||
                        document.querySelector('fieldset');
                    if (inputArea) {
                        inputArea.dispatchEvent(dragLeave);
                        if (inputArea.parentElement) inputArea.parentElement.dispatchEvent(dragLeave);
                    }

                    const potentialOverlays = document.querySelectorAll('.fixed.inset-0');
                    potentialOverlays.forEach(el => {
                        const style = window.getComputedStyle(el);
                        if (parseInt(style.zIndex) > 10) {
                            el.dispatchEvent(dragLeave);
                        }
                    });
                }

            }, 100);
        }
    }

    function toggleInterface() {
        if (state.active) {
            closeInterface();
            return;
        }

        const host = window.location.hostname;
        chrome.storage.local.get(['cc_disabled_domains'], (res) => {
            let domains = res.cc_disabled_domains || [];

            if (domains.includes(host)) {
                domains = domains.filter(d => d !== host);
                chrome.storage.local.set({ cc_disabled_domains: domains }, () => {
                    state.droneDismissed = false;
                    if (!document.getElementById('cc-drone-fab')) {
                        createTransportDrone();
                    }

                    showToast("Drone summoned! 🚁");
                });
            }
            else if (!document.getElementById('cc-drone-fab') && state.config) {
                createTransportDrone();
            }
            else {
                openInterface();
            }
        });
    }

    /* =========================================
       4. UI Construction
    ========================================= */
    let title, msg, prefixLabel, prefixInput, btnDl, btnCopy, btnScan, btnPaint, transferLabel, transferContainer, btnSelectAll, btnUnselectAll;
    let basketLabel, basketStatus, btnAddBasket, btnClearBasket, btnPasteBasket, basketPreviewList;
    let tooltip;
    let btnSummary, btnNewDoc;
    let updateContentTabBadges;
    let updateMechTabBadges;

    function createSysBtn(id, textKey, tooltipKey, promptKey, isCustom = false) {
        const t = LANG_DATA[state.lang];
        const btn = document.createElement('button');
        btn.id = id;
        btn.className = 'cc-sys-btn';
        btn.textContent = t[textKey] || textKey;
        btn.title = t[tooltipKey] || tooltipKey;

        Object.assign(btn.style, {
            background: 'transparent',
            border: '1px solid transparent',
            cursor: 'pointer',
            fontSize: '12px',
            padding: '1px 4px',
            borderRadius: '4px',
            transition: 'all 0.1s',
            opacity: '0.7'
        });

        btn.onmouseover = () => { btn.style.opacity = '1'; btn.style.background = 'rgba(128,128,128,0.2)'; };
        btn.onmouseout = () => { btn.style.opacity = '0.7'; btn.style.background = 'transparent'; };

        btn.onclick = (e) => {
            e.stopPropagation();
            if (prefixInput) flashInput(prefixInput);

            if (promptKey) {
                const curT = LANG_DATA[state.lang];
                if (prefixInput) {
                    prefixInput.value = curT[promptKey];
                    calculateTotalTokens();
                }
            }
        };
        return btn;
    }

    if (!state.theme) state.theme = 'dark';

    function applyTheme(newTheme) {
        state.theme = newTheme;
        chrome.storage.local.set({ 'cc_theme': newTheme });

        if (newTheme === 'light') {
            document.body.setAttribute('data-theme', 'light');
        } else {
            document.body.removeAttribute('data-theme');
        }

        const stdPanel = document.getElementById('cc-panel');
        const stdThemeBtn = document.getElementById('cc-btn-theme');

        if (stdPanel) {
            if (newTheme === 'dark') {
                stdPanel.setAttribute('data-theme', 'dark');
                if (stdThemeBtn) stdThemeBtn.textContent = '☀️';
            } else {
                stdPanel.removeAttribute('data-theme');
                if (stdThemeBtn) stdThemeBtn.textContent = '🌙';
            }
        }

        const platformIcons = document.querySelectorAll('.cc-platform-icon');
        platformIcons.forEach(img => {
            const pid = img.dataset.pid;
            if (pid) {
                img.src = chrome.runtime.getURL(`images/${pid}_${newTheme}.png`);
            }
        });

        const robotThemeBtn = document.getElementById('mech-btn-theme');
        if (robotThemeBtn) {
            if (newTheme === 'light') robotThemeBtn.classList.add('active');
            else robotThemeBtn.classList.remove('active');
        }

        const droneCard = document.querySelector('.cc-hover-card');
        if (droneCard) {
            if (newTheme === 'light') droneCard.classList.add('cc-light-mode');
            else droneCard.classList.remove('cc-light-mode');
        }

        if (state.pipWindow && state.pipWindow.document) {
            const pipBody = state.pipWindow.document.body;
            if (newTheme === 'light') {
                pipBody.setAttribute('data-theme', 'light');
            } else {
                pipBody.removeAttribute('data-theme');
            }
        }
    }

    function createPanel() {
        if (document.getElementById('cc-panel')) return;
        state.contentPanelTab = state.contentPanelTab || 'basket';
        const curLang = state.lang;
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
            if (state.streamingModal && state.streamingModal.element) {
                state.streamingModal.restore();
            } else {
                const ctx = state.lastAiContext || "";
                const cfg = state.lastAiConfig || state.aiConfig;
                chrome.storage.local.get(['cc_last_layout_mode'], (res) => {
                    const savedMode = res.cc_last_layout_mode || 'single';
                    const modal = showStreamingResponseModalMulti(ctx, cfg, savedMode);
                    if (state.lastAiText) {
                        modal.append(state.lastAiText);
                        modal.done();
                    }
                });
            }
        };

        if (!shouldShowAI()) {
            aiTab.style.display = 'none';
            resTab.style.display = 'none';
        }

        panel.appendChild(aiDrawer);
        panel.appendChild(aiTab);
        panel.appendChild(resTab);

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

        const controls = document.createElement('div');
        controls.className = 'cc-controls';

        if ('documentPictureInPicture' in window) {
            const pipBtn = document.createElement('button');
            pipBtn.className = 'cc-icon-btn';
            pipBtn.innerText = '⏏';
            pipBtn.title = t.btn_pip;
            pipBtn.onclick = openDedicatedPiP;
            controls.appendChild(pipBtn);
        }
        const robotBtn = document.createElement('button');
        robotBtn.className = 'cc-icon-btn';
        robotBtn.innerText = '🚁';
        robotBtn.title = t.btn_switch_ui_robot;
        robotBtn.onclick = () => toggleUIMode('robot');
        controls.appendChild(robotBtn);

        const langBtn = document.createElement('button');
        langBtn.id = 'cc-btn-lang';
        langBtn.className = 'cc-icon-btn';
        langBtn.textContent = '🌐';
        langBtn.title = t.btn_lang_title + t.hint_shortcut_lang;
        if (langBtn) {
            langBtn.onclick = (e) => {
                e.stopPropagation();
                showLanguageMenu(langBtn);
            };
        }
        controls.appendChild(langBtn);
        const themeBtn = document.createElement('button');
        themeBtn.id = 'cc-btn-theme';
        themeBtn.className = 'cc-icon-btn';
        themeBtn.textContent = state.theme === 'dark' ? '☀️' : '🌙';
        themeBtn.title = t.btn_theme_title;
        themeBtn.onclick = function () {
            const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
            applyTheme(nextTheme);
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
            if (p.id === 'deepseek') btn.classList.add('p-deepseek');
            if (p.id === 'perplexity') btn.classList.add('p-perplexity');
            const iconUrl = chrome.runtime.getURL(`images/${p.id}_${state.theme}.png`);
            btn.innerHTML = `
                <img src="${iconUrl}" 
                     class="cc-platform-icon" 
                     data-pid="${p.id}" 
                     style="width:16px; height:16px; vertical-align:middle; object-fit:contain;">
            `;
            btn.title = t.tooltip_transfer_to.replace('{name}', p.name);
            btn.onclick = () => handleCrossTransfer(p);
            transferContainer.appendChild(btn);
        });

        const toolsRow = document.createElement('div');
        toolsRow.className = 'cc-tools';

        btnSelectAll = document.createElement('button');
        btnSelectAll.className = 'tool-btn';
        btnSelectAll.id = 'cc-btn-select-all';
        btnSelectAll.title = t.btn_select_all;
        btnSelectAll.textContent = '✅';
        btnSelectAll.onclick = handleSelectAll;

        btnUnselectAll = document.createElement('button');
        btnUnselectAll.className = 'tool-btn';
        btnUnselectAll.id = 'cc-btn-unselect-all';
        btnUnselectAll.title = t.btn_unselect_all;
        btnUnselectAll.textContent = '⛔';
        btnUnselectAll.onclick = handleUnselectAll;

        const btnPasteMain = document.createElement('button');
        btnPasteMain.className = 'tool-btn';
        btnPasteMain.id = 'cc-btn-paste-main';
        btnPasteMain.title = t.btn_paste_basket;
        btnPasteMain.textContent = '🪄';
        btnPasteMain.onclick = handlePasteBasket;

        toolsRow.append(btnSelectAll, btnUnselectAll, btnPasteMain);
        const aiToolsRow = document.createElement('div');
        aiToolsRow.className = 'cc-tools';
        aiToolsRow.style.marginTop = '4px';

        if (shouldShowAI()) {
            btnSummary = document.createElement('button');
            btnSummary.className = 'tool-btn btn-ai-low';
            btnSummary.id = 'cc-btn-summary';
            btnSummary.title = t.btn_summary;
            btnSummary.textContent = t.btn_summary;
            btnSummary.onclick = () => {
                if (state.streamingModal && state.streamingModal.isMinimized) {
                    state.streamingModal.restore();
                    return;
                }
                handleAiSummary();
            };
            aiToolsRow.appendChild(btnSummary);
        }

        const drawerToggle = document.createElement('div');
        drawerToggle.className = 'cc-drawer-toggle';
        drawerToggle.id = 'cc-drawer-toggle';
        drawerToggle.innerHTML = `<span class="arrow">▼</span>${t.drawer_toggle}`;
        drawerToggle.onclick = () => {
            panel.classList.toggle('expanded');
        };
        const drawer = document.createElement('div');
        drawer.className = 'cc-drawer';

        const prefixHeader = document.createElement('div');
        prefixHeader.id = 'cc-prefix-header';
        Object.assign(prefixHeader.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px'
        });

        prefixLabel = document.createElement('div');
        prefixLabel.textContent = t.label_prefix;
        prefixLabel.style.fontWeight = '600';
        prefixLabel.style.fontSize = '12px';

        const prefixToolbar = document.createElement('div');
        prefixToolbar.className = 'cc-sys-toolbar';
        Object.assign(prefixToolbar.style, {
            display: 'flex',
            gap: '4px'
        });

        const btnNone = createSysBtn('sys-btn-none', 'None', 'No Prompt', null);
        btnNone.innerText = '🛑';
        btnNone.onclick = (e) => {
            e.stopPropagation();
            if (prefixInput) {
                prefixInput.value = "";
                calculateTotalTokens();
                flashInput(prefixInput);
            }
        };

        const btnSourceToggle = createSysBtn('sys-btn-source-toggle', 'Src', 'Toggle Source Info', null);
        const updateSourceBtnStyle = () => {
            btnSourceToggle.innerText = state.includeSource ? '🔗' : '⛓️‍💥';
            btnSourceToggle.style.opacity = state.includeSource ? '1' : '0.5';
            btnSourceToggle.title = state.includeSource ? (t.btn_source_on || "Source: ON") : (t.btn_source_off || "Source: OFF");
        };
        updateSourceBtnStyle();

        btnSourceToggle.onclick = (e) => {
            e.stopPropagation();
            state.includeSource = !state.includeSource;
            updateSourceBtnStyle();
            const msg = state.includeSource ? "Context Source: Included ✅" : "Context Source: Disabled 🚫";
            showToast(msg);
            updateBasketUI();
        };

        const btnSum = createSysBtn('sys-btn-sum', 'sys_btn_summary', 'sys_tooltip_summary', 'sys_prompt_summary');
        const btnTrans = createSysBtn('sys-btn-trans', 'sys_btn_translate', 'sys_tooltip_translate', 'sys_prompt_translate');
        const btnExp = createSysBtn('sys-btn-exp', 'sys_btn_explain', 'sys_tooltip_explain', 'sys_prompt_explain');
        const btnSave = createSysBtn('sys-btn-save', 'sys_btn_save', 'sys_tooltip_save', null);
        btnSave.onclick = (e) => {
            e.stopPropagation();
            handleSavePromptClick();
        };

        const btnLoad = createSysBtn('sys-btn-load', 'sys_btn_custom_user', 'sys_tooltip_load', null);
        btnLoad.textContent = '👤';
        btnLoad.onclick = (e) => {
            e.stopPropagation();
            handleLoadPromptClick(btnLoad);
        };

        prefixToolbar.append(btnNone, btnSum, btnTrans, btnExp, btnSave, btnLoad);
        prefixHeader.append(prefixLabel, prefixToolbar);

        prefixInput = document.createElement('textarea');
        prefixInput.id = 'cc-prefix-input';
        prefixInput.className = 'cc-input';
        prefixInput.value = t.default_prompt;
        prefixInput.placeholder = t.placeholder;
        prefixInput.addEventListener('input', debounce(calculateTotalTokens, 300));
        const contentTabBar = document.createElement('div');
        contentTabBar.id = 'cc-content-tab-bar';
        Object.assign(contentTabBar.style, {
            display: 'flex',
            gap: '4px',
            marginTop: '8px',
            marginBottom: '4px'
        });

        const createContentTab = (id, label, icon, isDefault = false) => {
            const tab = document.createElement('button');
            tab.id = id;
            tab.className = 'cc-content-tab' + (isDefault ? ' active' : '');
            tab.innerHTML = `${icon} <span class="tab-label">${label}</span><span class="tab-badge" style="display:none;margin-left:4px;background:#ff5252;color:#fff;padding:0 5px;border-radius:10px;font-size:9px;"></span>`;
            Object.assign(tab.style, {
                flex: '1',
                padding: '6px 8px',
                border: 'none',
                borderRadius: '6px 6px 0 0',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 0.2s',
                background: isDefault ? 'var(--cc-bg-card, #333)' : 'transparent',
                color: isDefault ? 'var(--cc-primary, #00d2ff)' : 'var(--cc-text-sub, #888)',
                borderBottom: isDefault ? '2px solid var(--cc-primary, #00d2ff)' : '2px solid transparent'
            });
            return tab;
        };

        const tabBasket = createContentTab('cc-tab-basket', 'Basket', '📦', state.contentPanelTab === 'basket');
        const tabPins = createContentTab('cc-tab-pins', 'Pins', '📍', state.contentPanelTab === 'pins');

        const switchContentTab = (tabName) => {
            state.contentPanelTab = tabName;
            const isBasket = tabName === 'basket';

            tabBasket.style.background = isBasket ? 'var(--cc-bg-card, #333)' : 'transparent';
            tabBasket.style.color = isBasket ? 'var(--cc-primary, #00d2ff)' : 'var(--cc-text-sub, #888)';
            tabBasket.style.borderBottom = isBasket ? '2px solid var(--cc-primary, #00d2ff)' : '2px solid transparent';
            tabBasket.classList.toggle('active', isBasket);

            tabPins.style.background = !isBasket ? 'var(--cc-bg-card, #333)' : 'transparent';
            tabPins.style.color = !isBasket ? 'var(--cc-primary, #00d2ff)' : 'var(--cc-text-sub, #888)';
            tabPins.style.borderBottom = !isBasket ? '2px solid var(--cc-primary, #00d2ff)' : '2px solid transparent';
            tabPins.classList.toggle('active', !isBasket);

            if (basketPreviewList) basketPreviewList.style.display = isBasket && state.isPreviewOpen ? 'block' : 'none';

            if (isBasket && state.isPreviewOpen) {
                renderBasketPreview(basket);
            }

            const pinPanel = document.getElementById('cc-std-pin-panel');
            if (pinPanel) pinPanel.style.display = !isBasket ? 'block' : 'none';

            const basketInfoEl = document.getElementById('cc-basket-info');
            if (basketInfoEl) basketInfoEl.style.display = isBasket ? 'flex' : 'none';

            const pinInfoEl = document.getElementById('cc-pin-info');
            if (pinInfoEl) pinInfoEl.style.display = !isBasket ? 'flex' : 'none';
        };

        tabBasket.onclick = () => switchContentTab('basket');
        tabPins.onclick = () => switchContentTab('pins');

        contentTabBar.append(tabBasket, tabPins);

        updateContentTabBadges = () => {
            const basketBadge = tabBasket.querySelector('.tab-badge');
            const pinBadge = tabPins.querySelector('.tab-badge');

            if (basketBadge) {
                const count = basket.length;
                basketBadge.textContent = count;
                basketBadge.style.display = count > 0 ? 'inline' : 'none';
            }

            if (pinBadge) {
                const pinCount = pinManager.pins.length;
                pinBadge.textContent = pinCount;
                pinBadge.style.display = pinCount > 0 ? 'inline' : 'none';
            }
        };

        const stdPinChangeCallback = () => {
            updateContentTabBadges();
            if (typeof renderStdPinPanel === 'function') renderStdPinPanel();
        };
        pinManager.registerOnChange(stdPinChangeCallback);
        setTimeout(() => stdPinChangeCallback(), 0);

        const basketInfo = document.createElement('div');
        basketInfo.className = 'basket-info';
        basketInfo.id = 'cc-basket-info';

        Object.assign(basketInfo.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 2px'
        });

        basketLabel = document.createElement('span');
        basketLabel.style.display = 'none';
        basketLabel.id = 'cc-basket-label';
        basketInfo.appendChild(basketLabel);

        basketStatus = document.createElement('span');
        basketStatus.textContent = t.basket_status_empty;
        basketStatus.style.cursor = 'pointer';
        basketStatus.id = 'cc-basket-status';
        basketStatus.onclick = toggleBasketPreview;
        basketInfo.appendChild(basketStatus);

        const basketIcons = document.createElement('div');
        Object.assign(basketIcons.style, {
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
        });

        btnAddBasket = document.createElement('span');
        btnAddBasket.textContent = '🧺';
        btnAddBasket.id = 'cc-btn-add-basket';
        btnAddBasket.title = t.btn_add_basket;
        btnAddBasket.style.cursor = 'pointer';
        btnAddBasket.onclick = handleAddToBasket;

        btnNewDoc = document.createElement('span');
        btnNewDoc.textContent = '🖍️';
        btnNewDoc.id = 'cc-btn-new-doc';
        btnNewDoc.title = t.btn_new_doc;
        btnNewDoc.style.cursor = 'pointer';
        btnNewDoc.onclick = handleNewDoc;

        btnClearBasket = document.createElement('span');
        btnClearBasket.textContent = '🗑️';
        btnClearBasket.style.cursor = 'pointer';
        btnClearBasket.style.color = 'var(--cc-primary)';
        btnClearBasket.id = 'cc-btn-clear-basket';
        btnClearBasket.title = t.btn_clear_basket
        btnClearBasket.onclick = handleClearBasket;

        basketIcons.appendChild(btnSourceToggle);
        basketIcons.appendChild(btnAddBasket);
        basketIcons.appendChild(btnNewDoc);
        basketIcons.appendChild(btnClearBasket);

        basketInfo.appendChild(basketIcons);
        const pinInfo = document.createElement('div');
        pinInfo.id = 'cc-pin-info';
        Object.assign(pinInfo.style, {
            display: 'none',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 2px'
        });

        const pinStatus = document.createElement('span');
        pinStatus.id = 'cc-pin-status';
        pinStatus.textContent = t.pin_status_empty || '📍 No pins yet';
        pinStatus.style.fontSize = '11px';
        pinStatus.style.color = '#888';
        pinInfo.appendChild(pinStatus);

        const pinActions = document.createElement('div');
        Object.assign(pinActions.style, { display: 'flex', gap: '8px', alignItems: 'center' });

        const btnClearPins = document.createElement('span');
        btnClearPins.textContent = '🗑️';
        btnClearPins.style.cursor = 'pointer';
        btnClearPins.style.color = 'var(--cc-primary)';
        btnClearPins.title = t.btn_clear_pins || 'Clear all pins';
        btnClearPins.onclick = () => {
            const t = LANG_DATA[state.lang];
            if (pinManager.pins.length === 0) return;
            showMainConfirmModal(
                t.confirm_clear_pins || 'Clear all pins?',
                t.confirm_clear_pins_msg || 'This will remove all pinned locations.',
                () => {
                    while (pinManager.pins.length > 0) {
                        pinManager.removePin(pinManager.pins[0].id);
                    }
                    showToast(t.toast_pins_cleared || 'All pins cleared');
                }
            );
        };
        pinActions.appendChild(btnClearPins);
        pinInfo.appendChild(pinActions);
        const stdPinPanel = document.createElement('div');
        stdPinPanel.id = 'cc-std-pin-panel';
        Object.assign(stdPinPanel.style, {
            display: 'none',
            maxHeight: '200px',
            overflowY: 'auto',
            padding: '4px'
        });

        const renderStdPinPanel = () => {
            const t = LANG_DATA[state.lang];
            stdPinPanel.innerHTML = '';
            const pins = pinManager.pins;
            const pinStatusEl = document.getElementById('cc-pin-status');

            if (pins.length === 0) {
                if (pinStatusEl) {
                    pinStatusEl.textContent = t.pin_status_empty || '📍 No pins yet';
                    pinStatusEl.style.color = '#888';
                }
                stdPinPanel.innerHTML = `<div style="text-align:center;color:#666;font-size:11px;padding:20px;">
                    ${t.pin_empty_hint || 'Drag 📌 from toolbar to pin locations on the page'}
                </div>`;
                updateContentTabBadges();
                return;
            }

            if (pinStatusEl) {
                pinStatusEl.textContent = (t.pin_status || '📍 {n} pins').replace('{n}', pins.length);
                pinStatusEl.style.color = '#4CAF50';
            }

            pins.forEach((p, idx) => {
                const row = document.createElement('div');
                row.className = 'cc-pin-item';
                Object.assign(row.style, {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px',
                    marginBottom: '4px',
                    background: 'var(--cc-bg-card, #333)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: '1px solid transparent'
                });

                row.onmouseenter = () => {
                    row.style.borderColor = 'var(--cc-primary, #00d2ff)';
                    row.style.background = 'var(--cc-bg-hover, #444)';
                };
                row.onmouseleave = () => {
                    row.style.borderColor = 'transparent';
                    row.style.background = 'var(--cc-bg-card, #333)';
                };

                const info = document.createElement('div');
                info.style.flex = '1';
                info.style.overflow = 'hidden';
                info.innerHTML = `
                    <div style="font-size:10px;color:#888;margin-bottom:2px;">📍 Pin ${idx + 1}</div>
                    <div style="font-size:11px;color:#eee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(p.text)}</div>
                `;

                const actions = document.createElement('div');
                actions.style.display = 'flex';
                actions.style.gap = '4px';

                const gotoBtn = document.createElement('button');
                gotoBtn.innerHTML = '🎯';
                gotoBtn.title = t.pin_goto || 'Jump to location';
                Object.assign(gotoBtn.style, {
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '4px'
                });
                gotoBtn.onclick = (e) => {
                    e.stopPropagation();
                    pinManager.scrollToPin(p.id);
                };

                const delBtn = document.createElement('button');
                delBtn.innerHTML = '✕';
                delBtn.title = t.pin_remove || 'Remove pin';
                Object.assign(delBtn.style, {
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#888',
                    padding: '4px'
                });
                delBtn.onmouseenter = () => delBtn.style.color = '#ff5252';
                delBtn.onmouseout = () => delBtn.style.color = '#888';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    pinManager.removePin(p.id);
                };

                actions.append(gotoBtn, delBtn);
                row.append(info, actions);

                row.onclick = () => pinManager.scrollToPin(p.id);

                stdPinPanel.appendChild(row);
            });

            updateContentTabBadges();
        };

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
            <div class="cc-drop-text" style="font-size: 12px; font-weight: bold;">${t.overlay_drop_add}</div>
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
        basketContainer.append(basketPreviewList, stdPinPanel, dropOverlay);
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
        extraActions.id = 'cc-extra-actions';

        btnPaint = document.createElement('button');
        btnPaint.className = 'tool-btn';
        btnPaint.innerText = '🖌️ ';
        btnPaint.id = 'cc-btn-paint';
        btnPaint.title = t.paint_tooltip + t.hint_shortcut_paint;
        btnPaint.onclick = () => {
            toggleSelectionMode();
            const p = document.getElementById('cc-panel');
            if (p) p.style.opacity = '0.2';
        };

        const btnPin = document.createElement('button');
        btnPin.className = 'tool-btn';
        btnPin.innerText = '📌';
        btnPin.id = 'cc-btn-pin';
        btnPin.title = t.btn_ping;
        btnPin.draggable = true;
        btnPin.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            if (!panel.classList.contains('expanded')) {
                panel.classList.add('expanded');
            }
            if (typeof switchContentTab === 'function') {
                switchContentTab('pins');
            }
            e.dataTransfer.setData('application/cc-pin', 'true');
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', 'ContextDrone Pin');
            const dragIcon = document.createElement('div');
            dragIcon.innerText = '📌';
            Object.assign(dragIcon.style, { fontSize: '24px', position: 'absolute', top: '-9999px', left: '-9999px' });
            document.body.appendChild(dragIcon);
            e.dataTransfer.setDragImage(dragIcon, 12, 12);
            requestAnimationFrame(() => dragIcon.remove());

            document.body.classList.add('cc-pin-dragging');
        });
        btnPin.addEventListener('dragend', () => {
            document.body.classList.remove('cc-pin-dragging');
        });

        const btnQr = document.createElement('button');
        btnQr.className = 'tool-btn';
        btnQr.innerText = '📱';
        btnQr.id = 'cc-btn-qr';
        btnQr.title = t.btn_qrcode;
        btnQr.onclick = handleQrCodeAction;

        btnDl = document.createElement('button');
        btnDl.className = 'tool-btn';
        btnDl.title = t.btn_dl;
        btnDl.id = 'cc-btn-dl';
        btnDl.textContent = '💾';
        btnDl.onclick = handleDownload;

        btnScan = document.createElement('button');
        btnScan.className = 'tool-btn';
        btnScan.title = t.btn_scan;
        btnScan.id = 'cc-btn-scan';
        btnScan.textContent = '↻';
        btnScan.onclick = function () {
            performScan();
            this.textContent = LANG_DATA[state.lang].btn_scan_done;
            setTimeout(() => {
                this.textContent = LANG_DATA[state.lang].btn_scan;
            }, 1000);
        };

        const btnAiConfig = document.createElement('button');
        btnAiConfig.id = 'cc-btn-ai-config';
        btnAiConfig.className = 'tool-btn';
        btnAiConfig.textContent = '🔓';
        btnAiConfig.title = t.ai_setting_tab;
        btnAiConfig.onclick = () => {
            const container = document.querySelector('.cc-ai-content');
            if (container) {
                document.getElementById('cc-ai-drawer-panel').classList.add('open');
                toggleAiSettingsInDrawer(container);
            }
        };

        extraActions.append(btnPin, btnQr, btnPaint, btnDl, btnScan, btnAiConfig);
        drawer.append(prefixHeader, prefixInput, contentTabBar, basketInfo, pinInfo, basketContainer, tokenDisplay);



        panel.append(header, msg, transferLabel, transferContainer, toolsRow, aiToolsRow, drawerToggle, drawer);

        if (aiToolsRow && aiToolsRow.parentNode === panel) {
            panel.insertBefore(extraActions, aiToolsRow);
        } else {
            panel.insertBefore(extraActions, drawerToggle);
        }
        panel.addEventListener('dragover', (e) => {
            if (e.dataTransfer.types.includes('application/cc-sort')) return;
            if (!e.dataTransfer.types.includes('application/cc-pin')) {
                if (state.contentPanelTab !== 'basket' && typeof switchContentTab === 'function') {
                    switchContentTab('basket');
                }
            }
            e.preventDefault();
            e.stopPropagation();
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
            e.stopPropagation();

            const t = LANG_DATA[state.lang];
            const droppedFiles = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
            const droppedText = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
            const isManualScan = e.dataTransfer.types.includes('application/cc-scan-item');

            getBasket((currentBasket) => {
                const currentCount = currentBasket ? currentBasket.length : 0;
                attemptFeatureUsage('context', () => {

                    if (droppedFiles.length > 0) {
                        droppedFiles.forEach((file) => {
                            if (file.type && file.type.includes('text') || /\.md$/i.test(file.name) || /\.txt$/i.test(file.name)) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                    const content = (ev.target.result || '').trim();
                                    if (!content) return;
                                    basketOp({
                                        kind: 'ADD',
                                        item: {
                                            text: content,
                                            timestamp: Date.now(),
                                            source: file.name + t.src_local
                                        }
                                    }, () => {
                                        showToast(LANG_DATA[state.lang].toast_basket_add || 'Added to basket');
                                        updateBasketUI();
                                        panel.classList.add('expanded');
                                        toggleBasketPreview(true);
                                    });
                                };
                                reader.readAsText(file);
                            }
                        });
                        return;
                    }

                    if (droppedText && droppedText.trim().length > 0) {
                        basketOp({
                            kind: 'ADD',
                            item: {
                                text: droppedText.trim(),
                                timestamp: Date.now(),
                                source: window.location.hostname + (isManualScan ? t.src_manual : t.src_drop)
                            }
                        }, () => {
                            showToast(LANG_DATA[state.lang].toast_basket_add || "已拖曳加入籃子 🧺");
                            updateBasketUI();
                            panel.classList.add('expanded');
                            toggleBasketPreview(true);
                        });
                    }
                }, currentCount);
            });
        });

        if (!state.config) {
            if (msg) msg.style.display = 'none';
            if (btnSelectAll) btnSelectAll.style.display = 'none';
            if (btnUnselectAll) btnUnselectAll.style.display = 'none';
            if (transferContainer) transferContainer.style.display = 'none';
            if (transferLabel) transferLabel.style.display = 'none';
            if (btnScan) btnScan.style.display = 'none';
            const curLang = state.lang;
            title.textContent = curLang === 'zh' ? 'ContextDrone' : 'ContextDrone';
        }

        if (state.theme === 'dark') {
            panel.setAttribute('data-theme', 'dark');
        }

        document.body.appendChild(panel);
        makeDraggable(panel, header);
    }

    function createTransportDrone() {
        injectStyles();
        fixGeminiDropZone();
        if (document.getElementById('cc-drone-fab')) return;
        const host = window.location.hostname;
        chrome.storage.local.get(['cc_disabled_domains'], (res) => {
            const disabledList = res.cc_disabled_domains || [];
            if (disabledList.includes(host)) {
                return;
            }
            initDroneDOM();
        });

        pinManager.registerOnChange(() => {
            if (typeof updateHoverCardUI === 'function') updateHoverCardUI();
        });

        function initDroneDOM() {
            let selectionState = {};

            const initData = () => {
                const load = (data) => {
                    basket = data || [];
                    updateDroneVisuals();
                };
                if (typeof getBasket === 'function') getBasket(load);
                else chrome.storage.local.get(['cc_basket'], (res) => load(res.cc_basket));
            };

            function forceInsertToLLM(text) {
                if (!text) return;
                const curT = LANG_DATA[state.lang];
                let inputEl = null;
                if (state.config && state.config.inputSelector) {
                    inputEl = document.querySelector(state.config.inputSelector);
                }
                if (!inputEl) {
                    const genericSelectors = ['#prompt-textarea', 'div[contenteditable="true"].ProseMirror', '.ql-editor[contenteditable="true"]', 'textarea[placeholder*="Ask"]', 'textarea', 'div[contenteditable="true"]', 'input[type="text"]'];
                    for (let sel of genericSelectors) { inputEl = document.querySelector(sel); if (inputEl) break; }
                }
                if (inputEl) {
                    autoFillInput(inputEl, text);
                    showToast(curT.toast_autofill || "Content pasted to input ✨");
                } else {
                    navigator.clipboard.writeText(text).then(() => {
                        showToast(curT.toast_input_not_found || "Content copied to clipboard 📋");
                    });
                }
            }

            const drone = document.createElement('div');
            drone.id = 'cc-drone-fab';
            drone.className = 'cc-drone-fab';

            drone.style.visibility = 'hidden';
            drone.style.opacity = '0';
            chrome.storage.local.get(['cc_drone_pos'], (res) => {
                if (res.cc_drone_pos) {
                    drone.style.left = res.cc_drone_pos.left;
                    drone.style.top = res.cc_drone_pos.top;
                    drone.style.bottom = 'auto'; drone.style.right = 'auto';
                }
                document.body.appendChild(drone);
                requestAnimationFrame(() => {
                    drone.style.visibility = 'visible';
                    drone.style.opacity = '';
                });
            });

            drone.title = LANG_DATA[state.lang].drone_title;
            const t = (state.langData && state.langData[state.lang]) ? state.langData[state.lang] : {};
            drone.innerHTML = `
                <div class="drone-action-btn drone-btn-tl" id="drone-btn-paint" title="${t.btn_paint + t.hint_shortcut_paint || 'Area Selection (ALT+C)'}">🖌️</div>

                <div class="drone-action-btn drone-btn-tr" id="drone-btn-close" title="${t.drone_dismiss || 'Close'}">✕</div>

                <div class="drone-action-btn drone-btn-bl" id="drone-btn-pin" title="${t.btn_ping || 'Drag to Pin'}" draggable="true">📌</div>

                <div class="drone-action-btn drone-btn-br" id="drone-btn-qr" title="${t.btn_qrcode || 'QR Code'}">📱</div>

                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="pointer-events:none;">
                    <path d="M12 2L15 8H9L12 2Z" fill="#00d2ff" fill-opacity="0.8"/>
                    <path d="M2 12L8 9L12 11L16 9L22 12" stroke="#e0e6ed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <rect x="10" y="11" width="4" height="6" rx="1" fill="#334155" stroke="#475569"/>
                    <path d="M4 12V14" stroke="#475569" stroke-width="1.5"/>
                    <path d="M20 12V14" stroke="#475569" stroke-width="1.5"/>
                    <circle cx="2" cy="12" r="1.5" class="drone-propeller" fill="rgba(255,255,255,0.5)"/>
                    <circle cx="22" cy="12" r="1.5" class="drone-propeller" fill="rgba(255,255,255,0.5)"/>
                </svg>
                <div id="cc-drone-badge">0</div>
            `;
            document.body.appendChild(drone);

            const badgeEl = drone.querySelector('#cc-drone-badge');
            const paintBtn = drone.querySelector('#drone-btn-paint');
            const closeBtn = drone.querySelector('#drone-btn-close');
            const pinBtn = drone.querySelector('#drone-btn-pin');
            const qrBtn = drone.querySelector('#drone-btn-qr');

            const card = document.createElement('div');
            card.className = 'cc-hover-card';
            if (state.theme === 'light') card.classList.add('cc-light-mode');
            card.innerHTML = `
                <div class="cc-card-header">
                    <span id="cc-card-label">Cargo: 0</span>
                    <span class="cc-select-all">Select All</span>
                </div>
                
                <div id="cc-pin-section" style="display:none; border-bottom:1px solid #444; margin-bottom:5px; padding-bottom:5px;">
                    <div style="font-size:10px; color:#aaa; padding:0 10px; margin-bottom:4px; font-weight:bold;">📍 CURRENT LOCATIONS</div>
                    <div id="cc-pin-list" style="max-height:100px; overflow-y:auto;"></div>
                </div>

                <div class="cc-list-container" id="cc-list-container"></div>
                <div class="cc-card-footer">
                    <button class="cc-btn-xs cc-btn-primary-xs" id="cc-paste-btn" title="Paste">🪄</button>
                    <button class="cc-btn-xs" id="cc-export-btn" title="Export">💾</button>
                    <button class="cc-btn-xs" id="cc-clear-btn" title="Clear">🗑️</button>
                    <button class="cc-btn-xs" id="cc-expand-btn" title="Expand">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                        </svg>
                    </button> 
                    <button class="cc-btn-xs" id="cc-source-btn" title="Toggle Source">🔗</button>
                </div>
            `;
            document.body.appendChild(card);

            const listContainer = card.querySelector('#cc-list-container');
            const pinSection = card.querySelector('#cc-pin-section');
            const pinListEl = card.querySelector('#cc-pin-list');

            updateHoverCardUI = updateDroneVisuals = () => {
                const curT = LANG_DATA[state.lang];
                const total = basket.length;

                const pins = pinManager.pins;
                if (pins.length > 0) {
                    pinSection.style.display = 'block';
                    pinListEl.innerHTML = '';
                    pins.forEach(p => {
                        const row = document.createElement('div');
                        Object.assign(row.style, {
                            padding: '4px 10px', fontSize: '11px', color: '#eee',
                            cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', transition: 'background 0.2s'
                        });
                        row.onmouseover = () => row.style.background = 'rgba(255,255,255,0.1)';
                        row.onmouseout = () => row.style.background = 'transparent';

                        row.onclick = (e) => {
                            e.stopPropagation();
                            pinManager.scrollToPin(p.id);
                        };

                        row.innerHTML = `
                            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                <span style="margin-right:4px;">📌</span>${escapeHTML(p.text)}
                            </div>
                        `;

                        const delBtn = document.createElement('span');
                        delBtn.innerHTML = '✕';
                        delBtn.style.color = '#888';
                        delBtn.style.paddingLeft = '8px';
                        delBtn.onmouseover = () => delBtn.style.color = '#ff5252';
                        delBtn.onmouseout = () => delBtn.style.color = '#888';
                        delBtn.onclick = (e) => {
                            e.stopPropagation();
                            pinManager.removePin(p.id);
                        };

                        row.appendChild(delBtn);
                        pinListEl.appendChild(row);
                    });
                } else {
                    pinSection.style.display = 'none';
                }

                badgeEl.textContent = total;
                badgeEl.classList.toggle('visible', total > 0);
                if (total > 0) {
                    drone.classList.add('has-cargo');
                    badgeEl.style.opacity = '1'; badgeEl.style.transform = 'scale(1)';
                } else {
                    drone.classList.remove('has-cargo');
                    badgeEl.style.opacity = '0'; badgeEl.style.transform = 'scale(0)';
                }

                basket.forEach((it) => { if (it && it.id && selectionState[it.id] === undefined) selectionState[it.id] = false; });
                const selectedCount = basket.filter(it => it && it.id && selectionState[it.id]).length;
                const isAllSelected = (total > 0 && selectedCount === total);

                const label = card.querySelector('#cc-card-label');
                const selectAllBtn = card.querySelector('.cc-select-all');

                const cargoTitle = curT.drone_cargo || "Cargo";
                label.textContent = `${cargoTitle}: ${total}`;
                selectAllBtn.textContent = isAllSelected ? curT.btn_unselect_all : curT.btn_select_all;

                listContainer.innerHTML = '';
                if (total === 0) {
                    const emptyText = curT.pip_basket_empty || "Empty";
                    const dragText = curT.src_drop || "Drag text here";
                    listContainer.innerHTML = `<div style="text-align:center;padding:30px 10px;color:#666;font-size:12px;">${emptyText}<br><span style="font-size:10px;opacity:0.7">${dragText}</span></div>`;
                } else {
                    basket.forEach((item, idx) => {
                        const row = document.createElement('div');
                        const id = item.id || String(idx);
                        row.className = `cc-list-item ${selectionState[id] ? 'selected' : ''}`;
                        row.draggable = true;
                        const safeText = item.text ? item.text.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])) : '';

                        row.innerHTML = `
                            <div class="cc-check-circle"></div>
                            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; pointer-events:none; opacity:0.9;">
                                ${safeText}
                            </div>
                            <div style="font-size:10px; color:#666; font-family:monospace;">≡</div>
                        `;

                        row.onclick = (e) => {
                            e.stopPropagation();
                            selectionState[id] = !selectionState[id];
                            updateHoverCardUI();
                        };

                        row.ondblclick = (e) => {
                            e.stopPropagation();
                            e.preventDefault();

                            const curT = LANG_DATA[state.lang];

                            showEditorModal(
                                curT.mm_node_edit || "編輯項目",
                                item.text,
                                null,
                                (newText) => {
                                    if (!newText || newText === item.text) return;

                                    updateBasketItemText(id, newText, () => {
                                        showToast("Saved ✨");
                                    });
                                }
                            );
                        };

                        row.addEventListener('dragstart', (e) => {
                            e.dataTransfer.effectAllowed = 'copyMove';
                            const selectedIds = basket
                                .map(it => it && it.id)
                                .filter(itemId => itemId && selectionState[itemId]);

                            let dragText = '';
                            let draggedIds = [];
                            if (selectionState[id] && selectedIds.length > 1) {
                                const selectedItems = selectedIds
                                    .map(selectedId => basket.find(it => it && it.id === selectedId))
                                    .filter(Boolean);

                                dragText = formatDragText(selectedItems);
                                draggedIds = selectedIds;
                                listContainer.querySelectorAll('.cc-list-item.selected').forEach(el => {
                                    el.classList.add('dragging');
                                });
                            } else {
                                dragText = formatDragText(item);
                                draggedIds = [id];
                                row.classList.add('dragging');
                            }
                            e.dataTransfer.setData('text/plain', dragText);
                            if (typeof simpleMarkdownParser === 'function') {
                                const htmlContent = simpleMarkdownParser(dragText);
                                e.dataTransfer.setData('text/html', htmlContent);
                            }
                            e.dataTransfer.setData('application/cc-drone-id', id);
                            e.dataTransfer.setData('application/cc-drone-ids', JSON.stringify(draggedIds));
                        });
                        row.addEventListener('dragend', () => {
                            listContainer.querySelectorAll('.cc-list-item.dragging').forEach(el => {
                                el.classList.remove('dragging');
                            });
                        });
                        row.addEventListener('dragover', (e) => {
                            e.preventDefault();
                            if (e.dataTransfer.types.includes('application/cc-drone-id')) row.style.borderTop = '2px solid #00d2ff';
                        });
                        row.addEventListener('dragleave', () => { row.style.borderTop = 'transparent'; });
                        row.addEventListener('drop', (e) => {
                            e.preventDefault();
                            row.style.borderTop = 'transparent';

                            const fromId = e.dataTransfer.getData('application/cc-drone-id');
                            const toId = item.id;
                            if (!fromId || !toId || fromId === toId) return;

                            const order = basket.map(it => it.id).filter(Boolean);
                            const fromIndex = order.indexOf(fromId);
                            const toIndex = order.indexOf(toId);
                            if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

                            const [moved] = order.splice(fromIndex, 1);
                            order.splice(toIndex, 0, moved);

                            basketOp({ kind: 'REORDER', order }, () => {
                                updateBasketUI();
                            });
                            updateHoverCardUI();
                        });
                        listContainer.appendChild(row);
                    });
                }
                const activeCount = basket.filter(it => it && it.id && selectionState[it.id]).length;
                const pasteBtn = card.querySelector('#cc-paste-btn');
                const pasteTxt = curT.pip_btn_paste || "Paste";

                if (activeCount > 0) {
                    pasteBtn.innerHTML = `🪄(${activeCount})`;
                    pasteBtn.style.opacity = '1';
                    pasteBtn.style.cursor = 'pointer';
                } else {
                    pasteBtn.innerHTML = `🪄`;
                    pasteBtn.style.opacity = '0.5';
                    pasteBtn.style.cursor = 'default';
                }
                const clearBtn = card.querySelector('#cc-clear-btn');
                const expandBtn = card.querySelector('#cc-expand-btn');
                if (clearBtn) clearBtn.title = curT.btn_clear_basket;
                if (expandBtn) expandBtn.title = curT.pip_tooltip_max;
            };

            const moveItem = (index, direction) => {
                const order = basket.map(it => it.id).filter(Boolean);
                const target = index + direction;
                if (target < 0 || target >= order.length) return;

                [order[index], order[target]] = [order[target], order[index]];
                basketOp({ kind: 'REORDER', order });
                updateDroneVisuals();
            };

            const exportBtn = card.querySelector('#cc-export-btn');
            if (exportBtn) {
                exportBtn.onclick = (e) => {
                    e.stopPropagation();
                    card.classList.remove('visible');
                    let currentBasket = basket || [];
                    const selectedItems = currentBasket.filter(it => it && it.id && selectionState[it.id]);
                    if (selectedItems.length > 0) {
                        currentBasket = selectedItems;
                    } else {
                        showToast("No items selected!");
                        return;
                    }

                    if (currentBasket.length === 0) {
                        showToast("Basket is empty!");
                        return;
                    }
                    showUniversalExportModal(window, currentBasket, 'drone-export-' + Date.now());
                };
            }

            const sourceBtn = card.querySelector('#cc-source-btn');
            const updateSourceBtn = () => {
                if (!sourceBtn) return;
                const t = LANG_DATA[state.lang] || {};
                sourceBtn.innerText = state.includeSource ? '🔗' : '⛓️‍💥';
                sourceBtn.style.opacity = state.includeSource ? '1' : '0.5';
                sourceBtn.title = state.includeSource ? (t.btn_source_on || "Source: ON") : (t.btn_source_off || "Source: OFF");
            };

            if (sourceBtn) {
                sourceBtn.onclick = (e) => {
                    e.stopPropagation();
                    state.includeSource = !state.includeSource;
                    updateSourceBtn();

                    const stdBtn = document.getElementById('sys-btn-source-toggle');
                    if (stdBtn) {
                        stdBtn.innerText = state.includeSource ? '🔗' : '⛓️‍💥';
                        stdBtn.style.opacity = state.includeSource ? '1' : '0.5';
                    }
                    const mechBtn = document.getElementById('mech-sys-btn-source');
                    if (mechBtn) {
                        mechBtn.innerText = state.includeSource ? '🔗' : '⛓️‍💥';
                        mechBtn.style.opacity = state.includeSource ? '1' : '0.5';
                        mechBtn.style.color = state.includeSource ? 'var(--mech-accent)' : '#555';
                    }

                    showToast(state.includeSource ? "Source: ON" : "Source: OFF");
                    updateBasketUI();
                };
                updateSourceBtn();
            }

            card.querySelector('#cc-paste-btn').onclick = (e) => {
                e.stopPropagation();
                if (basket.length === 0) return;

                const byId = new Map(basket.filter(it => it && it.id).map(it => [it.id, it]));
                const selectedIds = basket.map(it => it && it.id).filter(id => id && selectionState[id]);

                if (selectedIds.length > 0) {
                    const selectedItems = selectedIds.map(id => byId.get(id)).filter(Boolean);
                    const textToPaste = constructFinalContent(null, selectedItems);
                    forceInsertToLLM(textToPaste);
                    card.style.transform = "translateY(0) scale(1.02)";
                    setTimeout(() => card.style.transform = "translateY(0) scale(1)", 150);
                } else {
                    showToast("Please select items to paste 📋");
                    return;
                }
            };

            card.querySelector('.cc-select-all').onclick = (e) => {
                e.stopPropagation();
                const total = basket.length;
                const currentSel = basket.filter(it => it && it.id && selectionState[it.id]).length;
                const target = currentSel < total;
                selectionState = {}; basket.forEach(it => { if (it && it.id) selectionState[it.id] = target; });
                updateDroneVisuals();
            };

            card.querySelector('#cc-clear-btn').onclick = () => {
                const curT = LANG_DATA[state.lang];
                const selectedIds = basket.map(it => it && it.id).filter(id => id && selectionState[id]);

                if (selectedIds.length > 0) {
                    const title = curT.pip_confirm_del_item || "Delete selected items?";
                    const msg = `Delete ${selectedIds.length} selected items?`;

                    showMainConfirmModal(title, msg, () => {
                        let processed = 0;
                        selectedIds.forEach(id => {
                            basketOp({ kind: 'DELETE', id }, () => {
                                delete selectionState[id];
                                processed++;
                                if (processed === selectedIds.length) {
                                    updateDroneVisuals();
                                    showToast(curT.toast_basket_clear || "Deleted selected items");
                                }
                            });
                        });
                    });
                } else {
                    showToast("Please select items to delete ⚠️");
                }
            };

            card.querySelector('#cc-expand-btn').onclick = () => {
                toggleInterface();
                card.classList.remove('visible');
            };

            let isDragging = false;
            let hasMoved = false;
            let startX, startY, initX, initY;

            const onMouseMove = (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    hasMoved = true;
                    card.classList.remove('visible');
                }
                drone.style.left = (initX + dx) + 'px';
                drone.style.top = (initY + dy) + 'px';
                drone.style.bottom = 'auto'; drone.style.right = 'auto';
            };

            const onMouseUp = () => {
                if (!isDragging) return;
                isDragging = false;
                drone.style.transition = '';
                if (hasMoved) {
                    const rect = drone.getBoundingClientRect();
                    chrome.storage.local.set({ 'cc_drone_pos': { left: rect.left + 'px', top: rect.top + 'px' } });
                }
            };

            drone.addEventListener('mousedown', (e) => {
                if (e.target.closest('.drone-action-btn')) return;
                isDragging = true;
                hasMoved = false;
                startX = e.clientX; startY = e.clientY;
                const rect = drone.getBoundingClientRect();
                initX = rect.left; initY = rect.top;
                drone.style.transition = 'none';
                e.preventDefault();
            });

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);

            const cleanupDrone = () => {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                drone.remove();
                card.remove();
            };

            drone.addEventListener('click', (e) => {
                if (hasMoved || e.target.closest('.drone-action-btn')) return;
                toggleInterface();
                card.classList.remove('visible');
            });

            // Close
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                chrome.storage.local.get(['cc_disabled_domains'], (res) => {
                    const list = res.cc_disabled_domains || [];
                    const h = window.location.hostname;
                    if (!list.includes(h)) {
                        list.push(h);
                        chrome.storage.local.set({ cc_disabled_domains: list });
                    }
                });

                drone.style.transform = "scale(0)";
                setTimeout(() => { cleanupDrone(); }, 200);
            });

            // Paint
            paintBtn.addEventListener('click', (e) => {
                e.stopPropagation();

                if (typeof toggleSelectionMode === 'function') {
                    toggleSelectionMode();

                    paintBtn.style.transform = "scale(0.8)";
                    setTimeout(() => paintBtn.style.transform = "", 150);

                    const card = document.querySelector('.cc-hover-card');
                    if (card) card.classList.remove('visible');
                }
            });

            // QR Code
            qrBtn.addEventListener('click', async (e) => {
                e.stopPropagation();

                attemptFeatureUsage('qrcode', async (currentStats, currentTier) => {

                    let basketItems = [];
                    const selectedItems = basket.filter(it => it && it.id && selectionState[it.id]);
                    if (selectedItems.length > 0) basketItems = selectedItems;

                    let pageSelectedText = "";
                    if (typeof getSelectedText === 'function') pageSelectedText = getSelectedText(false) || "";

                    if (basketItems.length === 0 && !pageSelectedText) {
                        showToast("No items selected! 📱");
                        return;
                    }

                    const WATERMARK_START_AT = 5;
                    const currentUsage = currentStats.counts.qrcode || 0;
                    const shouldAddWatermark = (currentStats.tier === 1 && currentUsage >= WATERMARK_START_AT);

                    const css = `
                        body { font-family: sans-serif; padding: 20px; background: #f9f9f9; color: #333; line-height: 1.6; position: relative; min-height: 100vh; }
                        .card { background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border-left: 4px solid #00d2ff; position: relative; z-index: 1; }
                        .header { text-align: center; margin-bottom: 20px; color: #555; border-bottom: 2px solid #ddd; padding-bottom: 10px; z-index: 1; position: relative; }
                        .content { white-space: pre-wrap; word-break: break-word; font-size: 14px; }
                        .tag { display: inline-block; background: #eee; padding: 2px 6px; border-radius: 4px; font-size: 10px; color: #555; }
                        .watermark-container { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999; display: flex; flex-wrap: wrap; align-content: flex-start; overflow: hidden; opacity: 0.08; }
                        .watermark-text { width: 200px; height: 150px; display: flex; align-items: center; justify-content: center; transform: rotate(-30deg); font-size: 18px; font-weight: bold; color: #000; }
                    `;

                    let htmlContent = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body>`;

                    if (shouldAddWatermark) {
                        let watermarks = "";
                        for (let i = 0; i < 30; i++) watermarks += `<div class="watermark-text">Context Drone<br>Beta</div>`;
                        htmlContent += `<div class="watermark-container">${watermarks}</div>`;
                    }

                    htmlContent += `<div class="header">ContextDrone Share<br><span style="font-size:10px; font-weight:normal;">${new Date().toLocaleString()}</span></div>`;

                    if (pageSelectedText) {
                        htmlContent += `<div class="card" style="border-left-color: #ff9800;"><div style="font-size:12px; color:#999;">📄 Selection</div><div class="content">${escapeHTML(pageSelectedText)}</div></div>`;
                    }

                    basketItems.forEach(item => {
                        const tagsHtml = (item.tags && item.tags.length) ? item.tags.map(t => `<span class="tag">#${t}</span>`).join('') : '';
                        htmlContent += `<div class="card"><div style="font-size:12px; color:#999;">SOURCE: ${escapeHTML(item.source || 'Unknown')}</div><div class="content">${escapeHTML(item.text)}</div><div style="margin-top:8px;">${tagsHtml}</div></div>`;
                    });
                    htmlContent += `</body></html>`;

                    const existing = document.querySelector('.cc-qr-modal');
                    if (existing) existing.remove();

                    const modal = document.createElement('div');
                    modal.className = 'cc-qr-modal';
                    Object.assign(modal.style, {
                        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
                        zIndex: '2147483660', backgroundColor: 'rgba(0,0,0,0.8)',
                        backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    });

                    const limit = (currentStats.tier === 1) ? GROWTH_CONFIG.LIMITS.qrcode.tier1 : GROWTH_CONFIG.LIMITS.qrcode.tier2;
                    const remaining = Math.max(0, limit - currentUsage);
                    const footerMsg = (currentStats.tier >= 2)
                        ? `✨ Pro Tier: High Limits`
                        : `⚠️ Free Tier Left: ${remaining}`;

                    modal.innerHTML = `
                        <div class="cc-qr-card" style="background: #fff; padding: 25px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; max-width: 90%;">
                            <div id="qr-status-text" style="font-weight:bold; margin-bottom:15px; color:#333;">☁️ Encrypting & Uploading...</div>
                            <div id="qrcode-container" style="background:#f5f5f5; padding:20px; border-radius:8px; min-width:200px; min-height:200px; display:flex; justify-content:center; align-items:center;">
                                <div class="cc-spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite;"></div>
                            </div>
                            <div id="qr-footer-text" style="font-size:11px; color:#666; margin-top:15px; text-align: center;">${footerMsg}</div>
                            <button id="cc-close-qr" style="margin-top:20px; padding:8px 30px; cursor:pointer; background:#333; color: #fff; border:none; border-radius:6px;">Close</button>
                        </div>
                        <style>@keyframes spin {0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); }}</style>
                    `;

                    modal.querySelector('#cc-close-qr').onclick = () => modal.remove();
                    document.body.appendChild(modal);

                    const container = modal.querySelector('#qrcode-container');
                    const statusText = modal.querySelector('#qr-status-text');

                    try {
                        const retentionType = (currentStats.tier >= 2) ? 'long' : 'short';
                        const secureLink = await uploadToMyServerSecure(htmlContent, retentionType);

                        statusText.innerText = "📱 Scan to View";
                        container.innerHTML = '';

                        if (typeof qrcode === 'function') {
                            const qr = qrcode(0, 'L');
                            qr.addData(secureLink);
                            qr.make();
                            container.innerHTML = qr.createImgTag(5, 10);
                            const img = container.querySelector('img');
                            if (img) { img.style.maxWidth = '100%'; img.style.height = 'auto'; }
                        }
                    } catch (err) {
                        console.error(err);
                        statusText.innerText = "Error";
                        container.innerHTML = `<div style="color:red; font-size:12px;">Failed to upload.<br>${err.message}</div>`;
                    }
                });
            });

            // Pin
            pinBtn.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                e.dataTransfer.setData('application/cc-pin', 'true');
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/plain', 'ContextDrone Pin');

                const dragIcon = document.createElement('div');
                dragIcon.innerText = '📌';
                Object.assign(dragIcon.style, {
                    fontSize: '24px',
                    position: 'absolute',
                    top: '-9999px',
                    left: '-9999px',
                    pointerEvents: 'none'
                });
                document.body.appendChild(dragIcon);
                e.dataTransfer.setDragImage(dragIcon, 12, 12);
                setTimeout(() => dragIcon.remove(), 0);

                pinBtn.style.opacity = '0.5';
                document.body.classList.add('cc-pin-dragging');
            });

            pinBtn.addEventListener('dragend', (e) => {
                e.stopPropagation();
                pinBtn.style.opacity = '';
                document.body.classList.remove('cc-pin-dragging');
                cleanUpSiteOverlays();
            });

            pinBtn.addEventListener('click', (e) => e.stopPropagation());


            // Drag & Drop
            drone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                drone.classList.add('drag-over');
            });
            drone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                drone.classList.remove('drag-over');
            });
            drone.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                drone.classList.remove('drag-over');
                const text = e.dataTransfer.getData('text');
                const curT = LANG_DATA[state.lang];

                if (text) {

                    getBasket((currentBasket) => {
                        const currentCount = currentBasket ? currentBasket.length : 0;
                        attemptFeatureUsage('context', () => {

                            basketOp({
                                kind: 'ADD',
                                item: {
                                    text: text.trim(),
                                    timestamp: Date.now(),
                                    source: window.location.hostname + (curT.src_drop || " (Drag & Drop)")
                                }
                            }, (res) => {
                                getBasket((newBasket) => {
                                    basket = newBasket;
                                    updateDroneVisuals();
                                    updateDroneUI(newBasket);
                                    showToast(curT.toast_basket_add || "Added 🧺");
                                });
                            });
                        }, currentCount);
                    });
                }
            });

            let hoverTimer;
            const showCard = () => {
                clearTimeout(hoverTimer);
                updateDroneVisuals();
                const dRect = drone.getBoundingClientRect();
                card.style.display = 'flex';
                const cH = card.offsetHeight || 200;
                const cW = card.offsetWidth || 280;

                let top = dRect.top - cH - 12;
                let left = dRect.left + (dRect.width / 2) - (cW / 2);

                if (top < 10) top = dRect.bottom + 12;
                if (left < 10) left = 10;
                if (left + cW > window.innerWidth) left = window.innerWidth - cW - 10;

                card.style.top = top + 'px';
                card.style.left = left + 'px';
                requestAnimationFrame(() => card.classList.add('visible'));
            };

            drone.addEventListener('mouseenter', () => { if (!isDragging) showCard(); });
            drone.addEventListener('mouseleave', () => { hoverTimer = setTimeout(() => card.classList.remove('visible'), 300); });
            card.addEventListener('mouseenter', () => clearTimeout(hoverTimer));
            card.addEventListener('mouseleave', () => { hoverTimer = setTimeout(() => card.classList.remove('visible'), 300); });

            initData();
        }
    }

    function initPinDropLogic() {
        let lastTarget = null;

        document.addEventListener('dragover', (e) => {
            if (!e.dataTransfer) return;
            if (!e.dataTransfer.types.includes('application/cc-pin')) return;

            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';

            const target = e.target;

            if (target.closest('#cc-drone-fab') || target.closest('.cc-chat-pin-marker') || target.closest('.cc-panel') || target.closest('.cc-modal-mask')) {
                return;
            }

            const blockTarget = target.closest('div, p, section, article, li, pre');

            if (blockTarget && blockTarget !== lastTarget) {
                if (lastTarget) lastTarget.classList.remove('cc-pin-target-highlight');
                blockTarget.classList.add('cc-pin-target-highlight');
                lastTarget = blockTarget;
            }
        }, true);

        document.addEventListener('dragleave', (e) => {
            if (!e.dataTransfer) return;
            if (!e.dataTransfer.types.includes('application/cc-pin')) return;
            if (lastTarget && !lastTarget.contains(e.relatedTarget)) {
                lastTarget.classList.remove('cc-pin-target-highlight');
                lastTarget = null;
            }
        }, true);

        document.addEventListener('drop', (e) => {
            if (!e.dataTransfer) return;
            if (!e.dataTransfer.types.includes('application/cc-pin')) return;

            e.preventDefault();
            e.stopPropagation();

            if (lastTarget) {
                lastTarget.classList.remove('cc-pin-target-highlight');
                lastTarget = null;
            }

            const target = e.target.closest('div, p, section, article, li, pre') || e.target;

            if (target.closest('#cc-drone-fab') || target.closest('.cc-panel')) return;

            const rect = target.getBoundingClientRect();
            const offsetX = e.clientX - rect.left;
            const offsetY = e.clientY - rect.top;

            pinManager.addPin(target, offsetX - 12, offsetY - 24);

            if (typeof showToast === 'function') {
                showToast("Location Pinned 📌");
            }

        }, true);
    }

    function updateDroneUI(providedBasket) {
        const drone = document.getElementById('cc-drone-fab');
        if (!drone) return;

        const updateLogic = (basket) => {
            const count = basket.length;
            const badge = document.getElementById('cc-drone-badge');

            if (count > 0) {
                drone.classList.add('has-cargo');
                if (badge) {
                    badge.innerText = count;
                    badge.style.opacity = '1';
                    badge.style.transform = 'scale(1)';
                }
            } else {
                drone.classList.remove('has-cargo');
                if (badge) {
                    badge.innerText = '0';
                    badge.style.opacity = '0';
                    badge.style.transform = 'scale(0)';
                }
            }
        };

        if (Array.isArray(providedBasket)) {
            updateLogic(providedBasket);
        } else {
            getBasket(updateLogic);
        }
    }

    function createRobotPanel() {
        if (document.getElementById('cc-robot-panel')) return;
        const t = LANG_DATA[state.lang];
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

        antenna.onclick = () => openRobotSettings();
        antenna.style.cursor = 'pointer';

        if (shouldShowAI()) {
            antenna.title = t.ai_setting_tab;
            antenna.style.opacity = '1';
        } else {
            antenna.title = t.unlock_title;
            antenna.style.opacity = '0.5';
        }

        antenna.innerHTML = `<div class="antenna-tip"></div><div class="antenna-rod"></div><div class="antenna-base"></div>`;

        const leftShoulder = document.createElement('div');
        leftShoulder.className = 'shoulder-pad shoulder-left';
        leftShoulder.innerHTML = `<div class="linkage"></div>`;

        const btnSelectAll = document.createElement('button');
        btnSelectAll.id = 'mech-btn-select-all';
        btnSelectAll.className = 'mech-btn'; btnSelectAll.innerText = '✅'; btnSelectAll.title = t.btn_select_all;
        btnSelectAll.onclick = handleSelectAll;

        const btnUnselect = document.createElement('button');
        btnUnselect.id = 'mech-btn-unselect';
        btnUnselect.className = 'mech-btn'; btnUnselect.innerText = '⛔'; btnUnselect.title = t.btn_unselect_all;
        btnUnselect.onclick = handleUnselectAll;

        const btnPaint = document.createElement('button');
        btnPaint.id = 'mech-btn-paint';
        btnPaint.className = 'mech-btn'; btnPaint.innerText = '🖌️'; btnPaint.title = t.btn_paint + t.hint_shortcut_paint;
        btnPaint.onclick = () => { toggleSelectionMode(); container.style.opacity = '0.2'; };

        const btnPinRobot = document.createElement('button');
        btnPinRobot.id = 'mech-btn-pin';
        btnPinRobot.className = 'mech-btn';
        btnPinRobot.innerText = '📌';
        btnPinRobot.title = t.btn_ping;

        btnPinRobot.draggable = true;
        btnPinRobot.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            if (!container.classList.contains('deployed')) {
                container.classList.add('deployed');
                updateRobotBasketText();
            }
            if (typeof switchMechTab === 'function') {
                switchMechTab('pins');
            }
            e.dataTransfer.setData('application/cc-pin', 'true');
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/plain', 'Pin');
            const dragIcon = document.createElement('div');
            dragIcon.innerText = '📌';
            Object.assign(dragIcon.style, { fontSize: '24px', position: 'absolute', top: '-9999px', left: '-9999px' });
            document.body.appendChild(dragIcon);
            e.dataTransfer.setDragImage(dragIcon, 12, 12);
            requestAnimationFrame(() => dragIcon.remove());
            document.body.classList.add('cc-pin-dragging');
        });
        btnPinRobot.addEventListener('dragend', () => document.body.classList.remove('cc-pin-dragging'));

        leftShoulder.append(btnSelectAll, btnUnselect, btnPaint, btnPinRobot);

        const rightShoulder = document.createElement('div');
        rightShoulder.className = 'shoulder-pad shoulder-right';
        rightShoulder.innerHTML = `<div class="linkage"></div>`;

        const btnPasteMech = document.createElement('button');
        btnPasteMech.id = 'mech-btn-paste-main';
        btnPasteMech.className = 'mech-btn';
        btnPasteMech.innerText = '🪄';
        btnPasteMech.title = t.btn_paste_basket;
        btnPasteMech.onclick = handlePasteBasket;

        const btnDownload = document.createElement('button');
        btnDownload.id = 'mech-btn-download';
        btnDownload.className = 'mech-btn'; btnDownload.innerText = '💾'; btnDownload.title = t.btn_dl;
        btnDownload.onclick = handleDownload;

        const btnScan = document.createElement('button');
        btnScan.id = 'mech-btn-scan';
        btnScan.className = 'mech-btn'; btnScan.innerText = '↻'; btnScan.title = t.btn_scan;
        btnScan.onclick = () => { performScan(); btnScan.style.color = '#00d2ff'; setTimeout(() => btnScan.style.color = '', 500); };

        const btnQrRobot = document.createElement('button');
        btnQrRobot.className = 'mech-btn';
        btnQrRobot.innerText = '📱';
        btnQrRobot.title = "QR Code";
        btnQrRobot.onclick = handleQrCodeAction;

        rightShoulder.append(btnPasteMech, btnQrRobot, btnDownload, btnScan);

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
        if (state.theme === 'light') themeSwitch.classList.add('active');
        themeSwitch.title = t.btn_theme_title;
        themeSwitch.style.borderColor = '#ff9800';
        themeSwitch.onclick = function () {
            const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
            applyTheme(nextTheme);
        };
        const langSwitch = document.createElement('div');
        langSwitch.className = 'power-btn';
        langSwitch.id = 'mech-btn-lang';

        langSwitch.title = t.btn_lang_title + t.hint_shortcut_lang;
        langSwitch.style.borderColor = '#4CAF50';

        langSwitch.onclick = function (e) {
            e.stopPropagation();

            if (typeof showLanguageMenu === 'function') {
                showLanguageMenu(this);
            } else {
                console.error('showLanguageMenu function not found');
            }
        };

        powerGroup.append(uiSwitch, themeSwitch, langSwitch);

        const actionGroup = document.createElement('div');
        actionGroup.style.display = 'flex';
        actionGroup.style.alignItems = 'center';
        actionGroup.style.gap = '6px';

        if ('documentPictureInPicture' in window) {
            const ejectBtn = document.createElement('div');
            ejectBtn.className = 'mech-close-btn';
            ejectBtn.id = 'mech-btn-eject';
            ejectBtn.innerText = '⏏';
            ejectBtn.title = t.btn_pip;
            ejectBtn.style.borderColor = '#00d2ff';
            ejectBtn.style.color = '#00d2ff';
            ejectBtn.style.background = 'rgba(0, 210, 255, 0.1)';

            ejectBtn.onmouseenter = () => { ejectBtn.style.background = '#00d2ff'; ejectBtn.style.color = '#000'; };
            ejectBtn.onmouseleave = () => { ejectBtn.style.background = 'rgba(0, 210, 255, 0.1)'; ejectBtn.style.color = '#00d2ff'; };
            ejectBtn.onclick = openDedicatedPiP;
            actionGroup.appendChild(ejectBtn);
        }
        const closeBtn = document.createElement('div');
        closeBtn.className = 'mech-close-btn';
        closeBtn.id = 'mech-btn-close';
        closeBtn.innerText = '✕';
        closeBtn.title = t.btn_close_title + t.hint_shortcut_toggle;
        closeBtn.onclick = closeInterface;
        actionGroup.appendChild(closeBtn);
        controlsDiv.append(powerGroup, actionGroup);

        const visor = document.createElement('div');
        visor.className = 'visor';
        Object.assign(visor.style, {
            backgroundColor: '#111',
            backgroundImage: 'linear-gradient(to bottom, #1a1a1a, #000)',
            boxShadow: 'inset 0 0 10px #000',
            overflow: 'hidden',
            zIndex: '2'
        });
        makeDraggable(container, visor);

        const statusDiv = document.createElement('div');
        statusDiv.className = 'visor-status';
        statusDiv.innerHTML = `<span class="status-dot"></span><span id="mech-status-text">${t.status_ready}</span>`;
        msg = statusDiv.querySelector('#mech-status-text');


        if (shouldShowAI()) {
            const commsBtn = document.createElement('button');
            commsBtn.id = 'mech-comms-btn';
            commsBtn.className = 'comms-btn';
            commsBtn.innerHTML = `<span class="icon">📶</span>${t.robot_comms_tab}`;
            commsBtn.title = t.ai_response_tab;
            commsBtn.onclick = () => {
                if (state.streamingModal && state.streamingModal.element) {
                    state.streamingModal.restore();
                } else {
                    const ctx = state.lastAiContext || "";
                    const cfg = state.lastAiConfig || state.aiConfig;
                    chrome.storage.local.get(['cc_last_layout_mode'], (res) => {
                        const savedMode = res.cc_last_layout_mode || 'single';
                        const modal = showStreamingResponseModalMulti(ctx, cfg, savedMode);
                        if (state.lastAiText) {
                        }
                    });
                }
            };
            visor.append(statusDiv, commsBtn);
        }

        const inputDeck = document.createElement('div');
        inputDeck.className = 'input-deck';

        const mechToolbar = document.createElement('div');
        mechToolbar.className = 'mech-sys-toolbar';
        Object.assign(mechToolbar.style, {
            display: 'flex', justifyContent: 'flex-end', gap: '6px',
            marginBottom: '4px', paddingRight: '4px'
        });

        function createMechSysBtn(id, textKey, tooltipKey, promptKey, isCustom = false) {
            const btn = createSysBtn(id, textKey, tooltipKey, promptKey);
            btn.style.color = 'var(--mech-accent)';
            btn.style.border = '1px solid #333';
            btn.style.background = '#000';
            return btn;
        }

        const mechBtnNone = createMechSysBtn('mech-sys-btn-none', 'None', 'No Prompt', null);
        mechBtnNone.innerText = '🛑';
        mechBtnNone.onclick = (e) => {
            e.stopPropagation();
            if (prefixInput) {
                prefixInput.value = "";
                calculateTotalTokens();
                flashInput(prefixInput);
            }
        };

        const mechBtnSource = createMechSysBtn('mech-sys-btn-source', 'Src', 'Toggle Source', null);
        const updateMechSourceStyle = () => {
            mechBtnSource.innerText = state.includeSource ? '🔗' : '⛓️‍💥';
            mechBtnSource.style.opacity = state.includeSource ? '1' : '0.5';
            mechBtnSource.style.color = state.includeSource ? 'var(--mech-accent)' : '#555';
        };
        updateMechSourceStyle();
        mechBtnSource.onclick = (e) => {
            e.stopPropagation();
            state.includeSource = !state.includeSource;
            updateMechSourceStyle();

            const stdBtn = document.getElementById('sys-btn-source-toggle');
            if (stdBtn) {
                stdBtn.innerText = state.includeSource ? '🔗' : '⛓️‍💥';
                stdBtn.style.opacity = state.includeSource ? '1' : '0.5';
            }

            showToast(state.includeSource ? "Source: ON" : "Source: OFF");
            updateBasketUI();
        };

        const mechBtnSum = createMechSysBtn('mech-sys-btn-sum', 'sys_btn_summary', 'sys_tooltip_summary', 'sys_prompt_summary');
        const mechBtnTrans = createMechSysBtn('mech-sys-btn-trans', 'sys_btn_translate', 'sys_tooltip_translate', 'sys_prompt_translate');
        const mechBtnExp = createMechSysBtn('mech-sys-btn-exp', 'sys_btn_explain', 'sys_tooltip_explain', 'sys_prompt_explain');
        const mechBtnSave = createMechSysBtn('mech-btn-save', 'sys_btn_save', 'sys_tooltip_save', null);
        mechBtnSave.onclick = (e) => { e.stopPropagation(); handleSavePromptClick(); };
        const mechBtnLoad = createMechSysBtn('mech-btn-load', 'sys_btn_custom_user', 'sys_tooltip_load', null);
        mechBtnLoad.textContent = '👤';
        mechBtnLoad.onclick = (e) => { e.stopPropagation(); handleLoadPromptClick(mechBtnLoad); };

        mechToolbar.append(mechBtnNone, mechBtnSum, mechBtnTrans, mechBtnExp, mechBtnSave, mechBtnLoad);

        const robotInput = document.createElement('textarea');
        robotInput.className = 'main-input';
        robotInput.id = 'cc-prefix-input';
        robotInput.placeholder = t.placeholder;
        robotInput.value = document.getElementById('cc-prefix-input') ? document.getElementById('cc-prefix-input').value : t.default_prompt;
        robotInput.addEventListener('input', calculateTotalTokens);
        prefixInput = robotInput;

        inputDeck.append(mechToolbar, robotInput)

        if (shouldShowAI()) {
            const aiTrigger = document.createElement('button');
            aiTrigger.id = 'mech-ai-trigger';
            aiTrigger.className = 'ai-trigger-btn';
            aiTrigger.innerText = '✨';
            aiTrigger.title = t.btn_summary;
            aiTrigger.onclick = handleAiSummary;
            inputDeck.append(aiTrigger);
        }

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
            <div class="cc-drop-text" style="font-size: 10px; font-weight: bold; letter-spacing:1px;">${t.overlay_acquiring}</div>
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
        const mechTabBar = document.createElement('div');
        mechTabBar.id = 'mech-content-tab-bar';
        Object.assign(mechTabBar.style, {
            display: 'flex',
            gap: '4px',
            marginBottom: '8px',
            padding: '0 4px'
        });

        const createMechTab = (id, label, icon, isDefault = false) => {
            const tab = document.createElement('button');
            tab.id = id;
            tab.className = 'mech-content-tab' + (isDefault ? ' active' : '');
            tab.innerHTML = `${icon} <span>${label}</span><span class="mech-tab-badge" style="display:none;margin-left:4px;background:#ff5252;color:#fff;padding:0 5px;border-radius:10px;font-size:9px;"></span>`;
            Object.assign(tab.style, {
                flex: '1',
                padding: '6px 8px',
                border: '1px solid var(--mech-border, #333)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '10px',
                fontWeight: '600',
                letterSpacing: '1px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 0.2s',
                background: isDefault ? 'var(--mech-accent, #00d2ff)' : 'transparent',
                color: isDefault ? '#000' : 'var(--mech-text-dim, #666)'
            });
            return tab;
        };

        const mechTabBasket = createMechTab('mech-tab-basket', 'CARGO', '📦', state.contentPanelTab === 'basket');
        const mechTabPins = createMechTab('mech-tab-pins', 'PINS', '📍', state.contentPanelTab === 'pins');

        const switchMechTab = (tabName) => {
            state.contentPanelTab = tabName;
            const isBasket = tabName === 'basket';

            mechTabBasket.style.background = isBasket ? 'var(--mech-accent, #00d2ff)' : 'transparent';
            mechTabBasket.style.color = isBasket ? '#000' : 'var(--mech-text-dim, #666)';
            mechTabBasket.classList.toggle('active', isBasket);

            mechTabPins.style.background = !isBasket ? 'var(--mech-accent, #00d2ff)' : 'transparent';
            mechTabPins.style.color = !isBasket ? '#000' : 'var(--mech-text-dim, #666)';
            mechTabPins.classList.toggle('active', !isBasket);

            const mechBasketSection = document.getElementById('mech-basket-section');
            const mechPinSection = document.getElementById('mech-pin-section');

            if (mechBasketSection) mechBasketSection.style.display = isBasket ? 'block' : 'none';
            if (mechPinSection) mechPinSection.style.display = !isBasket ? 'block' : 'none';
        };

        mechTabBasket.onclick = () => switchMechTab('basket');
        mechTabPins.onclick = () => switchMechTab('pins');

        mechTabBar.append(mechTabBasket, mechTabPins);

        updateMechTabBadges = () => {
            const basketBadge = mechTabBasket.querySelector('.mech-tab-badge');
            const pinBadge = mechTabPins.querySelector('.mech-tab-badge');

            if (basketBadge) {
                const count = basket.length;
                basketBadge.textContent = count;
                basketBadge.style.display = count > 0 ? 'inline' : 'none';
            }

            if (pinBadge) {
                const pinCount = pinManager.pins.length;
                pinBadge.textContent = pinCount;
                pinBadge.style.display = pinCount > 0 ? 'inline' : 'none';
            }
        };
        const mechPinChangeCallback = () => {
            updateMechTabBadges();
            renderMechPinPanel();
        };
        pinManager.registerOnChange(mechPinChangeCallback);
        setTimeout(() => mechPinChangeCallback(), 0);

        const mechBasketSection = document.createElement('div');
        mechBasketSection.id = 'mech-basket-section';

        const tools = document.createElement('div');
        tools.className = 'basket-tools';
        tools.id = 'mech-basket-toolbar';
        const btnAdd = document.createElement('button'); btnAdd.className = 'tiny-btn'; btnAdd.innerText = t.btn_add_basket; btnAdd.onclick = handleAddToBasket; btnAdd.id = 'mech-basket-add';
        const btnNewDoc = document.createElement('button'); btnNewDoc.className = 'tiny-btn'; btnNewDoc.id = 'mech-basket-new'; btnNewDoc.innerText = t.btn_new_doc; btnNewDoc.onclick = handleNewDoc;
        const btnClear = document.createElement('button'); btnClear.className = 'tiny-btn'; btnClear.innerText = t.btn_clear_basket; btnClear.style.color = '#ff5555'; btnClear.onclick = handleClearBasket; btnClear.id = 'mech-basket-clear';
        tools.append(mechBtnSource, btnAdd, btnNewDoc, btnClear);

        const list = document.createElement('div');
        list.id = 'mech-basket-list';
        basketPreviewList = list;
        mechBasketSection.append(tools, list);

        const mechPinSection = document.createElement('div');
        mechPinSection.id = 'mech-pin-section';
        Object.assign(mechPinSection.style, {
            display: 'none',
            padding: '4px'
        });

        const mechPinTools = document.createElement('div');
        mechPinTools.className = 'basket-tools';
        Object.assign(mechPinTools.style, {
            marginBottom: '8px',
            justifyContent: 'space-between'
        });

        const mechPinStatus = document.createElement('span');
        mechPinStatus.id = 'mech-pin-status';
        mechPinStatus.textContent = t.pin_status_empty || '📍 NO PINS';
        Object.assign(mechPinStatus.style, {
            fontSize: '10px',
            color: 'var(--mech-text-dim)',
            letterSpacing: '1px'
        });

        const mechBtnClearPins = document.createElement('button');
        mechBtnClearPins.className = 'tiny-btn';
        mechBtnClearPins.innerText = '🗑️';
        mechBtnClearPins.id = 'mech-pin-clear';
        mechBtnClearPins.style.color = '#ff5555';
        mechBtnClearPins.onclick = () => {
            const t = LANG_DATA[state.lang];
            if (pinManager.pins.length === 0) return;
            showMainConfirmModal(
                t.confirm_clear_pins || 'Clear all pins?',
                t.confirm_clear_pins_msg || 'This will remove all pinned locations.',
                () => {
                    while (pinManager.pins.length > 0) {
                        pinManager.removePin(pinManager.pins[0].id);
                    }
                    showToast(t.toast_pins_cleared || 'All pins cleared');
                }
            );
        };

        mechPinTools.append(mechPinStatus, mechBtnClearPins);

        const mechPinList = document.createElement('div');
        mechPinList.id = 'mech-pin-list';
        Object.assign(mechPinList.style, {
            maxHeight: '180px',
            overflowY: 'auto'
        });

        const renderMechPinPanel = () => {
            mechPinList.innerHTML = '';
            const pins = pinManager.pins;

            if (pins.length === 0) {
                mechPinStatus.textContent = t.pin_status_empty || '📍 NO PINS';
                mechPinStatus.style.color = 'var(--mech-text-dim)';
                mechPinList.innerHTML = `<div style="text-align:center;color:var(--mech-text-dim);font-size:10px;padding:20px;border:1px dashed var(--mech-border);border-radius:4px;letter-spacing:1px;">
                    ${t.pin_empty_hint || 'DRAG 📌 TO PIN LOCATIONS'}
                </div>`;
                updateMechTabBadges();
                return;
            }

            mechPinStatus.textContent = (t.pin_status || '📍 {n} PINS').replace('{n}', pins.length).toUpperCase();
            mechPinStatus.style.color = 'var(--mech-accent)';

            pins.forEach((p, idx) => {
                const row = document.createElement('div');
                row.className = 'mech-pin-item';
                Object.assign(row.style, {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px',
                    marginBottom: '4px',
                    background: 'var(--mech-bg-dark, #1a1a1a)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: '1px solid var(--mech-border, #333)'
                });

                row.onmouseenter = () => {
                    row.style.borderColor = 'var(--mech-accent, #00d2ff)';
                    row.style.background = 'var(--mech-bg-hover, #252525)';
                };
                row.onmouseleave = () => {
                    row.style.borderColor = 'var(--mech-border, #333)';
                    row.style.background = 'var(--mech-bg-dark, #1a1a1a)';
                };

                const info = document.createElement('div');
                info.style.flex = '1';
                info.style.overflow = 'hidden';
                info.innerHTML = `
                    <div style="font-size:9px;color:var(--mech-text-dim);margin-bottom:2px;letter-spacing:1px;">📍 PIN ${idx + 1}</div>
                    <div style="font-size:10px;color:var(--mech-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHTML(p.text)}</div>
                `;

                const actions = document.createElement('div');
                actions.style.display = 'flex';
                actions.style.gap = '4px';

                const gotoBtn = document.createElement('button');
                gotoBtn.innerHTML = '🎯';
                gotoBtn.title = t.pin_goto || 'Jump to location';
                Object.assign(gotoBtn.style, {
                    background: 'transparent',
                    border: '1px solid var(--mech-border)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '4px 6px',
                    transition: 'all 0.2s'
                });
                gotoBtn.onmouseenter = () => { gotoBtn.style.borderColor = 'var(--mech-accent)'; };
                gotoBtn.onmouseleave = () => { gotoBtn.style.borderColor = 'var(--mech-border)'; };
                gotoBtn.onclick = (e) => {
                    e.stopPropagation();
                    pinManager.scrollToPin(p.id);
                };

                const delBtn = document.createElement('button');
                delBtn.innerHTML = '✕';
                delBtn.title = t.pin_remove || 'Remove pin';
                Object.assign(delBtn.style, {
                    background: 'transparent',
                    border: '1px solid var(--mech-border)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    color: 'var(--mech-text-dim)',
                    padding: '4px 6px',
                    transition: 'all 0.2s'
                });
                delBtn.onmouseenter = () => { delBtn.style.color = '#ff5252'; delBtn.style.borderColor = '#ff5252'; };
                delBtn.onmouseleave = () => { delBtn.style.color = 'var(--mech-text-dim)'; delBtn.style.borderColor = 'var(--mech-border)'; };
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    pinManager.removePin(p.id);
                };

                actions.append(gotoBtn, delBtn);
                row.append(info, actions);

                row.onclick = () => pinManager.scrollToPin(p.id);

                mechPinList.appendChild(row);
            });

            updateMechTabBadges();
        };

        mechPinSection.append(mechPinTools, mechPinList);
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
        thrusters.id = 'mech-thrusters';
        PLATFORMS.forEach(p => {
            const btn = document.createElement('div');
            btn.className = 'thruster-btn';
            const iconUrl = chrome.runtime.getURL(`images/${p.id}_${state.theme}.png`);
            btn.innerHTML = `
                <img src="${iconUrl}" 
                     class="cc-platform-icon" 
                     data-pid="${p.id}" 
                     style="width:14px; height:14px; vertical-align:middle; object-fit:contain;">
            `;
            btn.title = t.tooltip_transfer_to.replace('{name}', p.name);
            btn.onclick = () => handleCrossTransfer(p);
            thrusters.appendChild(btn);
        });

        cargoContent.append(mechTabBar, mechBasketSection, mechPinSection, tokenDisplay, thrusters);
        basketContainer.appendChild(cargoContent);
        suspension.appendChild(basketContainer);

        container.append(antenna, leftShoulder, rightShoulder, head, suspension);
        document.body.appendChild(container);

        container.addEventListener('dragover', (e) => {
            if (e.dataTransfer.types.includes('application/cc-sort')) return;
            if (!e.dataTransfer.types.includes('application/cc-pin')) {
                if (state.contentPanelTab !== 'basket' && typeof switchMechTab === 'function') {
                    switchMechTab('basket');
                }
            }
            e.preventDefault();
            e.stopPropagation();
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
            const curT = LANG_DATA[state.lang];
            if (e.dataTransfer.types && e.dataTransfer.types.includes('application/cc-sort')) return;
            e.preventDefault();
            e.stopPropagation();

            const droppedFiles = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
            const droppedText = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
            const isManualScan = e.dataTransfer.types.includes('application/cc-scan-item');

            getBasket((currentBasket) => {
                const currentCount = currentBasket ? currentBasket.length : 0;

                attemptFeatureUsage('context', () => {
                    if (droppedFiles.length > 0) {
                        const MAX_FILE_SIZE = 10 * 1024 * 1024;
                        droppedFiles.forEach((file) => {
                            if (file.size > MAX_FILE_SIZE) {
                                showToast(`❌ File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 10MB.`);
                                return;
                            }
                            if ((file.type && file.type.includes('text/plain')) ||
                                /\.(md|txt|js|py|html|css|json)$/i.test(file.name)) {

                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                    const content = (ev.target.result || '').trim();
                                    if (!content) return;

                                    basketOp({
                                        kind: 'ADD',
                                        item: {
                                            text: content,
                                            timestamp: Date.now(),
                                            source: file.name + (curT.src_file || " (File)")
                                        }
                                    }, () => {
                                        showToast("File loaded: " + file.name);
                                        cleanUpSiteOverlays();
                                    });
                                };
                                reader.readAsText(file);
                            }
                        });

                        return;
                    }

                    if (droppedText && droppedText.trim().length > 0) {
                        basketOp({
                            kind: 'ADD',
                            item: {
                                text: droppedText.trim(),
                                timestamp: Date.now(),
                                source: window.location.hostname + (isManualScan ? curT.src_manual : curT.src_drop)
                            }
                        }, () => {
                            showToast(curT.toast_basket_add || "Data Acquired 📥");
                            updateBasketUI();
                        });
                    }
                }, currentCount);
            });
        });

        setTimeout(() => container.classList.add('cc-visible'), 10);
        updateBasketUI();
        updateUITexts();
    }

    function openRobotSettings(initialConfig = null, onSaveCallback = null, targetDoc = document) {
        if (!state.isUnlocked) {
            showFeatureUnlockModal();
            return;
        }
        if (targetDoc.querySelector('.mech-config-overlay')) return;

        const t = LANG_DATA[state.lang];
        const currentConfig = initialConfig || state.aiConfig || {};
        const allConfigs = state.allAiConfigs || [];

        const overlay = targetDoc.createElement('div');
        overlay.className = 'mech-config-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)',
            zIndex: '2147483660', display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: '0', animation: 'fadeIn 0.3s forwards'
        });
        const card = targetDoc.createElement('div');
        card.className = 'mech-config-card';
        if (targetDoc !== document) {
            card.style.width = '90%';
            card.style.transform = 'scale(0.9)';
        }

        const profileOptions = allConfigs.map(c =>
            `<option value="${escapeHTML(c.name)}" ${currentConfig.name === c.name ? 'selected' : ''}>${escapeHTML(c.name)} (${escapeHTML(c.provider)})</option>`
        ).join('');

        card.innerHTML = `
            <div class="mech-config-header">
                <span>${t.mech_header}</span>
                <span style="font-size:12px; opacity:0.7">${t.mech_sub}</span>
            </div>

            <div class="mech-field" style="background:rgba(0,0,0,0.3); padding:10px; border:1px dashed var(--mech-border); margin-bottom:15px;">
                <span class="mech-label" style="color:var(--mech-accent);">${t.label_load_profile}</span>
                <div style="display:flex; gap:6px;">
                    <select id="mech-saved-profiles" class="mech-select" style="flex:1;">
                        <option value="__new__">${t.option_new_profile}</option>
                        ${profileOptions}
                    </select>
                </div>
            </div>
            
            <div class="mech-field">
                <span class="mech-label">${t.label_config_name}</span>
                <input type="text" id="mech-config-name" class="mech-input" placeholder="${t.ph_config_name}" value="${escapeHTML(currentConfig.name || 'Default')}">
            </div>

            <div class="mech-field">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="mech-label">${t.label_ai_provider}</span>
                    <span id="mech-endpoint-toggle" style="font-size:10px; cursor:pointer; color:var(--mech-accent); letter-spacing:1px; opacity:0.8;">${t.mech_edit_ep}</span>
                </div>
                <select id="mech-provider" class="mech-select">
                    <option value="openai">OpenAI (ChatGPT)</option>
                    <option value="claude">Anthropic (Claude)</option>
                    <option value="gemini">Google (Gemini)</option>
                    <option value="grok">xAI (Grok)</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="perplexity">Perplexity</option>
                    <option value="ollama">Local (Ollama)</option>
                    <option value="lm-studio">Local (LM Studio)</option>
                </select>
            </div>

            <div class="mech-field" id="field-key">
                <span class="mech-label">${t.label_api_key}</span>
                <input type="password" id="mech-key" class="mech-input" placeholder="${t.ph_api_key}" autocomplete="new-password" data-lpignore="true" aria-label="AI Service API Key">
            </div>

            <div class="mech-field" id="field-endpoint" style="display:none;">
                <span class="mech-label">${t.label_endpoint}</span>
                <input type="text" id="mech-endpoint" class="mech-input" placeholder="e.g. https://generativelanguage.googleapis.com...">
                <div style="font-size:9px; color:#666; margin-top:4px;">* Leave empty to use auto-generated default URL</div>
            </div>

            <div class="mech-field">
                <span class="mech-label">${t.label_target_model}</span>
                <div style="display:flex; gap:6px;">
                    <select id="mech-model-select" class="mech-select" style="width:30px; padding:0 4px; flex:0 0 auto; text-align:center;">
                        <option value="">▼</option>
                    </select>
                    <input type="text" id="mech-model" class="mech-input" placeholder="${t.ph_model}" style="flex:1;">
                </div>
            </div>

            <div class="mech-deco-line"></div>

            <div class="mech-btn-group">
                <button id="mech-cancel" class="mech-cancel-btn">${t.btn_abort || 'ABORT'}</button>
                <button id="mech-save" class="mech-action-btn">${t.ai_save || 'SAVE CONFIG'}</button>
            </div>

            <div style="display:flex; gap:10px; margin-top:15px; border-top:1px dashed var(--mech-border); padding-top:10px; opacity:0.7;">
                <button id="mech-export" style="flex:1; background:transparent; border:none; color:var(--mech-text-dim); font-size:10px; cursor:pointer; text-transform:uppercase; letter-spacing:1px;">
                    [ ${t.btn_export_json} ]
                </button>
                <button id="mech-import" style="flex:1; background:transparent; border:none; color:var(--mech-text-dim); font-size:10px; cursor:pointer; text-transform:uppercase; letter-spacing:1px;">
                    [ ${t.btn_import_json} ]
                </button>
            </div>
        `;

        overlay.appendChild(card);
        targetDoc.body.appendChild(overlay);

        const profileSelect = card.querySelector('#mech-saved-profiles');
        const nameInput = card.querySelector('#mech-config-name');
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
        const btnExport = card.querySelector('#mech-export');
        const btnImport = card.querySelector('#mech-import');

        btnExport.onclick = () => {
            chrome.storage.local.get(['cc_all_ai_configs', 'cc_ai_config', 'cc_active_ai_config_name'], (data) => {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `cc-mech-config-${new Date().toISOString().slice(0, 10)}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        };

        btnImport.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const json = JSON.parse(ev.target.result);
                        if (json.cc_all_ai_configs) {
                            const t = LANG_DATA[state.lang];
                            const title = t.import_confirm_title || 'Import Config?';
                            const msg = t.import_confirm_msg || 'This will overwrite current system config. Proceed?';
                            showMainConfirmModal(title, msg, () => {
                                chrome.storage.local.set(json, () => {
                                    state.allAiConfigs = json.cc_all_ai_configs || [];
                                    let active = json.cc_ai_config;
                                    if (!active && json.cc_active_ai_config_name) {
                                        active = state.allAiConfigs.find(c => c.name === json.cc_active_ai_config_name);
                                    }
                                    if (!active && state.allAiConfigs.length > 0) active = state.allAiConfigs[0];
                                    state.aiConfig = active || {};
                                    showToast(t.msg_import_success);
                                    overlay.remove();
                                    if (typeof loadAiConfig === 'function') loadAiConfig();
                                    openRobotSettings();
                                });
                            });
                        } else {
                            showToast("DATA CORRUPTED (Invalid JSON)");
                        }
                    } catch (err) {
                        console.error(err);
                        showToast("READ ERROR");
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        };

        const updateUIState = () => {
            const val = providerSel.value;
            if (val === 'local') {
                fieldKey.style.display = 'none';
                fieldEndpoint.style.display = 'block';
                epToggle.style.display = 'none';
            } else {
                fieldKey.style.display = 'block';
                epToggle.style.display = 'block';
            }
        };

        async function updateModelList(provider) {
            if (!modelSelect) return;
            modelSelect.innerHTML = `<option value="">...</option>`;
            let models = MODEL_PRESETS[provider] || [];

            if (provider === 'local' || provider === 'ollama' || provider === 'lm-studio') {
                try {
                    let defaultPort = '11434';
                    if (provider === 'lm-studio') defaultPort = '1234';
                    const currentEndpoint = endpointInput.value || `http://localhost:${defaultPort}`;
                    const response = await new Promise(resolve =>
                        chrome.runtime.sendMessage({
                            action: "GET_LOCAL_MODELS",
                            provider: provider,
                            endpoint: currentEndpoint
                        }, resolve)
                    );

                    if (response && response.success) models = response.models;
                } catch (e) {
                    console.error("Model fetch error:", e);
                }
            }

            modelSelect.innerHTML = '<option value="">▼</option>';
            models.forEach(m => {
                const opt = document.createElement('option');
                const val = m.id || m;
                opt.value = val;
                opt.textContent = val;
                modelSelect.appendChild(opt);
            });
        }

        const fillForm = (cfg) => {
            nameInput.value = cfg.name || '';
            providerSel.value = cfg.provider || 'openai';
            keyInput.value = cfg.apiKey || '';
            endpointInput.value = cfg.endpoint || '';
            modelInput.value = cfg.model || '';
            updateUIState();
            updateModelList(providerSel.value);
        };
        fillForm(currentConfig);
        profileSelect.onchange = () => {
            const selectedName = profileSelect.value;
            if (selectedName === '__new__') fillForm({ name: 'New Config', provider: 'openai' });
            else {
                const cfg = allConfigs.find(c => c.name === selectedName);
                if (cfg) fillForm(cfg);
            }
        };

        epToggle.onclick = () => {
            const isHidden = fieldEndpoint.style.display === 'none';
            fieldEndpoint.style.display = isHidden ? 'block' : 'none';
            epToggle.innerText = isHidden ? t.mech_hide_ep : t.mech_edit_ep;
            epToggle.style.color = isHidden ? '#fff' : 'var(--mech-accent)';
        };

        providerSel.addEventListener('change', async () => {
            updateUIState(false);
            const provider = providerSel.value;

            let defModel = '';
            if (MODEL_PRESETS[provider] && MODEL_PRESETS[provider].length > 0) {
                defModel = MODEL_PRESETS[provider][0];
            }

            let defEp = API_ENDPOINTS[provider] || '';

            if (defEp.includes('{model}')) {
                defEp = defEp.replace('{model}', defModel);
            }

            if (!defEp) {
                if (provider === 'local' || provider === 'ollama') {
                    defEp = 'http://localhost:11434/api/chat';
                } else if (provider === 'lm-studio') {
                    defEp = 'http://localhost:1234/v1/chat/completions';
                }
            }

            endpointInput.value = defEp;
            modelInput.value = defModel;
            await updateModelList(provider);
        });

        modelSelect.addEventListener('change', () => {
            if (modelSelect.value) {
                modelInput.value = modelSelect.value;
                const provider = providerSel.value;
                const templateEp = API_ENDPOINTS[provider];
                if (templateEp && templateEp.includes('{model}')) {
                    endpointInput.value = templateEp.replace('{model}', modelSelect.value);
                }
            }
        });

        updateUIState(true);
        btnSave.onclick = () => {
            const provider = providerSel.value;
            const finalEndpoint = endpointInput.value.trim();
            const finalKey = (provider === 'local') ? '' : keyInput.value.trim();
            const finalModel = modelInput.value.trim();
            const configName = nameInput.value.trim() || 'Custom Config';

            const newConfig = {
                configured: true,
                name: configName,
                provider: provider,
                endpoint: finalEndpoint,
                apiKey: finalKey,
                model: finalModel
            };

            btnSave.innerText = t.ai_save_indicator_saving || "SAVING...";

            chrome.storage.local.get(['cc_all_ai_configs'], (result) => {
                let latestAllConfigs = result.cc_all_ai_configs || [];

                const existingIndex = latestAllConfigs.findIndex(c => c.name === configName);
                if (existingIndex >= 0) {
                    latestAllConfigs[existingIndex] = newConfig;
                } else {
                    latestAllConfigs.push(newConfig);
                }

                chrome.storage.local.set({
                    'cc_all_ai_configs': latestAllConfigs,
                    'cc_ai_config': newConfig,
                    'cc_active_ai_config_name': configName
                }, () => {
                    state.allAiConfigs = latestAllConfigs;
                    state.aiConfig = newConfig;

                    btnSave.innerText = t.ai_save_indicator_saved || "SAVED";
                    setTimeout(() => {
                        overlay.remove();
                        if (onSaveCallback) onSaveCallback(newConfig);
                        if (typeof loadAiConfig === 'function') loadAiConfig();
                    }, 500);
                });
            });
        };

        btnCancel.onclick = () => overlay.remove();

        let isMouseDownOnOverlay = false;

        card.onmousedown = (e) => e.stopPropagation();
        card.onclick = (e) => e.stopPropagation();

        overlay.onmousedown = (e) => {
            if (e.target === overlay) isMouseDownOnOverlay = true;
        };

        overlay.onmouseup = (e) => {
            if (e.target === overlay && isMouseDownOnOverlay) {
                overlay.remove();
            }
            isMouseDownOnOverlay = false;
        };
    }

    function updateRobotBasketText(count) {
        const hatch = document.getElementById('mech-hatch-trigger');
        const panel = document.getElementById('cc-robot-panel');
        if (!hatch || !panel) return;
        const t = LANG_DATA[state.lang];
        const isDeployed = panel.classList.contains('deployed');
        const textExpand = t.hatch_expand || "▼ DEPLOY BASKET";
        const textRetract = t.hatch_retract || "▲ RETRACT BASKET";
        const baseText = isDeployed ? textRetract : textExpand;

        if (typeof count === 'number' && count > 0) {
            hatch.innerText = `${baseText} (${count}) ${isDeployed ? '▲' : '▼'}`;
        } else {
            hatch.innerText = `${baseText} ${isDeployed ? '▲' : '▼'}`;
        }
    }

    function toggleUIMode(mode) {
        const oldPanel = document.getElementById('cc-panel') || document.getElementById('cc-robot-panel');
        let lastRect = null;
        let wasExpanded = false;

        let currentPrompt = "";
        if (prefixInput) currentPrompt = prefixInput.value;

        if (oldPanel) {
            lastRect = oldPanel.getBoundingClientRect();
            if (state.uiMode === 'standard') {
                wasExpanded = oldPanel.classList.contains('expanded');
            } else {
                wasExpanded = oldPanel.classList.contains('deployed');
            }
            oldPanel.remove();
        }
        document.getElementById('cc-tooltip')?.remove();

        if (mode) {
            state.uiMode = mode;
        } else {
            state.uiMode = (state.uiMode === 'robot') ? 'standard' : 'robot';
        }

        if (state.uiMode === 'robot') {
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

            updateBasketUI((basket) => {
                if (state.uiMode === 'standard') {
                    const stdPanel = document.getElementById('cc-panel');
                    if (stdPanel) {
                        if (wasExpanded) {
                            stdPanel.classList.add('expanded');
                            toggleBasketPreview(true);
                        }
                        if (state.contentPanelTab === 'pins') {
                            document.getElementById('cc-tab-pins')?.click();
                        } else {
                            document.getElementById('cc-tab-basket')?.click();
                        }
                    }
                }
                else if (state.uiMode === 'robot') {
                    const robotPanel = document.getElementById('cc-robot-panel');
                    if (robotPanel) {
                        if (wasExpanded) {
                            robotPanel.classList.add('deployed');
                            updateRobotBasketText(basket ? basket.length : 0);
                        }
                        if (state.contentPanelTab === 'pins') {
                            document.getElementById('mech-tab-pins')?.click();
                        } else {
                            document.getElementById('mech-tab-basket')?.click();
                        }
                    }
                }
            });
            pinManager._notifyChange();
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
                if (element.id === 'cc-panel' || element.id === 'cc-robot-panel') {
                    const rect = element.getBoundingClientRect();
                    chrome.storage.local.set({
                        'cc_drone_position': { top: rect.top, left: rect.left }
                    });
                }
            }
        });
    }

    function renderCompactSettings(container) {
        if (!state.isUnlocked) {
            const drawer = document.getElementById('cc-ai-drawer-panel');
            if (drawer) drawer.classList.remove('open');
            const aiTab = document.querySelector('.cc-ai-tab');
            if (aiTab) aiTab.classList.remove('active');
            showFeatureUnlockModal();
            return;
        }
        if (!container) container = document.querySelector('.cc-ai-content');
        if (!container) return;

        const currentConfig = state.aiConfig || {};
        const allConfigs = state.allAiConfigs || [];
        const t = LANG_DATA[state.lang];

        const profileOptions = allConfigs.map(c =>
            `<option value="${escapeHTML(c.name)}" ${currentConfig.name === c.name ? 'selected' : ''}>${escapeHTML(c.name)} (${c.provider})</option>`
        ).join('');

        container.innerHTML = `
                <div style="height:100%; display:flex; flex-direction:column; padding:10px 4px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-weight:bold; font-size:13px; border-bottom:1px solid var(--cc-border); padding-bottom:6px;">
                        <span>⚙️ ${t.ai_config_title}</span>
                        <span id="btn-close-drawer-compact" style="cursor:pointer; opacity:0.6; font-size:14px;">✕</span>
                    </div>

                    <div style="flex:1; display:flex; flex-direction:column; gap:10px; overflow-y:auto; padding-right:2px;">
                        
                        <div style="background:rgba(0,0,0,0.05); padding:8px; border-radius:6px; border:1px dashed var(--cc-border);">
                            <label style="font-size:10px; color:var(--cc-text-sub); display:block; margin-bottom:2px;">${t.label_load_profile}</label>
                            <select id="drawer-saved-profiles" class="cc-input" style="height:28px !important; margin:0;">
                                <option value="__new__">${t.option_new_profile}</option>
                                ${profileOptions}
                            </select>
                        </div>

                        <div>
                            <label style="font-size:10px; color:var(--cc-text-sub); display:block; margin-bottom:2px;">${t.label_config_name}</label>
                            <input type="text" id="drawer-config-name" class="cc-input" ... value="${escapeHTML(currentConfig.name || 'Default')}">
                        </div>

                        <div>
                            <label style="font-size:10px; color:var(--cc-text-sub); display:block; margin-bottom:2px;">${t.label_ai_provider}</label>
                            <select id="drawer-ai-provider" class="cc-input" style="height:28px !important; margin:0;">
                                <option value="openai">OpenAI (ChatGPT)</option>
                                <option value="claude">Anthropic (Claude)</option>
                                <option value="gemini">Google (Gemini)</option>
                                <option value="grok">xAI (Grok)</option>
                                <option value="ollama">Local (Ollama)</option>
<option value="lm-studio">Local (LM Studio)</option>
                            </select>
                        </div>

                        <div id="field-key-container">
                            <label style="font-size:10px; color:var(--cc-text-sub); display:block; margin-bottom:2px;">${t.label_api_key}</label>
                            <input type="password" id="drawer-ai-key" class="cc-input" style="height:28px !important; margin:0;" placeholder="${t.ph_api_key}" autocomplete="new-password" data-lpignore="true">
                        </div>

                        <div>
                            <label style="font-size:10px; color:var(--cc-text-sub); display:block; margin-bottom:2px;">${t.label_target_model}</label>
                            <div style="display:flex; gap:6px;">
                                <select id="drawer-ai-model-select" class="cc-input" style="width:24px; padding:0 4px; flex:0 0 auto; cursor:pointer;" title="Quick Select">
                                    <option value="">▼</option>
                                </select>
                                <input type="text" id="drawer-ai-model" class="cc-input" style="height:28px !important; margin:0; flex:1;" placeholder="${t.ph_model}">
                            </div>
                        </div>

                        <div>
                            <div id="toggle-advanced" style="font-size:10px; color:var(--cc-text-sub); cursor:pointer; display:flex; align-items:center; gap:4px;">
                                <span>▶</span> ${t.ai_endpoint_toggle || t.label_endpoint}
                            </div>
                            <input type="text" id="drawer-ai-endpoint" class="cc-input" 
                                style="display:none; height:28px !important; margin-top:4px; font-size:11px;" 
                                placeholder="https://api...">
                        </div>
                    </div>

                    <button id="drawer-save" style="margin-top:12px; width:100%; background:var(--cc-primary); color:#fff; border:none; padding:8px; border-radius:6px; font-weight:bold; cursor:pointer;">
                        ${t.ai_save}
                    </button>
                    
                    <div style="display:flex; gap:8px; margin-top:8px;">
                        <button id="drawer-export" style="flex:1; background:transparent; border:1px solid var(--cc-border); color:var(--cc-text-sub); padding:6px; border-radius:4px; font-size:10px; cursor:pointer;">
                            ${t.btn_export_json}
                        </button>
                        <button id="drawer-import" style="flex:1; background:transparent; border:1px solid var(--cc-border); color:var(--cc-text-sub); padding:6px; border-radius:4px; font-size:10px; cursor:pointer;">
                            ${t.btn_import_json}
                        </button>
                    </div>
                </div>
            `;

        const profileSelect = container.querySelector('#drawer-saved-profiles');
        const nameInput = container.querySelector('#drawer-config-name');
        const providerSel = container.querySelector('#drawer-ai-provider');
        const keyContainer = container.querySelector('#field-key-container');
        const keyInput = container.querySelector('#drawer-ai-key');
        const epInput = container.querySelector('#drawer-ai-endpoint');
        const modelInput = container.querySelector('#drawer-ai-model');
        const modelSelect = container.querySelector('#drawer-ai-model-select');
        const advToggle = container.querySelector('#toggle-advanced');
        const btnSave = container.querySelector('#drawer-save');
        const btnExport = container.querySelector('#drawer-export');
        const btnImport = container.querySelector('#drawer-import');

        const updateUIState = () => {
            const val = providerSel.value;
            if (val === 'ollama' || val === 'lm-studio') {
                keyContainer.style.display = 'none';
                epInput.style.display = 'block';
                advToggle.style.display = 'none';
            } else {
                keyContainer.style.display = 'block';
                advToggle.style.display = 'flex';
                if (epInput.value && epInput.value.trim() !== '') {
                    epInput.style.display = 'block';
                    advToggle.querySelector('span').innerText = '▼';
                } else {
                    epInput.style.display = 'none';
                    advToggle.querySelector('span').innerText = '▶';
                }
            }
        };

        btnExport.onclick = () => {
            chrome.storage.local.get(['cc_all_ai_configs', 'cc_ai_config', 'cc_active_ai_config_name'], (data) => {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `cc-config-${new Date().toISOString().slice(0, 10)}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        };

        btnImport.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const json = JSON.parse(ev.target.result);
                        if (json.cc_all_ai_configs) {
                            const t = LANG_DATA[state.lang];
                            const title = t.import_confirm_title;
                            const msg = t.import_confirm_msg;
                            showMainConfirmModal(title, msg, () => {
                                chrome.storage.local.set(json, () => {
                                    state.allAiConfigs = json.cc_all_ai_configs || [];
                                    let active = json.cc_ai_config;
                                    if (!active && json.cc_active_ai_config_name) {
                                        active = state.allAiConfigs.find(c => c.name === json.cc_active_ai_config_name);
                                    }
                                    if (!active && state.allAiConfigs.length > 0) active = state.allAiConfigs[0];
                                    state.aiConfig = active || {};
                                    showToast(t.msg_import_success);
                                    if (typeof loadAiConfig === 'function') loadAiConfig();
                                    renderCompactSettings(container);
                                });
                            });
                        } else {
                            showToast(t.msg_import_fail);
                        }
                    } catch (err) {
                        console.error(err);
                        showToast(t.msg_import_fail);
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        };

        const updateModelList = async (provider) => {
            if (!modelSelect) return;
            modelSelect.innerHTML = `<option value="">${t.option_loading}</option>`;
            let models = MODEL_PRESETS[provider] || [];

            if (provider === 'ollama' || provider === 'lm-studio') {
                try {
                    const currentEndpoint = epInput ? epInput.value : '';
                    const response = await new Promise(resolve => {
                        chrome.runtime.sendMessage({
                            action: "GET_LOCAL_MODELS",
                            provider: provider,
                            endpoint: currentEndpoint
                        }, resolve);
                    });

                    if (response && response.success && response.models.length > 0) {
                        models = response.models;
                        if (response.activeEndpoint && epInput) {
                            if (response.activeEndpoint.includes('1234') && !epInput.value.includes('1234')) {
                                epInput.value = `${response.activeEndpoint}/v1/chat/completions`;
                            } else if (!epInput.value) {
                                epInput.value = `${response.activeEndpoint}/api/chat`;
                            }
                        }
                    } else {
                        modelSelect.innerHTML = `<option value="">⚠️ Connection failed</option>`;
                        return;
                    }
                } catch (e) {
                    console.warn("Local model fetch failed", e);
                    modelSelect.innerHTML = `<option value="">⚠️ Error: ${e.message}</option>`;
                    return;

                }
            }

            modelSelect.innerHTML = '<option value="">▼</option>';
            models.forEach(m => {
                const opt = document.createElement('option');
                const val = m.id || m;
                opt.value = val;
                opt.textContent = val;
                modelSelect.appendChild(opt);
            });
        };

        const fillForm = (cfg) => {
            nameInput.value = cfg.name || '';
            providerSel.value = cfg.provider || 'openai';
            keyInput.value = cfg.apiKey || '';
            epInput.value = cfg.endpoint || '';
            modelInput.value = cfg.model || '';
            updateUIState();
            updateModelList(providerSel.value);
        };

        fillForm(currentConfig);

        profileSelect.onchange = () => {
            const selectedName = profileSelect.value;
            if (selectedName === '__new__') {
                fillForm({ name: 'New Config', provider: 'openai' });
            } else {
                const cfg = allConfigs.find(c => c.name === selectedName);
                if (cfg) fillForm(cfg);
            }
        };

        providerSel.addEventListener('change', async () => {
            updateUIState();
            const provider = providerSel.value;
            let defModel = '';
            if (MODEL_PRESETS[provider] && MODEL_PRESETS[provider].length > 0) {
                defModel = MODEL_PRESETS[provider][0];
            }

            let defEp = API_ENDPOINTS[provider] || '';

            if (defEp.includes('{model}')) {
                defEp = defEp.replace('{model}', defModel);
            }

            if (!defEp) {
                if (provider === 'ollama') defEp = 'http://localhost:11434/api/chat';
                else if (provider === 'lm-studio') defEp = 'http://localhost:1234/v1/chat/completions';
            }

            epInput.value = defEp;
            modelInput.value = defModel;
            await updateModelList(provider);
        });

        modelSelect.addEventListener('change', () => {
            if (modelSelect.value) {
                modelInput.value = modelSelect.value;
                const template = API_ENDPOINTS[providerSel.value];
                if (template && template.includes('{model}')) {
                    epInput.value = template.replace('{model}', modelSelect.value);
                }
                flashInput(modelInput);
            }
        });

        modelInput.oninput = () => {
            const provider = providerSel.value;
            const val = modelInput.value.trim();
            const template = API_ENDPOINTS[provider];

            if (val && template && template.includes('{model}')) {
                epInput.value = template.replace('{model}', val);
            }
        };

        advToggle.onclick = () => {
            const isHidden = epInput.style.display === 'none';
            epInput.style.display = isHidden ? 'block' : 'none';
            advToggle.querySelector('span').innerText = isHidden ? '▼' : '▶';
        };

        btnSave.onclick = function () {
            const provider = providerSel.value;
            const finalEndpoint = epInput.value.trim();
            const finalKey = (provider === 'local') ? '' : keyInput.value.trim();
            const finalModel = modelInput.value.trim();
            const configName = nameInput.value.trim() || 'Custom Config';

            const isLocal = (provider === 'ollama' || provider === 'lm-studio');
            if (!isLocal && finalKey.length < 5) {
                showToast("Please enter a valid API Key.");
                return;
            }

            const newConfig = {
                configured: true,
                name: configName,
                provider: provider,
                endpoint: finalEndpoint,
                apiKey: finalKey,
                model: finalModel
            };

            btnSave.innerText = "SAVING...";

            chrome.storage.local.get(['cc_all_ai_configs'], (result) => {
                let latestAllConfigs = result.cc_all_ai_configs || [];

                latestAllConfigs = latestAllConfigs.filter(c => c.name !== configName);

                latestAllConfigs.push(newConfig);

                chrome.storage.local.set({
                    'cc_all_ai_configs': latestAllConfigs,
                    'cc_ai_config': newConfig,
                    'cc_active_ai_config_name': configName
                }, () => {
                    state.allAiConfigs = latestAllConfigs;
                    state.aiConfig = newConfig;

                    btnSave.innerText = "SAVED";
                    btnSave.style.background = "#4CAF50";

                    setTimeout(() => {
                        btnSave.innerText = t.ai_save || "SAVE CONFIG";
                        btnSave.style.background = "";

                        const drawerPanel = document.getElementById('cc-ai-drawer-panel');
                        const tab = document.querySelector('.cc-ai-tab');
                        const rTab = document.querySelector('.cc-res-tab');
                        if (drawerPanel) drawerPanel.classList.remove('open');
                        if (tab) tab.classList.remove('active');
                        if (rTab) rTab.style.display = 'flex';

                        if (typeof loadAiConfig === 'function') loadAiConfig();
                    }, 500);
                });
            });
        };

        container.querySelector('#btn-close-drawer-compact').onclick = () => {
            document.getElementById('cc-ai-drawer-panel').classList.remove('open');
            document.querySelector('.cc-ai-tab').classList.remove('active');
            const resTab = document.querySelector('.cc-res-tab');
            if (resTab) resTab.style.display = 'flex';
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

    function showTokenWarningModal(estTokens, limit, platformName, onConfirmCallback) {
        const t = LANG_DATA[state.lang];
        if (document.querySelector('.cc-warning-overlay')) return;

        const overlay = document.createElement('div');
        overlay.className = 'cc-warning-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
            background: 'rgba(0, 0, 0, 0.8)', zIndex: '2147483660',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(5px)', opacity: '0', transition: 'opacity 0.3s'
        });

        const card = document.createElement('div');
        Object.assign(card.style, {
            width: '380px', background: '#1e1e1e', border: '1px solid #444',
            borderTop: '4px solid #f00', borderRadius: '8px', padding: '20px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)', color: '#fff',
            fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', gap: '15px'
        });

        const titleText = t.token_warn_title || '⚠️ Token Limit Warning';
        const msgTemplate = t.token_warn_msg || 'Content ({est}) exceeds recommended limit for {platform} ({limit}).\n\nTransferring may cause memory loss.\nDo you want to proceed?';

        const messageHtml = msgTemplate
            .replace('{est}', `<b style="color:#ff5252;">${estTokens.toLocaleString()}</b>`)
            .replace('{platform}', `<b>${platformName}</b>`)
            .replace('{limit}', `<b>${limit.toLocaleString()}</b>`);

        card.innerHTML = `
            <div style="font-size:16px; font-weight:bold; color:#ff5252; display:flex; align-items:center; gap:8px;">
                <span>${titleText}</span>
            </div>
            <div style="font-size:13px; color:#ccc; line-height:1.6; background:rgba(255,82,82,0.1); padding:10px; border-radius:4px;">
                ${messageHtml.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>')}
            </div>
            <div style="font-size:12px; color:#aaa; margin-top:-5px; font-style:italic;">
                * ${t.token_warn_msg.split('\n\n')[1] || 'Please confirm the risk before proceeding.'}
            </div>
            
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:5px;">
                <button id="btn-cancel-warning" style="background:transparent; border:1px solid #555; color:#aaa; padding:8px 16px; cursor:pointer; border-radius:4px; font-size:12px;">
                    ${t.preview_cancel || 'Cancel'}
                </button>
                <button id="btn-confirm-warning" style="background:#ff5252; border:none; color:#fff; padding:8px 16px; cursor:pointer; border-radius:4px; font-weight:bold; font-size:12px;">
                    ${t.unlock_confirm || 'I Understand, Continue'}
                </button>
            </div>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => overlay.style.opacity = '1');

        const btnSave = card.querySelector('#btn-confirm-warning');
        const btnCancel = card.querySelector('#btn-cancel-warning');

        btnCancel.onclick = () => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
        };

        btnSave.onclick = () => {
            btnSave.innerText = "Processing...";
            btnSave.style.background = "#4CAF50";

            if (onConfirmCallback) {
                onConfirmCallback();
            }

            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 300);
        };
    }

    function updatePiPUITexts(win) {
        if (!win || !win.document) return;
        const doc = win.document;
        const t = LANG_DATA[state.lang];

        const tabCollect = doc.getElementById('tab-collect');
        if (tabCollect) tabCollect.innerText = t.pip_tab_collect;

        const tabFlow = doc.getElementById('tab-flow');
        if (tabFlow) tabFlow.innerText = t.pip_tab_flow;

        const btnTheme = doc.getElementById('btn-pip-theme');
        if (btnTheme) btnTheme.title = t.pip_tooltip_theme;

        const btnSettings = doc.getElementById('btn-pip-settings');
        if (btnSettings) btnSettings.title = t.pip_tooltip_settings;

        const btnMax = doc.getElementById('btn-pip-max');
        if (btnMax) btnMax.title = t.pip_tooltip_max;

        const btnPaste = doc.getElementById('btn-pip-paste');
        if (btnPaste) {
            btnPaste.title = t.pip_btn_paste;
            const icon = btnPaste.querySelector('i');
            btnPaste.innerHTML = '';
            if (icon) btnPaste.appendChild(icon);
            btnPaste.append(` ${t.pip_btn_paste}`);
        }

        const btnExport = doc.getElementById('btn-pip-export');
        if (btnExport) {
            btnExport.title = t.pip_btn_export;
            const icon = btnExport.querySelector('i');
            btnExport.innerHTML = '';
            if (icon) btnExport.appendChild(icon);
            btnExport.append(` ${t.pip_btn_export}`);
        }

        const btnClear = doc.getElementById('btn-pip-clear');
        if (btnClear) {
            btnClear.title = t.pip_btn_clear;
            const icon = btnClear.querySelector('i');
            btnClear.innerHTML = '';
            if (icon) btnClear.appendChild(icon);
            btnClear.append(` ${t.pip_btn_clear}`);
        }

        const dropTitle = doc.querySelector('.drop-zone-overlay div:nth-child(2)');
        if (dropTitle) dropTitle.innerText = t.pip_drop_title;

        const dropSub = doc.querySelector('.drop-zone-overlay div:nth-child(3)');
        if (dropSub) dropSub.innerText = t.pip_drop_sub;

        const mbTitle = doc.querySelector('.mb-title span:first-child');
        if (mbTitle) mbTitle.innerText = t.pip_basket_title;

        renderPiPList(win);
        renderPiPNodes(win);
        renderPiPConnections(win);
        renderMiniBasket(win);
    }

    function updateUITexts() {
        const curLang = state.lang;
        const t = LANG_DATA[curLang];

        if (title) title.innerText = t.title;
        if (msg && state.uiMode !== 'robot') {
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

        if (pinManager && typeof pinManager._notifyChange === 'function') {
            pinManager._notifyChange();
        }

        const drone = document.getElementById('cc-drone-fab');
        if (drone) {
            drone.title = t.drone_title;

            const btnPaint = document.getElementById('drone-btn-paint');
            if (btnPaint) btnPaint.title = t.btn_paint + t.hint_shortcut_paint;

            const btnClose = document.getElementById('drone-btn-close');
            if (btnClose) btnClose.title = t.drone_dismiss;

            const pinBtn = drone.querySelector('#drone-btn-pin');
            if (pinBtn) pinBtn.title = t.btn_ping;

            const qrBtn = drone.querySelector('#drone-btn-qr');
            if (qrBtn) qrBtn.title = t.btn_qrcode;

            const card = document.querySelector('.cc-hover-card');
            if (card) {
                const btnPaste = card.querySelector('#cc-paste-btn');
                if (btnPaste) btnPaste.title = t.pip_btn_paste;

                const btnExport = card.querySelector('#cc-export-btn');
                if (btnExport) btnExport.title = t.pip_btn_export;

                const btnClear = card.querySelector('#cc-clear-btn');
                if (btnClear) btnClear.title = t.btn_clear_basket;

                const btnExpand = card.querySelector('#cc-expand-btn');
                if (btnExpand) btnExpand.title = t.pip_tooltip_max;

                if (typeof updateHoverCardUI === 'function') updateHoverCardUI();
            }
        }

        const btnSum = document.getElementById('sys-btn-sum');
        if (btnSum) {
            btnSum.textContent = t.sys_btn_summary;
            btnSum.title = t.sys_tooltip_summary;
        }
        const btnTrans = document.getElementById('sys-btn-trans');
        if (btnTrans) {
            btnTrans.textContent = t.sys_btn_translate;
            btnTrans.title = t.sys_tooltip_translate;
        }
        const btnExp = document.getElementById('sys-btn-exp');
        if (btnExp) {
            btnExp.textContent = t.sys_btn_explain;
            btnExp.title = t.sys_tooltip_explain;
        }
        const btnSave = document.getElementById('sys-btn-save');
        if (btnSave) {
            btnSave.title = t.sys_tooltip_save;
        }
        const btnLoad = document.getElementById('sys-btn-load');
        if (btnLoad) {
            btnLoad.title = t.sys_tooltip_load;
        }

        const stdPanel = document.getElementById('cc-panel');
        if (stdPanel) {


            const btnSelectAll = document.getElementById('cc-btn-select-all');
            if (btnSelectAll) {
                btnSelectAll.title = t.btn_select_all;
            }

            const btnUnselectAll = document.getElementById('cc-btn-unselect-all');
            if (btnUnselectAll) {
                btnUnselectAll.title = t.btn_unselect_all;
            }

            const btnCopy = document.getElementById('cc-btn-copy');
            if (btnCopy) {
                btnCopy.title = t.btn_copy;
            }

            if (prefixLabel) prefixLabel.innerText = t.label_prefix;
            if (prefixInput) prefixInput.placeholder = t.placeholder;

            const btnAiConfig = document.getElementById('cc-btn-ai-config');
            if (btnAiConfig) {
                btnAiConfig.title = t.ai_setting_tab;
            }

            const btnPaint = document.getElementById('cc-btn-paint');
            if (btnPaint) {
                btnPaint.title = t.paint_tooltip + t.hint_shortcut_paint;
            }

            const btnScan = document.getElementById('cc-btn-scan');
            if (btnScan) {
                btnScan.title = t.btn_scan;
            }

            const btnPin = document.getElementById('cc-btn-pin');
            if (btnPin) {
                btnPin.title = t.btn_ping;
            }
            const btnQr = document.getElementById('cc-btn-qr');
            if (btnQr) {
                btnQr.title = t.btn_qrcode;
            }

            const btnDl = document.getElementById('cc-btn-dl');
            if (btnDl) {
                btnDl.title = t.btn_dl;
            }

            if (basketLabel) basketLabel.innerText = t.label_basket;

            const btnAddBasket = document.getElementById('cc-btn-add-basket');
            if (btnAddBasket) {
                btnAddBasket.title = t.btn_add_basket;
            }
            const btnPasteBasket = document.getElementById('cc-btn-paste-basket');
            if (btnPasteBasket) {
                btnPasteBasket.title = t.btn_paste_basket;
            }
            const btnNewDoc = document.getElementById('cc-btn-new-doc');
            if (btnNewDoc) {
                btnNewDoc.title = t.btn_new_doc;
            }

            const btnClearBasket = document.getElementById('cc-btn-clear-basket');
            if (btnClearBasket) {
                btnClearBasket.title = t.btn_clear_basket;
            }

            const btnSummary = document.getElementById('cc-btn-summary');
            if (btnSummary) btnSummary.innerText = t.btn_summary;
            if (transferLabel) transferLabel.innerText = t.label_transfer;


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
            const platformBtns = stdPanel.querySelectorAll('.platform-btn');
            platformBtns.forEach((btn, index) => {
                if (PLATFORMS[index]) {
                    btn.title = t.tooltip_transfer_to.replace('{name}', PLATFORMS[index].name);
                }
            });

            const drawerToggle = document.querySelector('.cc-drawer-toggle');
            if (drawerToggle) {
                const isExpanded = stdPanel.classList.contains('expanded');
                drawerToggle.innerHTML = `<span class="arrow" style="${isExpanded ? 'transform: rotate(180deg); display: inline-block;' : ''}">▼</span>${t.drawer_toggle}`;
            }
        }

        const robotPanel = document.getElementById('cc-robot-panel');
        if (robotPanel) {

            const tabBasketBtn = document.getElementById('mech-tab-basket');
            if (tabBasketBtn) {
                const labelSpan = tabBasketBtn.querySelector('span:not(.mech-tab-badge)');
                if (labelSpan) labelSpan.innerText = 'CARGO';
            }

            const tabPinsBtn = document.getElementById('mech-tab-pins');
            if (tabPinsBtn) {
                const labelSpan = tabPinsBtn.querySelector('span:not(.mech-tab-badge)');
                if (labelSpan) labelSpan.innerText = 'PINS';
            }

            const btnPinClear = document.getElementById('mech-pin-clear');
            if (btnPinClear) {
                btnPinClear.innerText = '🗑️';
            }

            if (typeof renderMechPinPanel === 'function') {
                renderMechPinPanel();
            }

            if (typeof renderBasketPreview === 'function' && typeof basket !== 'undefined') {
                const previewList = document.getElementById('mech-basket-list');
                if (previewList) {
                    if (basket.length === 0) {
                        previewList.innerHTML = `<div style="text-align:center; color:var(--mech-text-dim); padding:15px; font-size:11px; letter-spacing:1px; border:1px dashed var(--mech-border); border-radius:4px;">${t.emptyMsg || t.basket_status_empty || 'EMPTY'}</div>`;
                    } else {
                        renderBasketPreview(basket);
                    }
                }
            }

            const btnSel = document.getElementById('mech-btn-select-all');
            if (btnSel) btnSel.title = t.btn_select_all;

            const btnUnsel = document.getElementById('mech-btn-unselect');
            if (btnUnsel) btnUnsel.title = t.btn_unselect_all;

            const mBtnSum = document.getElementById('mech-sys-btn-sum');
            if (mBtnSum) { mBtnSum.textContent = t.sys_btn_summary; mBtnSum.title = t.sys_tooltip_summary; }

            const mBtnTrans = document.getElementById('mech-sys-btn-trans');
            if (mBtnTrans) { mBtnTrans.textContent = t.sys_btn_translate; mBtnTrans.title = t.sys_tooltip_translate; }

            const mBtnExp = document.getElementById('mech-sys-btn-exp');
            if (mBtnExp) { mBtnExp.textContent = t.sys_btn_explain; mBtnExp.title = t.sys_tooltip_explain; }

            const mBtnSave = document.getElementById('mech-btn-save');
            if (mBtnSave) { mBtnSave.title = t.sys_tooltip_save; }

            const mBtnLoad = document.getElementById('mech-btn-load');
            if (mBtnLoad) { mBtnLoad.title = t.sys_tooltip_load; }

            const btnPnt = document.getElementById('mech-btn-paint');
            if (btnPnt) btnPnt.title = t.btn_paint + t.hint_shortcut_paint;

            const btnPinRobot = document.getElementById('mech-btn-pin');
            if (btnPinRobot) btnPinRobot.title = t.btn_ping;

            const btnPasteMech = document.getElementById('mech-btn-paste-main');
            if (btnPasteMech) btnPasteMech.title = t.btn_paste_basket;

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
            if (comms) {
                comms.title = t.ai_response_tab;
                comms.innerHTML = `<span class="icon">📶</span>${t.robot_comms_tab}`;
            }

            const antenna = document.querySelector('.antenna-group');
            if (antenna) {
                antenna.title = shouldShowAI() ? t.ai_setting_tab : t.unlock_title;
            }

            const thrusterBtns = robotPanel.querySelectorAll('.thruster-btn');
            thrusterBtns.forEach((btn, index) => {
                if (PLATFORMS[index]) {
                    btn.title = t.tooltip_transfer_to.replace('{name}', PLATFORMS[index].name);
                }
            });

            const aiTrig = document.getElementById('mech-ai-trigger');
            if (aiTrig) aiTrig.title = t.btn_summary;

            const bAdd = document.getElementById('mech-basket-add');
            if (bAdd) bAdd.innerText = '🧺';
            if (bAdd) bAdd.title = t.btn_add_basket;

            const bPaste = document.getElementById('mech-basket-paste');
            if (bPaste) bPaste.innerText = '🪄';
            if (bPaste) bPaste.title = t.btn_paste_basket;

            const bClear = document.getElementById('mech-basket-clear');
            if (bClear) bClear.innerText = '🗑️';
            if (bClear) bClear.title = t.btn_clear_basket;

            const bNew = document.getElementById('mech-basket-new');
            if (bNew) bNew.innerText = '🖍️';
            if (bNew) bNew.title = t.btn_new_doc;
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

        if (state.streamingModal && state.streamingModal.element) {
            const m = state.streamingModal.element;
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

        const dropTextStd = document.querySelector('#cc-panel .cc-drop-text');
        if (dropTextStd) dropTextStd.innerText = t.overlay_drop_add;

        const dropTextRobot = document.querySelector('#cc-robot-panel .cc-drop-text');
        if (dropTextRobot) dropTextRobot.innerText = t.overlay_acquiring;

        if (state.isPiPActive && state.pipWindow) {
            updatePiPUITexts(state.pipWindow);
        }

        calculateTotalTokens();
        updateBasketUI();
        updateMultiNodeTexts();
    }

    function showLanguageMenu(anchorBtn) {
        const existing = document.getElementById('cc-lang-popover');
        if (existing) {
            existing.remove();
            return;
        }

        const menu = document.createElement('div');
        menu.id = 'cc-lang-popover';
        menu.className = 'cc-lang-menu';

        const list = window.CC_SUPPORTED_LANGS || [
            { code: 'en', label: 'English', flag: '🇺🇸' },
            { code: 'zh-TW', label: '繁體中文', flag: '🇹🇼' },
            { code: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
            { code: 'ja', label: '日本語', flag: '🇯🇵' },
            { code: 'ko', label: '한국어', flag: '🇰🇷' }
        ];

        list.forEach(item => {
            const div = document.createElement('div');
            div.className = `cc-lang-item ${state.lang === item.code ? 'active' : ''}`;
            div.innerHTML = `<span class="cc-lang-flag">${item.flag}</span><span>${item.label}</span>`;

            div.onclick = (e) => {
                e.stopPropagation();
                const oldLang = state.lang;
                state.lang = item.code;
                switchPromptLanguage(oldLang, state.lang);
                updateUITexts();
                menu.remove();
            };
            menu.appendChild(div);
        });

        document.body.appendChild(menu);

        const rect = anchorBtn.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();

        let top = rect.bottom + 6;
        let left = rect.left;

        if (left + menuRect.width > window.innerWidth) {
            left = window.innerWidth - menuRect.width - 10;
        }
        if (top + menuRect.height > window.innerHeight) {
            top = rect.top - menuRect.height - 6;
        }

        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;

        const closeHandler = (e) => {
            if (!menu.contains(e.target) && e.target !== anchorBtn) {
                menu.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    function updateMultiNodeTexts() {
        const modal = document.querySelector('.cc-modal-card');
        if (!modal) return;

        const t = LANG_DATA[state.lang];
        const isSingle = state.aiLayoutMode === 'single';

        const titleEl = document.getElementById('cc-mm-title') || document.getElementById('modal-title-text');
        if (titleEl) titleEl.innerText = isSingle ? t.mm_title_single : t.mm_title_multi;

        const toggleBtn = document.getElementById('btn-toggle-view');
        if (toggleBtn) toggleBtn.innerText = isSingle ? t.mm_view_multi : t.mm_view_single;

        const loopLabel = document.getElementById('cc-mm-loop-label');
        if (loopLabel) loopLabel.innerText = t.mm_loop_label;

        const btnAdd = document.getElementById('btn-add-node');
        if (btnAdd) btnAdd.innerText = t.mm_add_node;

        const btnRun = document.getElementById('btn-run-flow');
        if (btnRun) btnRun.innerText = t.mm_run;

        const btnStop = document.getElementById('btn-stop-all');
        if (btnStop && !btnStop.innerText.includes('🛑')) {
            btnStop.innerText = t.mm_stop;
        }

        const btnSendAll = document.getElementById('btn-mm-send-all');
        if (btnSendAll) btnSendAll.innerText = t.mm_send_all;

        const basketTitle = document.getElementById('cc-mm-basket-title');
        if (basketTitle) basketTitle.innerText = t.mm_basket;

        const btnPaste = document.getElementById('btn-mm-basket-paste');
        if (btnPaste) btnPaste.title = t.mm_basket_paste;

        const btnExport = document.getElementById('btn-mm-basket-export');
        if (btnExport) btnExport.title = t.mm_basket_export;

        const btnImport = document.getElementById('btn-mm-basket-import');
        if (btnImport) btnImport.title = t.mm_basket_import;

        const mTitle = modal.querySelector('.cc-modal-header span');
        if (mTitle && !mTitle.id) mTitle.innerText = isSingle ? t.mm_title_single : t.mm_title_multi;

        const tmplSelect = document.getElementById('template-select');
        if (tmplSelect) {
            const currentVal = tmplSelect.value;
            const templates = getWorkflowTemplates();
            let html = '<option value="">-- Select --</option>';
            Object.entries(templates).forEach(([k, v]) => {
                html += `<option value="${k}" ${k === currentVal ? 'selected' : ''}>${v.name}</option>`;
            });
            tmplSelect.innerHTML = html;
        }

        if (state.pipWindow && state.pipWindow.document) {
            const pipSelect = state.pipWindow.document.getElementById('pip-template-select');
            if (pipSelect) {
                const currentVal = pipSelect.value;
                const templates = getWorkflowTemplates();
                let html = '<option value="">🧩 Load Template</option>';
                Object.entries(templates).forEach(([k, v]) => {
                    html += `<option value="${k}" ${k === currentVal ? 'selected' : ''}>${v.name}</option>`;
                });
                pipSelect.innerHTML = html;
            }
        }
    }

    function performScan() {
        if (!state.active) return;
        fixGeminiDropZone();
        if (!state.config || !state.config.msgSelector) return;

        const els = document.querySelectorAll(state.config.msgSelector);
        let count = 0;
        const curLang = state.lang;
        const t = LANG_DATA[curLang];

        els.forEach(el => {
            if (el.querySelector('.cc-btn') || el.dataset.ccListening === 'true' || el.innerText.trim().length < 1) return;

            if (state.config.ignore && el.closest(state.config.ignore)) {
                return;
            }

            let parent = el.parentElement;
            let isNested = false;
            while (parent) {
                if (parent.dataset && parent.dataset.ccListening === 'true') {
                    isNested = true;
                    break;
                }
                parent = parent.parentElement;
            }
            if (isNested) return;

            const style = window.getComputedStyle(el);
            if (style.position === 'static') {
                el.style.position = 'relative';
            }

            const btn = document.createElement('button');
            btn.className = 'cc-btn';
            btn.innerText = '➕';
            btn.title = t.btn_add_title + " (Drag)";
            btn.setAttribute('draggable', 'true');
            Object.assign(btn.style, {
                position: 'absolute',
                top: '6px', right: '6px', left: 'auto',
                zIndex: '9999',
                background: 'rgba(255, 255, 255, 0.9)',
                color: '#2196F3',
                border: '2px solid #2196F3',
                fontWeight: '900',
                padding: '0', fontSize: '16px', cursor: 'grab',
                borderRadius: '50%',
                boxShadow: '0 2px 8px rgba(33, 150, 243, 0.4)',
                width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: '1', transform: 'scale(1)',
                transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)'
            });

            const onDragStart = (e) => {
                e.stopPropagation();
                const cleanText = convertToMarkdown(el);
                e.dataTransfer.setData('text/plain', cleanText);
                e.dataTransfer.setData('text', cleanText);
                e.dataTransfer.setData('application/cc-scan-item', 'true');
                e.dataTransfer.effectAllowed = 'copy';
                chrome.storage?.local?.set({
                    cc_last_drag_text: cleanText,
                    cc_last_drag_ts: Date.now()
                });
                el.style.opacity = '0.6';
                btn.style.cursor = 'grabbing';
            };

            const onDragEnd = (e) => {
                el.style.opacity = '1';
                btn.style.cursor = 'grab';

                if (window.location.hostname.includes('claude.ai')) {
                    document.dispatchEvent(new DragEvent('dragleave', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    }));

                    const inputArea = document.querySelector('[data-testid="chat-input-grid-area"]');
                    if (inputArea) {
                        inputArea.dispatchEvent(new DragEvent('dragleave', { bubbles: true }));
                    }

                    const overlays = document.querySelectorAll('.fixed.inset-0');
                    overlays.forEach(overlay => {
                        const style = window.getComputedStyle(overlay);
                        if (overlay.querySelector('input[type="file"]') || parseInt(style.zIndex) >= 40) {
                            overlay.dispatchEvent(new DragEvent('dragleave', { bubbles: true }));
                        }
                    });
                }
            };

            btn.addEventListener('dragstart', onDragStart);
            btn.addEventListener('dragend', onDragEnd);
            el.addEventListener('dragend', onDragEnd);

            const onMouseEnter = () => {
                if (!state.active) return;
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
                if (!state.active) return;
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
                const lastIndex = state.lastCheckedIndex;

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
                state.lastCheckedIndex = currentIndex;
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
        const curLang = state.lang;
        const n = document.querySelectorAll('.cc-btn[data-selected="true"]').length;
        if (state.uiMode === 'standard' && msg.id === 'status-badge') {
            msg.innerText = LANG_DATA[curLang].msg_selected.replace('{n}', n);
        }

        if (state.uiMode === 'robot') {
            updateRobotBasketText(document.querySelectorAll('.cc-basket-item').length);
        }
    }

    function getSelectedText(includePrefix = true) {
        const selected = document.querySelectorAll('.cc-btn[data-selected="true"]');
        if (selected.length === 0) return null;

        const t = LANG_DATA[state.lang];
        let combined = "";

        if (includePrefix) {
            const userPrefix = document.getElementById('cc-prefix-input').value;
            if (userPrefix) combined += userPrefix + "\n\n====================\n\n";
        }

        selected.forEach(btn => {
            const textContent = convertToMarkdown(btn.parentElement);
            combined += `${t.prompt_fragment}\n${textContent}\n\n`;
        });

        if (includePrefix) {
            combined += `====================\n${t.prompt_end}`;
        }
        return combined;
    }

    function constructFinalContent(pageSelection, basketItems) {
        const t = LANG_DATA[state.lang];
        const prefix = document.getElementById('cc-prefix-input')?.value || "";
        let parts = [];

        if (prefix && prefix.trim()) {
            parts.push(prefix.trim());
            parts.push("====================");
        }

        if (pageSelection && pageSelection.trim()) {
            parts.push(pageSelection.trim());
        }

        if (basketItems && basketItems.length > 0) {
            if (pageSelection && pageSelection.trim()) {
                parts.push(t.prompt_sep_basket.trim());
            }

            const basketText = basketItems.map((item, idx) => {
                const itemText = (item.text || "").trim();
                if (state.includeSource && item.source) {
                    const header = t.prompt_item_prefix
                        .replace('{n}', idx + 1)
                        .replace('{source}', item.source);
                    return `${header}\n${itemText}`;
                } else {
                    return itemText;
                }
            }).join("\n--------------------\n");

            parts.push(basketText);
        }

        return parts.join("\n").trim() + "\n";
    }

    function formatDragText(items, includeSource = null) {
        const useSource = includeSource !== null ? includeSource : state.includeSource;
        if (!Array.isArray(items)) items = [items];

        return items.map(item => {
            const itemText = (item.text || "").trim();
            if (useSource && item.source) {
                return `[Source: ${item.source}]\n${itemText}`;
            }
            return itemText;
        }).join("\n--------------------\n").trim();
    }

    function resolveContentToExport(callback) {
        const t = LANG_DATA[state.lang];

        getBasket((basket) => {
            const pageText = getSelectedText(false);
            const hasBasket = (basket && basket.length > 0);
            const hasPage = (pageText && pageText.length > 0);

            if (!hasPage && !hasBasket) {
                showToast(t.alert_no_selection);
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
            if (!finalContent) return;
            const defaultName = 'contextdrone-' + new Date().toISOString().slice(0, 10);
            showUniversalExportModal(window, finalContent, defaultName);
        });
    }

    function handleCopyOnly() {
        const t = LANG_DATA[state.lang];

        getBasket((basket) => {
            const pageText = getSelectedText(false);
            if (!pageText && (!basket || basket.length === 0)) {
                showToast(t.alert_no_selection);
                return;
            }
            const finalContent = constructFinalContent(pageText, basket);
            navigator.clipboard.writeText(finalContent).then(() => {
                showToast(t.alert_copy_done);
            }).catch(err => showToast("Copy failed"));
        });
    }

    function getBasket(cb) {
        chrome.storage.local.get(['cc_basket'], (result) => {
            const basket = result.cc_basket || [];
            cb(basket);
        });
    }

    function basketOp(op, cb) {
        chrome.runtime.sendMessage({ action: "BASKET_OP", op }, (res) => {
            if (chrome.runtime.lastError) {
                console.warn('ContextDrone: BASKET_OP failed', chrome.runtime.lastError);
                cb && cb({ success: false, error: chrome.runtime.lastError.message });
                return;
            }
            cb && cb(res || { success: true });
        });
    }

    function updateBasketUI(callback) {
        getBasket((fetchedData) => {
            let currentBasket = fetchedData || [];
            basket = currentBasket;

            const count = currentBasket.length;
            const t = LANG_DATA[state.lang];

            if (typeof updateDroneUI === 'function') {
                updateDroneUI(currentBasket);
            }

            if (typeof updateHoverCardUI === 'function') {
                updateHoverCardUI();
            }

            if (state.isPiPActive && state.pipWindow) {
                renderPiPList(state.pipWindow);
                renderMiniBasket(state.pipWindow);
            }

            if (state.uiMode === 'standard') {
                if (basketStatus) {
                    if (count === 0) {
                        basketStatus.innerText = t.basket_status_empty;
                        basketStatus.style.color = '#aaa';
                        if (basketPreviewList) basketPreviewList.style.display = 'none';
                        state.isPreviewOpen = false;
                    } else {
                        basketStatus.innerText = t.basket_status.replace('{n}', count);
                        basketStatus.style.color = '#4CAF50';
                        if (state.isPreviewOpen && basketPreviewList && state.contentPanelTab === 'basket') {
                            basketPreviewList.style.display = 'block';
                            renderBasketPreview(currentBasket);
                        }
                    }
                }
                if (typeof updateStdPasteButton === 'function') updateStdPasteButton();
                if (typeof updateContentTabBadges === 'function') updateContentTabBadges();
            } else if (state.uiMode === 'robot') {
                updateRobotBasketText(count);
                if (typeof updateMechTabBadges === 'function') updateMechTabBadges();
                if (basketPreviewList) {
                    basketPreviewList.style.display = 'block';
                    if (count === 0) {
                        basketPreviewList.innerHTML = `<div style="text-align:center; color:var(--mech-text-dim); padding:15px; font-size:11px; letter-spacing:1px; border:1px dashed var(--mech-border); border-radius:4px;">${t.emptyMsg}</div>`;
                    } else {
                        renderBasketPreview(currentBasket);
                    }
                }
                if (typeof updateMechPasteButton === 'function') updateMechPasteButton();
            }

            if (state.basketListeners) {
                state.basketListeners.forEach(listener => {
                    try { listener(currentBasket); } catch (e) { console.error(e); }
                });
            }


            calculateTotalTokens();

            if (callback && typeof callback === 'function') {
                callback(currentBasket);
            }
        });
    }

    function toggleBasketPreview(forceOpen = false) {
        if (!basketPreviewList) return;

        const isHidden = basketPreviewList.style.display === 'none';
        if (forceOpen && !isHidden) return;
        if (!forceOpen && !isHidden) {
            basketPreviewList.style.display = 'none';
            state.isPreviewOpen = false;
            const panel = document.getElementById('cc-panel');
            if (panel) panel.classList.remove('expanded');
            return;
        }

        state.isPreviewOpen = true;
        if (state.contentPanelTab === 'basket') {
            basketPreviewList.style.display = 'block';
        }

        const panel = document.getElementById('cc-panel');
        if (panel && panel.classList.contains('cc-visible')) {
            panel.classList.add('expanded');
        }


        updateBasketUI();
    }

    let draggingId = null;
    function renderBasketPreview(basket) {
        if (tooltip) tooltip.style.display = 'none';
        basketPreviewList.innerHTML = '';
        const t = LANG_DATA[state.lang];
        const prefixEl = document.getElementById('cc-prefix-input');
        const currentPrefix = prefixEl ? prefixEl.value : "";
        let isDraggingRow = false;
        basket.forEach(item => {
            if (item && item.id && state.basketSelectionState[item.id] === undefined) {
                state.basketSelectionState[item.id] = false;
            }
        });

        const selectedCount = basket.filter(it => it && it.id && state.basketSelectionState[it.id]).length;
        const isAllSelected = basket.length > 0 && selectedCount === basket.length;
        const headerRow = document.createElement('div');
        Object.assign(headerRow.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
            padding: '4px 0'
        });

        const selectAllBtn = document.createElement('button');
        selectAllBtn.className = 'cc-select-all-btn';
        selectAllBtn.innerHTML = isAllSelected ? '☑️ ' + (t.btn_unselect_all || 'Unselect All') : '☐ ' + (t.btn_select_all || 'Select All');
        Object.assign(selectAllBtn.style, {
            background: 'transparent',
            border: '1px solid #555',
            borderRadius: '4px',
            color: '#aaa',
            fontSize: '10px',
            padding: '4px 8px',
            cursor: 'pointer',
            transition: 'all 0.2s'
        });
        selectAllBtn.onmouseenter = () => { selectAllBtn.style.borderColor = '#00d2ff'; selectAllBtn.style.color = '#00d2ff'; };
        selectAllBtn.onmouseleave = () => { selectAllBtn.style.borderColor = '#555'; selectAllBtn.style.color = '#aaa'; };
        selectAllBtn.onclick = () => {
            const targetState = !isAllSelected;
            basket.forEach(item => {
                if (item && item.id) state.basketSelectionState[item.id] = targetState;
            });
            renderBasketPreview(basket);
            updateStdPasteButton();
        };

        const hint = document.createElement('div');
        hint.innerText = selectedCount > 0 ? `${selectedCount} selected` : t.preview_drag_hint;
        Object.assign(hint.style, { fontSize: '10px', color: selectedCount > 0 ? '#4CAF50' : '#888' });

        headerRow.append(selectAllBtn, hint);
        basketPreviewList.append(headerRow);

        basket.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'cc-basket-item' + (state.basketSelectionState[item.id] ? ' selected' : '');
            row.draggable = true;
            row.dataset.index = index;
            row.dataset.id = item.id;

            const isSelected = state.basketSelectionState[item.id];

            Object.assign(row.style, {
                background: isSelected ? 'rgba(0, 210, 255, 0.15)' : '#333',
                padding: '8px',
                borderRadius: '6px',
                fontSize: '11px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'grab',
                border: isSelected ? '2px solid var(--cc-primary, #00d2ff)' : '2px solid transparent',
                position: 'relative',
                marginBottom: '4px',
                transition: 'all 0.15s'
            });

            row.onmouseenter = (e) => {
                if (!tooltip || draggingId !== null) return;
                let fullClean = item.text;
                if (currentPrefix && fullClean.startsWith(currentPrefix)) fullClean = fullClean.replace(currentPrefix, '');
                fullClean = fullClean.replace(/={5,}/g, '').replace(/--- Fragment ---/g, '').replace(/\[END OF CONTEXT\]/g, '').trim();
                if (fullClean.length > 500) fullClean = fullClean.substring(0, 500) + "\n\n(......)";
                tooltip.innerText = `[Source: ${item.source}]\n${fullClean}`;
                tooltip.style.display = 'block';
                updateTooltipPosition(e);
            };
            row.onmousemove = (e) => updateTooltipPosition(e);
            row.onmouseleave = () => { if (tooltip) tooltip.style.display = 'none'; };
            row.ondragstart = (e) => {
                e.stopPropagation();
                isDraggingRow = true;
                e.dataTransfer.effectAllowed = 'copyMove';
                const selectedIds = basket
                    .map(it => it && it.id)
                    .filter(itemId => itemId && state.basketSelectionState[itemId]);

                let dragText = '';
                let draggedIds = [];
                if (state.basketSelectionState[item.id] && selectedIds.length > 1) {
                    const selectedItems = selectedIds
                        .map(selectedId => basket.find(it => it && it.id === selectedId))
                        .filter(Boolean);

                    dragText = formatDragText(selectedItems);
                    draggedIds = selectedIds;
                    basketPreviewList.querySelectorAll('.cc-basket-item.selected').forEach(el => {
                        el.style.opacity = '0.5';
                    });
                } else {
                    dragText = formatDragText(item);
                    draggedIds = [item.id];
                    row.style.opacity = '0.5';
                }

                draggingId = item.id;
                e.dataTransfer.setData('text/plain', dragText);
                e.dataTransfer.setData('text', dragText);
                e.dataTransfer.setData('application/cc-id', item.id);
                e.dataTransfer.setData('application/cc-ids', JSON.stringify(draggedIds));
                e.dataTransfer.setData('application/cc-sort', 'true');
                if (tooltip) tooltip.style.display = 'none';
            };

            row.ondragend = (e) => {
                draggingId = null;
                basketPreviewList.querySelectorAll('.cc-basket-item').forEach(el => {
                    el.style.opacity = '1';
                    el.style.borderTopColor = 'transparent';
                    el.style.borderBottomColor = 'transparent';
                });
                setTimeout(() => { isDraggingRow = false; }, 200);

                if (window.location.hostname.includes('claude.ai')) {
                    const leaveEvent = new DragEvent('dragleave', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: 0,
                        clientY: 0
                    });

                    const dropEvent = new DragEvent('drop', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    });

                    const targets = [
                        document,
                        document.body,
                        document.querySelector('[data-testid="chat-input-grid-area"]'),
                        document.querySelector('div[class*="drag-overlay"]'),
                        ...document.querySelectorAll('.fixed.inset-0')
                    ];

                    targets.forEach(t => {
                        if (t) {
                            t.dispatchEvent(leaveEvent);
                            setTimeout(() => t.dispatchEvent(dropEvent), 10);
                        }
                    });
                }
            };
            row.ondragover = (e) => {
                e.preventDefault();
                if (!e.dataTransfer.types.includes('application/cc-sort')) {
                    e.dataTransfer.dropEffect = 'copy';
                    return;
                }

                if (!draggingId || draggingId === item.id) return;

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
                if (!state.basketSelectionState[item.id]) {
                    row.style.borderTopColor = 'transparent';
                    row.style.borderBottomColor = 'transparent';
                }
            };

            row.ondrop = (e) => {
                if (!e.dataTransfer.types.includes('application/cc-sort')) return;

                e.preventDefault();
                e.stopPropagation();
                row.style.borderTopColor = 'transparent';
                row.style.borderBottomColor = 'transparent';
                const fromId = e.dataTransfer.getData('application/cc-id');
                const toId = item.id;
                if (!fromId || !toId || fromId === toId) return;

                const order = basket.map(it => it.id).filter(Boolean);
                const fromIndex = order.indexOf(fromId);
                const toIndex = order.indexOf(toId);
                if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

                const [moved] = order.splice(fromIndex, 1);
                order.splice(toIndex, 0, moved);

                basketOp({ kind: 'REORDER', order }, () => updateBasketUI());
            };

            row.onclick = (e) => {
                if (isDraggingRow) return;
                if (e.target.closest('button')) return;
                if (e.target.closest('.cc-check-circle')) return;
                if (e.detail === 2) {
                    showEditorModal("Edit Item", item.text, (newText) => {
                        const id = item.id || row.dataset.id;
                        if (!id) return;

                        updateBasketItemText(id, newText, () => {
                            showToast("Content updated ✨");
                        });
                    });
                } else {
                    state.basketSelectionState[item.id] = !state.basketSelectionState[item.id];
                    renderBasketPreview(basket);
                    updateStdPasteButton();
                }
            };
            let cleanText = item.text;
            if (currentPrefix && cleanText.startsWith(currentPrefix)) cleanText = cleanText.replace(currentPrefix, '');
            cleanText = cleanText.replace(/={5,}/g, '').replace(/--- Fragment ---/g, '').replace(/\[END OF CONTEXT\]/g, '').trim();
            let snippet = cleanText.substring(0, 50).replace(/[\r\n]+/g, ' ');
            if (cleanText.length > 50) snippet += '...';
            if (snippet.length === 0) snippet = "(System Prompt Only)";
            const checkCircle = document.createElement('div');
            checkCircle.className = 'cc-check-circle';
            Object.assign(checkCircle.style, {
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: isSelected ? '2px solid var(--cc-primary, #00d2ff)' : '2px solid #555',
                background: isSelected ? 'var(--cc-primary, #00d2ff)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '8px',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s'
            });
            checkCircle.innerHTML = isSelected ? '<span style="color:#000;font-size:10px;font-weight:bold;">✓</span>' : '';
            checkCircle.onclick = (e) => {
                e.stopPropagation();
                state.basketSelectionState[item.id] = !state.basketSelectionState[item.id];
                renderBasketPreview(basket);
                updateStdPasteButton();
            };

            const info = document.createElement('div');
            info.style.overflow = 'hidden';
            info.style.flex = '1';
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
                if (tooltip) {
                    tooltip.style.display = 'none';
                }
                row.classList.add('cc-deleting');
                delete state.basketSelectionState[item.id];
                setTimeout(() => handleDeleteSingleItem(item.id || row.dataset.id, row), 300);
            };

            row.append(checkCircle, info, delBtn);
            basketPreviewList.append(row);
        });
        if (typeof updateContentTabBadges === 'function') {
            updateContentTabBadges();
        }
    }

    function updateStdPasteButton() {
        const pasteBtn = document.getElementById('cc-btn-paste-main');
        if (!pasteBtn) return;

        const selectedCount = basket.filter(it => it && it.id && state.basketSelectionState[it.id]).length;
        const t = LANG_DATA[state.lang];

        if (selectedCount > 0) {
            pasteBtn.innerHTML = `🪄(${selectedCount})`;
            pasteBtn.style.opacity = '1';
            pasteBtn.title = (t.btn_paste_selected || 'Paste {n} selected').replace('{n}', selectedCount);
        } else {
            pasteBtn.innerHTML = '🪄';
            pasteBtn.style.opacity = '0.6';
            pasteBtn.title = t.btn_paste_basket || 'Paste basket';
        }
    }

    function updateMechPasteButton() {
        const pasteBtn = document.getElementById('mech-btn-paste-main');
        if (!pasteBtn) return;

        const selectedCount = basket.filter(it => it && it.id && state.basketSelectionState[it.id]).length;
        const t = LANG_DATA[state.lang];

        if (selectedCount > 0) {
            pasteBtn.innerHTML = `🪄(${selectedCount})`;
            pasteBtn.style.background = 'var(--mech-accent, #00d2ff)';
            pasteBtn.style.color = '#000';
            pasteBtn.title = (t.btn_paste_selected || 'Paste {n} selected').replace('{n}', selectedCount);
        } else {
            pasteBtn.innerHTML = '🪄';
            pasteBtn.style.background = '';
            pasteBtn.style.color = '';
            pasteBtn.title = t.btn_paste_basket || 'Paste basket';
        }
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
            if (!Array.isArray(basket)) return;
            if (fromIndex < 0 || toIndex < 0 || fromIndex >= basket.length || toIndex >= basket.length) return;
            const [movedItem] = basket.splice(fromIndex, 1);
            basket.splice(toIndex, 0, movedItem);
            basketOp({ kind: 'REORDER', order: basket.map(it => it.id).filter(Boolean) }, () => {
                updateBasketUI();
            });
        });
    }

    function handleDeleteSingleItem(id, rowElement) {
        const targetId = id || (rowElement && rowElement.dataset ? rowElement.dataset.id : null);
        if (!targetId) return;
        if (rowElement) rowElement.remove();
        basketOp({ kind: 'DELETE', id: targetId }, () => {
            updateBasketUI();
        });
    }

    function handleNewDoc() {
        const t = LANG_DATA[state.lang];
        showEditorModal(t.btn_new_doc || "New Document", "", (text) => {
            if (text && text.trim().length > 0) {
                basketOp({
                    kind: 'ADD',
                    item: {
                        text: text.trim(),
                        timestamp: Date.now(),
                        source: t.src_manual
                    }
                }, () => {
                    showToast(t.toast_basket_add || "Added to basket");
                    updateBasketUI();
                });
            }
        });
    }

    function handleAddToBasket() {
        const text = getSelectedText(false);
        const t = LANG_DATA[state.lang];
        if (!text) { showToast(t.alert_no_selection); return; }

        getBasket((currentBasket) => {
            const currentCount = currentBasket ? currentBasket.length : 0;

            attemptFeatureUsage('context', () => {

                basketOp({
                    kind: 'ADD',
                    item: {
                        text: text,
                        timestamp: Date.now(),
                        source: window.location.hostname
                    }
                }, () => {
                    showToast(t.toast_basket_add);
                    handleUnselectAll();
                });

            }, currentCount);
        });
    }

    function handleClearBasket() {
        basketOp({ kind: 'CLEAR' }, () => {
            const t = LANG_DATA[state.lang];
            state.basketSelectionState = {}
            showToast(t.toast_basket_clear);
            updateBasketUI();
        });
    }

    function handlePasteBasket() {
        const t = LANG_DATA[state.lang];
        getBasket((basket) => {
            if (basket.length === 0) { showToast(t.basket_status_empty); return; }

            const inputEl = document.querySelector(config ? config.inputSelector : 'textarea, input[type="text"], [contenteditable="true"]');

            if (!inputEl) {
                showToast(t.alert_llm_only);
                return;
            }

            const selectedIds = basket.map(it => it && it.id).filter(id => id && state.basketSelectionState[id]);
            let itemsToPaste = basket;

            if (selectedIds.length > 0) {
                itemsToPaste = selectedIds.map(id => basket.find(it => it && it.id === id)).filter(Boolean);
            }

            if (itemsToPaste.length === 0) {
                showToast(t.toast_select_first || "Please select items to paste");
                return;
            }

            const finalContent = constructFinalContent(null, itemsToPaste);

            let limit = 100000;
            let platformName = 'General LLM Page';

            if (state.config) {
                const currentPlatform = PLATFORMS.find(p => window.location.hostname.includes(p.id));
                if (currentPlatform) {
                    limit = currentPlatform.limit || limit;
                    platformName = currentPlatform.name;
                }
            } else {
                limit = 100000;
            }

            const est = estimateTokens(finalContent);
            if (est > limit) {
                showTokenWarningModal(est, limit, platformName, () => {
                    autoFillInput(inputEl, finalContent);
                    showToast(t.toast_autofill);
                });
                return;
            }

            autoFillInput(inputEl, finalContent);
            showToast(t.toast_autofill);
        });
    }

    function handleCrossTransfer(platformObj) {
        resolveContentToExport((finalContent) => {
            if (!finalContent) return;
            const t = LANG_DATA[state.lang];
            const est = estimateTokens(finalContent);
            const limit = platformObj.limit || 30000;
            const platformName = platformObj.name;
            const url = platformObj.url;
            if (est > limit) {
                showTokenWarningModal(est, limit, platformName, () => {
                    chrome.storage.local.set({
                        'cc_transfer_payload': {
                            text: finalContent,
                            timestamp: Date.now(),
                            source: window.location.hostname
                        }
                    }, () => window.open(url, '_blank'));
                });
                return;
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
                selectBtn(btn);
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
                unselectBtn(btn);
                changed = true;
            }
        });

        if (changed) updateStatus();
        state.lastCheckedIndex = null;
        calculateTotalTokens();
    }

    /* =========================================
       6. Receiver Logic (Auto-Fill) & Listeners
    ========================================= */
    function checkAutoFill() {
        if (!chrome.storage) return;
        if (!state.config) return;

        chrome.storage.local.get(['cc_transfer_payload'], (result) => {
            const data = result.cc_transfer_payload;

            if (data && (Date.now() - data.timestamp < 30000)) {
                const lastConsumed = sessionStorage.getItem('cc_last_consumed_ts');
                if (lastConsumed && parseInt(lastConsumed) === data.timestamp) {
                    return;
                }

                let attempts = 0;
                const maxAttempts = 40;
                const fillInterval = setInterval(() => {
                    const inputEl = document.querySelector(state.config.inputSelector);
                    if (inputEl) {
                        clearInterval(fillInterval);
                        autoFillInput(inputEl, data.text);
                        sessionStorage.setItem('cc_last_consumed_ts', data.timestamp);
                        showToast(LANG_DATA[state.lang].toast_autofill);
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

    function fixGeminiDropZone() {
        const host = location.hostname;

        const isGemini = host === 'gemini.google.com';
        const isGrok = host === 'x.ai' || host === 'www.x.ai' || host === 'grok.com' || host === 'www.grok.com';
        const isClaude = host === 'claude.ai' || host === 'www.claude.ai';
        const isDeepSeek = host === 'chat.deepseek.com';
        const isPerplexity = host === 'www.perplexity.ai';

        if (!isGemini && !isGrok && !isClaude && !isDeepSeek && !isPerplexity) return;

        const flag =
            isGemini ? '__ccDropShimGemini' :
                isGrok ? '__ccDropShimGrok' :
                    isDeepSeek ? '__ccDropShimDeepSeek' :
                        isPerplexity ? '__ccDropShimPplx' :
                            '__ccDropShimClaude';

        if (window[flag]) return;
        window[flag] = true;

        const isInCCUI = (t) =>
            t && t.closest && t.closest('#cc-modal, .cc-modal, #cc-drone-fab, .cc-floating-ui, .cc-basket-item');

        const hasTextPayload = (dt) => {
            const types = dt?.types ? Array.from(dt.types) : [];
            const hasText = types.includes('text/plain') || types.includes('text');
            const hasFiles = types.includes('Files') || (dt?.files && dt.files.length > 0);
            return hasText && !hasFiles;
        };

        const isNearInput = (t) => {
            if (!t || !t.closest) return false;

            if (isGemini) {
                return !!t.closest('input-container, input-area-v2, .text-input-field, rich-textarea, .ql-editor, .input-area');
            }
            if (isGrok) {
                return !!t.closest('form, textarea, [contenteditable="true"], [role="textbox"], footer, .chat, .composer, .prompt');
            }
            if (isDeepSeek) {
                return !!t.closest('#chat-input, form, .ds-input-area');
            }
            if (isPerplexity) {
                return !!t.closest('textarea, div[class*="input-wrapper"], footer');
            }
            return !!t.closest('[data-testid="chat-input-grid-container"], [data-testid="chat-input"], fieldset, main');
        };

        const getTargetEditor = () => {
            if (isGemini) return document.querySelector('.ql-editor[contenteditable="true"]');
            if (isClaude) return document.querySelector('[data-testid="chat-input"]');
            return document.activeElement?.isContentEditable
                ? document.activeElement
                : (document.querySelector('[contenteditable="true"]') || document.querySelector('textarea'));
        };

        document.addEventListener('dragover', (e) => {
            if (isInCCUI(e.target)) return;
            if (!isNearInput(e.target)) return;
            if (!hasTextPayload(e.dataTransfer)) return;
            if (draggedItem) {
                e.preventDefault();
                return;
            }
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        }, true);

        document.addEventListener('drop', (e) => {
            if (isInCCUI(e.target)) return;
            if (!isNearInput(e.target)) return;
            if (!hasTextPayload(e.dataTransfer)) return;

            const editor = getTargetEditor();
            if (!editor) return;

            let text = '';
            try {
                text = (e.dataTransfer?.getData('text/plain') || e.dataTransfer?.getData('text') || '').trim();
            } catch { }

            if (!text) return;

            e.preventDefault();
            e.stopPropagation();

            autoFillInput(editor, text);

            showToast(LANG_DATA[state.lang]?.toast_autofill || "Auto-filled by ContextDrone.");
            cleanUpSiteOverlays();
        }, true);
    }

    function autoFillInput(element, text) {
        if (!element.isContentEditable && element.querySelector('.ql-editor')) {
            element = element.querySelector('.ql-editor');
        }
        if (!element.isContentEditable && element.tagName !== 'TEXTAREA' && element.tagName !== 'INPUT') {
            const innerEditable = element.querySelector('[contenteditable="true"], [role="textbox"], textarea, input');
            if (innerEditable) {
                element = innerEditable;
            }
        }
        element.focus();

        const isContentEditable = element.isContentEditable ||
            element.contentEditable === "true" ||
            element.getAttribute('role') === 'textbox';

        if (isContentEditable) {
            let success = false;
            if (element.classList.contains('ql-editor') && element.innerText.trim() === '') {
                const safeText = escapeHTML(text);
                element.innerHTML = `<p>${safeText}</p>`;
                success = true;
            } else {
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(element);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);

                success = document.execCommand('insertText', false, text);

                if (!success) {
                    if (element.innerText.trim() === '') {
                        element.innerHTML = `<p>${escapeHTML(text)}</p>`;
                    } else {
                        element.textContent += text;
                    }
                }
            }

            if (!success) {
                if (element.innerText.trim() === '') {
                    const safeText = text.replace(/[&<>'"]/g,
                        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
                    element.innerHTML = `<p>${safeText}</p>`;
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

        const tracker = element._valueTracker;
        if (tracker) {
            tracker.setValue(text);
        }

        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('textInput', { bubbles: true }));

        const originalBg = element.style.backgroundColor;
        element.style.transition = "background-color 0.5s";
        element.style.backgroundColor = "rgba(76, 175, 80, 0.2)";
        setTimeout(() => {
            element.style.backgroundColor = originalBg;
        }, 1000);
    }

    function showToast(message, targetDoc = document) {
        const toast = targetDoc.createElement('div');
        toast.innerText = message;
        Object.assign(toast.style, {
            position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
            background: '#333', color: '#fff', padding: '10px 20px', borderRadius: '20px',
            zIndex: '2147483660', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', fontSize: '12px',
            opacity: '0', transition: 'opacity 0.3s', border: '1px solid #555'
        });
        targetDoc.body.appendChild(toast);
        requestAnimationFrame(() => toast.style.opacity = '1');
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function refreshUIAfterUnlock() {
        state.isUnlocked = true;
        const t = LANG_DATA[state.lang];

        const robotPanel = document.getElementById('cc-robot-panel');
        if (robotPanel) {
            const antenna = robotPanel.querySelector('.antenna-group');
            if (antenna) {
                antenna.style.opacity = '1';
                antenna.title = t.ai_setting_tab;
            }

            const inputDeck = robotPanel.querySelector('.input-deck');
            if (inputDeck && !inputDeck.querySelector('#mech-ai-trigger')) {
                const aiTrigger = document.createElement('button');
                aiTrigger.id = 'mech-ai-trigger';
                aiTrigger.className = 'ai-trigger-btn';
                aiTrigger.innerText = '✨';
                aiTrigger.title = t.btn_summary;
                aiTrigger.onclick = handleAiSummary;
                inputDeck.appendChild(aiTrigger);
            }

            const visor = robotPanel.querySelector('.visor');
            if (visor && !visor.querySelector('#mech-comms-btn')) {
                const commsBtn = document.createElement('button');
                commsBtn.id = 'mech-comms-btn';
                commsBtn.className = 'comms-btn';
                commsBtn.innerHTML = `<span class="icon">📶</span> ${t.robot_comms_tab}`;
                commsBtn.title = t.ai_response_tab;
                commsBtn.onclick = () => {
                    if (state.streamingModal && state.streamingModal.element) {
                        state.streamingModal.restore();
                    } else {
                        const ctx = state.lastAiContext || "";
                        const cfg = state.lastAiConfig || state.aiConfig;
                        chrome.storage.local.get(['cc_last_layout_mode'], (res) => {
                            const savedMode = res.cc_last_layout_mode || 'single';
                            showStreamingResponseModalMulti(ctx, cfg, savedMode);
                        });
                    }
                };
                visor.appendChild(commsBtn);
            }
        }

        const stdPanel = document.getElementById('cc-panel');
        if (stdPanel) {
            const aiTab = stdPanel.querySelector('.cc-ai-tab');
            const resTab = stdPanel.querySelector('.cc-res-tab');
            if (aiTab) aiTab.style.display = 'flex';
            if (resTab) resTab.style.display = 'flex';

            const aiToolsRow = stdPanel.querySelector('.cc-tools:nth-of-type(2)');
            if (aiToolsRow && !aiToolsRow.querySelector('button')) {
                const btnSummary = document.createElement('button');
                btnSummary.className = 'tool-btn btn-ai-low';
                btnSummary.textContent = t.btn_summary;
                btnSummary.onclick = () => { handleAiSummary(); };
                aiToolsRow.appendChild(btnSummary);
            }
        }

        loadAiConfig();
    }

    function showFeatureUnlockModal(targetDoc = document, customWarning = null, onSuccess = null) {
        if (targetDoc.querySelector('.cc-unlock-overlay')) return;
        const t = LANG_DATA[state.lang];

        const isLight = state.theme === 'light';
        const bgOverlay = isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
        const bgCard = isLight ? '#ffffff' : '#1e1e1e';
        const textColor = isLight ? '#333' : '#fff';
        const borderColor = isLight ? '#ccc' : '#444';
        const textSubColor = isLight ? '#666' : '#ccc';
        const textBg = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';

        const overlay = targetDoc.createElement('div');
        overlay.className = 'cc-unlock-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: bgOverlay, zIndex: '2147483660',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(5px)', opacity: '0', transition: 'opacity 0.3s'
        });

        const card = targetDoc.createElement('div');
        Object.assign(card.style, {
            width: '340px', background: bgCard, border: `1px solid ${borderColor}`,
            borderTop: '3px solid #ff9800', borderRadius: '8px', padding: '20px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)', color: textColor,
            fontFamily: 'Segoe UI, sans-serif', display: 'flex', flexDirection: 'column', gap: '15px'
        });

        const warningMsg = customWarning || t.unlock_warning;

        card.innerHTML = `
            <div style="font-size:14px; font-weight:bold; color:#ff9800; display:flex; align-items:center; gap:8px;">
                <span>${t.unlock_title}</span>
            </div>
            <div style="font-size:11px; color:${textSubColor}; line-height:1.5; background:${textBg}; padding:10px; border-radius:4px; max-height:300px; overflow-y:auto;">
                ${warningMsg}
            </div>
            
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:5px;">
                <button id="btn-cancel-unlock" style="background:transparent; border:1px solid ${borderColor}; color:${textSubColor}; padding:6px 12px; cursor:pointer; border-radius:4px; font-size:11px;">
                    ${t.unlock_cancel}
                </button>
                <button id="btn-confirm-unlock" style="background:#ff9800; border:none; color:#000; padding:6px 12px; cursor:pointer; border-radius:4px; font-weight:bold; font-size:11px;">
                    ${t.unlock_confirm}
                </button>
            </div>
        `;

        overlay.appendChild(card);
        targetDoc.body.appendChild(overlay);

        requestAnimationFrame(() => overlay.style.opacity = '1');

        const btnSave = card.querySelector('#btn-confirm-unlock');
        const btnCancel = card.querySelector('#btn-cancel-unlock');

        btnCancel.onclick = () => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
                if (targetDoc !== document) {
                    targetDoc.defaultView.close();
                }
            }, 300);
        };

        btnSave.onclick = () => {
            btnSave.innerText = t.unlock_enabling;
            chrome.storage.local.set({ 'cc_feature_unlock': true }, () => {
                state.isUnlocked = true;
                showToast(t.unlock_toast_success, targetDoc);
                overlay.remove();
                refreshUIAfterUnlock();

                if (onSuccess) {
                    onSuccess();
                } else {
                    const robotPanel = document.getElementById('cc-robot-panel');
                    const stdPanel = document.getElementById('cc-panel');
                    if (robotPanel) robotPanel.remove();
                    if (stdPanel) stdPanel.remove();
                    state.active = false;
                    if (state.interval) clearInterval(state.interval);
                    setTimeout(() => openInterface(), 200);
                }
            });
        };
    }

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.cc_basket || changes.cc_folders || changes.cc_links) {

                if (changes.cc_basket) {
                    basket = changes.cc_basket.newValue || [];
                }

                updateBasketUI();
                syncPiPIfOpen();

                if (changes.cc_basket) {
                    calculateTotalTokens();

                    const newBasket = basket;
                    const count = newBasket.length;

                    const droneBadge = document.querySelector('.cc-drone-badge');
                    if (droneBadge) {
                        droneBadge.innerText = count > 99 ? '99+' : count;
                        droneBadge.style.display = count > 0 ? 'flex' : 'none';

                        const drone = document.getElementById('cc-transport-drone');
                        if (drone) {
                            drone.style.filter = "brightness(1.3)";
                            setTimeout(() => drone.style.filter = "", 300);
                        }
                    }

                    if (typeof updateRobotBasketText === 'function') {
                        updateRobotBasketText(count);
                    }

                    if (typeof updateDroneVisuals === 'function') {
                        updateDroneVisuals();
                    }
                }
            }

            if (changes.cc_disabled_domains) {
                const disabledList = changes.cc_disabled_domains.newValue || [];
                const currentHost = window.location.hostname;

                if (disabledList.includes(currentHost)) {
                    const drone = document.getElementById('cc-drone-fab');
                    if (drone) {
                        drone.style.transform = "scale(0)";
                        setTimeout(() => drone.remove(), 200);
                    }
                    const hoverCard = document.querySelector('.cc-hover-card');
                    if (hoverCard) hoverCard.remove();
                    state.droneDismissed = true;
                }
            }
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
            syncPiPIfOpen();
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
                const drone = document.getElementById('cc-drone-fab');
                if (!state.active && !drone) {
                    openInterface();
                }
                toggleSelectionMode();
                const p = document.getElementById('cc-panel') || document.getElementById('cc-robot-panel');
                if (p) p.style.opacity = '0.2';
                if (drone) drone.style.opacity = '0.2';
            }
            // Alt+L: toggle language
            if (key === 'KeyL') {
                e.preventDefault();

                const langList = (window.CC_SUPPORTED_LANGS && window.CC_SUPPORTED_LANGS.length > 0)
                    ? window.CC_SUPPORTED_LANGS.map(item => item.code)
                    : ['en', 'zh-TW', 'zh-CN', 'ja', 'ko'];

                const oldLang = state.lang;

                const currentIndex = langList.indexOf(oldLang);
                const nextIndex = (currentIndex + 1) % langList.length;
                const newLang = langList[nextIndex];

                if (prefixInput && LANG_DATA[oldLang] && LANG_DATA[newLang]) {
                    const currentInput = prefixInput.value?.trim() || '';
                    const oldDefault = LANG_DATA[oldLang].default_prompt.trim();

                    if (currentInput === oldDefault) {
                        prefixInput.value = LANG_DATA[newLang].default_prompt;
                        if (typeof flashInput === 'function') flashInput(prefixInput);
                    }
                }

                state.lang = newLang;
                updateUITexts();
                const statusText = document.getElementById('mech-status-text');
                if (statusText && LANG_DATA[newLang]) {
                    statusText.innerText = LANG_DATA[newLang].status_ready;
                }

                if (typeof showToast === 'function') {
                    const langLabel = (window.CC_SUPPORTED_LANGS && window.CC_SUPPORTED_LANGS[nextIndex])
                        ? window.CC_SUPPORTED_LANGS[nextIndex].flag + ' ' + window.CC_SUPPORTED_LANGS[nextIndex].label
                        : newLang.toUpperCase();
                    showToast(`Language: ${langLabel}`);
                }
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

        const t = LANG_DATA[state.lang];
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
        const drone = document.getElementById('cc-drone-fab');
        if (drone) drone.style.opacity = '1';
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
            const t = LANG_DATA[state.lang];
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
        const t = LANG_DATA[state.lang];
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
                basketOp({
                    kind: 'ADD',
                    item: {
                        text: finalText,
                        timestamp: Date.now(),
                        source: window.location.hostname + t.source_area_select
                    }
                }, () => {
                    showToast(t.toast_basket_add);
                    updateBasketUI();
                    calculateTotalTokens();
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

    function getWorkflowTemplates() {
        const t = LANG_DATA[state.lang];

        return {
            'clean': {
                name: t.clean,
                nodes: []
            },
            'summary_keywords': {
                name: t.summary_name,
                nodes: [
                    { id: 1, x: 50, y: 100, title: t.summary_node1, context: t.summary_ctx1 },
                    { id: 2, x: 400, y: 100, title: t.summary_node2, context: t.summary_ctx2 }
                ],
                connections: [{ from: 1, to: 2 }]
            },
            'translator_polish': {
                name: t.trans_name,
                nodes: [
                    { id: 1, x: 50, y: 100, title: t.trans_node1, context: t.trans_ctx1 },
                    { id: 2, x: 400, y: 100, title: t.trans_node2, context: t.trans_ctx2 }
                ],
                connections: [{ from: 1, to: 2 }]
            },
            'code_review': {
                name: t.review_name,
                nodes: [
                    { id: 1, x: 50, y: 50, title: t.review_node1, context: t.review_ctx1 },
                    { id: 2, x: 50, y: 350, title: t.review_node2, context: t.review_ctx2 },
                    { id: 3, x: 400, y: 200, title: t.review_node3, context: t.review_ctx3 }
                ],
                connections: [{ from: 1, to: 3 }, { from: 2, to: 3 }]
            }
        };
    }

    function toggleAiSettingsInDrawer(container) {
        if (typeof renderCompactSettings === 'function') {
            renderCompactSettings(container);
        } else {
            console.error("renderCompactSettings not found");
        }
    };

    function loadAiConfig() {
        chrome.storage.local.get(['cc_all_ai_configs', 'cc_active_ai_config_name', 'cc_ai_config'], (result) => {
            let allConfigs = result.cc_all_ai_configs || [];
            let activeConfig = null;
            if (allConfigs.length === 0) {
                const single = result.cc_ai_config || {};
                if (single && Object.keys(single).length > 0) {
                    const defaultName = single.name || 'Default';
                    allConfigs = [{ ...single, name: defaultName }];
                    activeConfig = allConfigs[0];
                    chrome.storage.local.set({
                        'cc_all_ai_configs': allConfigs,
                        'cc_active_ai_config_name': defaultName
                    });
                }
            }

            if (!activeConfig) {
                const activeName = result.cc_active_ai_config_name;
                if (activeName) {
                    activeConfig = allConfigs.find(c => c.name === activeName);
                }
                if (!activeConfig && allConfigs.length > 0) {
                    activeConfig = allConfigs[0];
                    chrome.storage.local.set({ 'cc_active_ai_config_name': activeConfig.name });
                }
            }

            state.allAiConfigs = allConfigs;
            state.aiConfig = activeConfig || {};

            const btn = document.querySelector('.tool-btn.btn-ai-low, .tool-btn.btn-ai-high');
            if (btn) {
                if (activeConfig && activeConfig.configured) {
                    btn.classList.remove('btn-ai-low');
                    btn.classList.add('btn-ai-high');
                    btn.innerHTML = `✨ AI Summary`;
                } else {
                    btn.classList.remove('btn-ai-high');
                    btn.classList.add('btn-ai-low');
                    btn.textContent = LANG_DATA[state.lang].btn_summary;
                }
            }
        });
    }

    function handleAiSummary() {
        const t = LANG_DATA[state.lang];

        if (!state.aiConfig || !state.aiConfig.configured) {
            loadAiConfig();
            setTimeout(() => {
                if (!state.aiConfig || !state.aiConfig.configured) {
                    if (state.isPiPActive && state.pipWindow) {
                        const btnSettings = state.pipWindow.document.getElementById('btn-pip-settings');
                        if (btnSettings) btnSettings.click();
                        showToast("Please configure AI settings first.");
                    } else if (state.uiMode === 'robot') {
                        openRobotSettings();
                        showToast("Please configure AI uplink first. 📡");
                    } else {
                        const drawer = document.getElementById('cc-ai-drawer-panel');
                        if (drawer) {
                            const aiTab = document.querySelector('.cc-ai-tab');
                            if (aiTab) aiTab.click();
                        }
                        showToast(t.ai_unconfigured || "Please configure AI settings first.");
                    }
                } else {
                    handleAiSummary();
                }
            }, 100);
            return;
        }

        const { ok, msg } = validateApiKey(state.aiConfig.provider, state.aiConfig.apiKey);
        if (!ok && state.aiConfig.provider !== 'local') {
            showToast(t.ai_unconfigured || `API Key Error: ${msg}`);
            if (state.uiMode === 'robot') openRobotSettings();
            return;
        }

        resolveContentToExport((finalContent) => {
            if (state.isPiPActive && state.pipWindow) {
                const win = state.pipWindow;
                win.focus();

                const tabFlow = win.document.getElementById('tab-flow');
                if (tabFlow) tabFlow.click();

                if (finalContent) {
                    state.multiPanelConfigs.push({
                        id: Date.now(),
                        context: finalContent,
                        config: state.aiConfig || {},
                        x: 50, y: 50,
                        responseText: "",
                        runCount: 0
                    });
                    renderPiPNodes(win);
                }
                return;
            }

            if (!finalContent) return;
            if (typeof showStreamingResponseModalMulti === 'function') {
                showStreamingResponseModalMulti(finalContent, state.aiConfig, 'single', true);
            }
        });
    }

    function validateApiKey(provider, key) {
        const isLocal = (provider === 'local' || provider === 'ollama' || provider === 'lm-studio' || provider === 'lm_studio');

        if (!key && !isLocal) {
            return { ok: false, msg: 'API Key is required.' };
        }

        if (isLocal) {
            return { ok: true };
        }

        if (key.length < 20) {
            return { ok: false, msg: 'API Key looks too short.' };
        }

        if (provider === 'openai' && !key.startsWith('sk-')) {
            return { ok: false, msg: 'OpenAI key should start with "sk-".' };
        }

        if (provider === 'claude' && !key.startsWith('sk-ant-')) {
            return { ok: false, msg: 'Claude key should start with "sk-ant-".' };
        }

        return { ok: true };
    }

    function showStreamingResponseModalMulti(originalContext, aiConfig, initialMode = null, autoStart = false) {
        const t = LANG_DATA[state.lang];
        if (initialMode) {
            state.aiLayoutMode = initialMode;
        } else if (!state.aiLayoutMode) {
            state.aiLayoutMode = 'single';
        }

        if (!state.loopSetting) state.loopSetting = 1;

        if (!state.multiPanelConfigs) state.multiPanelConfigs = [];

        if (!state.singleViewConfig) {
            state.singleViewConfig = {
                id: 'single-node',
                context: originalContext || "",
                config: aiConfig || state.aiConfig || {},
                isStreaming: false,
                responseText: "",
                runCount: 0
            };
        } else if (originalContext && state.aiLayoutMode === 'single') {
            state.singleViewConfig.context = originalContext;
            state.singleViewConfig.config = aiConfig || state.aiConfig || {};
        }

        if (state.multiPanelConfigs.length === 0) {
            state.multiPanelConfigs.push({
                id: Date.now(),
                context: "",
                config: aiConfig || state.aiConfig || {},
                x: 100, y: 100,
                isStreaming: false,
                responseText: "",
                runCount: 0
            });
            state.workflowConnections = [];
        }

        if (state.streamingModal && state.streamingModal.element) {
            state.streamingModal.element.remove();
        }

        const mask = document.createElement('div');
        mask.className = 'cc-modal-mask';

        let targetParent = document.body;

        if (state.isPiPActive && state.pipWindow) {
            targetParent = state.pipWindow.document.body;
            mask.classList.add('pip-mode');
        }

        const cardEl = document.createElement('div');
        cardEl.className = 'cc-modal-card';

        const header = document.createElement('div');
        header.className = 'cc-modal-header';

        const updateCardStyle = () => {
            const isSingle = state.aiLayoutMode === 'single';
            if (isSingle) {
                Object.assign(cardEl.style, {
                    width: '800px', maxWidth: '95vw', height: '75vh',
                    display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease'
                });
            } else {
                Object.assign(cardEl.style, {
                    width: '98vw', height: '95vh', maxWidth: 'none',
                    display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease'
                });
            }
        };
        updateCardStyle();

        const toolbarStyles = `
            <style>
                .cc-toolbar-group {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: rgba(255, 255, 255, 0.05);
                    padding: 4px 8px;
                    border-radius: 6px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }
                .cc-toolbar-btn {
                    background: transparent;
                    border: 1px solid transparent;
                    color: #e0e6ed;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    transition: all 0.2s;
                }
                .cc-toolbar-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.2);
                }
                .cc-toolbar-btn.primary {
                    background: var(--cc-primary, #3b82f6);
                    color: white;
                }
                .cc-toolbar-btn.danger {
                    color: #ff5252;
                }
                .cc-toolbar-select {
                    background: #111;
                    color: #fff;
                    border: 1px solid #444;
                    border-radius: 4px;
                    padding: 2px 4px;
                    font-size: 11px;
                    outline: none;
                }
            </style>
        `;

        header.innerHTML = toolbarStyles + `
            <div style="font-weight:bold; display:flex; align-items:center; gap:12px; font-size: 14px; color: #fff;">
                <span id="cc-mm-title" style="display:flex; align-items:center; gap:6px;"></span>
                <div class="cc-toolbar-group">
                    <button id="btn-toggle-view" class="cc-toolbar-btn" title="Toggle View"></button>
                </div>
            </div>

            <div class="min-controls" style="display:flex; gap:12px; align-items:center;">
                <div id="toolbar-templates" class="cc-toolbar-group">
                    <span style="font-size:11px; color:#aaa;">🧩 Templates:</span>
                    <select id="template-select" class="cc-toolbar-select">
                        <option value="">-- Select --</option>
                        ${Object.entries(getWorkflowTemplates()).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}
                    </select>
                </div>
                
                <div id="loop-control-group" class="cc-toolbar-group">
                    <span id="cc-mm-loop-label" style="font-size:11px; color:#aaa; font-weight:normal;"></span>
                    <select id="loop-select" class="cc-toolbar-select">
                        <option value="1">1 (Once)</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="5">5</option>
                        <option value="10">10</option>
                    </select>
                </div>

                <button id="btn-global-settings" class="cc-toolbar-btn" title="Global Settings"><span>⚙️</span></button>

                <div id="canvas-controls" class="cc-toolbar-group" style="border-color: var(--cc-primary, #3b82f6);">
                    <button id="btn-add-node" class="cc-toolbar-btn"><span>+</span> Node</button>
                    <div style="width:1px; height:16px; background:#444;"></div>
                    <button id="btn-run-flow" class="cc-toolbar-btn primary">▶ Run</button>
                    <button id="btn-stop-all" class="cc-toolbar-btn danger">⏹ Stop</button>
                </div>

                <button id="btn-close-modal" class="cc-toolbar-btn" style="font-size: 14px; opacity: 0.7;">✕</button>
            </div>
        `;
        setTimeout(() => {
            const loopSel = header.querySelector('#loop-select');
            if (loopSel) {
                loopSel.value = state.loopSetting || 1;
                loopSel.onchange = (e) => { state.loopSetting = parseInt(e.target.value); };
            }
        }, 0);

        const canvasContainer = document.createElement('div');
        canvasContainer.id = 'cc-canvas-container';
        Object.assign(canvasContainer.style, {
            position: 'relative', width: '100%', flex: '1', overflow: 'hidden'
        });

        const svgLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgLayer.id = 'cc-connections-layer';
        svgLayer.style.overflow = 'visible';
        svgLayer.innerHTML = `<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#ff9800" /></marker></defs>`;
        canvasContainer.appendChild(svgLayer);

        const singleFooter = document.createElement('div');
        singleFooter.className = 'cc-modal-footer';
        singleFooter.style.cssText = `padding:10px; border-top:1px solid #333; background:#1e1e1e; gap:8px; align-items:center; flex-wrap:wrap; display:none;`;

        const exportGroup = document.createElement('div');
        exportGroup.style.display = 'flex'; exportGroup.style.gap = '4px'; exportGroup.style.marginRight = 'auto';

        const btnExportSingle = document.createElement('button');
        btnExportSingle.innerHTML = "📤 Export / Save";
        btnExportSingle.title = t.pip_export_title || "Export";
        btnExportSingle.style.cssText = "background:#333; border:1px solid #555; color:#ccc; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:bold;";

        btnExportSingle.onclick = () => {
            const text = state.singleViewConfig.responseText || state.singleViewConfig.context || "";
            if (!text) return showToast("No content to export");

            const defName = `ai-response-${Date.now()}`;
            showUniversalExportModal(window, text, defName);
        };

        exportGroup.append(btnExportSingle);
        singleFooter.appendChild(exportGroup);

        const btnSendAll = document.createElement('button');
        btnSendAll.id = 'btn-mm-send-all';
        btnSendAll.innerHTML = t.mm_send_all;
        btnSendAll.style.cssText = "background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:bold;";
        btnSendAll.onclick = () => {
            const txt = state.singleViewConfig.responseText || state.singleViewConfig.context || "";
            if (txt) {
                chrome.storage.local.set({
                    'cc_transfer_payload': {
                        text: txt,
                        timestamp: Date.now(),
                        source: 'SingleView_SendAll'
                    }
                }, () => {
                    PLATFORMS.forEach(p => window.open(p.url, '_blank'));
                });
            }
        };
        singleFooter.appendChild(btnSendAll);

        PLATFORMS.forEach(p => {
            const btn = document.createElement('button');
            const iconUrl = chrome.runtime.getURL(`images/${p.id}_${state.theme}.png`);
            btn.innerHTML = `
                <img src="${iconUrl}" 
                     class="cc-platform-icon" 
                     data-pid="${p.id}" 
                     style="width:16px; height:16px; vertical-align:middle; object-fit:contain;">
            `;
            btn.style.cssText = "background:#333; border:1px solid #555; color:#fff; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:11px;";
            btn.onclick = () => {
                const txt = state.singleViewConfig.responseText || state.singleViewConfig.context || "";
                if (txt) chrome.storage.local.set({ 'cc_transfer_payload': { text: txt, timestamp: Date.now(), source: 'SingleView' } }, () => window.open(p.url, '_blank'));
            };
            singleFooter.appendChild(btn);
        });

        const fabBasket = document.createElement('button');
        fabBasket.innerHTML = "🧺";
        fabBasket.title = t.mm_basket;
        fabBasket.style.cssText = `
            position: absolute; bottom: 20px; right: 20px; 
            width: 48px; height: 48px; border-radius: 50%; 
            background: #ff9800; border: 2px solid #fff; color: #fff; 
            font-size: 24px; cursor: pointer; z-index: 1000; 
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            display: flex; align-items: center; justify-content: center;
            transition: transform 0.2s, background 0.2s;
        `;

        fabBasket.addEventListener('dragover', (e) => {
            e.preventDefault(); e.stopPropagation();
            fabBasket.style.transform = 'scale(1.2)';
            fabBasket.style.background = '#4CAF50';
        });
        fabBasket.addEventListener('dragleave', (e) => {
            fabBasket.style.transform = 'scale(1)';
            fabBasket.style.background = '#ff9800';
        });
        fabBasket.addEventListener('drop', (e) => {
            e.preventDefault(); e.stopPropagation();
            fabBasket.style.transform = 'scale(1)';
            fabBasket.style.background = '#ff9800';
            const text = e.dataTransfer.getData('text/plain');
            if (text) {
                basketOp({
                    kind: 'ADD',
                    item: { text: text, timestamp: Date.now(), source: 'Drag Drop' }
                }, () => {
                    showToast(t.mm_basket_added);
                    if (basketMiniWin.style.display !== 'none') refreshBasketList();
                    fabBasket.innerHTML = "✅";
                    setTimeout(() => fabBasket.innerHTML = "🧺", 1000);
                });
            }
        });

        const tmplSelect = header.querySelector('#template-select');
        if (tmplSelect) {
            tmplSelect.onchange = (e) => {
                const key = e.target.value;
                if (!key || !WORKFLOW_TEMPLATES[key]) return;
                const t = LANG_DATA[state.lang];
                const title = t.mm_load_tmpl_title || 'Load Template?';
                const msg = t.mm_load_tmpl_msg || 'Current workflow will be cleared. Continue?';

                showMainConfirmModal(title, msg, () => {
                    const tmpl = getWorkflowTemplates()[key];
                    state.multiPanelConfigs = [];
                    state.workflowConnections = [];

                    tmpl.nodes.forEach(n => {
                        state.multiPanelConfigs.push({
                            id: Date.now() + n.id,
                            context: n.context,
                            config: state.aiConfig || {},
                            x: n.x, y: n.y,
                            isStreaming: false, responseText: "", runCount: 0,
                            customTitle: n.title
                        });
                    });

                    const baseId = state.multiPanelConfigs[0].id - tmpl.nodes[0].id;
                    if (tmpl.connections) {
                        tmpl.connections.forEach(c => {
                            state.workflowConnections.push({
                                from: baseId + c.from,
                                to: baseId + c.to,
                                id: Date.now() + Math.random()
                            });
                        });
                    }

                    if (state.aiLayoutMode === 'single') {
                        state.aiLayoutMode = 'canvas';
                        updateCardStyle();
                    }
                    renderAll();
                    tmplSelect.value = "";
                });
            };
        }

        const basketMiniWin = document.createElement('div');
        basketMiniWin.id = 'cc-canvas-basket';
        basketMiniWin.style.cssText = `
            position: absolute; bottom: 80px; right: 20px; width: 280px; max-height: 400px;
            background: #1e1e1e; border: 1px solid #444; border-radius: 8px;
            display: none; flex-direction: column; z-index: 1001; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.5); padding: 10px;
        `;


        const basketHeader = document.createElement('div');
        basketHeader.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid #444; padding-bottom:5px; font-weight:bold; color:#ff9800;";
        const basketTitle = document.createElement('span');
        basketTitle.id = 'cc-mm-basket-title';
        basketTitle.innerText = t.mm_basket;
        const basketActions = document.createElement('div');
        basketActions.style.display = 'flex'; basketActions.style.gap = '4px';

        const btnBasketPasteAll = document.createElement('button');
        btnBasketPasteAll.id = 'btn-mm-basket-paste-all';
        btnBasketPasteAll.innerHTML = "📥";
        btnBasketPasteAll.title = t.mm_basket_paste_all;
        btnBasketPasteAll.style.cssText = "font-size:12px; background:transparent; border:1px solid #555; color:#ccc; cursor:pointer; padding:2px 4px; border-radius:3px;";
        btnBasketPasteAll.onclick = () => {
            getBasket(basket => {
                if (!basket.length) return showToast(t.mm_basket_empty);
                const content = basket.map(b => b.text).join('\n\n');
                state.multiPanelConfigs.forEach(p => {
                    p.context = (p.context ? p.context + "\n\n" : "") + content;
                });
                renderAll();
                const t = LANG_DATA[state.lang];
                showToast(t.mm_pasted_all || "Pasted to all nodes");
            });
        };

        const btnBasketExport = document.createElement('button');
        btnBasketExport.id = 'btn-mm-basket-export';
        btnBasketExport.innerHTML = "⬇️";
        btnBasketExport.title = t.mm_basket_export;
        btnBasketExport.style.cssText = "font-size:12px; background:transparent; border:1px solid #555; color:#ccc; cursor:pointer; padding:2px 4px; border-radius:3px;";
        btnBasketExport.onclick = () => {
            getBasket(basket => {
                if (!basket.length) return showToast(t.mm_basket_empty);
                const content = basket.map(b => `[Source: ${b.source}]\n${b.text}`).join('\n\n====================\n\n');
                const blob = new Blob([content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `basket-export-${Date.now()}.txt`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
            });
        };

        const btnBasketImport = document.createElement('button');
        btnBasketImport.id = 'btn-mm-basket-import';
        btnBasketImport.innerHTML = "⬆️";
        btnBasketImport.title = t.mm_basket_import;
        btnBasketImport.style.cssText = "font-size:12px; background:transparent; border:1px solid #555; color:#ccc; cursor:pointer; padding:2px 4px; border-radius:3px;";
        btnBasketImport.onclick = () => {
            const input = document.createElement('input'); input.type = 'file'; input.accept = '.txt,.md,.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const text = ev.target.result;
                    try {
                        const json = JSON.parse(text);
                        if (Array.isArray(json) && json.length && json[0] && typeof json[0] === 'object' && json[0].text) {
                            const itemsToAdd = json.map(it => ({
                                text: (it.text || '').toString(),
                                timestamp: it.timestamp || Date.now(),
                                source: it.source || (file.name + ' (Import)')
                            })).filter(it => it.text.trim().length > 0);
                            if (!itemsToAdd.length) throw new Error('Empty import');
                            let pending = itemsToAdd.length;
                            itemsToAdd.forEach((it) => {
                                basketOp({ kind: 'ADD', item: it }, () => {
                                    pending -= 1;
                                    if (pending === 0) { showToast("Imported"); refreshBasketList(); }
                                });
                            });
                        } else {
                            throw new Error('Not array');
                        }
                    } catch (err) {
                        basketOp({ kind: 'ADD', item: { text: text, timestamp: Date.now(), source: file.name + ' (Import)' } }, () => {
                            showToast("Imported"); refreshBasketList();
                        });
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        };


        basketActions.append(btnBasketPasteAll, btnBasketExport, btnBasketImport);
        basketHeader.append(basketTitle, basketActions);

        const basketList = document.createElement('div');
        basketList.style.cssText = "flex:1; overflow-y:auto; max-height:300px;";

        basketList.addEventListener('dragover', (e) => { e.preventDefault(); basketList.style.background = 'rgba(255,152,0,0.1)'; });
        basketList.addEventListener('dragleave', (e) => { basketList.style.background = 'transparent'; });

        basketList.addEventListener('drop', (e) => {
            if (e.dataTransfer.types.includes('application/cc-basket-index')) {
                e.preventDefault();
                basketList.style.background = 'transparent';
                return;
            }

            e.preventDefault(); basketList.style.background = 'transparent';
            const text = e.dataTransfer.getData('text/plain');
            if (text) {
                basketOp({ kind: 'ADD', item: { text: text, timestamp: Date.now(), source: 'Canvas' } }, () => {
                    showToast(t.mm_basket_added); refreshBasketList();
                });
            }
        });

        basketMiniWin.append(basketHeader, basketList);

        const refreshBasketList = () => {
            getBasket(items => {
                basketList.innerHTML = "";
                if (!items || items.length === 0) {
                    basketList.innerHTML = `<div style='color:#666; font-size:11px; text-align:center;'>${t.mm_basket_empty}</div>`;
                } else {
                    items.forEach((item, index) => {
                        const d = document.createElement('div');
                        d.draggable = true;
                        d.dataset.id = item.id;
                        d.style.cssText = "background:#333; padding:6px; margin-bottom:5px; border-radius:4px; font-size:11px; cursor:grab; color:#ccc; border: 1px solid transparent; transition: all 0.2s;";
                        d.innerText = item.text.substring(0, 40) + "...";

                        d.ondragstart = (e) => {
                            const dragText = formatDragText(item);
                            e.dataTransfer.setData('text/plain', dragText);
                            e.dataTransfer.setData('application/cc-basket-id', item.id);
                            e.dataTransfer.effectAllowed = 'move';
                            d.style.opacity = '0.5';
                        };

                        d.ondragend = () => {
                            d.style.opacity = '1';
                            Array.from(basketList.children).forEach(c => {
                                c.style.borderTop = 'none';
                                c.style.borderBottom = 'none';
                            });
                        };

                        d.ondragover = (e) => {
                            if (e.dataTransfer.types.includes('application/cc-basket-id')) {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                const rect = d.getBoundingClientRect();
                                const midY = rect.top + rect.height / 2;
                                if (e.clientY < midY) {
                                    d.style.borderTop = '2px solid #4CAF50';
                                    d.style.borderBottom = 'none';
                                } else {
                                    d.style.borderBottom = '2px solid #4CAF50';
                                    d.style.borderTop = 'none';
                                }
                            }
                        };

                        d.ondragleave = () => {
                            d.style.borderTop = 'none';
                            d.style.borderBottom = 'none';
                        };

                        d.ondrop = (e) => {
                            const fromId = e.dataTransfer.getData('application/cc-basket-id');
                            if (fromId) {
                                e.preventDefault(); e.stopPropagation();
                                const toId = d.dataset.id;
                                if (!toId || fromId === toId) return;

                                const order = items.map(it => it.id).filter(Boolean);
                                const fromIndex = order.indexOf(fromId);
                                const toIndex = order.indexOf(toId);
                                if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

                                const [moved] = order.splice(fromIndex, 1);
                                order.splice(toIndex, 0, moved);

                                basketOp({ kind: 'REORDER', order });
                            }
                        };

                        basketList.appendChild(d);
                    });
                }
            });
        };

        const canvasBasketListener = () => refreshBasketList();
        state.basketListeners.add(canvasBasketListener);

        fabBasket.onclick = () => {
            if (basketMiniWin.style.display === 'none') {
                basketMiniWin.style.display = 'flex'; refreshBasketList();
            } else {
                basketMiniWin.style.display = 'none';
            }
        };

        canvasContainer.append(fabBasket, basketMiniWin);
        cardEl.append(header, canvasContainer, singleFooter);
        mask.appendChild(cardEl);
        targetParent.appendChild(mask);
        function detectCycle(nodes, connections) {
            const ids = new Set(nodes.map(n => n.id));
            const indeg = new Map();
            const adj = new Map();
            ids.forEach(id => { indeg.set(id, 0); adj.set(id, []); });

            connections.forEach(({ from, to }) => {
                const f = parseInt(from), t = parseInt(to);
                if (!ids.has(f) || !ids.has(t)) return;
                adj.get(f).push(t);
                indeg.set(t, indeg.get(t) + 1);
            });

            const q = [];
            indeg.forEach((v, k) => { if (v === 0) q.push(k); });

            let visited = 0;
            while (q.length) {
                const u = q.shift();
                visited++;
                for (const v of adj.get(u)) {
                    indeg.set(v, indeg.get(v) - 1);
                    if (indeg.get(v) === 0) q.push(v);
                }
            }
            return visited !== ids.size;
        }

        function buildPrompt(node) {
            const base = node.context || "";

            if (!node.inputSlots) return base;

            const nodeId = parseInt(node.id);

            const incomingIds = state.workflowConnections
                .filter(c => parseInt(c.to) === nodeId)
                .map(c => parseInt(c.from));

            if (incomingIds.length === 0) return base;

            const blocks = incomingIds
                .map(fromId => node.inputSlots[fromId])
                .filter(slot => slot && slot.text)
                .map(slot => `\n\n--- Input from Previous Node (ID:${String(slot.sourceId).slice(-3)}) ---\n${slot.text}`);

            if (blocks.length > 0) {
                return base + blocks.join("");
            }

            return base;
        }

        let isFlowStopped = false;

        function runNodeTask(panel, expectedToken, forceRun = false) {
            return new Promise((resolve) => {
                if (expectedToken !== state.runToken) { resolve(); return; }
                if (typeof isFlowStopped !== 'undefined' && isFlowStopped) { resolve(); return; }
                if (panel.runCount >= state.loopSetting) { resolve(); return; }

                const currentToken = expectedToken;

                if (!panel.inputSlots) panel.inputSlots = {};
                if (typeof panel._inputVersion === 'undefined') panel._inputVersion = 0;

                if (panel.id !== 'single-node' && !forceRun) {
                    const incomingConns = state.workflowConnections.filter(c => parseInt(c.to) === panel.id);
                    const allParentsReady = incomingConns.every(c => {
                        const pid = parseInt(c.from);
                        const parent = state.multiPanelConfigs.find(p => p.id === pid);
                        if (!parent) return false;
                        return parent.lastFinishedRunToken === currentToken &&
                            parent.runCount > panel.runCount &&
                            parent.isFinished;
                    });
                    if (!allParentsReady && incomingConns.length > 0) { resolve(); return; }
                }

                const panelEl = (panel.id === 'single-node')
                    ? document.getElementById('cc-canvas-container').querySelector('.cc-freestyle-panel')
                    : document.getElementById(`panel-${panel.id}`);

                const statusTag = panelEl ? panelEl.querySelector('.cc-status-tag') : null;
                const outArea = panelEl ? panelEl.querySelector('.output-area') : null;

                if (panelEl) { panelEl.classList.add('active'); panelEl.classList.remove('processing'); }
                if (statusTag) {
                    statusTag.innerText = `Running (${panel.runCount + 1}/${state.loopSetting})`;
                    statusTag.style.color = "#00d2ff";
                }

                panel.responseText = "";
                if (outArea) outArea.innerText = "";

                const finalPrompt = (panel.id === 'single-node') ? (panel.context || "") : buildPrompt(panel);

                const isLocalProvider = ['local', 'ollama', 'lm-studio', 'lm_studio'].includes(panel.config?.provider);

                if (!panel.config || (!panel.config.apiKey && !isLocalProvider)) {
                    if (statusTag) {
                        statusTag.innerText = "Config Error";
                        statusTag.style.color = "#ff0000";
                    }
                    panel.responseText = `[Error] Node configuration is missing or API Key is invalid.\nPlease check the settings specifically for Node #${String(panel.id).slice(-3)}.`;
                    if (outArea) outArea.innerText = panel.responseText;
                    resolve();
                    return;
                }

                panel.isFinished = false;
                panel.runCount++;

                callAiStreaming(finalPrompt, panel.config, {
                    append: (chunk) => {
                        if ((typeof isFlowStopped !== 'undefined' && isFlowStopped) || state.runToken !== currentToken) return;
                        panel.responseText += chunk;
                        if (outArea) { outArea.innerText = panel.responseText; outArea.scrollTop = outArea.scrollHeight; }
                        if (panel.id === 'single-node') state.lastAiText = panel.responseText;
                    },
                    done: () => {
                        if ((typeof isFlowStopped !== 'undefined' && isFlowStopped) || state.runToken !== currentToken) { resolve(); return; }

                        if (panelEl) { panelEl.classList.remove('active'); panelEl.classList.add('processing'); }
                        if (statusTag) { statusTag.innerText = "Done"; statusTag.style.color = "#4CAF50"; }

                        panel.isFinished = true;
                        panel.lastFinishedRunToken = currentToken;

                        if (panel.id !== 'single-node') triggerDownstream(panel.id, currentToken);
                        resolve();
                    },
                    error: (err) => {
                        if ((typeof isFlowStopped !== 'undefined' && isFlowStopped) || state.runToken !== currentToken) { resolve(); return; }
                        if (statusTag) { statusTag.innerText = "Error"; statusTag.style.color = "#f00"; }
                        panel.responseText += `\n[Error] ${err}`;
                        if (outArea) outArea.innerText = panel.responseText;
                        panel.isFinished = true;
                        panel.hasError = true;
                        failDownstream(panel.id, err, false);
                        resolve();
                    }
                });
            });
        }

        state.runNodeTask = runNodeTask;

        function triggerDownstream(sourceId, tokenFromCaller) {
            if (typeof isFlowStopped !== 'undefined' && isFlowStopped) return;

            const currentToken = tokenFromCaller;
            const sid = parseInt(sourceId);

            const outgoing = state.workflowConnections.filter(c => parseInt(c.from) === sid);

            const sourcePanel = state.multiPanelConfigs.find(p => p.id === sid);
            if (!sourcePanel) return;

            outgoing.forEach(conn => {
                const tid = parseInt(conn.to);
                const targetPanel = state.multiPanelConfigs.find(p => p.id === tid);
                if (!targetPanel) return;

                if (!targetPanel.inputSlots) targetPanel.inputSlots = {};

                targetPanel.inputSlots[sid] = {
                    text: sourcePanel.responseText || "",
                    sourceId: sid,
                    timestamp: Date.now()
                };

                targetPanel._inputVersion = (targetPanel._inputVersion || 0) + 1;

                const queueKey = `${currentToken}:${targetPanel.runCount}:${targetPanel._inputVersion}`;
                if (targetPanel._lastQueuedKey === queueKey) return;
                if (targetPanel.runCount < state.loopSetting) {
                    targetPanel._lastQueuedKey = queueKey;

                    if (typeof AI_QUEUE !== 'undefined') {
                        AI_QUEUE.add(() => state.runNodeTask(targetPanel, currentToken));
                    } else {
                        state.runNodeTask(targetPanel, currentToken);
                    }
                }
            });
        }

        let isConnecting = false, connectStartNode = null, tempPath = null;
        let isDraggingPanel = false, currentDragPanel = null, dragOffsetX = 0, dragOffsetY = 0;

        function getCenterPos(el) {
            if (!el) return { x: 0, y: 0 };
            const r = el.getBoundingClientRect();
            const c = canvasContainer.getBoundingClientRect();
            return { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height / 2 };
        }
        function calculateBezier(x1, y1, x2, y2) {
            const dist = Math.abs(x2 - x1) * 0.5 + 50;
            return `M ${x1} ${y1} C ${x1 + dist} ${y1}, ${x2 - dist} ${y2}, ${x2} ${y2}`;
        }
        function renderConnections() {
            const paths = svgLayer.querySelectorAll('path.connection');
            paths.forEach(p => p.remove());
            if (state.aiLayoutMode === 'single') return;

            state.workflowConnections.forEach((conn, index) => {
                const fromEl = document.querySelector(`.cc-connector.output[data-pid="${conn.from}"]`);
                const toEl = document.querySelector(`.cc-connector.input[data-pid="${conn.to}"]`);
                if (!fromEl || !toEl) return;
                const p1 = getCenterPos(fromEl);
                const p2 = getCenterPos(toEl);
                const d = calculateBezier(p1.x, p1.y, p2.x, p2.y);
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute('d', d);
                path.setAttribute('class', 'connection');
                path.setAttribute('marker-end', 'url(#arrowhead)');
                path.onclick = (e) => {
                    e.stopPropagation();
                    const t = LANG_DATA[state.lang];
                    const title = t.delete_connection_title;
                    const msg = t.delete_connection_msg;
                    showMainConfirmModal(title, msg, () => {
                        const fromId = parseInt(conn.from);
                        const toId = parseInt(conn.to);

                        state.workflowConnections.splice(index, 1);
                        const targetNode = state.multiPanelConfigs.find(n => n.id === toId);
                        if (targetNode && targetNode.inputSlots) {
                            delete targetNode.inputSlots[fromId];
                        }

                        renderConnections();
                    });
                };
                svgLayer.appendChild(path);
            });
        }

        function createFreestylePanel(panel) {
            const isSingleMode = state.aiLayoutMode === 'single';
            const el = document.createElement('div');
            el.className = 'cc-freestyle-panel';
            el.id = (isSingleMode) ? 'panel-single' : `panel-${panel.id}`;

            if (isSingleMode) {
                el.classList.add('maximized');
                Object.assign(el.style, {
                    border: 'none', boxShadow: 'none', background: 'transparent',
                    top: '0', left: '0', width: '100%', height: '100%', borderRadius: '0'
                });
            } else {
                if (!panel.x) panel.x = 100 + (Math.random() * 50);
                if (!panel.y) panel.y = 100 + (Math.random() * 50);
                Object.assign(el.style, { left: `${panel.x}px`, top: `${panel.y}px` });
            }

            if (!isSingleMode) {
                el.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); el.style.borderColor = '#00d2ff'; });
                el.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); el.style.borderColor = '#444'; });
                el.addEventListener('drop', (e) => {
                    e.preventDefault(); e.stopPropagation(); el.style.borderColor = '#444';
                    const text = e.dataTransfer.getData('text/plain');
                    if (text) {
                        panel.context = text;
                        updateTokenCount();
                    }
                });
            }

            el.ondblclick = (e) => {
                if (isSingleMode) return;
                e.stopPropagation();
                el.classList.toggle('maximized');
                setTimeout(renderConnections, 300);
            };

            const panelHeader = document.createElement('div');
            panelHeader.className = 'cc-panel-header';
            if (isSingleMode) panelHeader.style.display = 'none';

            const titleSpan = document.createElement('span');
            titleSpan.innerText = panel.customTitle ? panel.customTitle : `Node ${String(panel.id).slice(-3)}`;
            const headerControls = document.createElement('div');
            Object.assign(headerControls.style, { display: 'flex', alignItems: 'center', gap: '8px' });
            const statusTag = document.createElement('span');
            statusTag.className = 'cc-status-tag';
            statusTag.innerText = 'Idle';
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '✕';
            closeBtn.style.cssText = "background:transparent; border:none; color:#ff5252; width:20px; cursor:pointer;";
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                state.multiPanelConfigs = state.multiPanelConfigs.filter(p => p.id !== panel.id);
                state.workflowConnections = state.workflowConnections.filter(c => c.from !== panel.id && c.to !== panel.id);
                renderAll();
            };
            headerControls.append(statusTag, closeBtn);
            panelHeader.append(titleSpan, headerControls);

            panelHeader.onmousedown = (e) => {
                if (el.classList.contains('maximized') || isSingleMode) return;
                e.preventDefault();
                isDraggingPanel = true; currentDragPanel = { obj: panel, el: el };
                const r = el.getBoundingClientRect();
                dragOffsetX = e.clientX - r.left; dragOffsetY = e.clientY - r.top;
                el.style.zIndex = 100;
                window.addEventListener('mousemove', onPanelDrag);
                window.addEventListener('mouseup', endPanelDrag);
            };

            const body = document.createElement('div');
            body.className = 'cc-panel-body';

            const controlBar = document.createElement('div');
            controlBar.style.cssText = "display:flex; gap:6px; margin-bottom:10px; align-items:center; background:rgba(0,0,0,0.2); padding:4px; border-radius:4px;";

            const configSelect = document.createElement('select');
            configSelect.className = 'cc-node-select';
            configSelect.style.cssText = "flex:1; min-width: 120px; background:#fff; color:#333; outline:none; border-radius:4px;";
            const allConfigs = state.allAiConfigs || [];
            allConfigs.forEach(cfg => {
                const opt = document.createElement('option');
                opt.value = cfg.name;
                opt.innerText = `${cfg.name}`;
                if (panel.config && panel.config.name === cfg.name) opt.selected = true;
                configSelect.appendChild(opt);
            });
            configSelect.onchange = () => {
                const sel = allConfigs.find(c => c.name === configSelect.value);
                if (sel) panel.config = sel;
            };

            const btnStyle = "width:28px; height:28px; min-width:28px; border-radius:4px; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; border:1px solid #555; background:#444; color:#fff;";

            const btnEdit = document.createElement('button');
            btnEdit.innerHTML = "✏️"; btnEdit.title = t.mm_node_edit; btnEdit.style.cssText = btnStyle;
            btnEdit.onclick = (e) => {
                e.stopPropagation();
                let upstreamText = "";
                if (panel.inputSlots) {
                    const incomingIds = state.workflowConnections
                        .filter(c => parseInt(c.to) === panel.id)
                        .map(c => parseInt(c.from));

                    upstreamText = incomingIds
                        .map(pid => {
                            const slot = panel.inputSlots[pid];
                            return slot ? `[From Node ${String(pid).slice(-3)}]:\n${slot.text.substring(0, 300)}${slot.text.length > 300 ? '...' : ''}` : null;
                        })
                        .filter(t => t)
                        .join("\n\n");
                }
                showEditorModal(t.mm_node_edit, panel.context, upstreamText, (newText) => {
                    panel.context = newText;
                    updateTokenCount();
                });
            };

            const btnEraser = document.createElement('button');
            btnEraser.innerHTML = "🧹"; btnEraser.title = t.mm_node_clear; btnEraser.style.cssText = btnStyle;
            btnEraser.onclick = (e) => {
                const t = LANG_DATA[state.lang];
                e.stopPropagation();
                showMainConfirmModal(
                    t.mm_clear_node_title || "Clear Content?",
                    t.mm_clear_node_msg || "Clear prompt and response?",
                    () => {
                        panel.context = "";
                        panel.responseText = "";
                        updateTokenCount();
                        if (outArea) outArea.innerText = "";
                    });
            };

            const btnCopy = document.createElement('button');
            btnCopy.innerHTML = "📋"; btnCopy.title = t.mm_node_copy; btnCopy.style.cssText = btnStyle;
            btnCopy.onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(panel.responseText || panel.context || "").then(() => {
                    const o = btnCopy.innerHTML; btnCopy.innerHTML = "✅"; setTimeout(() => btnCopy.innerHTML = o, 1000);
                });
            };

            const btnDrag = document.createElement('button');
            if (!isSingleMode) {
                btnDrag.innerHTML = "✋"; btnDrag.title = t.mm_node_drag;
                btnDrag.draggable = true; btnDrag.style.cssText = btnStyle; btnDrag.style.cursor = "grab";
                btnDrag.ondragstart = (e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData('text/plain', panel.responseText || panel.context || "");
                };
            }

            const btnRunNode = document.createElement('button');
            btnRunNode.innerHTML = "▶"; btnRunNode.title = t.mm_node_run;
            btnRunNode.style.cssText = "width:28px; height:28px; min-width:28px; background:#4CAF50; border:none; color:#fff; border-radius:4px; cursor:pointer; font-size:12px;";
            btnRunNode.onclick = (e) => {
                e.stopPropagation();

                attemptFeatureUsage('workflow', () => {
                    isFlowStopped = false;
                    state.runToken = (state.runToken || 0) + 1;
                    const thisToken = state.runToken;
                    panel.runCount = 0;
                    panel.isFinished = false;
                    runNodeTask(panel, thisToken, true).then(() => updateTokenCount());
                });
            };

            const tokenDisplay = document.createElement('span');
            tokenDisplay.style.cssText = "font-size:10px; color:#aaa; margin-left:auto; font-family:monospace;";

            function updateTokenCount() {
                const text = panel.responseText || panel.context || "";
                const count = Math.ceil(text.length / 3.5);
                const label = panel.responseText ? 'Res:' : 'Prm:';
                tokenDisplay.innerText = `${label}${count}T`;
            }
            updateTokenCount();

            controlBar.append(configSelect, btnEdit, btnEraser, btnCopy);
            if (!isSingleMode) controlBar.append(btnDrag);
            controlBar.append(btnRunNode, tokenDisplay);

            const outArea = document.createElement('div');
            outArea.className = 'output-area';
            outArea.innerText = panel.responseText || "";
            if (isSingleMode) {
                outArea.style.background = 'transparent'; outArea.style.border = '1px solid #444';
            }

            body.append(controlBar, outArea);

            if (!isSingleMode) {
                const inputDot = document.createElement('div');
                inputDot.className = 'cc-connector input';
                inputDot.dataset.pid = panel.id; inputDot.dataset.type = 'input';
                inputDot.onmousedown = (e) => startConnection(e, panel.id, 'input');

                const outputDot = document.createElement('div');
                outputDot.className = 'cc-connector output';
                outputDot.dataset.pid = panel.id; outputDot.dataset.type = 'output';
                outputDot.onmousedown = (e) => startConnection(e, panel.id, 'output');
                el.append(inputDot, outputDot);
            }

            el.append(panelHeader, body);
            return el;
        }

        function onPanelDrag(e) {
            if (!isDraggingPanel || !currentDragPanel) return;
            const r = canvasContainer.getBoundingClientRect();
            let nx = e.clientX - r.left - dragOffsetX;
            let ny = e.clientY - r.top - dragOffsetY;
            if (ny < 0) ny = 0;
            currentDragPanel.el.style.left = nx + 'px'; currentDragPanel.el.style.top = ny + 'px';
            currentDragPanel.obj.x = nx; currentDragPanel.obj.y = ny;
            renderConnections();
        }
        function endPanelDrag() {
            isDraggingPanel = false; currentDragPanel = null;
            window.removeEventListener('mousemove', onPanelDrag);
            window.removeEventListener('mouseup', endPanelDrag);
        }
        function startConnection(e, pid, type) {
            e.stopPropagation(); e.preventDefault();
            isConnecting = true; connectStartNode = { el: e.target, pid, type };
            tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            tempPath.setAttribute('class', 'temp-line'); svgLayer.appendChild(tempPath);
            window.addEventListener('mousemove', onConnecting);
            window.addEventListener('mouseup', endConnection);
        }
        function onConnecting(e) {
            if (!isConnecting) return;
            const p1 = getCenterPos(connectStartNode.el);
            const r = canvasContainer.getBoundingClientRect();
            const ex = e.clientX - r.left; const ey = e.clientY - r.top;
            tempPath.setAttribute('d', calculateBezier(p1.x, p1.y, ex, ey));
        }
        function endConnection(e) {
            if (!isConnecting) return;
            isConnecting = false; if (tempPath) tempPath.remove();
            const target = document.elementFromPoint(e.clientX, e.clientY);
            if (target && target.classList.contains('cc-connector')) {
                const tPid = parseInt(target.dataset.pid);
                const tType = target.dataset.type;
                if (tPid !== connectStartNode.pid && tType !== connectStartNode.type) {
                    let fid = (connectStartNode.type === 'output') ? connectStartNode.pid : tPid;
                    let tid = (connectStartNode.type === 'output') ? tPid : connectStartNode.pid;
                    if (!state.workflowConnections.some(c => c.from === fid && c.to === tid)) {
                        state.workflowConnections.push({ from: fid, to: tid, id: Date.now() });
                        renderConnections();
                    }
                }
            }
            window.removeEventListener('mousemove', onConnecting);
            window.removeEventListener('mouseup', endConnection);
        }

        function renderAll() {
            Array.from(canvasContainer.children).forEach(c => {
                if (c.id !== 'cc-connections-layer' && c !== fabBasket && c !== basketMiniWin) c.remove();
            });

            if (state.aiLayoutMode === 'single') {
                canvasContainer.appendChild(createFreestylePanel(state.singleViewConfig));

                canvasContainer.style.background = 'var(--cc-bg)';
                canvasContainer.style.backgroundImage = 'none';
                svgLayer.style.display = 'none';
                singleFooter.style.display = 'flex';
                fabBasket.style.display = 'none';
                basketMiniWin.style.display = 'none';
                header.querySelector('#loop-control-group').style.display = 'none';
                header.querySelector('#canvas-controls').style.display = 'none';
                const tmpl = header.querySelector('#toolbar-templates');
                if (tmpl) tmpl.style.display = 'none';
            } else {
                state.multiPanelConfigs.forEach(p => {
                    canvasContainer.appendChild(createFreestylePanel(p));
                });
                renderConnections();

                canvasContainer.style.background = '#141414';
                canvasContainer.style.backgroundImage = 'radial-gradient(#333 1px, transparent 1px)';
                canvasContainer.style.backgroundSize = '24px 24px';
                svgLayer.style.display = 'block';
                singleFooter.style.display = 'none';
                fabBasket.style.display = 'flex';
                header.querySelector('#loop-control-group').style.display = 'flex';
                header.querySelector('#canvas-controls').style.display = 'flex';
                const tmpl = header.querySelector('#toolbar-templates');
                if (tmpl) tmpl.style.display = 'flex';
            }

            const modalTitle = header.querySelector('#modal-title-text');
            const toggleBtn = header.querySelector('#btn-toggle-view');

            if (modalTitle) modalTitle.innerText = state.aiLayoutMode === 'single' ? t.mm_title_single : t.mm_title_multi;
            if (toggleBtn) toggleBtn.innerText = state.aiLayoutMode === 'single' ? t.mm_view_multi : t.mm_view_single;
        }

        const switchToCanvas = () => {
            state.aiLayoutMode = 'canvas';
            chrome.storage.local.set({ 'cc_last_layout_mode': 'canvas' });
            updateCardStyle();
            renderAll();
        };

        header.querySelector('#btn-close-modal').onclick = () => {
            isFlowStopped = true;
            if (typeof AI_QUEUE !== 'undefined') AI_QUEUE.queue = [];
            state.basketListeners.delete(canvasBasketListener);
            mask.remove();
            state.streamingModal = null;
            chrome.storage.local.set({ 'cc_last_layout_mode': state.aiLayoutMode });
        };

        const btnStop = header.querySelector('#btn-stop-all');
        if (btnStop) btnStop.onclick = () => {
            isFlowStopped = true;
            if (typeof AI_QUEUE !== 'undefined') AI_QUEUE.queue = [];
            btnStop.innerText = "🛑";
        };

        header.querySelector('#btn-toggle-view').onclick = () => {
            if (state.aiLayoutMode === 'single') {
                chrome.storage.local.get(['cc_has_shown_canvas_warning'], (res) => {
                    if (res.cc_has_shown_canvas_warning) {
                        switchToCanvas();
                    } else {
                        showResourceWarningModal(() => { switchToCanvas(); });
                    }
                });
            } else {
                state.aiLayoutMode = 'single';
                chrome.storage.local.set({ 'cc_last_layout_mode': 'single' });
                updateCardStyle();
                renderAll();
            }
        };

        header.querySelector('#btn-global-settings').onclick = () => {
            openRobotSettings(null, () => renderAll());
        };

        const btnAdd = header.querySelector('#btn-add-node');
        if (btnAdd) btnAdd.onclick = () => {
            state.multiPanelConfigs.push({
                id: Date.now(),
                context: "",
                config: state.aiConfig || {},
                x: 150 + Math.random() * 50, y: 150 + Math.random() * 50,
                isStreaming: false, responseText: "",
                runCount: 0
            });
            renderAll();
        };

        const btnRun = header.querySelector('#btn-run-flow');
        if (btnRun) btnRun.onclick = () => {
            const t = LANG_DATA[state.lang];
            if (detectCycle(state.multiPanelConfigs, state.workflowConnections)) {
                showToast(t.cycle_detected, document);
                return;
            }
            attemptFeatureUsage('workflow', () => {
                isFlowStopped = false;
                state.runToken = (state.runToken || 0) + 1;
                const thisToken = state.runToken;
                if (state.aiLayoutMode === 'single') {
                    state.singleViewConfig.runCount = 0;
                    state.singleViewConfig.isFinished = false;

                    if (typeof AI_QUEUE !== 'undefined') {
                        AI_QUEUE.add(() => runNodeTask(state.singleViewConfig, thisToken));
                    } else {
                        runNodeTask(state.singleViewConfig, thisToken);
                    }
                    return;
                }

                state.multiPanelConfigs.forEach(p => {
                    p.runCount = 0;
                    p.isFinished = false;
                    p.lastFinishedRunToken = -1;
                    p._inputVersion = 0;
                    p._lastQueuedKey = "";
                });

                const dests = new Set(state.workflowConnections.map(c => parseInt(c.to)));
                const roots = state.multiPanelConfigs.filter(p => !dests.has(p.id));

                if (roots.length === 0 && state.multiPanelConfigs.length > 0) {
                    if (typeof AI_QUEUE !== 'undefined') AI_QUEUE.add(() => runNodeTask(state.multiPanelConfigs[0], thisToken));
                    else runNodeTask(state.multiPanelConfigs[0], thisToken);
                } else {
                    const loopLimit = state.loopSetting || 1;

                    roots.forEach(p => {
                        const hasOutgoing = state.workflowConnections.some(c => parseInt(c.from) === p.id);

                        if (!hasOutgoing && loopLimit > 1) {
                            for (let i = 0; i < loopLimit; i++) {
                                if (typeof AI_QUEUE !== 'undefined') AI_QUEUE.add(() => runNodeTask(p, thisToken));
                                else runNodeTask(p, thisToken);
                            }
                        } else {
                            if (typeof AI_QUEUE !== 'undefined') AI_QUEUE.add(() => runNodeTask(p, thisToken));
                            else runNodeTask(p, thisToken);
                        }
                    });
                }
            });
        };

        renderAll();
        state.streamingModal = { element: mask, restore: () => mask.style.display = 'flex' };
        updateMultiNodeTexts();

        if (autoStart) {
            setTimeout(() => {
                if (state.aiLayoutMode === 'single') {
                    runNodeTask(state.singleViewConfig);
                } else if (state.multiPanelConfigs.length > 0) {
                    if (typeof AI_QUEUE !== 'undefined') AI_QUEUE.add(() => runNodeTask(state.multiPanelConfigs[0]));
                }
            }, 500);
        }
    }

    setTimeout(() => {
        try {
            injectStyles();
            loadAiConfig();
        } catch (e) {
            console.error('Error initializing AI module', e);
        }
    }, 1000);

    function ensureHtmlDoc(raw) {
        const html = (raw || "").trim();
        if (!/<html[\s>]/i.test(html)) {
            return `<!doctype html>
    <html>
    <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    </head>
    <body>
    ${html}
    </body>
    </html>`;
        }
        return html;
    }

    function sanitizeHtmlForPreview(docHtml) {
        let out = docHtml || "";

        out = out.replace(/<script\b[^>]*\bsrc\s*=\s*(['"])[\s\S]*?\1[^>]*>[\s\S]*?<\/script>/gi, "");

        out = out.replace(/<link\b[^>]*\brel\s*=\s*(['"])stylesheet\1[^>]*>/gi, (m) => {
            return /href\s*=\s*/i.test(m) ? "" : m;
        });

        out = out.replace(/<(iframe|object|embed)\b[^>]*>/gi, "");

        return out;
    }

    function showEditorModal(title, initialValue, upstreamContent, onSaveCallback) {
        if (typeof upstreamContent === 'function' && !onSaveCallback) {
            onSaveCallback = upstreamContent;
            upstreamContent = null;
        }
        const mask = document.createElement('div');
        mask.className = 'cc-modal-mask';

        const card = document.createElement('div');
        card.className = 'cc-modal-card';
        Object.assign(card.style, {
            width: '900px', maxWidth: '95vw', height: '80vh',
            display: 'flex', flexDirection: 'column'
        });

        const header = document.createElement('div');
        header.className = 'cc-modal-header';

        const titleGroup = document.createElement('div');
        titleGroup.style.display = 'flex'; titleGroup.style.gap = '10px'; titleGroup.style.alignItems = 'center';
        titleGroup.innerHTML = `<span style="font-weight:bold;">📝 ${title}</span>`;

        const btnToggleBasket = document.createElement('button');
        btnToggleBasket.innerHTML = "🧺 Basket";
        btnToggleBasket.style.cssText = "background:#333; border:1px solid #555; color:#ccc; border-radius:4px; cursor:pointer; font-size:11px; padding:2px 8px;";
        btnToggleBasket.onclick = () => {
            const basketPanel = document.getElementById('editor-basket-panel');
            if (basketPanel) {
                basketPanel.style.display = basketPanel.style.display === 'none' ? 'flex' : 'none';
            }
        };

        const btnPreview = document.createElement('button');
        btnPreview.style.cssText = "background:#333; border:1px solid #555; color:#ccc; border-radius:4px; cursor:pointer; font-size:11px; padding:2px 8px; margin-left:8px; min-width:80px;";

        let previewState = 0;

        let upstreamPreview = null;
        let textarea = null;
        let previewDiv = null;
        let htmlFrame = null;

        const updatePreviewBtn = () => {
            if (previewState === 0) {
                btnPreview.innerHTML = "👁️ View HTML";
                btnPreview.style.background = "#333";
                btnPreview.style.color = "#ccc";
            } else if (previewState === 1) {
                btnPreview.innerHTML = "📄 View Markdown";
                btnPreview.style.background = "#4CAF50";
                btnPreview.style.color = "#fff";
            } else {
                btnPreview.innerHTML = "✏️ Edit";
                btnPreview.style.background = "#2196F3";
                btnPreview.style.color = "#fff";
            }
        };
        updatePreviewBtn();

        titleGroup.appendChild(btnToggleBasket);
        titleGroup.appendChild(btnPreview);
        header.appendChild(titleGroup);

        const btnClose = document.createElement('button');
        btnClose.innerHTML = '✕';
        btnClose.style.cssText = "background:none; border:none; color:#aaa; cursor:pointer; font-size:16px;";
        btnClose.onclick = () => mask.remove();
        header.appendChild(btnClose);

        if (upstreamContent) {
            upstreamPreview = document.createElement('div');
            Object.assign(upstreamPreview.style, {
                padding: '8px 10px',
                background: 'rgba(0,0,0,0.15)',
                color: '#888',
                borderBottom: '1px solid #333',
                fontSize: '11px',
                maxHeight: '80px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                flexShrink: '0',
                position: 'relative'
            });

            const closeUpstreamBtn = document.createElement('button');
            closeUpstreamBtn.innerHTML = '✕';
            closeUpstreamBtn.title = "Remove Upstream Preview";
            Object.assign(closeUpstreamBtn.style, {
                position: 'absolute', top: '4px', right: '6px',
                background: 'transparent', border: 'none', color: '#666',
                cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', padding: '0'
            });
            closeUpstreamBtn.onmouseover = () => closeUpstreamBtn.style.color = '#ccc';
            closeUpstreamBtn.onmouseout = () => closeUpstreamBtn.style.color = '#666';

            closeUpstreamBtn.onclick = () => {
                upstreamPreview.remove();
                if (textarea) textarea.style.flex = '1';
            };

            const label = document.createElement('div');
            label.style.marginBottom = '2px';
            label.innerHTML = `<span style="color:#0088cc; font-weight:bold; font-size:10px;">🔌 Upstream Input (Preview)</span>`;

            const textDiv = document.createElement('div');
            textDiv.textContent = upstreamContent;
            textDiv.style.opacity = '0.8';

            upstreamPreview.append(closeUpstreamBtn, label, textDiv);
        }

        const contentContainer = document.createElement('div');
        contentContainer.style.cssText = "flex:1; display:flex; overflow:hidden; position:relative; flex-direction:column;";

        textarea = document.createElement('textarea');
        textarea.className = 'cc-modal-content';
        Object.assign(textarea.style, {
            background: '#252525', border: 'none', resize: 'none', color: '#fff',
            outline: 'none', flex: '1', padding: '16px', fontSize: '14px',
            lineHeight: '1.6', fontFamily: 'monospace', display: 'block'
        });
        textarea.value = initialValue || "";
        textarea.placeholder = "Enter prompt context here...";

        textarea.addEventListener('dragover', (e) => { e.preventDefault(); textarea.style.background = '#333'; });
        textarea.addEventListener('dragleave', (e) => { textarea.style.background = '#252525'; });
        textarea.addEventListener('drop', (e) => {
            e.preventDefault();
            textarea.style.background = '#252525';
            const text = e.dataTransfer.getData('text/plain');
            if (text) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const val = textarea.value;
                textarea.value = val.substring(0, start) + text + val.substring(end);
            }
        });

        previewDiv = document.createElement('div');
        previewDiv.className = 'cc-md-preview';
        Object.assign(previewDiv.style, {
            flex: '1', padding: '16px', overflowY: 'auto', display: 'none',
            background: '#1e1e1e', color: '#e0e6ed', fontFamily: 'Segoe UI, sans-serif', lineHeight: '1.6', whiteSpace: 'pre-wrap'
        });

        htmlFrame = document.createElement('iframe');
        htmlFrame.className = 'cc-html-preview';
        Object.assign(htmlFrame.style, {
            flex: '1', display: 'none', border: 'none', background: '#fff'
        });
        htmlFrame.setAttribute('sandbox', 'allow-scripts');

        btnPreview.onclick = () => {
            previewState = (previewState + 1) % 3;

            textarea.style.display = 'none';
            previewDiv.style.display = 'none';
            htmlFrame.style.display = 'none';
            if (upstreamPreview) upstreamPreview.style.display = 'none';

            if (previewState === 0) {
                htmlFrame.srcdoc = "";
                textarea.style.display = 'block';
                if (upstreamPreview && contentContainer.contains(upstreamPreview)) {
                    upstreamPreview.style.display = 'block';
                }
                requestAnimationFrame(() => textarea.focus());

            } else if (previewState === 1) {
                htmlFrame.style.display = 'block';
                const raw = textarea.value || "";
                const docHtml = sanitizeHtmlForPreview(ensureHtmlDoc(raw));
                setTimeout(() => { htmlFrame.srcdoc = docHtml; }, 0);

            } else {
                htmlFrame.srcdoc = "";
                previewDiv.style.display = 'block';
                previewDiv.innerHTML = simpleMarkdownParser(textarea.value || "");
            }
            updatePreviewBtn();
        };

        const basketPanel = document.createElement('div');
        basketPanel.id = 'editor-basket-panel';
        Object.assign(basketPanel.style, {
            width: '250px', borderLeft: '1px solid #444', background: '#1e1e1e',
            display: 'none', flexDirection: 'column', overflowY: 'auto', padding: '10px'
        });

        let selectedBasketIndices = new Set();
        let lastClickedIndex = null;

        const renderEditorBasket = () => {
            getBasket((basket) => {
                basketPanel.innerHTML = "";
                if (!basket || basket.length === 0) {
                    basketPanel.innerHTML = "<div style='color:#666; font-size:12px; text-align:center; padding:20px;'>Basket is empty</div>";
                    return;
                }
                basket.forEach((item, index) => {
                    const itemEl = document.createElement('div');
                    itemEl.draggable = true;
                    const isSelected = selectedBasketIndices.has(index);
                    itemEl.style.cssText = `background: ${isSelected ? '#3b82f6' : '#333'}; border: 1px solid ${isSelected ? '#60a5fa' : '#444'}; padding: 8px; margin-bottom: 8px; border-radius: 4px; cursor: grab; font-size: 11px; color: ${isSelected ? '#fff' : '#eee'}; user-select: none; transition: all 0.1s;`;
                    let safeSnip = escapeHTML(item.text.substring(0, 60).replace(/\n/g, ' '));
                    if (item.text.length > 60) safeSnip += '...';
                    itemEl.innerHTML = `<div style="color:${isSelected ? '#ddd' : '#aaa'}; font-size:9px; margin-bottom:4px;">${escapeHTML(item.source)}</div><div>${safeSnip}</div>`;

                    itemEl.onclick = (e) => {
                        e.stopPropagation();
                        if (e.shiftKey && lastClickedIndex !== null) {
                            const start = Math.min(lastClickedIndex, index);
                            const end = Math.max(lastClickedIndex, index);
                            selectedBasketIndices.clear();
                            for (let i = start; i <= end; i++) selectedBasketIndices.add(i);
                        } else if (e.ctrlKey || e.metaKey) {
                            if (selectedBasketIndices.has(index)) selectedBasketIndices.delete(index); else selectedBasketIndices.add(index);
                            lastClickedIndex = index;
                        } else {
                            selectedBasketIndices.clear(); selectedBasketIndices.add(index); lastClickedIndex = index;
                        }
                        renderEditorBasket();
                    };
                    itemEl.dataset.id = item.id;
                    itemEl.ondragstart = (e) => {
                        if (!selectedBasketIndices.has(index)) {
                            selectedBasketIndices.clear();
                            selectedBasketIndices.add(index);
                            renderEditorBasket();
                        }
                        const indices = Array.from(selectedBasketIndices).sort((a, b) => a - b);
                        const selectedItems = indices.map(i => basket[i]);
                        const combinedText = formatDragText(selectedItems);
                        e.dataTransfer.setData('text/plain', combinedText);
                        e.dataTransfer.setData('application/cc-editor-id', item.id);
                        e.dataTransfer.effectAllowed = 'copyMove';

                        itemEl.style.opacity = '0.5';
                    };
                    itemEl.ondragend = () => {
                        itemEl.style.opacity = '1';
                        Array.from(basketPanel.children).forEach(c => {
                            c.style.borderTop = 'none';
                            c.style.borderBottom = 'none';
                        });
                    };
                    itemEl.ondragover = (e) => {
                        if (e.dataTransfer.types.includes('application/cc-editor-id')) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            const rect = itemEl.getBoundingClientRect();
                            if (e.clientY < rect.top + rect.height / 2) {
                                itemEl.style.borderTop = '2px solid #4CAF50';
                                itemEl.style.borderBottom = 'none';
                            } else {
                                itemEl.style.borderBottom = '2px solid #4CAF50';
                                itemEl.style.borderTop = 'none';
                            }
                        }
                    };

                    itemEl.ondragleave = () => {
                        itemEl.style.borderTop = 'none';
                        itemEl.style.borderBottom = 'none';
                    };
                    itemEl.ondrop = (e) => {
                        const fromId = e.dataTransfer.getData('application/cc-editor-id');
                        if (!fromId) return;

                        e.preventDefault();
                        e.stopPropagation();

                        const toId = itemEl.dataset.id;
                        if (!toId || fromId === toId) return;

                        const order = basket.map(it => it.id).filter(Boolean);
                        const fromIndex = order.indexOf(fromId);
                        const toIndex = order.indexOf(toId);
                        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

                        const [moved] = order.splice(fromIndex, 1);
                        order.splice(toIndex, 0, moved);

                        basketOp({ kind: 'REORDER', order }, () => {
                            selectedBasketIndices.clear();
                            renderEditorBasket();
                            showToast("Reordered");
                        });
                    };
                    basketPanel.appendChild(itemEl);
                });
            });
        };

        const editorBasketListener = () => renderEditorBasket();
        state.basketListeners.add(editorBasketListener);
        renderEditorBasket();

        const wrapper = document.createElement('div');
        wrapper.style.cssText = "flex:1; display:flex; overflow:hidden;";

        if (upstreamPreview) contentContainer.appendChild(upstreamPreview);
        contentContainer.append(textarea, previewDiv, htmlFrame);

        wrapper.append(contentContainer, basketPanel);

        const footer = document.createElement('div');
        footer.className = 'cc-modal-footer';
        const btnCancel = document.createElement('button');
        btnCancel.innerText = "Cancel";
        btnCancel.style.cssText = "padding:6px 12px; background:transparent; border:1px solid #555; color:#ccc; border-radius:4px; cursor:pointer;";
        btnCancel.onclick = () => {
            state.basketListeners.delete(editorBasketListener);
            mask.remove();
        };
        const btnSave = document.createElement('button');
        btnSave.innerText = "Save";
        btnSave.style.cssText = "padding:6px 16px; background:#4CAF50; border:none; color:#fff; border-radius:4px; cursor:pointer; font-weight:bold;";
        btnSave.onclick = () => {
            const val = textarea.value;
            if (onSaveCallback) onSaveCallback(val);
            state.basketListeners.delete(editorBasketListener);
            mask.remove();
        };
        footer.append(btnCancel, btnSave);
        card.append(header, wrapper, footer);
        mask.appendChild(card);
        document.body.appendChild(mask);
        setTimeout(() => textarea.focus(), 100);
    }

    async function callAiStreaming(text, config, controller) {
        state.lastAiContext = text;
        state.lastAiConfig = config;
        let port;
        try {
            port = chrome.runtime.connect({ name: "cc-ai-stream" });
        } catch (e) {
            console.error("ContextDrone: Connection failed", e);
            controller.error("Extension context invalidated. Please refresh the page.");
            return;
        }
        const currentLang = state.lang || 'en';
        const keepAliveInterval = setInterval(() => {
            try {
                port.postMessage({ type: 'PING' });
            } catch (e) {
                clearInterval(keepAliveInterval);
            }
        }, 20000);
        port.postMessage({ text, config, lang: currentLang });
        port.onMessage.addListener((msg) => {
            if (msg.type === 'TEXT') {
                controller.append(msg.text);
            } else if (msg.type === 'DONE') {
                clearInterval(keepAliveInterval);
                controller.done();
                port.disconnect();
            } else if (msg.type === 'ERROR') {
                clearInterval(keepAliveInterval);
                controller.error(msg.error);
                port.disconnect();
            }
        });

        port.onDisconnect.addListener(() => {
            clearInterval(keepAliveInterval);
            if (chrome.runtime.lastError) {
                controller.error("Connection failed: " + chrome.runtime.lastError.message);
            }
        });
    }

    function showResourceWarningModal(onConfirmCallback, targetDoc = document) {
        const t = LANG_DATA[state.lang];
        if (targetDoc.querySelector('.cc-resource-warning-overlay')) return;

        const overlay = targetDoc.createElement('div');
        overlay.className = 'cc-resource-warning-overlay';
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            background: 'rgba(0, 0, 0, 0.9)', zIndex: '2147483660',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(5px)', opacity: '0', transition: 'opacity 0.3s'
        });

        const card = targetDoc.createElement('div');
        Object.assign(card.style, {
            width: '360px', background: '#1e1e1e', border: '1px solid #444',
            borderTop: '3px solid #ff9800', borderRadius: '8px', padding: '20px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)', color: '#fff',
            fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', gap: '15px'
        });

        const warnTitle = t.warn_resource_title || '⚠️ Resource Warning';
        const warnMsg = (t.warn_resource_msg1 || 'Activating Multi-Node View.') + '<br/>' + (t.warn_resource_msg2 || 'Multiple AI requests may consume tokens.');

        card.innerHTML = `
            <div style="font-size:16px; font-weight:bold; color:#ff9800; display:flex; align-items:center; gap:8px;">
                <span>${warnTitle}</span>
            </div>
            <div style="font-size:13px; color:#ccc; line-height:1.5; background:rgba(255, 152, 0, 0.1); padding:10px; border-radius:4px;">
                ${warnMsg}
            </div>
            <div style="font-size:11px; color:#888;">
                * This warning will not appear again.
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:5px;">
                <button id="btn-cancel-res-warn" style="background:transparent; border:1px solid #555; color:#aaa; padding:6px 12px; cursor:pointer; border-radius:4px; font-size:11px;">
                    Cancel
                </button>
                <button id="btn-confirm-res-warn" style="background:#ff9800; border:none; color:#000; padding:6px 12px; cursor:pointer; border-radius:4px; font-weight:bold; font-size:11px;">
                    I Understand
                </button>
            </div>
        `;

        overlay.appendChild(card);
        targetDoc.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.style.opacity = '1');

        card.querySelector('#btn-cancel-res-warn').onclick = () => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
                if (targetDoc !== document) targetDoc.defaultView.close();
            }, 300);
        };

        card.querySelector('#btn-confirm-res-warn').onclick = () => {
            chrome.storage.local.set({ 'cc_has_shown_canvas_warning': true });
            state.hasShownQuadWarning = true;

            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
                if (onConfirmCallback) onConfirmCallback();
            }, 300);
        };
    }

    /* =========================================
       10. Global Drop Listener for LLMs
    ========================================= */
    document.addEventListener('dragover', (e) => {
        if (!state.config) return;
        if (e.dataTransfer.types.includes('application/cc-sort')) return;

        const isInput = e.target.closest(state.config.inputSelector) ||
            e.target.isContentEditable ||
            e.target.getAttribute('role') === 'textbox';

        const isContainer = state.config.inputSelector && e.target.querySelector && e.target.querySelector(state.config.inputSelector);

        if (isInput || isContainer) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';

            const overlays = document.querySelectorAll('.cc-drop-overlay, .ds-drop-overlay, #cc-drag-shim, .fixed.inset-0');
            overlays.forEach(ol => {
                if (ol.style.display !== 'none') {
                    ol.style.display = 'none';
                    ol.style.pointerEvents = 'none';
                }
            });
        }
    }, true);

    document.addEventListener('drop', (e) => {
        if (e.dataTransfer.types.includes('application/cc-sort') ||
            e.dataTransfer.types.includes('application/cc-basket-index') ||
            e.dataTransfer.types.includes('application/cc-editor-sort')) {
            return;
        }

        if (!state.config) return;

        let inputEl = null;
        if (state.config.inputSelector) {
            inputEl = e.target.closest(state.config.inputSelector);
        }
        if (!inputEl && state.config.inputSelector) {
            if (e.target.tagName === 'DIV' || e.target.tagName === 'P' || e.target.tagName === 'MAIN') {
                const targetInput = e.target.querySelector(state.config.inputSelector);
                if (targetInput && targetInput.offsetParent !== null) {
                    inputEl = targetInput;
                }
            }
        }

        if (!inputEl) {
            if (e.target.isContentEditable ||
                e.target.contentEditable === 'true' ||
                e.target.getAttribute('role') === 'textbox') {

                inputEl = e.target;

            } else {
                setTimeout(cleanUpSiteOverlays, 200);
                return;
            }
        }

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setTimeout(cleanUpSiteOverlays, 500);
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const text = e.dataTransfer.getData('text/plain');
        if (text) {
            autoFillInput(inputEl, text);
            showToast(LANG_DATA[state.lang]?.toast_autofill || "Auto-filled by ContextDrone.");
        }

        cleanUpSiteOverlays();

    }, true);

    /* =========================================
       11. Auto-Launch Check
    ========================================= */
    if (state.config) {
        chrome.storage.local.get(['cc_disabled_domains'], (res) => {
            const domains = res.cc_disabled_domains || [];
            const host = window.location.hostname;

            if (!domains.includes(host)) {
                setTimeout(() => {
                    createTransportDrone();
                }, 500);
            }
        });
    }

    /* =========================================
       12. Dedicated PiP UI (Neural Data Pod)
    ========================================= */
    async function openDedicatedPiP() {
        if (!('documentPictureInPicture' in window)) return showToast("Browser doesn't support Document PiP");
        if (state.isPiPActive) return;

        loadAiConfig();

        const pipWindow = await documentPictureInPicture.requestWindow({
            width: 1000,
            height: 800,
        });

        state.isPiPActive = true;
        state.pipWindow = pipWindow;
        const t = LANG_DATA[state.lang];

        const style = document.createElement('style');
        style.textContent = `
            :root { 
                --bg: #0a0a0c; 
                --panel: #141416; 
                --card-bg: #1a1b1e;
                --border: #333; 
                --input-bg: #111;
                --hover-bg: rgba(255,255,255,0.1);
                --accent: #00d2ff; 
                --accent-glow: rgba(0, 210, 255, 0.2);
                --text: #e0e0e0; 
                --text-dim: #888; 
                --text-inv: #000;
                --success: #4CAF50; 
                --mech-border: #444; 
                --shadow: 0 10px 30px rgba(0,0,0,0.5);
                --tag-bg: #222;
            }

            body[data-theme="light"] {
                --bg: #f0f2f5; 
                --panel: #ffffff; 
                --card-bg: #ffffff;
                --border: #e0e0e0; 
                --input-bg: #f8fafc;
                --hover-bg: rgba(0,0,0,0.05);
                --accent: #007acc; 
                --accent-glow: rgba(0, 122, 204, 0.15);
                --text: #334155; 
                --text-dim: #64748b; 
                --text-inv: #fff;
                --success: #16a34a; 
                --mech-border: #cbd5e1; 
                --shadow: 0 4px 15px rgba(0,0,0,0.1);
                --tag-bg: #e2e8f0;
            }

            body { 
                margin: 0; background: var(--bg); color: var(--text); 
                font-family: 'Segoe UI', system-ui, sans-serif; 
                display: flex; flex-direction: column; height: 100vh; overflow: hidden; 
                user-select: none; transition: background 0.3s, color 0.3s;
            }
            
            .mech-config-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(4px);
                z-index: 2147483660; display: flex; align-items: center; justify-content: center;
                opacity: 0; animation: fadeIn 0.3s forwards;
            }
            .mech-config-card {
                width: 90%; max-width: 400px;
                background: var(--card-bg); border: 2px solid var(--mech-border);
                border-top: 4px solid var(--accent);
                box-shadow: var(--shadow);
                color: var(--text); font-family: 'Segoe UI', monospace;
                padding: 20px; box-sizing: border-box;
                transform: scale(0.9); animation: mechPopOpen 0.3s forwards;
            }
            @keyframes fadeIn { to { opacity: 1; } }
            @keyframes mechPopOpen { to { transform: scale(1); } }

            .mech-config-header {
                font-size: 16px; font-weight: bold; color: var(--accent);
                text-transform: uppercase; letter-spacing: 2px;
                border-bottom: 1px dashed var(--mech-border);
                padding-bottom: 10px; margin-bottom: 20px;
            }
            .mech-field { margin-bottom: 15px; }
            .mech-label {
                display: block; font-size: 10px; color: var(--text-dim);
                margin-bottom: 5px; letter-spacing: 1px;
            }
            .mech-input, .mech-select {
                width: 100%; background: var(--input-bg); border: 1px solid var(--mech-border); 
                color: var(--text); padding: 8px 10px; font-family: monospace; font-size: 12px;
                box-sizing: border-box; height: 36px;
            }
            .mech-input:focus, .mech-select:focus {
                border-color: var(--accent); outline: none;
            }
            .mech-btn-group { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
            .mech-action-btn {
                background: transparent; border: 1px solid var(--accent); color: var(--accent);
                padding: 8px 16px; cursor: pointer; font-family: monospace; font-weight: bold;
            }
            .mech-action-btn:hover { background: var(--accent); color: var(--text-inv); }
            .mech-cancel-btn {
                background: transparent; border: 1px solid var(--mech-border); color: var(--text-dim);
                padding: 8px 16px; cursor: pointer; font-family: monospace;
            }
            .mech-cancel-btn:hover { border-color: var(--text); color: var(--text); }

            .pip-header { 
                padding: 0; background: var(--panel); border-bottom: 1px solid var(--border); 
                display: flex; justify-content: space-between; align-items: center;
                height: 40px; -webkit-app-region: drag; 
            }
            .pip-tabs-group {
                display: flex; flex: 1; height: 100%;
            }
            .pip-tab { 
                flex: 1; display: flex; align-items: center; justify-content: center;
                padding: 0 20px; cursor: pointer; font-size: 11px; font-weight: bold; letter-spacing: 1px; 
                color: var(--text-dim); transition: 0.2s; border-bottom: 2px solid transparent; 
                max-width: 150px;
            }
            .pip-tab:hover { background: var(--hover-bg); color: var(--text); }
            .pip-tab.active { color: var(--accent); border-bottom-color: var(--accent); background: linear-gradient(to top, var(--accent-glow), transparent); }
            
            .pip-controls-group {
                display: flex; height: 100%; align-items: center; padding-right: 5px; -webkit-app-region: no-drag;
            }
            .pip-ctrl-btn {
                width: 36px; height: 100%; display: flex; align-items: center; justify-content: center;
                cursor: pointer; color: var(--text-dim); transition: 0.2s; font-size: 14px;
                background: transparent; border: none;
            }
            .pip-ctrl-btn:hover { background: var(--hover-bg); color: var(--text); }
            
            .tag-bar { 
                padding: 8px; border-bottom: 1px solid var(--border); display: flex; gap: 6px; 
                overflow-x: auto; white-space: nowrap; background: var(--input-bg); align-items: center;
                min-height: 28px;
            }
            .tag-pill { 
                font-size: 10px; padding: 3px 10px; border-radius: 12px; border: 1px solid var(--mech-border); 
                cursor: grab; color: var(--text-dim); transition: 0.2s; user-select: none; background: var(--tag-bg);
            }
            .tag-pill:hover { border-color: var(--accent); color: var(--text); }
            .tag-pill.active { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: bold; }
            .tag-add-btn {
                font-size: 14px; width: 24px; height: 24px; border-radius: 50%; border: 1px dashed var(--text-dim);
                color: var(--text-dim); display: flex; align-items: center; justify-content: center; cursor: pointer;
            }
            .tag-add-btn:hover { border-color: var(--accent); color: var(--accent); }
            .tag-input-field {
                background: var(--bg); border: 1px solid var(--accent); color: var(--text); 
                font-size: 10px; padding: 2px 6px; border-radius: 4px; outline: none; width: 80px;
            }

            .list-container { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
            .pip-item { 
                background: var(--card-bg); border: 1px solid var(--border); padding: 8px 10px; 
                border-radius: 4px; font-size: 11px; cursor: grab; 
                border-left: 3px solid var(--mech-border); transition: all 0.2s; position: relative; 
                display: flex; flex-direction: column; gap: 4px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .pip-item:hover { border-color: var(--text-dim); transform: translateY(-1px); }
            .pip-item.tag-hover { border-color: var(--accent); background: var(--accent-glow); transform: scale(1.02); }

            .pip-item-meta { display: flex; justify-content: space-between; color: var(--text-dim); font-size: 9px; }
            .pip-item-content { color: var(--text); white-space: pre-wrap; overflow: hidden; max-height: 60px; line-height: 1.4; }
            .pip-native-select {
                background: var(--input-bg);
                color: var(--text);
                border: 1px solid var(--border);
                font-size: 10px;
                height: 24px;
                border-radius: 4px;
                outline: none;
                cursor: pointer;
            }
            .pip-native-select option {
                background: var(--card-bg);
                color: var(--text);
            }
            
            .item-tags { 
                display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; 
                min-height: 16px;
                align-items: center;
            }
            .mini-tag { 
                font-size: 9px; padding: 1px 6px; background: var(--accent-glow); 
                border: 1px solid rgba(0,210,255,0.3); border-radius: 8px; color: var(--accent); 
                display: inline-block;
            }

            .btn-item-action { position: absolute; right: 5px; top: 10px; display:none; gap:4px; }
            .pip-item:hover .btn-item-action { display:flex; }
            .act-btn { background: var(--tag-bg); border: 1px solid var(--mech-border); color: var(--text-dim); cursor: pointer; border-radius: 3px; font-size: 10px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
            .act-btn:hover { background: var(--hover-bg); color: var(--text); }
            .act-btn.del:hover { background: #fee2e2; border-color: #ef4444; color: #ef4444; }
            body[data-theme="dark"] .act-btn.del:hover { background: #500; border-color: #f00; color: #fff; }

            .pip-footer { padding: 8px; border-top: 1px solid var(--border); display: flex; gap: 8px; justify-content: space-around; background: var(--panel); }
            .pip-tool-btn {
                flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
                background: var(--input-bg); border: 1px solid var(--border); color: var(--text-dim); padding: 8px;
                border-radius: 6px; cursor: pointer; font-size: 11px; transition: 0.2s;
            }
            .pip-tool-btn:hover { background: var(--hover-bg); color: var(--text); border-color: var(--mech-border); }
            .pip-tool-btn i { font-style: normal; font-size: 14px; }

            .mini-basket { 
                height: 36px; border-top: 1px solid var(--border); background: var(--panel); 
                transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; overflow: hidden; 
                position: absolute; bottom: 0; width: 100%; z-index: 100;
            }
            .mini-basket.open { height: 320px; box-shadow: 0 -5px 20px rgba(0,0,0,0.2); }
            .mb-header { padding: 0 10px; height: 36px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; background: var(--hover-bg); border-bottom: 1px solid var(--border); color: var(--text); }
            .mb-list { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 4px; background: var(--bg); }
            .mb-item { font-size: 10px; padding: 6px; background: var(--card-bg); border-radius: 3px; color: var(--text); cursor: grab; border: 1px solid transparent; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
            .mb-item:hover { border-color: var(--mech-border); background: var(--hover-bg); }

            .drop-zone-overlay { position: absolute; top:0; left:0; width:100%; height:100%; background: var(--accent-glow); border: 2px dashed var(--accent); display: flex; align-items: center; justify-content: center; flex-direction: column; color: var(--accent); font-weight: bold; pointer-events: none; opacity: 0; z-index: 100; backdrop-filter: blur(2px); transition: opacity 0.2s; }
            body.drag-active .drop-zone-overlay { opacity: 1; }
            .pip-view { flex: 1; display: none; flex-direction: column; position: relative; overflow: hidden; }
            .pip-view.active { display: flex; }
            #pip-canvas { flex: 1; position: relative; overflow: hidden; background-image: radial-gradient(var(--text-dim) 1px, transparent 1px); background-size: 20px 20px; cursor: grab; opacity: 0.8; }
            #pip-canvas:active { cursor: grabbing; }
            
            .pip-node { 
                position: absolute; width: 280px; background: var(--card-bg); 
                border: 1px solid var(--border); border-radius: 8px; 
                box-shadow: var(--shadow); display: flex; flex-direction: column; 
                transition: box-shadow 0.2s, border-color 0.2s; z-index: 10; 
                overflow: visible !important; 
            }
            .pip-node:hover { border-color: var(--text-dim); z-index: 20; }
            .pip-node.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
            .pip-node.drag-target { border-color: var(--accent) !important; background: var(--accent-glow); }
            .node-header { padding: 8px 10px; background: var(--hover-bg); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; cursor: grab; border-radius: 8px 8px 0 0; }
            .node-title { font-size: 11px; font-weight: bold; color: var(--text); }
            .node-status { font-size: 9px; padding: 2px 6px; border-radius: 4px; background: var(--input-bg); color: var(--text-dim); }
            .node-status.busy { color: #ff9800; background: rgba(255,152,0,0.1); }
            .node-status.ok { color: var(--success); background: rgba(76,175,80,0.1); }
            .node-body { padding: 10px; display: flex; flex-direction: column; gap: 8px; background: var(--card-bg); border-radius: 0 0 8px 8px; }
            .node-controls { display: flex; gap: 4px; align-items: center; }
            .node-select { flex: 1; background: var(--input-bg); color: var(--text); border: 1px solid var(--mech-border); font-size: 10px; height: 24px; border-radius: 4px; outline:none; }
            .node-icon-btn { width: 24px; height: 24px; background: var(--input-bg); border: 1px solid var(--mech-border); color: var(--text); border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; }
            .node-icon-btn:hover { border-color: var(--accent); color: var(--accent); }
            .node-icon-btn.run { background: var(--success); border-color: var(--success); color: #fff; }
            .node-output { height: 100px; background: var(--input-bg); border: 1px solid var(--mech-border); border-radius: 4px; padding: 8px; font-size: 11px; color: var(--text); overflow-y: auto; white-space: pre-wrap; font-family: monospace; resize: vertical; min-height: 60px; outline:none; }
            .connector { 
                position: absolute; width: 14px; height: 14px; 
                background: var(--border); border: 2px solid var(--text-dim); 
                border-radius: 50%; top: 12px; cursor: crosshair; 
                transition: transform 0.2s; z-index: 10;
            }
            .connector:hover { transform: scale(1.3); border-color: var(--accent); background: var(--accent); }
            .connector.conn-in { left: -9px; background: var(--bg); } 
            .connector.conn-out { right: -9px; background: var(--bg); }
            
            ::-webkit-scrollbar { width: 4px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: var(--mech-border); border-radius: 2px; }
            ::-webkit-scrollbar-thumb:hover { background: var(--text-dim); }
        `;
        pipWindow.document.head.appendChild(style);

        if (state.theme === 'light') {
            pipWindow.document.body.setAttribute('data-theme', 'light');
        } else {
            pipWindow.document.body.removeAttribute('data-theme');
        }

        const doc = pipWindow.document;

        doc.body.innerHTML = `
            <div class="drop-zone-overlay">
                <div style="font-size: 32px;">📥</div>
                <div>${t.pip_drop_title}</div>
                <div style="font-size: 10px; opacity: 0.8; margin-top:5px;">${t.pip_drop_sub}</div>
            </div>

            <div class="pip-header">
                <div class="pip-tabs-group">
                    <div id="tab-collect" class="pip-tab active">${t.pip_tab_collect}</div>
                    <div id="tab-flow" class="pip-tab">${t.pip_tab_flow}</div>
                </div>
                <div class="pip-controls-group">
                    <select id="pip-template-select" style="background:#111; color:#aaa; border:1px solid #333; font-size:10px; margin-right:10px; height:24px; border-radius:4px;">
                        <option value="">🧩 Load Template</option>
                        ${Object.entries(getWorkflowTemplates()).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}
                    </select>
                    
                    <div style="display:flex; align-items:center; gap:4px; margin-right:10px; padding:2px 6px; border-radius:4px; border:1px solid var(--border); height:24px; box-sizing:border-box;">
                        <span style="font-size:10px; color:var(--text-dim);">Loop:</span>
                        <select id="pip-loop-select" class="pip-native-select" style="border:none; height:20px; background:transparent;">
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="5">3</option>
                            <option value="10">5</option>
                        </select>
                    </div>

                    <button id="btn-pip-theme" class="pip-ctrl-btn" title="${t.pip_tooltip_theme}">🌗</button>
                    <button id="btn-pip-settings" class="pip-ctrl-btn" title="${t.pip_tooltip_settings}">⚙️</button>
                    <button id="btn-pip-max" class="pip-ctrl-btn" title="${t.pip_tooltip_max}">⬜</button>
                </div>
            </div>
            
            <div id="view-collect" class="pip-view active">
               <div id="collect-tag-bar" class="tag-bar"></div>
                <div id="pip-list" class="list-container"></div>
                <div class="pip-footer">
                    <button id="btn-pip-paste" class="pip-tool-btn" title="${t.pip_btn_paste}"><i>📋</i> ${t.pip_btn_paste}</button>
                    <button id="btn-pip-export" class="pip-tool-btn" title="${t.pip_btn_export}"><i>📤</i> ${t.pip_btn_export}</button>
                    <button id="btn-pip-clear" class="pip-tool-btn" title="${t.pip_btn_clear}" style="color:#ff5252;"><i>🗑️</i> ${t.pip_btn_clear}</button>
                </div>
            </div>
            
            <div id="view-flow" class="pip-view">
                <div id="pip-canvas">
                    <svg id="svg-layer" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; overflow:visible;">
                        <defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#888" /></marker></defs>
                    </svg>
                </div>
                
                <div style="position:absolute; top:10px; left:10px; display:flex; gap:5px; z-index:90;">
                    <button id="btn-add-node" style="width:28px; height:28px; background:var(--card-bg); border:1px solid var(--border); color:var(--text); border-radius:4px; cursor:pointer; font-weight:bold;" title="Add Node">+</button>
                    <button id="btn-run-all" style="width:28px; height:28px; background:var(--accent); border:none; color:#fff; border-radius:4px; cursor:pointer; font-weight:bold;" title="Run All">▶</button>
                    <button id="btn-stop-pip" style="width:28px; height:28px; background:#ff5252; border:none; color:#fff; border-radius:4px; cursor:pointer; font-weight:bold;" title="Stop">⏹</button>
                </div>

                <div id="mini-basket" class="mini-basket">
                    <div class="mb-header" id="mb-toggle">
                        <div class="mb-title"><span>${t.pip_basket_title}</span> (<span id="mb-count">0</span>)</div>
                        <span style="font-size:10px; opacity:0.7;">▲</span>
                    </div>
                    <div id="flow-tag-bar" class="tag-bar" style="border-bottom:none; border-top:1px solid var(--border); background:var(--panel);"></div>
                    <div id="mb-list" class="mb-list"></div>
                </div>
            </div>
        `;

        initPiPLogic(pipWindow);

        setTimeout(() => {
            checkPiPGuards(pipWindow);
        }, 300);

        pipWindow.addEventListener("pagehide", () => {
            state.isPiPActive = false;
            state.pipWindow = null;
            const panel = document.getElementById('cc-robot-panel');
            if (panel) panel.classList.remove('cc-hidden');
            const stdPanel = document.getElementById('cc-panel');
            if (stdPanel) stdPanel.classList.remove('cc-hidden');
        });

        const panel = document.getElementById('cc-robot-panel');
        if (panel) panel.classList.add('cc-hidden');
        const stdPanel = document.getElementById('cc-panel');
        if (stdPanel) stdPanel.classList.add('cc-hidden');
    }

    function checkPiPGuards(win) {
        const doc = win.document;
        chrome.storage.local.get(['cc_feature_unlock', 'cc_has_shown_canvas_warning'], (res) => {
            if (!res.cc_feature_unlock) {
                const t = LANG_DATA[state.lang];
                const combinedWarning = t.unlock_warning +
                    `<br/><br/><div style="border-top:1px dashed #555; margin-top:10px; padding-top:10px;">
                        <b style='color:#ff9800'>${t.warn_resource_title}</b><br/>
                        ${t.warn_resource_msg1}<br/>
                        ${t.warn_resource_msg2}<br/>
                        ${t.warn_resource_msg3}
                    </div>`;

                showFeatureUnlockModal(doc, combinedWarning, () => {
                    chrome.storage.local.set({ 'cc_has_shown_canvas_warning': true }, () => {
                        checkPiPGuards(win); c
                    });
                });
            } else if (!res.cc_has_shown_canvas_warning) {
                showResourceWarningModal(() => {
                }, doc);
            }
        });
    }

    function showUniversalExportModal(win, contentData, defaultFilename = 'export') {
        const doc = win.document;
        const tpack = (typeof LANG_DATA !== 'undefined' && LANG_DATA && state && state.lang && LANG_DATA[state.lang])
            ? LANG_DATA[state.lang]
            : {};
        const T = (k, fallback) => tpack[k] || fallback;

        const existing = doc.querySelector('.mech-config-overlay');
        if (existing) existing.remove();

        const overlay = doc.createElement('div');
        overlay.className = 'mech-config-overlay';
        overlay.style.opacity = '1';

        const card = doc.createElement('div');
        card.className = 'mech-config-card';
        card.style.width = '350px';

        card.innerHTML = `
            <div class="mech-config-header">
                <span>${T('pip_export_title', 'EXPORT / SAVE')}</span>
            </div>

            <div class="mech-field">
                <span class="mech-label">${T('pip_label_filename', 'FILE NAME')}</span>
                <input type="text" id="exp-name" class="mech-input"
                    value="${escapeHTML(defaultFilename)}" placeholder="Enter filename">
            </div>

            <div class="mech-field">
                <span class="mech-label">${T('pip_label_format', 'FORMAT')}</span>
                <select id="exp-format" class="mech-select">
                    <option value="txt">Text File (.txt)</option>
                    <option value="md">Markdown (.md)</option>
                    <option value="pdf_printer">PDF (local printer)</option>
                </select>
            </div>

            <div class="mech-btn-group">
                <button id="btn-cancel" class="mech-cancel-btn">${T('pip_modal_cancel', 'Cancel')}</button>
                <button id="btn-save" class="mech-action-btn">${T('pip_btn_save_export', 'Export')}</button>
            </div>
        `;

        const btnCancel = card.querySelector('#btn-cancel');
        const btnSave = card.querySelector('#btn-save');
        const inputName = card.querySelector('#exp-name');
        const selectFormat = card.querySelector('#exp-format');

        btnCancel.onclick = () => overlay.remove();

        const isBasketArray = Array.isArray(contentData);

        const generateHTMLContent = () => {
            if (isBasketArray) {
                return contentData.map(b =>
                    `<div style="margin-bottom:20px; border-bottom:1px dashed #ccc; padding-bottom:10px;">
                    <div style="font-size:10px; color:#666; margin-bottom:5px;">
                        Source: ${escapeHTML(b?.source || 'Unknown')} | ${new Date(b?.timestamp || Date.now()).toLocaleString()}
                    </div>
                    <div style="white-space: pre-wrap; font-family: sans-serif; font-size:12px; line-height:1.5;">${escapeHTML(b?.text || '')}</div>
                 </div>`
                ).join('');
            }
            return `<div style="white-space: pre-wrap; font-family: 'Segoe UI', sans-serif; font-size:12px; line-height:1.6;">${escapeHTML(contentData ?? '')}</div>`;
        };

        const generateTextContent = (format) => {
            if (isBasketArray) {
                if (format === 'md') {
                    return contentData
                        .map(b => `### Source: ${b?.source || 'Unknown'}\n*${new Date(b?.timestamp || Date.now()).toLocaleString()}*\n\n${b?.text || ''}`)
                        .join('\n\n---\n\n');
                }
                return contentData
                    .map(b => `[Source: ${b?.source || 'Unknown'} | Time: ${new Date(b?.timestamp || Date.now()).toLocaleString()}]\n${b?.text || ''}`)
                    .join('\n\n====================\n\n');
            }
            return (contentData ?? '').toString();
        };

        const downloadTextFile = (name, format) => {
            const textContent = generateTextContent(format);
            const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = doc.createElement('a');
            a.href = url;
            a.download = `${name}.${format}`;
            doc.body.appendChild(a);
            a.click();
            doc.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

        const printViaIframe = (name) => {
            const printFrame = doc.createElement('iframe');
            Object.assign(printFrame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
            doc.body.appendChild(printFrame);

            const htmlContent = generateHTMLContent();
            const docFrame = printFrame.contentWindow.document;

            docFrame.open();
            docFrame.write(`
            <html>
                <head>
                    <title>${escapeHTML(name)}</title>
                    <style>
                        @media print {
                            @page { margin: 15mm; size: A4; }
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        }
                        body { font-family: sans-serif; padding: 40px; color: #000; }
                        img { max-width: 100%; }
                    </style>
                </head>
                <body>
                    <h2 style="border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:20px;">${escapeHTML(name)}</h2>
                    ${htmlContent}
                    <div style="margin-top:50px; font-size:10px; color:#999; text-align:center;">Exported via ContextDrone</div>
                </body>
            </html>
        `);
            docFrame.close();

            setTimeout(() => {
                printFrame.contentWindow.focus();
                printFrame.contentWindow.print();
                setTimeout(() => printFrame.remove(), 1000);
            }, 500);
        };

        const pdfDirectDownload = (name) => {
            if (typeof html2pdf === 'undefined') {
                alert("Error: html2pdf library not found. Please use 'PDF (System Print)' mode.");
                return;
            }

            btnSave.disabled = true;
            const oldText = btnSave.textContent;
            btnSave.textContent = 'Generating...';

            const element = doc.createElement('div');
            element.style.cssText = "padding: 40px; font-family: sans-serif; color: #000; background: #fff; width: 800px;";
            element.innerHTML = `
            <h2 style="border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:20px;">${escapeHTML(name)}</h2>
            ${generateHTMLContent()}
            <div style="margin-top:50px; font-size:10px; color:#999; text-align:center;">Exported via ContextDrone</div>
        `;

            const opt = {
                margin: 10,
                filename: `${name}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 1, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: 'avoid-all' }
            };

            html2pdf().set(opt).from(element).save()
                .then(() => {
                    overlay.remove();
                })
                .catch(err => {
                    console.error(err);
                    alert("Generation failed. Try 'PDF (System Print)' mode.");
                    btnSave.disabled = false;
                    btnSave.textContent = oldText;
                });
        };

        btnSave.onclick = () => {
            const name = inputName.value.trim() || 'export';
            const format = selectFormat.value;

            if (format === 'pdf_printer') {
                overlay.remove();
                printViaIframe(name);
                return;
            }

            if (format === 'pdf_direct') {
                pdfDirectDownload(name);
                return;
            }

            downloadTextFile(name, format);
            overlay.remove();
        };

        overlay.appendChild(card);
        doc.body.appendChild(overlay);
        inputName.focus();
    }

    function showPiPExportModal(win) {
        getBasket((basket) => {
            showUniversalExportModal(win, basket, 'basket-export');
        });
    }

    function showPiPConfirmModal(win, title, message, onConfirm) {
        const doc = win.document;
        const t = LANG_DATA[state.lang];

        const overlay = doc.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.6)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(2px)', opacity: '0', transition: 'opacity 0.2s'
        });

        const card = doc.createElement('div');
        Object.assign(card.style, {
            width: '320px',
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderTop: '3px solid #ff5252',
            borderRadius: '8px', padding: '20px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            color: 'var(--text)',
            fontFamily: 'Segoe UI, sans-serif',
            display: 'flex', flexDirection: 'column', gap: '15px',
            transform: 'scale(0.9)', transition: 'transform 0.2s'
        });

        card.innerHTML = `
            <div style="font-size:16px; font-weight:bold; color:#ff5252; display:flex; align-items:center; gap:8px;">
                <span>⚠️ ${title}</span>
            </div>
            <div style="font-size:13px; color:var(--text); line-height:1.5; opacity:0.9;">
                ${message}
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
                <button id="btn-cancel" style="background:transparent; border:1px solid var(--border); color:var(--text-dim); padding:6px 16px; cursor:pointer; border-radius:4px; font-size:12px;">
                    ${t.pip_modal_cancel}
                </button>
                <button id="btn-confirm" style="background:#ff5252; border:none; color:#fff; padding:6px 16px; cursor:pointer; border-radius:4px; font-weight:bold; font-size:12px; box-shadow: 0 2px 5px rgba(255, 82, 82, 0.4);">
                    ${t.pip_modal_confirm}
                </button>
            </div>
        `;

        overlay.appendChild(card);
        doc.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            card.style.transform = 'scale(1)';
        });


        const close = () => {
            overlay.style.opacity = '0';
            card.style.transform = 'scale(0.9)';
            setTimeout(() => overlay.remove(), 200);
        };

        card.querySelector('#btn-cancel').onclick = close;

        card.querySelector('#btn-confirm').onclick = () => {
            close();
            if (onConfirm) onConfirm();
        };

        overlay.onclick = (e) => {
            if (e.target === overlay) close();
        };
    }

    function showMainConfirmModal(title, message, onConfirm) {
        const t = LANG_DATA[state.lang];
        const txtConfirm = t.confirm_click;
        const txtCancel = t.cancel_click;

        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.6)', zIndex: 2147483660,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(2px)', opacity: '0', transition: 'opacity 0.2s'
        });

        const card = document.createElement('div');
        Object.assign(card.style, {
            width: '320px', background: '#1e1e1e', border: '1px solid #444',
            borderTop: '3px solid #ff5252', borderRadius: '8px', padding: '20px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)', color: '#fff',
            fontFamily: 'Segoe UI, sans-serif', display: 'flex', flexDirection: 'column', gap: '15px',
            transform: 'scale(0.9)', transition: 'transform 0.2s'
        });

        card.innerHTML = `
        <div style="font-size:16px; font-weight:bold; color:#ff5252; display:flex; align-items:center; gap:8px;">
            <span>⚠️ ${title}</span>
        </div>
        <div style="font-size:13px; color:#ddd; line-height:1.5;">${message}</div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
            <button id="btn-cancel" style="background:transparent; border:1px solid #555; color:#ccc; padding:6px 16px; cursor:pointer; border-radius:4px; font-size:12px;">${txtCancel}</button>
            <button id="btn-confirm" style="background:#ff5252; border:none; color:#fff; padding:6px 16px; cursor:pointer; border-radius:4px; font-weight:bold; font-size:12px;">${txtConfirm}</button>
        </div>
    `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => { overlay.style.opacity = '1'; card.style.transform = 'scale(1)'; });

        const close = () => {
            overlay.style.opacity = '0'; card.style.transform = 'scale(0.9)';
            setTimeout(() => overlay.remove(), 200);
        };

        card.querySelector('#btn-cancel').onclick = close;
        card.querySelector('#btn-confirm').onclick = () => { close(); if (onConfirm) onConfirm(); };
        overlay.onclick = (e) => { if (e.target === overlay) close(); };
    }

    function initPiPLogic(win) {
        const doc = win.document;
        const t = LANG_DATA[state.lang];
        const canvas = doc.getElementById('pip-canvas');
        const svg = doc.getElementById('svg-layer');
        const miniBasket = doc.getElementById('mini-basket');
        const mbToggle = doc.getElementById('mb-toggle');

        win.pipLoopLimit = 1;
        win.isPiPStopped = false;

        const loopSel = doc.getElementById('pip-loop-select');
        if (loopSel) {
            loopSel.onchange = (e) => { win.pipLoopLimit = parseInt(e.target.value); };
        }

        const btnStop = doc.getElementById('btn-stop-pip');
        if (btnStop) {
            btnStop.onclick = () => {
                win.isPiPStopped = true;
                btnStop.innerText = "🛑";
                showToast("Stopping...", doc);
                setTimeout(() => {
                    win.isPiPStopped = false;
                    btnStop.innerText = "⏹";
                }, 2000);
            };
        }

        mbToggle.onclick = () => miniBasket.classList.toggle('open');

        const btnMax = doc.getElementById('btn-pip-max');
        btnMax.onclick = () => {
            const screenAvailW = win.screen.availWidth;
            const screenAvailH = win.screen.availHeight;
            const screenAvailL = win.screen.availLeft || 0;
            const screenAvailT = win.screen.availTop || 0;

            const isMaximized = (Math.abs(win.outerWidth - screenAvailW) < 50) && (Math.abs(win.outerHeight - screenAvailH) < 50);

            if (isMaximized) {
                const restoreW = 1000;
                const restoreH = 800;
                const left = screenAvailL + (screenAvailW - restoreW) / 2;
                const top = screenAvailT + (screenAvailH - restoreH) / 2;
                win.resizeTo(restoreW, restoreH);
                win.moveTo(left, top);
            } else {
                win.moveTo(screenAvailL, screenAvailT);
                setTimeout(() => {
                    win.resizeTo(screenAvailW, screenAvailH);
                }, 50);
            }
        };

        const btnTheme = doc.getElementById('btn-pip-theme');
        if (btnTheme) {
            btnTheme.onclick = () => {
                const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
                applyTheme(nextTheme);
            };
        }

        const pipTmplSelect = doc.getElementById('pip-template-select');
        if (pipTmplSelect) {
            pipTmplSelect.onchange = (e) => {
                const key = e.target.value;
                if (!key || !getWorkflowTemplates()[key]) return;

                showPiPConfirmModal(win, "Load Template?", "Current workflow will be cleared.", () => {
                    const tmpl = getWorkflowTemplates()[key];
                    state.multiPanelConfigs = [];
                    state.workflowConnections = [];

                    tmpl.nodes.forEach(n => {
                        state.multiPanelConfigs.push({
                            id: Date.now() + n.id,
                            context: n.context,
                            config: state.aiConfig || {},
                            x: n.x, y: n.y,
                            responseText: "", runCount: 0,
                            customTitle: n.title
                        });
                    });

                    if (state.multiPanelConfigs.length > 0 && tmpl.nodes.length > 0) {
                        const baseId = state.multiPanelConfigs[0].id - tmpl.nodes[0].id;
                        if (tmpl.connections) {
                            tmpl.connections.forEach(c => {
                                state.workflowConnections.push({
                                    from: baseId + c.from,
                                    to: baseId + c.to,
                                    id: Date.now() + Math.random()
                                });
                            });
                        }
                    }

                    const tabFlow = doc.getElementById('tab-flow');
                    if (tabFlow) tabFlow.click();

                    renderPiPNodes(win);
                    renderPiPConnections(win);
                    pipTmplSelect.value = "";
                });
            };
        }

        doc.body.addEventListener('dragover', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (!e.dataTransfer.types.includes('application/cc-pip-sort') &&
                !e.dataTransfer.types.includes('application/cc-pip-basket-item') &&
                !e.dataTransfer.types.includes('application/cc-pip-tag')) {
                e.dataTransfer.dropEffect = 'copy';
                doc.body.classList.add('drag-active');
            }
        });
        doc.body.addEventListener('dragleave', (e) => {
            if (e.relatedTarget === null) doc.body.classList.remove('drag-active');
        });
        doc.body.addEventListener('drop', (e) => {
            e.preventDefault(); e.stopPropagation();
            doc.body.classList.remove('drag-active');

            if (e.dataTransfer.types.includes('application/cc-pip-sort') ||
                e.dataTransfer.types.includes('application/cc-pip-basket-item') ||
                e.dataTransfer.types.includes('application/cc-pip-tag')) return;

            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                Array.from(e.dataTransfer.files).forEach(file => {
                    const reader = new FileReader();
                    reader.onload = (ev) => addToBasket(ev.target.result, file.name + " (File)", []);
                    reader.readAsText(file);
                });
            } else {
                const text = e.dataTransfer.getData('text/plain');
                if (text) addToBasket(text, "External Drop", []);
            }
        });

        const tabCollect = doc.getElementById('tab-collect');
        const tabFlow = doc.getElementById('tab-flow');
        const viewCollect = doc.getElementById('view-collect');
        const viewFlow = doc.getElementById('view-flow');
        const btnSettings = doc.getElementById('btn-pip-settings');

        tabCollect.onclick = () => {
            tabCollect.classList.add('active'); tabFlow.classList.remove('active');
            viewCollect.classList.add('active'); viewFlow.classList.remove('active');
        };
        tabFlow.onclick = () => {
            tabFlow.classList.add('active'); tabCollect.classList.remove('active');
            viewFlow.classList.add('active'); viewCollect.classList.remove('active');
            renderMiniBasket(win);
        };
        if (doc.getElementById('view-collect').classList.contains('active')) {
            doc.getElementById('pip-template-select').style.display = 'none';
        }

        btnSettings.onclick = () => {
            openRobotSettings(null, () => {
                renderPiPNodes(win);
            }, win.document);
        };

        doc.getElementById('btn-pip-paste').onclick = async () => {
            try {
                const text = await win.navigator.clipboard.readText();
                if (text && text.trim().length > 0) {
                    addToBasket(text, "Clipboard", []);
                    showToast(t.pip_toast_pasted, win.document);
                } else {
                    showToast(t.pip_toast_empty, win.document);
                }
            } catch (e) {
                showToast(t.pip_toast_perm, win.document);
            }
        };

        const btnExport = doc.getElementById('btn-pip-export');
        if (btnExport) {
            btnExport.onclick = () => {
                showPiPExportModal(win);
            };
        }

        doc.getElementById('btn-pip-clear').onclick = () => {
            showPiPConfirmModal(
                win,
                t.pip_modal_clear_title,
                t.pip_modal_clear_msg,
                () => {
                    basketOp({ kind: 'CLEAR' }, () => {
                        renderPiPList(win);
                        renderMiniBasket(win);
                        const countBadge = win.document.getElementById('mb-count');
                        if (countBadge) countBadge.innerText = '0';
                        updateBasketUI();

                        const list = win.document.getElementById('pip-list');
                        if (list) list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-dim); font-size:11px;">${t.pip_toast_cleared}</div>`;

                        showToast(t.pip_toast_cleared, win.document);
                    });
                }
            );
        };

        doc.getElementById('btn-add-node').onclick = () => {
            state.multiPanelConfigs.push({ id: Date.now(), context: "", config: state.aiConfig || {}, x: 50, y: 50, responseText: "", runCount: 0 });
            renderPiPNodes(win);
        };
        doc.getElementById('btn-run-all').onclick = () => {
            attemptFeatureUsage('workflow', () => {
                handlePiPRunAll(win);
            });
        };

        initPiPWorkflow(win);
        renderPiPList(win);
    }

    function showPiPEditor(title, initialValue, upstreamContent, onSave, win) {
        const doc = win.document;
        const overlay = doc.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex',
            flexDirection: 'column', padding: '10px', boxSizing: 'border-box'
        });

        const header = doc.createElement('div');
        header.style.cssText = "display:flex; justify-content:space-between; color:#fff; margin-bottom:10px; font-weight:bold; align-items:center;";

        const titleDiv = doc.createElement('div');
        titleDiv.style.cssText = "display:flex; gap:10px; align-items:center;";
        titleDiv.innerHTML = `<span>✏️ ${title}</span>`;

        const btnPreview = doc.createElement('button');
        btnPreview.style.cssText = "background:#333; border:1px solid #555; color:#ccc; border-radius:4px; cursor:pointer; font-size:11px; padding:2px 8px; min-width:80px;";

        let previewState = 0;

        const updatePreviewBtn = () => {
            if (previewState === 0) {
                btnPreview.innerHTML = "👁️ View HTML";
                btnPreview.style.background = "#333";
                btnPreview.style.color = "#ccc";
            } else if (previewState === 1) {
                btnPreview.innerHTML = "📄 View Markdown";
                btnPreview.style.background = "#4CAF50";
                btnPreview.style.color = "#fff";
            } else {
                btnPreview.innerHTML = "✏️ Edit";
                btnPreview.style.background = "#2196F3";
                btnPreview.style.color = "#fff";
            }
        };
        updatePreviewBtn();

        btnPreview.onclick = () => {
            const ta = overlay.querySelector('textarea');
            const pre = overlay.querySelector('.pip-md-preview');
            const hFrame = overlay.querySelector('.pip-html-preview');
            const upPreview = overlay.querySelector('.pip-upstream-preview');

            previewState = (previewState + 1) % 3;

            ta.style.display = 'none';
            pre.style.display = 'none';
            hFrame.style.display = 'none';
            if (upPreview) upPreview.style.display = 'none';

            if (previewState === 0) {
                hFrame.srcdoc = "";
                ta.style.display = 'block';
                if (upPreview) upPreview.style.display = 'block';
                requestAnimationFrame(() => ta.focus());

            } else if (previewState === 1) {
                hFrame.style.display = 'block';
                const raw = ta.value || "";
                const docHtml = sanitizeHtmlForPreview(ensureHtmlDoc(raw));

                setTimeout(() => {
                    hFrame.srcdoc = docHtml;
                }, 0);

            } else {
                hFrame.srcdoc = "";
                pre.style.display = 'block';
                pre.innerHTML = simpleMarkdownParser(ta.value || "");
            }
            updatePreviewBtn();
        };
        titleDiv.appendChild(btnPreview);
        header.appendChild(titleDiv);

        const closeBtn = doc.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = "background:none; border:none; color:#aaa; font-size:16px; cursor:pointer;";
        closeBtn.onclick = () => overlay.remove();
        header.appendChild(closeBtn);

        const contentWrapper = doc.createElement('div');
        contentWrapper.style.cssText = "flex:1; display:flex; flex-direction:column; overflow:hidden; position:relative;";

        if (upstreamContent) {
            const upstreamDiv = doc.createElement('div');
            upstreamDiv.className = 'pip-upstream-preview';
            Object.assign(upstreamDiv.style, {
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.05)',
                color: '#888',
                borderBottom: '1px solid #444',
                fontSize: '11px',
                maxHeight: '80px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                flexShrink: '0',
                position: 'relative',
                marginBottom: '5px'
            });

            const closeUpBtn = doc.createElement('button');
            closeUpBtn.innerHTML = '✕';
            closeUpBtn.title = "Hide Upstream Preview";
            Object.assign(closeUpBtn.style, {
                position: 'absolute', top: '2px', right: '4px',
                background: 'transparent', border: 'none', color: '#666',
                cursor: 'pointer', fontSize: '10px'
            });
            closeUpBtn.onclick = () => {
                upstreamDiv.remove();
            };

            const label = doc.createElement('div');
            label.style.marginBottom = '2px';
            label.innerHTML = `<span style="color:#0088cc; font-weight:bold; font-size:10px;">🔌 Upstream Input</span>`;

            const textDiv = doc.createElement('div');
            textDiv.textContent = upstreamContent;
            textDiv.style.opacity = '0.8';

            upstreamDiv.append(closeUpBtn, label, textDiv);
            contentWrapper.appendChild(upstreamDiv);
        }

        const textarea = doc.createElement('textarea');
        textarea.value = initialValue || "";
        textarea.style.cssText = "flex:1; background:#111; color:#ddd; border:1px solid #444; padding:10px; resize:none; font-family:monospace; margin-bottom:10px; outline:none;";
        textarea.placeholder = "Enter prompt context here...";

        const previewDiv = doc.createElement('div');
        previewDiv.className = 'pip-md-preview';
        previewDiv.style.cssText = "flex:1; background:#111; color:#ddd; border:1px solid #444; padding:10px; overflow-y:auto; display:none; margin-bottom:10px; font-family:Segoe UI, sans-serif; line-height:1.6;";

        const htmlFrame = doc.createElement('iframe');
        htmlFrame.className = 'pip-html-preview';
        htmlFrame.style.cssText = "flex:1; background:#fff; border:1px solid #444; display:none; margin-bottom:10px;";
        htmlFrame.setAttribute('sandbox', 'allow-scripts');

        contentWrapper.append(textarea, previewDiv, htmlFrame);

        const footer = doc.createElement('div');
        footer.style.cssText = "display:flex; justify-content:flex-end; gap:8px;";

        const saveBtn = doc.createElement('button');
        saveBtn.innerText = "Save";
        saveBtn.style.cssText = "background:#00d2ff; color:#000; border:none; padding:6px 12px; border-radius:4px; font-weight:bold; cursor:pointer;";
        saveBtn.onclick = () => {
            onSave(textarea.value);
            overlay.remove();
        };

        footer.appendChild(saveBtn);
        overlay.append(header, contentWrapper, footer);
        doc.body.appendChild(overlay);
        textarea.focus();
    }

    function addToBasket(text, source, tags = []) {
        basketOp({
            kind: 'ADD',
            item: { text: text, timestamp: Date.now(), source: source, tags: tags }
        }, () => {
            updateBasketUI();
            if (state.pipWindow) {
                renderPiPList(state.pipWindow);
                renderMiniBasket(state.pipWindow);
            }
            if (typeof updateHoverCardUI === 'function') {
                updateHoverCardUI();
            }
        });
    }

    function runPiPNode(node, win, forceSingleRun = false) {
        if (!win || win.closed) return;
        if (win.isPiPStopped) return;
        const loopMax = win.pipLoopLimit || 1;
        if (!forceSingleRun && node.runCount >= loopMax) return;

        const el = win.document.getElementById(`pip-node-${node.id}`);
        if (!el) return;

        const statusTxt = el.querySelector('.node-status');
        const outArea = el.querySelector('.node-output');

        if (!node.config || (!node.config.apiKey && !['local', 'ollama', 'lm-studio'].includes(node.config?.provider))) {
            if (state.aiConfig && state.aiConfig.configured) {
                node.config = { ...state.aiConfig };
                const uiEl = win.document.getElementById(`pip-node-${node.id}`);
                if (uiEl) {
                    const sel = uiEl.querySelector('.node-select');
                    if (sel) sel.value = state.aiConfig.name;
                }
            }
        }

        const isLocal = ['local', 'ollama', 'lm-studio', 'lm_studio'].includes(node.config?.provider);

        if (!node.config || (!node.config.apiKey && !isLocal)) {
            statusTxt.innerText = 'Config Error';
            statusTxt.className = 'node-status busy';
            statusTxt.style.color = '#f00';
            outArea.value = "[Error] No valid API Configuration found for this node.\nPlease select a valid profile in the node's dropdown.";
            return;
        }

        node.responseText = "";
        if (outArea) outArea.value = "";

        statusTxt.className = 'node-status busy';
        statusTxt.innerText = `RUNNING (${(node.runCount || 0) + 1}/${forceSingleRun ? 1 : loopMax})`;

        node.runCount = (node.runCount || 0) + 1;
        node.isFinished = false;

        let finalPrompt = node.context || "";

        const incomingIds = state.workflowConnections
            .filter(c => parseInt(c.to) === node.id)
            .map(c => parseInt(c.from));

        if (incomingIds.length > 0) {
            const inputs = incomingIds.map(pid => {
                const parent = state.multiPanelConfigs.find(p => p.id === pid);
                if (parent && parent.responseText) {
                    return `\n\n--- Input from Node #${String(pid).slice(-3)} ---\n${parent.responseText}`;
                }
                return "";
            }).join("");
            finalPrompt += inputs;
        }

        callAiStreaming(finalPrompt, node.config, {
            append: (chunk) => {
                if (win.isPiPStopped) return;
                node.responseText += chunk;
                if (win && !win.closed && outArea) {
                    outArea.value = node.responseText;
                    outArea.scrollTop = outArea.scrollHeight;
                }
            },
            done: () => {
                const currentNodeExists = state.multiPanelConfigs.find(n => n.id === node.id);
                if (!currentNodeExists) return;
                if (win.isPiPStopped) return;
                statusTxt.className = 'node-status ok';
                statusTxt.innerText = 'DONE';
                node.isFinished = true;

                const downstream = state.workflowConnections.filter(c => c.from === node.id);
                downstream.forEach(conn => {
                    const targetNode = state.multiPanelConfigs.find(n => n.id === conn.to);
                    if (targetNode) {
                        const parentIds = state.workflowConnections.filter(c => c.to === targetNode.id).map(c => c.from);
                        const allParentsDone = parentIds.every(pid => {
                            const p = state.multiPanelConfigs.find(n => n.id === pid);
                            return p && p.runCount >= targetNode.runCount + 1 && p.isFinished;
                        });

                        if (allParentsDone) {
                            runPiPNode(targetNode, win);
                        }
                    }
                });
            },
            error: (err) => {
                statusTxt.innerText = 'ERROR';
                statusTxt.style.color = '#f00';
                if (outArea) outArea.value += `\n[Error]: ${err}`;
                node.isFinished = true;
                node.hasError = true;
                failDownstream(node.id, err, true);
            }
        });
    }

    function handlePiPRunAll(win) {
        win.isPiPStopped = false;

        state.multiPanelConfigs.forEach(p => p.runCount = 0);

        const dests = new Set(state.workflowConnections.map(c => c.to));
        const roots = state.multiPanelConfigs.filter(p => !dests.has(p.id));

        if (roots.length === 0 && state.multiPanelConfigs.length > 0) {
            runPiPNode(state.multiPanelConfigs[0], win);
        } else {
            const loops = win.pipLoopLimit || 1;
            roots.forEach(node => {
                for (let i = 0; i < loops; i++) {
                    setTimeout(() => runPiPNode(node, win), i * 1000);
                }
            });
        }
    }

    let currentTagFilter = 'all';

    function renderPiPList(win) {
        const container = win.document.getElementById('pip-list');
        const tagBar = win.document.getElementById('collect-tag-bar');
        const t = LANG_DATA[state.lang];

        chrome.storage.local.get(['cc_basket', 'cc_user_tags'], (res) => {
            const basket = res.cc_basket || [];
            let userTags = res.cc_user_tags || ['Important', 'To-Do', 'Reference'];

            tagBar.innerHTML = '';
            const allPill = win.document.createElement('div');
            allPill.className = `tag-pill ${currentTagFilter === 'all' ? 'active' : ''}`;
            allPill.innerText = t.pip_tag_all;
            allPill.onclick = () => { currentTagFilter = 'all'; renderPiPList(win); };
            tagBar.appendChild(allPill);

            userTags.forEach(tag => {
                const p = win.document.createElement('div');
                p.className = `tag-pill ${currentTagFilter === tag ? 'active' : ''}`;
                p.innerText = tag;
                p.draggable = true;

                p.ondragstart = (e) => {
                    e.dataTransfer.setData('application/cc-pip-tag', tag);
                    p.style.opacity = '0.5';
                };
                p.ondragend = () => p.style.opacity = '1';
                p.onclick = () => { currentTagFilter = tag; renderPiPList(win); };
                tagBar.appendChild(p);
            });

            if (userTags.length < 8) {
                const addWrapper = win.document.createElement('div');
                addWrapper.className = 'tag-add-btn';
                addWrapper.innerText = '+';
                addWrapper.onclick = (e) => {
                    e.stopPropagation();
                    const input = win.document.createElement('input');
                    input.className = 'tag-input-field';
                    input.placeholder = 'Tag Name';
                    input.addEventListener('keydown', (ev) => {
                        if (ev.key === 'Enter') {
                            const newTag = input.value.trim();
                            if (newTag && !userTags.includes(newTag)) {
                                userTags.push(newTag);
                                chrome.storage.local.set({ 'cc_user_tags': userTags }, () => {
                                    renderPiPList(win);
                                    if (win.document.getElementById('view-flow').classList.contains('active')) {
                                        renderMiniBasket(win);
                                    }
                                });
                            } else {
                                renderPiPList(win);
                            }
                        } else if (ev.key === 'Escape') {
                            renderPiPList(win);
                        }
                    });
                    tagBar.replaceChild(input, addWrapper);
                    input.focus();
                };
                tagBar.appendChild(addWrapper);
            }

            container.innerHTML = '';
            const filteredBasket = currentTagFilter === 'all'
                ? basket
                : basket.filter(item => item.tags && item.tags.includes(currentTagFilter));

            if (filteredBasket.length === 0) {
                container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-dim); font-size:11px;">${t.pip_empty_list}</div>`;
                return;
            }

            filteredBasket.forEach((item, index) => {
                const realIndex = basket.indexOf(item);
                const el = win.document.createElement('div');
                el.className = 'pip-item';
                el.draggable = true;

                const timeStr = new Date(item.timestamp).toLocaleTimeString();
                const tagsHtml = (item.tags && item.tags.length > 0)
                    ? item.tags.map(t => `<span class="mini-tag">#${t}</span>`).join('')
                    : '';

                el.innerHTML = `
                    <div class="pip-item-meta">
                        <span>${escapeHTML(item.source)}</span><span>${timeStr}</span>
                    </div>
                    <div class="pip-item-content">${escapeHTML(item.text.substring(0, 100))}...</div>
                    <div class="item-tags" style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px; min-height:16px;">${tagsHtml}</div>
                    <div class="btn-item-action">
                        <div class="act-btn del" title="${t.pip_confirm_del_item}">✕</div>
                    </div>
                `;

                const contentDiv = el.querySelector('.pip-item-content');
                el.ondblclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();

                    showPiPEditor("Edit Item", item.text, (newText) => {
                        if (newText === item.text) return;

                        const id = item.id;
                        if (!id) return;

                        updateBasketItemText(id, newText, () => {
                            renderPiPList(win);

                            const mb = win.document.getElementById('mini-basket');
                            if (mb && mb.classList.contains('open')) {
                                renderMiniBasket(win);
                            }
                        });
                    }, win);
                };

                el.ondragstart = (e) => {
                    const dragText = formatDragText(item);
                    e.dataTransfer.setData('text/plain', dragText);
                    e.dataTransfer.setData('application/cc-pip-basket-item', dragText);
                    if (currentTagFilter === 'all') {
                        e.dataTransfer.setData('application/cc-pip-sort-id', item.id);
                    }
                    el.classList.add('dragging');
                };

                el.ondragend = () => el.classList.remove('dragging');

                el.ondragover = (e) => {
                    if (e.dataTransfer.types.includes('application/cc-pip-tag')) {
                        e.preventDefault();
                        el.classList.add('tag-hover');
                    } else if (currentTagFilter === 'all' && e.dataTransfer.types.includes('application/cc-pip-sort-id')) {
                        e.preventDefault();
                        el.style.borderTop = '2px solid #00d2ff';
                    }
                };

                el.ondragleave = () => {
                    el.classList.remove('tag-hover');
                    el.style.borderTop = '';
                };

                el.ondrop = (e) => {
                    e.preventDefault();
                    el.classList.remove('tag-hover');
                    el.style.borderTop = '';

                    if (e.dataTransfer.types.includes('application/cc-pip-tag')) {
                        const tag = e.dataTransfer.getData('application/cc-pip-tag');
                        if (!tag) return;

                        const id = item.id;
                        if (!id) return;

                        const currentTags = Array.isArray(item.tags) ? item.tags : [];
                        if (currentTags.includes(tag)) return;

                        const newTags = [...currentTags, tag];

                        updateBasketItemPatch(id, { tags: newTags }, () => {
                            renderPiPList(win);

                            const mb = win.document.getElementById('mini-basket');
                            if (mb && mb.classList.contains('open')) {
                                renderMiniBasket(win);
                            }
                        });

                        return;
                    }

                    if (currentTagFilter === 'all' && e.dataTransfer.types.includes('application/cc-pip-sort-id')) {
                        const fromId = e.dataTransfer.getData('application/cc-pip-sort-id');
                        const toId = item.id;
                        if (!fromId || !toId || fromId === toId) return;

                        const order = basket.map(it => it.id).filter(Boolean);
                        const fromIndex = order.indexOf(fromId);
                        const toIndex = order.indexOf(toId);
                        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

                        const [moved] = order.splice(fromIndex, 1);
                        order.splice(toIndex, 0, moved);

                        basketOp({ kind: 'REORDER', order }, () => renderPiPList(win));
                    }
                };

                el.querySelector('.act-btn.del').onclick = () => {
                    const id = item.id;
                    if (!id) return;
                    basketOp({ kind: 'DELETE', id }, () => {
                        renderPiPList(win); renderMiniBasket(win);
                    });
                };

                container.appendChild(el);
            });
        });
    }

    function initPiPWorkflow(win) {
        const doc = win.document;
        const canvas = doc.getElementById('pip-canvas');
        const svg = doc.getElementById('svg-layer');
        const miniBasket = doc.getElementById('mini-basket');
        const mbToggle = doc.getElementById('mb-toggle');

        mbToggle.onclick = () => miniBasket.classList.toggle('open');

        doc.getElementById('btn-add-node').onclick = () => {
            state.multiPanelConfigs.push({
                id: Date.now(),
                context: "",
                config: state.aiConfig || {},
                x: 50, y: 50,
                responseText: "",
                runCount: 0
            });
            renderPiPNodes(win);
        };

        doc.getElementById('btn-run-all').onclick = () => {
            handlePiPRunAll(win);
        };
        renderPiPNodes(win);
        renderPiPConnections(win);
    }

    function renderPiPNodes(win) {
        const canvas = win.document.getElementById('pip-canvas');
        const t = LANG_DATA[state.lang];
        Array.from(canvas.querySelectorAll('.pip-node')).forEach(n => n.remove());

        state.multiPanelConfigs.forEach(node => {
            const el = win.document.createElement('div');
            el.className = 'pip-node';
            el.style.left = (node.x || 50) + 'px';
            el.style.top = (node.y || 50) + 'px';
            el.id = `pip-node-${node.id}`;

            if ((!node.config || !node.config.name) && state.allAiConfigs.length > 0) {
                node.config = state.allAiConfigs[0];
            }

            const modelName = node.config?.name || 'No Config';
            let statusText = t.pip_node_idle;
            if (node.isFinished && node.responseText) statusText = t.pip_node_done;

            const displayTitle = escapeHTML(node.customTitle ? node.customTitle : `#${String(node.id).slice(-3)}`);

            el.innerHTML = `
                <div class="connector conn-in" data-pid="${node.id}" data-type="input"></div>
                
                <div class="node-header">
                    <span class="node-title">${displayTitle}</span>
                    <span class="node-status ${node.responseText ? 'ok' : ''}">${statusText}</span>
                </div>
                
                <div class="node-body">
                    <div class="node-controls">
                        <select class="node-select" title="Select AI Config">
                            <option>${modelName}</option>
                        </select>
                        <div class="node-icon-btn run" title="${t.pip_tooltip_run_node}">▶</div>
                        <div class="node-icon-btn edit" title="${t.pip_tooltip_edit_node}">✏️</div>
                        <div class="node-icon-btn del" title="${t.pip_tooltip_del_node}">✕</div>
                    </div>
                    <textarea class="node-output" placeholder="${t.pip_node_ph}"></textarea>
                </div>

                <div class="connector conn-out" data-pid="${node.id}" data-type="output"></div>
            `;

            const sel = el.querySelector('.node-select');
            sel.innerHTML = '';
            (state.allAiConfigs || []).forEach(cfg => {
                const opt = win.document.createElement('option');
                opt.value = cfg.name;
                opt.innerText = cfg.name;
                if (node.config && node.config.name === cfg.name) opt.selected = true;
                sel.appendChild(opt);
            });

            sel.onchange = (e) => {
                const selectedName = e.target.value;
                const foundConfig = state.allAiConfigs.find(c => c.name === selectedName);
                if (foundConfig) {
                    node.config = foundConfig;
                }
            };

            el.querySelector('.edit').onclick = (e) => {
                e.stopPropagation();

                let upstreamText = "";
                const incomingIds = state.workflowConnections
                    .filter(c => parseInt(c.to) === node.id)
                    .map(c => parseInt(c.from));

                if (incomingIds.length > 0) {
                    upstreamText = incomingIds.map(pid => {
                        const parent = state.multiPanelConfigs.find(p => p.id === pid);
                        if (parent && parent.responseText) {
                            return `[From # ${String(pid).slice(-3)}]:\n${parent.responseText.substring(0, 200)}...`;
                        }
                        return null;
                    }).filter(Boolean).join("\n\n");
                }

                showPiPEditor(`Edit Node #${node.id}`, node.context, upstreamText, (val) => {
                    node.context = val;
                    if (!node.responseText) el.querySelector('.node-output').value = val;
                }, win);
            };

            el.querySelector('.run').onclick = async (e) => {
                e.stopPropagation();

                attemptFeatureUsage('workflow', () => {

                    const currentSelection = sel.value;
                    const activeConfig = state.allAiConfigs.find(c => c.name === currentSelection);
                    if (activeConfig) node.config = activeConfig;

                    win.isPiPStopped = false;
                    node.runCount = 0;
                    node.isFinished = false;
                    node.responseText = "";

                    const outArea = el.querySelector('.node-output');
                    if (outArea) outArea.value = "";

                    const statusEl = el.querySelector('.node-status');
                    if (statusEl) {
                        statusEl.innerText = "Waiting...";
                        statusEl.className = 'node-status busy';
                    }

                    if (typeof runPiPNode === 'function') {
                        runPiPNode(node, win, true);
                    } else {
                        console.error("ContextDrone: runPiPNode function missing.");
                    }
                });
            };

            el.querySelector('.del').onclick = (e) => {
                e.stopPropagation();
                state.multiPanelConfigs = state.multiPanelConfigs.filter(n => n.id !== node.id);
                state.workflowConnections = state.workflowConnections.filter(c => c.from !== node.id && c.to !== node.id);
                renderPiPNodes(win);
                renderPiPConnections(win);
            };

            const outArea = el.querySelector('.node-output');
            outArea.oninput = (e) => {
                if (!node.responseText) node.context = e.target.value;
            };
            outArea.onmousedown = (e) => e.stopPropagation();

            const header = el.querySelector('.node-header');
            header.onmousedown = (e) => {
                e.stopPropagation();
                let startX = e.clientX;
                let startY = e.clientY;
                let origX = node.x || 50;
                let origY = node.y || 50;

                const onMove = (mv) => {
                    node.x = origX + (mv.clientX - startX);
                    node.y = origY + (mv.clientY - startY);
                    el.style.left = node.x + 'px';
                    el.style.top = node.y + 'px';
                    renderPiPConnections(win);
                };
                const onUp = () => {
                    win.removeEventListener('mousemove', onMove);
                    win.removeEventListener('mouseup', onUp);
                };
                win.addEventListener('mousemove', onMove);
                win.addEventListener('mouseup', onUp);
            };

            el.ondragover = (e) => {
                if (e.dataTransfer.types.includes('application/cc-pip-basket-item')) {
                    e.preventDefault();
                    e.stopPropagation();
                    el.classList.add('drag-target');
                }
            };
            el.ondragleave = () => el.classList.remove('drag-target');
            el.ondrop = (e) => {
                e.preventDefault();
                e.stopPropagation();
                el.classList.remove('drag-target');
                const text = e.dataTransfer.getData('application/cc-pip-basket-item');
                if (text) {
                    node.context = (node.context ? node.context + "\n\n" : "") + text;
                    if (!node.responseText) outArea.value = node.context;

                    el.style.boxShadow = "0 0 20px var(--success)";
                    setTimeout(() => el.style.boxShadow = "", 500);
                }
            };

            const connOut = el.querySelector('.conn-out');
            connOut.onmousedown = (e) => {
                e.stopPropagation(); e.preventDefault();
                startPiPConnection(win, e, node.id);
            };

            canvas.appendChild(el);
            const textArea = el.querySelector('.node-output');
            if (textArea) {
                textArea.value = node.responseText || node.context || '';
            }
        });
    }

    function renderPiPConnections(win) {
        const svg = win.document.getElementById('svg-layer');
        while (svg.lastChild && svg.lastChild.tagName === 'path') {
            svg.removeChild(svg.lastChild);
        }

        state.workflowConnections.forEach(conn => {
            const fromEl = win.document.querySelector(`#pip-node-${conn.from} .conn-out`);
            const toEl = win.document.querySelector(`#pip-node-${conn.to} .conn-in`);

            if (fromEl && toEl) {
                const canvasRect = win.document.getElementById('pip-canvas').getBoundingClientRect();
                const fRect = fromEl.getBoundingClientRect();
                const tRect = toEl.getBoundingClientRect();

                const x1 = (fRect.left - canvasRect.left) + 5;
                const y1 = (fRect.top - canvasRect.top) + 5;
                const x2 = (tRect.left - canvasRect.left) + 5;
                const y2 = (tRect.top - canvasRect.top) + 5;

                const d = `M ${x1} ${y1} C ${x1 + 50} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`;

                const path = win.document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("stroke-width", "4");
                path.style.cursor = "pointer";
                path.style.pointerEvents = "stroke";
                path.setAttribute("d", d);
                path.setAttribute("stroke", "#666");
                path.setAttribute("fill", "none");
                path.setAttribute("marker-end", "url(#arrow)");
                path.onclick = () => {
                    showPiPConfirmModal(win, "Delete Connection?", "Remove this link between nodes?", () => {
                        state.workflowConnections = state.workflowConnections.filter(c => c !== conn);
                        renderPiPConnections(win);
                    });
                };
                svg.appendChild(path);
            }
        });
    }

    function startPiPConnection(win, evt, startId) {
        const svg = win.document.getElementById('svg-layer');
        const tempPath = win.document.createElementNS("http://www.w3.org/2000/svg", "path");
        tempPath.setAttribute("stroke", "#fff");
        tempPath.setAttribute("stroke-width", "2");
        tempPath.setAttribute("stroke-dasharray", "5,5");
        tempPath.setAttribute("fill", "none");
        tempPath.style.pointerEvents = "none";
        svg.appendChild(tempPath);

        const canvasRect = win.document.getElementById('pip-canvas').getBoundingClientRect();
        const startEl = win.document.querySelector(`#pip-node-${startId} .conn-out`);
        const sRect = startEl.getBoundingClientRect();
        const x1 = (sRect.left - canvasRect.left) + 5;
        const y1 = (sRect.top - canvasRect.top) + 5;

        const onMove = (e) => {
            const x2 = e.clientX - canvasRect.left;
            const y2 = e.clientY - canvasRect.top;
            const d = `M ${x1} ${y1} C ${x1 + 50} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`;
            tempPath.setAttribute("d", d);
        };

        const onUp = (e) => {
            win.removeEventListener('mousemove', onMove);
            win.removeEventListener('mouseup', onUp);
            tempPath.remove();

            const target = win.document.elementFromPoint(e.clientX, e.clientY);
            if (target && target.classList.contains('conn-in')) {
                const endId = parseInt(target.dataset.pid);
                if (endId !== startId) {
                    state.workflowConnections.push({ from: startId, to: endId, id: Date.now() });
                    renderPiPConnections(win);
                }
            }
        };

        win.addEventListener('mousemove', onMove);
        win.addEventListener('mouseup', onUp);
    }

    let miniBasketFilter = 'all';

    function renderMiniBasket(win) {
        const list = win.document.getElementById('mb-list');
        const countBadge = win.document.getElementById('mb-count');
        const flowTagBar = win.document.getElementById('flow-tag-bar');

        getBasket((basket) => {
            if (countBadge) countBadge.innerText = basket.length;

            chrome.storage.local.get(['cc_user_tags'], (res) => {
                let userTags = res.cc_user_tags || ['Important', 'To-Do', 'Reference'];

                flowTagBar.innerHTML = '';

                const createPill = (text, val) => {
                    const p = win.document.createElement('div');
                    p.className = `tag-pill ${miniBasketFilter === val ? 'active' : ''}`;
                    p.innerText = text;
                    p.onclick = () => { miniBasketFilter = val; renderMiniBasket(win); };
                    return p;
                };

                flowTagBar.appendChild(createPill("All", 'all'));
                userTags.forEach(tag => {
                    flowTagBar.appendChild(createPill(tag, tag));
                });

                list.innerHTML = '';
                const filtered = miniBasketFilter === 'all'
                    ? basket
                    : basket.filter(item => item.tags && item.tags.includes(miniBasketFilter));

                if (filtered.length === 0) {
                    list.innerHTML = `<div style="text-align:center; color:#444; font-size:10px; padding:10px;">Empty</div>`;
                    return;
                }

                filtered.forEach((item, index) => {
                    const el = win.document.createElement('div');
                    el.className = 'mb-item';
                    el.draggable = true;

                    const tagLabel = (item.tags && item.tags.length) ? ` <span style="color:#00d2ff; font-size:9px;">#${item.tags[0]}</span>` : '';
                    el.innerHTML = `${item.text.substring(0, 30)}...${tagLabel}`;

                    el.ondragstart = (e) => {
                        const dragText = formatDragText(item);
                        e.dataTransfer.setData('application/cc-pip-basket-item', dragText);
                        e.dataTransfer.setData('text', dragText);
                        e.dataTransfer.effectAllowed = 'copy';
                    };
                    list.appendChild(el);
                });
            });
        });
    }

    /* =========================================
       Helper
    ========================================= */

    async function uploadToMyServerSecure(htmlContent, retentionType = 'short') {
        const key = await window.crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );

        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();
        const encodedData = encoder.encode(htmlContent);

        const encryptedBuffer = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            encodedData
        );

        const contentB64 = arrayBufferToBase64(encryptedBuffer);
        const ivB64 = arrayBufferToBase64(iv);


        const DOMAIN = 'https://qrcode.doglab24.org';
        const API_ENDPOINT = `${DOMAIN}/api/upload`;

        const uploadPayload = JSON.stringify({
            data: contentB64,
            iv: ivB64
        });

        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Secret-Token': 'dogegg-qrcode-generator'
            },
            body: JSON.stringify({
                content: uploadPayload,
                type: retentionType
            })
        });

        if (!response.ok) throw new Error("Upload Failed: " + response.statusText);

        const resJson = await response.json();
        const exportedKey = await window.crypto.subtle.exportKey("jwk", key);
        const keyString = btoa(JSON.stringify(exportedKey));
        const VIEWER_URL = `${DOMAIN}/viewer.html`;

        return `${VIEWER_URL}?id=${resJson.id}&type=${resJson.type}#${keyString}`;
    }

    function arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    async function handleQrCodeAction() {
        let basket = [];
        const currentBasket = await new Promise(resolve => getBasket(resolve));
        const pageSelectedText = getSelectedText(false) || "";

        if (currentBasket.length === 0 && !pageSelectedText) {
            showToast("No content to share! 📱");
            return;
        }

        attemptFeatureUsage('qrcode', async (currentStats) => {
            const WATERMARK_START_AT = 5;
            const currentUsage = currentStats.counts.qrcode || 0;
            const shouldAddWatermark = (currentStats.tier === 1 && currentUsage >= WATERMARK_START_AT);

            const css = `body { font-family: sans-serif; padding: 20px; background: #f9f9f9; color: #333; line-height: 1.6; } .card { background: #fff; border-radius: 8px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border-left: 4px solid #00d2ff; } .content { white-space: pre-wrap; word-break: break-word; font-size: 14px; }`;

            let htmlContent = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body>`;
            htmlContent += `<div style="text-align:center;margin-bottom:20px;color:#555;">ContextDrone Share<br><span style="font-size:10px;">${new Date().toLocaleString()}</span></div>`;

            if (pageSelectedText) {
                htmlContent += `<div class="card" style="border-left-color: #ff9800;"><div style="font-size:12px; color:#999;">📄 Page Selection</div><div class="content">${escapeHTML(pageSelectedText)}</div></div>`;
            }
            currentBasket.forEach(item => {
                htmlContent += `<div class="card"><div style="font-size:12px; color:#999;">SOURCE: ${escapeHTML(item.source || 'Unknown')}</div><div class="content">${escapeHTML(item.text)}</div></div>`;
            });
            htmlContent += `</body></html>`;

            const existing = document.querySelector('.cc-qr-modal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.className = 'cc-qr-modal';
            Object.assign(modal.style, {
                position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
                zIndex: '2147483660', backgroundColor: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            });

            modal.innerHTML = `
                <div class="cc-qr-card" style="background: #fff; padding: 25px; border-radius: 12px; display: flex; flex-direction: column; align-items: center;">
                    <div id="qr-status-text" style="font-weight:bold; margin-bottom:15px; color:#333;">☁️ Encrypting & Uploading...</div>
                    <div id="qrcode-container" style="background:#f5f5f5; padding:20px; border-radius:8px; min-width:200px; min-height:200px; display:flex; justify-content:center; align-items:center;"></div>
                    <button id="cc-close-qr" style="margin-top:20px; padding:8px 30px; cursor:pointer; background:#333; color: #fff; border:none; border-radius:6px;">Close</button>
                </div>
            `;
            modal.querySelector('#cc-close-qr').onclick = () => modal.remove();
            document.body.appendChild(modal);

            const container = modal.querySelector('#qrcode-container');
            const statusText = modal.querySelector('#qr-status-text');

            try {
                const retentionType = (currentStats.tier >= 2) ? 'long' : 'short';
                const secureLink = await uploadToMyServerSecure(htmlContent, retentionType);

                statusText.innerText = "📱 Scan to View";
                container.innerHTML = '';
                if (typeof qrcode === 'function') {
                    const qr = qrcode(0, 'L');
                    qr.addData(secureLink);
                    qr.make();
                    container.innerHTML = qr.createImgTag(5, 10);
                }
            } catch (err) {
                console.error(err);
                statusText.innerText = "Error";
                container.innerHTML = `<div style="color:red; font-size:12px;">Failed.<br>${err.message}</div>`;
            }
        });
    }

    /* =========================================
       Initial
    ========================================= */
    function t(key) {
        const dict = state.langData[state.lang] || state.langData['en'];
        return dict ? (dict[key] || key) : key;
    }

    injectStyles();
    initPinDropLogic();

})();