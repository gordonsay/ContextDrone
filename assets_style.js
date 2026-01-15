const CC_STYLES = `
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
                    --dsk-bg: #e0e7ff; --dsk-text: #3730a3; --dsk-border: #c7d2fe;
                    --ppl-bg: #ccfbf1; --ppl-text: #0f766e; --ppl-border: #99f6e4;
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
                    --dsk-bg: rgba(99, 102, 241, 0.15); --dsk-text: #818cf8; --dsk-border: rgba(99, 102, 241, 0.3);
                    --ppl-bg: rgba(20, 184, 166, 0.15); --ppl-text: #2dd4bf; --ppl-border: rgba(20, 184, 166, 0.3);
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
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                    margin-bottom: 12px;
                }
                #cc-panel .platform-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0px;
                    padding: 8px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                    font-weight: 600;
                    font-size: 0px;
                }
                #cc-panel .platform-btn:hover {
                    transform: translateY(-1px);
                    filter: brightness(1.05);
                }
                #cc-panel .platform-btn i {
                    font-style: normal;
                    font-size: 16px;
                }
                #cc-panel .p-chatgpt,
                #cc-panel .p-claude,
                #cc-panel .p-gemini,
                #cc-panel .p-grok,
                #cc-panel .p-deepseek,
                #cc-panel .p-perplexity {
                    background: var(--cc-btn-bg);
                    color: var(--cc-text);
                    border-color: var(--cc-border);
                }

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
                    font-size: 14px;
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
                    height: 70px;
                    min-height: 70px;
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
                .tiny-btn { font-size: 12px; color: var(--mech-text-dim); cursor: pointer; background: none; border: none; padding: 0; }
                .tiny-btn:hover { color: var(--mech-accent); text-decoration: underline; }

                .mech-basket .cc-basket-item {
                    background: rgba(0,0,0,0.3) !important;
                    border-left: 2px solid var(--mech-text-dim) !important;
                    color: var(--mech-text) !important;
                    margin-bottom: 6px;
                }

                .thruster-pack {
                    display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
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

                #cc-multi-panel-grid {
                    transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    opacity: 1;
                }
                #cc-multi-panel-grid.fade-out {
                    opacity: 0;
                }

                .cc-panel-item {
                    transition: all 0.2s ease;
                    border: 1px solid #444;
                    position: relative;
                }

                .cc-panel-item:hover {
                    border-color: #00d2ff !important;
                    box-shadow: 0 4px 12px rgba(0, 210, 255, 0.15);
                    z-index: 5;
                }

                .cc-panel-item.active {
                    border-color: #00d2ff !important;
                    box-shadow: 0 0 0 1px #00d2ff;
                    z-index: 10;
                }

                .cc-saved-indicator {
                    font-size: 11px;
                    color: #4CAF50;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    margin-right: 12px;
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .cc-saved-indicator.visible {
                    opacity: 1;
                }
                .cc-saved-indicator.saving {
                    color: #aaa;
                    opacity: 1;
                }

                .cc-stat-pill {
                    background: rgba(255,255,255,0.05);
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    color: #aaa;
                    border: 1px solid rgba(255,255,255,0.1);
                    transition: 0.2s;
                }
                .cc-stat-pill:hover {
                    background: rgba(255,255,255,0.1);
                    color: #fff;
                }

                .cc-panel-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0, 0, 0, 0.2);
                    border: 2px dashed #444;
                    border-radius: 8px;
                    height: 100%;
                    width: 100%;
                    transition: all 0.2s;
                    cursor: pointer;
                }
                .cc-panel-empty:hover {
                    border-color: #666;
                    background: rgba(0, 0, 0, 0.4);
                }
                .cc-empty-btn {
                    font-size: 24px;
                    color: #555;
                    margin-bottom: 8px;
                    transition: all 0.2s;
                }
                .cc-panel-empty:hover .cc-empty-btn {
                    color: #00d2ff;
                    transform: scale(1.2);
                }
                .cc-empty-text {
                    font-size: 11px;
                    color: #666;
                    font-weight: bold;
                    letter-spacing: 1px;
                }
                .cc-panel-empty:hover .cc-empty-text {
                    color: #aaa;
                }

                #cc-drone-fab {
                    position: fixed;
                    bottom: 40px;
                    right: 40px;
                    width: 56px;
                    height: 56px;
                    z-index: 2147483640;
                    cursor: grab;
                    opacity: 0.6;
                    transition: opacity 0.3s, transform 0.2s, filter 0.3s;
                    filter: grayscale(100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0,0,0,0.2);
                    border-radius: 50%;
                    backdrop-filter: blur(4px);
                    border: 1px solid rgba(255,255,255,0.15);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                }

                #cc-drone-fab.cc-hidden {
                    display: none !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                }

                #cc-drone-fab:hover {
                    opacity: 1;
                    filter: grayscale(0%);
                    background: rgba(0, 210, 255, 0.1);
                    box-shadow: 0 0 15px rgba(0, 210, 255, 0.3);
                    transform: scale(1.1);
                }
                #cc-drone-fab:active {
                    cursor: grabbing;
                }

                #cc-drone-fab.drag-over {
                    transform: scale(1.3);
                    box-shadow: 0 0 25px #4CAF50;
                    background: rgba(76, 175, 80, 0.2);
                    border-color: #4CAF50;
                }

                .mech-minimize-btn {
                    width: 18px; height: 18px;
                    background: #000;
                    border: 1px solid #00d2ff;
                    color: #00d2ff;
                    font-size: 10px;
                    font-weight: bold;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer;
                    border-radius: 50%;
                    margin-right: 6px;
                    transition: all 0.2s;
                }
                .mech-minimize-btn:hover {
                    background: #00d2ff; color: #000; box-shadow: 0 0 8px #00d2ff;
                }

                .drone-action-btn {
                    position: absolute;
                    width: 20px;
                    height: 20px;
                    background: #1a1b1e;
                    border: 1px solid #555;
                    color: #ccc;
                    border-radius: 50%;
                    font-size: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    opacity: 0;
                    transform: scale(0.5);
                    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    z-index: 20;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                }

                #cc-drone-badge {
                    position: absolute;
                    top: 30%; 
                    right: -5px;
                    background: #ff5252;
                    color: white;
                    font-size: 10px;
                    font-weight: bold;
                    min-width: 18px;
                    height: 18px;
                    border-radius: 9px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transform: scale(0);
                    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    box-shadow: 0 2px 5px rgba(0,0,0,0.5);
                    border: 2px solid rgba(255,255,255,0.1);
                    z-index: 25;
                    pointer-events: none;
                }

                #cc-drone-fab.has-cargo #cc-drone-badge {
                    opacity: 1;
                    transform: scale(1);
                }

                #cc-drone-fab:hover .drone-action-btn {
                    opacity: 1;
                    transform: scale(1);
                }

                .drone-btn-tl { top: -8px; left: -8px; }
                .drone-btn-tr { top: -8px; right: -8px; }
                .drone-btn-bl { bottom: -8px; left: -8px; cursor: grab; }
                .drone-btn-br { bottom: -8px; right: -8px; }

                .drone-action-btn:hover {
                    transform: scale(1.15);
                    color: white;
                    z-index: 22;
                }

                .drone-btn-tr:hover {
                    background: #ff5252;
                    border-color: #ff5252;
                }

                .drone-btn-tl:hover, 
                .drone-btn-bl:hover, 
                .drone-btn-br:hover {
                    background: #00d2ff;
                    border-color: #00d2ff;
                    color: #000;
                }

                #cc-canvas-container {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    background: radial-gradient(#333 1px, transparent 1px);
                    background-size: 24px 24px;
                    background-color: #141414;
                    overflow: hidden;
                    border-radius: 8px;
                }

                #cc-connections-layer {
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    pointer-events: none; z-index: 0;
                }

                path.connection {
                    fill: none; stroke: #ff9800; stroke-width: 3;
                    pointer-events: stroke; cursor: pointer; transition: stroke 0.1s;
                }
                path.connection:hover { stroke: #ff5252; stroke-width: 5; }

                path.temp-line {
                    fill: none; stroke: #fff; stroke-width: 2; stroke-dasharray: 5, 5; opacity: 0.6; pointer-events: none;
                }

                .cc-freestyle-panel {
                    position: absolute;
                    width: 320px;
                    height: 450px;
                    max-height: 80vh;
                    display: flex; 
                    flex-direction: column;
                    background: #1e1e1e;
                    border: 1px solid #444;
                    border-radius: 8px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    z-index: 10;
                    overflow: visible;
                    transition: transform 0.2s ease, box-shadow 0.2s;
                }

                .cc-freestyle-panel.minimized {
                    height: 40px !important;
                    overflow: hidden;
                }

                .cc-panel-body {
                    flex: 1; 
                    display: flex; 
                    flex-direction: column;
                    padding: 12px; 
                    overflow-y: auto;
                    gap: 8px;              
                }

                .output-area {
                    flex: 1;                 
                    min-height: 100px;
                    background: #111; 
                    border: 1px solid #333;
                    border-radius: 4px; 
                    padding: 10px; 
                    font-size: 13px;         
                    line-height: 1.5;
                    color: #e0e6ed; 
                    overflow-y: auto; 
                    white-space: pre-wrap;
                }

                .cc-freestyle-panel:hover {
                    transform: scale(1.02);
                    box-shadow: 0 8px 25px rgba(0,0,0,0.5);
                    z-index: 50;
                    border-color: #666;
                }

                .cc-freestyle-panel.maximized {
                    width: 96% !important;
                    height: 96% !important;
                    top: 2% !important;
                    left: 2% !important;
                    z-index: 1000 !important;
                    transform: none !important;
                    box-shadow: 0 0 50px rgba(0,0,0,0.8);
                    border-color: #00d2ff;
                }

                .cc-freestyle-panel.active { border-color: #00d2ff; }
                .cc-freestyle-panel.processing { border-color: #4CAF50; }

                .cc-panel-header {
                    padding: 8px 12px;
                    background: rgba(255,255,255,0.03);
                    border-bottom: 1px solid #333;
                    cursor: grab;
                    user-select: none;
                    display: flex; justify-content: space-between; align-items: center;
                    font-size: 11px; font-weight: bold; color: #ccc;
                    border-radius: 12px 12px 0 0;
                }
                .cc-panel-header:active { cursor: grabbing; }

                .cc-panel-body {
                    flex: 1; display: flex; flex-direction: column;
                    padding: 10px; overflow: hidden;
                }

                .output-area {
                    flex: 1; background: #000; border: 1px solid #333;
                    border-radius: 6px; padding: 8px; font-size: 12px;
                    color: #00d2ff; overflow-y: auto; white-space: pre-wrap;
                }

                .cc-connector {
                    width: 10px; height: 10px; border-radius: 50%;
                    position: absolute; top: 40px;
                    cursor: crosshair; z-index: 20;
                    border: 2px solid #fff;
                    box-shadow: 0 0 4px rgba(0,0,0,0.5);
                    transition: transform 0.2s;
                }
                .cc-connector:hover { transform: scale(1.6); }
                .cc-connector.input { left: -6px; background: #00d2ff; }
                .cc-connector.output { right: -6px; background: #4CAF50; }

                .cc-status-tag {
                    font-size: 10px; padding: 2px 6px; border-radius: 4px;
                    background: #444; color: #aaa; margin-left: 8px;
                }

                .cc-node-select {
                    background: #111;
                    color: #bbb;
                    border: 1px solid #444;
                    border-radius: 4px;
                    padding: 2px 4px;
                    font-size: 11px;
                    height: 20px;
                    outline: none;
                    margin: 0 4px;
                    max-width: 80px;
                    transition: border-color 0.2s;
                }
                .cc-node-select:hover {
                    border-color: #00d2ff;
                    color: #fff;
                }

                .cc-hover-card {
                    --cc-bg: #1e1e1e;
                    --cc-border: #444;
                    position: fixed; width: 300px;
                    background: var(--cc-bg);
                    border: 1px solid var(--cc-border);
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.6);
                    z-index: 2147483646;
                    display: flex; flex-direction: column;
                    opacity: 0; transform: translateY(10px) scale(0.95);
                    pointer-events: none;
                    transition: opacity 0.2s, transform 0.2s;
                    overflow: hidden;
                    font-family: 'Segoe UI', sans-serif;
                }
                .cc-hover-card.cc-light-mode {
                    --cc-bg: rgba(255, 255, 255, 0.98);
                    --cc-border: rgba(0,0,0,0.1);
                    color: #333;
                }
                .cc-hover-card.visible { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }

                .cc-sort-controls {
                    display: flex; flex-direction: column; gap: 1px; margin-right: 6px;
                    opacity: 0; transition: opacity 0.2s;
                }
                .cc-list-item:hover .cc-sort-controls { opacity: 1; }
                .cc-sort-btn {
                    width: 14px; height: 10px; font-size: 8px; line-height: 8px;
                    background: rgba(255,255,255,0.1); color: #aaa; border:none; border-radius: 2px;
                    cursor: pointer; display: flex; align-items: center; justify-content: center;
                }
                .cc-sort-btn:hover { background: #00d2ff; color: #000; }

                .cc-list-item { 
                    padding: 8px; margin: 2px 4px; border-radius: 6px; 
                    font-size: 13px; color:#e0e0e0; cursor:pointer; 
                    display:flex; align-items:center; 
                    border: 1px solid transparent;
                }
                .cc-hover-card.cc-light-mode .cc-list-item { color: #333; }
                .cc-list-item:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
                .cc-list-item.selected { background: rgba(0, 210, 255, 0.15); border-color: rgba(0, 210, 255, 0.3); }

                .cc-card-footer { padding: 8px; background: rgba(0,0,0,0.15); display:flex; gap:6px; border-top: 1px solid var(--cc-border); }
                .cc-btn-xs { 
                    flex:1; border:none; padding:8px; border-radius:4px; font-size:12px; 
                    cursor:pointer; background:rgba(255,255,255,0.08); color:#ccc; 
                    display: flex; align-items: center; justify-content: center; gap: 4px;
                }
                .cc-btn-xs:hover { background:rgba(255,255,255,0.2); color:#fff; }
                .cc-btn-primary-xs { background: #00d2ff !important; color: #000 !important; font-weight:bold; flex:2; }
                .cc-btn-primary-xs:hover { filter: brightness(1.1); }

                .cc-card-header {
                    padding: 12px 16px;
                    background: rgba(255, 255, 255, 0.05);
                    border-bottom: 1px solid var(--cc-border);
                    display: flex; justify-content: space-between; align-items: center;
                    font-size: 13px; font-weight: 700; color: #fff;
                }
                    
                .cc-hover-card.cc-light-mode .cc-card-header{
                    background: rgba(0,0,0,0.04);
                    color: #111;
                }
                
                .cc-select-all {
                    font-size: 11px; color: #00d2ff; cursor: pointer;
                    padding: 2px 6px; border-radius: 4px;
                    transition: all 0.2s;
                }
                .cc-select-all:hover { background: rgba(0, 210, 255, 0.1); }

                .cc-list-container {
                    max-height: 250px; overflow-y: auto; padding: 4px;
                    background: rgba(0,0,0,0.2);
                }

                .cc-list-item { 
                    padding: 8px 10px; margin: 2px; border-radius: 6px; 
                    font-size: 12px; color:#ccc; cursor:pointer; 
                    display:flex; align-items:center; gap: 8px;
                    border: 1px solid transparent; transition: all 0.1s;
                }
                .cc-list-item:hover { background: rgba(255,255,255,0.08); color: #fff; }
                .cc-list-item.selected { 
                    background: rgba(0, 210, 255, 0.15); 
                    border-color: rgba(0, 210, 255, 0.3); 
                    color: #fff;
                }
                
                .cc-check-circle {
                    width: 14px; height: 14px; border-radius: 50%;
                    border: 1px solid #666; flex-shrink: 0;
                    display: flex; align-items: center; justify-content: center;
                }
                .cc-list-item.selected .cc-check-circle {
                    background: #00d2ff; border-color: #00d2ff;
                }
                .cc-list-item.selected .cc-check-circle::after {
                    content: '✓'; font-size: 10px; color: #000; font-weight: bold;
                }

                .cc-card-footer { 
                    padding: 10px; background: #252525; 
                    display:flex; gap:8px; border-top: 1px solid var(--cc-border); 
                }
                .cc-btn-xs { 
                    flex:1; border: 1px solid #555; padding: 6px 10px; border-radius: 6px; 
                    font-size: 12px; cursor: pointer; background: #333; color: #eee; 
                    display: flex; align-items: center; justify-content: center; gap: 6px;
                    transition: all 0.2s;
                }
                .cc-btn-xs:hover { background: #444; border-color: #777; color: #fff; }
                
                .cc-btn-primary-xs { 
                    background: #00d2ff !important; color: #000 !important; 
                    border: none !important; font-weight: bold; flex: 2; 
                }
                .cc-btn-primary-xs:hover { filter: brightness(1.1); box-shadow: 0 0 8px rgba(0,210,255,0.4); }

                #cc-expand-btn {
                    font-size: 16px; font-weight: bold; padding: 0 12px;
                }

                .cc-view-switcher {
                    display: flex; background: var(--cc-btn-bg);
                    border: 1px solid var(--cc-border); border-radius: 20px;
                    padding: 2px; margin-bottom: 8px; width: fit-content;
                }
                .cc-view-btn {
                    padding: 4px 12px; border-radius: 16px; font-size: 11px;
                    cursor: pointer; transition: all 0.2s; color: var(--cc-text-sub);
                    border: 1px solid transparent; font-weight: 600;
                }
                .cc-view-btn.active {
                    background: var(--cc-bg); color: var(--cc-text);
                    box-shadow: 0 2px 5px rgba(0,0,0,0.05); border-color: var(--cc-border);
                }

                .cc-folder-nav {
                    display: flex; gap: 4px; overflow-x: auto; padding-bottom: 4px;
                    margin-bottom: 8px; border-bottom: 1px solid var(--cc-border);
                    align-items: center;
                }
                .cc-folder-tab {
                    padding: 4px 8px; border-radius: 6px; font-size: 10px;
                    cursor: pointer; white-space: nowrap; border: 1px solid transparent;
                    opacity: 0.7; transition: 0.2s; display: flex; align-items: center; gap: 4px;
                }
                .cc-folder-tab:hover { opacity: 1; background: rgba(255,255,255,0.05); }
                .cc-folder-tab.active {
                    opacity: 1; background: var(--cc-btn-bg); border-color: var(--cc-border);
                    font-weight: bold; transform: translateY(-1px);
                }
                .cc-add-folder-btn {
                    padding: 2px 6px; border-radius: 4px; cursor: pointer;
                    font-size: 12px; color: var(--cc-primary); border: 1px dashed var(--cc-border);
                }
                .cc-add-folder-btn:hover { background: var(--cc-btn-bg); }

                .cc-link-item {
                    border-left: 3px solid #00d2ff !important;
                    background: rgba(0, 210, 255, 0.05) !important;
                }
                .cc-link-title { font-weight: bold; color: var(--cc-text); font-size: 11px; margin-bottom: 2px; }
                .cc-link-meta { font-size: 9px; color: var(--cc-text-sub); display: flex; justify-content: space-between; }
                
                .mech-container .cc-view-switcher { background: #000; border-color: #333; }
                .mech-container .cc-view-btn.active { background: #222; color: #00d2ff; border-color: #00d2ff; }

                #cc-view-switcher-row{
                    display:flex;
                    justify-content:center;
                    align-items:center;
                    margin: 6px 0 8px 0;
                }
            `;

const LANG_MENU_CSS = `
    .cc-lang-menu {
        position: fixed;
        background: #1e1e1e;
        border: 1px solid #444;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        z-index: 2147483647;
        padding: 5px;
        min-width: 130px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-family: sans-serif;
        animation: cc-fade-in 0.1s ease-out;
    }
    .cc-lang-item {
        padding: 8px 12px;
        cursor: pointer;
        color: #ddd;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        border-radius: 4px;
        transition: background 0.2s;
        text-align: left;
    }
    .cc-lang-item:hover {
        background: #333;
        color: #fff;
    }
    .cc-lang-item.active {
        background: #00d2ff; /* 你的主題色 */
        color: #000;
        font-weight: bold;
    }
    .cc-lang-flag {
        font-size: 18px;
    }
    @keyframes cc-fade-in {
        from { opacity: 0; transform: translateY(-5px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;