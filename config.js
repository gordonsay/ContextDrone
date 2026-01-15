(function () {
    window.CC_CONFIG = {
        PLATFORMS: [
            { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/?model=gpt-4o', icon: '🤖', limit: 100000 },
            { id: 'claude', name: 'Claude', url: 'https://claude.ai/new', icon: '🧠', limit: 200000 },
            { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app', icon: '💎', limit: 1000000 },
            { id: 'grok', name: 'Grok', url: 'https://grok.com', icon: '✖️', limit: 100000 },
            { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com', icon: '🐋', limit: 100000 },
            { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai', icon: '🔍', limit: 50000 }
        ],

        APP_CONFIG: {
            'chatgpt.com': {
                msgSelector: '[data-message-author-role="assistant"].text-message, .user-message-bubble-color',
                inputSelector: '#prompt-textarea',
                ignore: '.sr-only, button, .cb-buttons'
            },
            'gemini.google.com': {
                msgSelector: 'user-query, model-response',
                inputSelector: '.ql-editor, .text-input-field, div[role="textbox"], div[contenteditable="true"]',
                ignore: '.mat-icon, .action-button, .button-label, .botones-acciones'
            },
            'claude.ai': {
                msgSelector: '.font-user-message, .font-claude-response, div[data-testid="user-message"]',
                inputSelector: '.ProseMirror[contenteditable="true"]',
                ignore: 'button, .copy-icon, [data-testid="chat-message-actions"], .cursor-pointer, [role="button"], [aria-haspopup], .text-xs, [data-testid="model-selector-dropdown"]'
            },
            'grok': {
                msgSelector: '.message-bubble',
                inputSelector: 'div[role="textbox"], textarea, div[contenteditable="true"]',
                ignore: 'svg, span[role="button"], .action-buttons'
            },
            'chat.deepseek.com': {
                msgSelector: '.ds-message, .ds-markdown, .ds-text, div[class*="message-content"], .fbb737a4',
                inputSelector: '#chat-input, textarea, div[contenteditable="true"]',
                ignore: '.ds-icon-button, button, svg, .ds-ref'
            },
            'www.perplexity.ai': {
                msgSelector: '.prose, div[class*="answer"], .bg-offset.rounded-2xl, h1, .select-text',
                inputSelector: 'textarea, div[contenteditable="true"]',
                ignore: '.citation, .source, .related, button, svg, .exclude-from-selection, .suggestion'
            }
        },

        MODEL_PRESETS: {
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
            'deepseek': [
                'deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'
            ],
            'perplexity': [
                'sonar-small-online', 'sonar-medium-online', 'sonar-reasoning-pro'
            ],

            'ollama': [],

            'lm-studio': []
        },
        "API_ENDPOINTS": {
            "openai": "https://api.openai.com/v1/chat/completions",
            "claude": "https://api.anthropic.com/v1/messages",
            "grok": "https://api.x.ai/v1/chat/completions",
            "gemini": "https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent",
            "deepseek": "https://api.deepseek.com/chat/completions",
            "perplexity": "https://api.perplexity.ai/chat/completions",
            "ollama": "http://localhost:11434/v1/chat/completions",
            "lm-studio": "http://localhost:1234/v1/chat/completions"
        }

    };

})();