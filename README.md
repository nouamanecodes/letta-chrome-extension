# Letta Memory - Chrome Extension

**Give every AI you use a perfect memory.**

Letta Memory captures your conversations across ChatGPT, Claude, Perplexity, and Gemini—building a unified memory that follows you everywhere. No more repeating yourself. No more lost context. Every AI just _gets_ you.

---

## Why Letta Memory?

Ever notice how you have to re-explain your job, preferences, and past decisions every time you start a new chat? Letta Memory fixes that.

- **Remember Everything**: Your preferences, projects, and conversation history—automatically saved
- **Works Everywhere**: One memory across ChatGPT, Claude, Gemini, and Perplexity
- **One-Click Context**: Inject your memory into any conversation instantly
- **Privacy First**: Your data stays in _your_ Letta account. We never train on it.

---

## Quick Start

### 1. Install the Extension

- **Chrome Web Store**: [Coming Soon](#)
- **Manual Install**: See [Installation from Source](#installation-from-source) below

### 2. Get Your API Key

1. Go to [app.letta.com](https://app.letta.com) and sign up (free)
2. Navigate to **API Keys** in settings
3. Create a new key and copy it

### 3. Set Up the Extension

1. Click the Letta icon in your browser toolbar
2. Paste your API key and click **Test**
3. Click **Create Agent** to set up your memory agent
4. Done! Visit ChatGPT, Claude, or any supported site

### 4. Start Using It

1. Go to [chatgpt.com](https://chatgpt.com) (or Claude, Gemini, Perplexity)
2. Look for the **Letta button** near the chat input
3. Click it to add your memory context to the conversation
4. Chat normally—your messages are automatically captured

---

## How It Works

### Memory Injection

Click the Letta button before sending a message. Your memory context gets added to the input, giving the AI everything it needs to know about you:

```
=== RELEVANT MEMORIES FROM LETTA ===

[user_context]
# User Profile
- Software engineer working on React projects
- Prefers concise, code-focused answers
- Currently building a Chrome extension

[active_topics]
# Active Topics
- Letta Chrome Extension development
- TypeScript best practices

[facts]
# Key Facts
- Uses VSCode with Vim keybindings
- Team uses GitHub for version control

=== END MEMORIES ===

<your message here>
```

### Automatic Learning

Every conversation is captured and processed in the background. Letta extracts:

- **Who you are**: Job, expertise, preferences
- **What you're working on**: Active projects and interests
- **Important details**: Names, dates, decisions, specific facts
- **How you like responses**: Format, length, tone

---

## Supported Platforms

| Platform   | Status       | Works On                     |
| ---------- | ------------ | ---------------------------- |
| ChatGPT    | ✅ Supported | chatgpt.com, chat.openai.com |
| Claude     | ✅ Supported | claude.ai                    |
| Gemini     | ✅ Supported | gemini.google.com            |
| Perplexity | ✅ Supported | perplexity.ai                |

---

## Settings

Click the extension icon to access settings:

### Platforms

Enable/disable memory capture for each platform. Useful if you only want Letta on certain sites.

### Memory Blocks

Choose which memory types to inject:

- **user_context** – Your background, preferences, and goals
- **active_topics** – Current projects and interests
- **facts** – Specific details worth remembering
- **conversation_patterns** – How you prefer AI responses

---

## Privacy & Security

Your privacy matters:

- **Your data, your account**: Everything is stored in your personal Letta account
- **No training**: We never use your conversations to train models
- **Delete anytime**: Remove all your data from [app.letta.com](https://app.letta.com)
- **Open source**: This extension's code is fully auditable

Read our full [Privacy Policy](https://letta.com/privacy).

---

## Troubleshooting

### Letta button not showing?

1. Refresh the page
2. Make sure the extension is enabled (check `chrome://extensions`)
3. Try disabling other extensions that modify chat interfaces

### Messages not syncing?

1. Check your API key is valid (test it in settings)
2. Make sure an agent is selected
3. Check browser console (F12) for errors

### Memory not injecting?

1. Click the Letta button—memory appears in the input box
2. If empty, click refresh in settings to reload your memory blocks
3. Make sure you have enabled blocks in settings

### Connection errors?

1. Verify your API key at [app.letta.com/api-keys](https://app.letta.com/api-keys)
2. Check your internet connection
3. Try creating a new agent

---

## Installation from Source

For developers or if the Chrome Web Store version isn't available:

```bash
# Clone the repository
git clone https://github.com/Vedant020000/letta-chrome-extension.git
cd letta-chrome-extension

# Install dependencies
npm install

# Build the extension
npm run build

# Load in Chrome:
# 1. Go to chrome://extensions
# 2. Enable "Developer mode" (top right)
# 3. Click "Load unpacked"
# 4. Select the `dist` folder
```

---

## FAQ

**Q: Is Letta Memory free?**  
A: Yes! The extension and Letta accounts are free to use.

**Q: Does this work with the ChatGPT app?**  
A: Currently only browser versions are supported. Mobile app support is planned.

**Q: Can I use different memories for different platforms?**  
A: Currently one memory agent is shared across all platforms. Multi-agent support coming soon.

**Q: How do I delete my data?**  
A: Log into [app.letta.com](https://app.letta.com), go to your agent, and delete it. All associated memories are removed.

**Q: Is my data encrypted?**  
A: Yes, all data is encrypted in transit (HTTPS) and at rest in Letta's infrastructure.

---

## Get Help

- **Discord**: [discord.gg/letta](https://discord.gg/letta) – fastest way to get help
- **Documentation**: [docs.letta.com](https://docs.letta.com)
- **Issues**: [GitHub Issues](https://github.com/Vedant020000/letta-chrome-extension/issues)

---

## License

Apache License 2.0 – see [LICENSE](LICENSE) for details.

---

\*\*Built with ❤️ by Vedant
