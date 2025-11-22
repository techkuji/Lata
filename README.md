
# <img width="40" height="40" alt="image" src="https://github.com/user-attachments/assets/0455bf32-8b95-4273-b2c2-52496808ad82" /> Lata 


**Lata** is a VS Code extension to auto complete our code using **cloud LLMs**, **local models**, or **self-hosted endpoints**.  
It is built for **Pravary** and **flexibility**.

![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

---

## 🚀 Features

- 🔥 **Multiple AI Providers**
  - OpenAI 
  - Anthropic Claude
  - Google Gemini
  - Local LLMs via Ollama
  - Self-hosted / custom OpenAI-compatible endpoints

- 🧠 **Smart Code Parsing Modes**
  - `pruned` – Fastest, minimal context
  - `intelligent` – Balanced context extraction
  - `max` – Sends maximum context

- ⚡ **Hole Filler Model Mode**  
  Optimized prompt template for code auto-completion.

- 🖥 Works offline with local models  
- ⚙️ Easy configuration via VS Code settings  
- 🪶 Lightweight + fast startup  

---

## 📦 Lata Setup

### Step 1 - Installation

```bash
git clone https://github.com/techkuji/Lata.git
cd Lata
npm install
npm run compile
````

### Step 2 - Configuration (settings.json)
Press `Ctrl + Shift + P` (Windows/Linux) or `Cmd + Shift + P` (Mac), search for `preference` and select `Preferences: Open User Settings (JSON)`
Add below fields in your VS Code `settings.json`:

```jsonc
// Lata Local Code Complete configs
"lata.codeParsingMode": "intelligent",                     // Options: "pruned", "intelligent", "max"
"lata.reqType": "claude",                             // Options: "local", "openai", "claude", "gemini", "self_hosted"
"lata.modelType": "hole-filler",                      // Enables hole-filler prompting

// Cloud API config
"lata.openAIApiKey": "YOUR_API_KEY",
"lata.openAIModel": "gpt-4o-mini",                    // Options: "gpt-4o-mini", "gpt-4.1-mini"
"lata.openAIEndpoint": "https://api.openai.com/v1/chat/completions",

"lata.claudeApiKey": "YOUR_API_KEY",
"lata.claudeModel": "claude-3-5-haiku-latest",        // Options: "claude-3-5-haiku-latest", "claude-3-haiku-20240307", "claude-3-sonnet-20240229"
"lata.claudeEndpoint": "https://api.anthropic.com/v1/messages",

"lata.geminiApiKey": "YOUR_API_KEY",
"lata.geminiModel": "gemini-1.5-flash-latest",        // Options: "gemini-1.5-flash-latest", "gemini-2.5-flash", "gemini-2.5-pro"
"lata.geminiEndpoint": "https://generativelanguage.googleapis.com/v1beta/models/",

"lata.selfHostedAPIKey": "YOUR_API_KEY",
"lata.selfHostedModel": "gpt-4o",
"lata.selfHostedEndPoint": "https://YOUR_DOMAIN/openai/v1/chat/completions",
"lata.selfHostedModelProvider": "openai",

// Local LLM config (Ollama)
"lata.localModel": "codellama:7b",                    // Options: "deepseek-coder-v2:16b", "codellama:7b"
"lata.localEndpoint": "http://localhost:11434/api/generate"
```

Press **F5** (Start Debugging) to launch the Extension Development Host.
A new VS code window will open with Lata activated.

Enjoy 😊

---

## 🧠 Code Parsing Modes

### 🔹 `pruned`

* Fastest
* Minimal context window
* Great for fast typing and quick suggestions

### 🔹 `intelligent`

* Balanced
* Uses heuristic context selection
* Best everyday mode

### 🔹 `max`

* Sends maximum code context
* Best quality
* Higher cost on cloud models

---

## 🤖 Model Provider Options (`lata.reqType`)

Choose which AI model powers completion:

| Provider      | Description                           |
| ------------- | ------------------------------------- |
| `openai`      | GPT-4o, GPT-4.1, etc.                 |
| `claude`      | Claude 3, Claude 3.5 Haiku / Sonnet   |
| `gemini`      | Gemini 1.5 Flash, Gemini 2.5          |
| `local`       | Ollama models (offline)               |
| `self_hosted` | Any custom OpenAI-compatible endpoint |

Example:

```json
"lata.reqType": "claude"
```
---


## 🪪 License

Licensed under the **MIT License**.



## 👤 Author

**techkuji**
GitHub: [https://github.com/techkuji](https://github.com/techkuji)

---

