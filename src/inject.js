/**
 * Fetch interceptor for ChatGPT
 * Injects Letta memory context into outgoing messages at the network level
 * Runs in page's main execution context (not content script)
 */

(function() {
  'use strict';

  // Store for Letta context (populated by content script via custom events)
  let lettaContext = null;

  // Listen for context updates from content script
  window.addEventListener('letta-context-update', (e) => {
    lettaContext = e.detail;
    console.log('[Letta Inject] Context updated:', lettaContext ? 'ready' : 'cleared');
  });

  // Store original fetch
  const originalFetch = window.fetch;

  // Override fetch
  window.fetch = async function(...args) {
    let [resource, options] = args;

    // Check if this is a ChatGPT conversation API call
    if (shouldIntercept(resource, options)) {
      try {
        const modified = await modifyRequest(resource, options);
        resource = modified.resource;
        options = modified.options;
      } catch (e) {
        console.error('[Letta Inject] Failed to modify request:', e);
      }
    }

    return originalFetch.apply(this, [resource, options]);
  };

  function shouldIntercept(resource, options) {
    if (!options || options.method !== 'POST') return false;
    if (!lettaContext) return false;

    const url = typeof resource === 'string' ? resource : resource.url;
    
    // ChatGPT's conversation endpoint
    return url.includes('/backend-api/conversation') || 
           url.includes('chat.openai.com/backend-api') ||
           url.includes('chatgpt.com/backend-api');
  }

  async function modifyRequest(resource, options) {
    if (!options.body) return { resource, options };

    try {
      const body = JSON.parse(options.body);

      // ChatGPT sends messages in a specific format
      if (body.messages && Array.isArray(body.messages)) {
        const lastMessage = body.messages[body.messages.length - 1];
        
        if (lastMessage && lastMessage.content && lastMessage.content.parts) {
          // ChatGPT format: content.parts is an array of strings
          const originalText = lastMessage.content.parts[0];
          
          // Skip if already has context or is empty
          if (!originalText || originalText.includes('[Letta Context]')) {
            return { resource, options };
          }

          // Build context string
          const contextStr = buildContextString();
          
          // Prepend context to the message
          lastMessage.content.parts[0] = `${contextStr}\n\n${originalText}`;
          
          console.log('[Letta Inject] Injected context into message');
          
          // Dispatch event to notify content script
          window.dispatchEvent(new CustomEvent('letta-message-sent', {
            detail: { originalText, withContext: true }
          }));
        }
      }

      options.body = JSON.stringify(body);
    } catch (e) {
      console.error('[Letta Inject] Error parsing request body:', e);
    }

    return { resource, options };
  }

  function buildContextString() {
    if (!lettaContext || !Array.isArray(lettaContext.blocks)) return '';

    let contextParts = ['[Letta Context]'];
    
    for (const block of lettaContext.blocks) {
      if (block && block.value && block.value.trim()) {
        contextParts.push(`[${block.label}]\n${block.value}`);
      }
    }

    return contextParts.join('\n\n');
  }

  console.log('[Letta Inject] Fetch interceptor installed');
})();
