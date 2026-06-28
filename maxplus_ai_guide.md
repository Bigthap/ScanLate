# MaxPlus AI Integration Guide (maxplus-ai.cc)

This guide explains how to integrate and use **MaxPlus AI** API keys (formatted as `ccsk-...`) with other development tools, code editors (like Cursor), and custom scripts (Python, Node.js).

---

## ⚙️ Core API Configurations

*   **Base URL (Claude/Anthropic Protocol):** `https://api.maxplus-ai.cc`
*   **Base URL (OpenAI/Chat Protocol):** `https://api.maxplus-ai.cc/v1`
*   **API Key Format:** Starts with `ccsk-` (e.g., `ccsk-787c2a05...`)

---

## 🛠️ Tool Integration

### 1. Claude Code (Terminal CLI)
To use MaxPlus AI with the official `claude` command line tool, inject the variables directly into your terminal session before launching the command:

#### **Windows (PowerShell)**
```powershell
$env:ANTHROPIC_BASE_URL="https://api.maxplus-ai.cc"
$env:ANTHROPIC_API_KEY="ccsk-YOUR_API_KEY_HERE"
claude
```

#### **macOS / Linux (Bash/Zsh)**
```bash
export ANTHROPIC_BASE_URL="https://api.maxplus-ai.cc"
export ANTHROPIC_API_KEY="ccsk-YOUR_API_KEY_HERE"
claude
```

---

### 2. Cursor IDE
You can route Cursor's AI requests through MaxPlus AI's cheaper endpoints:

1. Open Cursor and go to **Settings** (Gear icon on top-right) -> **Models**.
2. Find the **OpenAI** section and toggle it **ON**.
3. Under **Override OpenAI Base URL**, input:
   ```text
   https://api.maxplus-ai.cc/v1
   ```
4. Under **OpenAI API Key**, paste your key: `ccsk-YOUR_API_KEY_HERE`.
5. Under the models list, click **+ Add model** and enter the model name you want to use (e.g., `gpt-5.5` or `claude-sonnet-4-6`).

---

### 3. Cline / Roo Code (VS Code Extensions)
For extensions that support custom OpenAI or Anthropic configurations:

*   **Provider:** Choose `OpenAI Compatible` or `Anthropic Compatible`.
*   **Base URL:** 
    *   For OpenAI style: `https://api.maxplus-ai.cc/v1`
    *   For Anthropic style: `https://api.maxplus-ai.cc`
*   **API Key:** `ccsk-YOUR_API_KEY_HERE`
*   **Model ID:** Enter any supported model (e.g., `claude-sonnet-4-6`, `gpt-5.5`).

---

## 💻 SDK Code Integration

### 1. Python (OpenAI SDK)
Ensure you have the package installed: `pip install openai`.
```python
import openai

client = openai.OpenAI(
    base_url="https://api.maxplus-ai.cc/v1",
    api_key="ccsk-YOUR_API_KEY_HERE"
)

response = client.chat.completions.create(
    model="gpt-5.5",  # Or "claude-sonnet-4-6"
    messages=[
        {"role": "system", "content": "You are a helpful coding assistant."},
        {"role": "user", "content": "Write a python quicksort function."}
    ],
    max_tokens=1000
)

print(response.choices[0].message.content)
```

---

### 2. Python (Anthropic SDK)
Ensure you have the package installed: `pip install anthropic`.
```python
import anthropic

client = anthropic.Anthropic(
    base_url="https://api.maxplus-ai.cc",
    api_key="ccsk-YOUR_API_KEY_HERE"
)

message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1500,
    messages=[
        {"role": "user", "content": "Explain quantum computing in simple terms."}
    ]
)

print(message.content[0].text)
```

---

### 3. Node.js (OpenAI SDK)
Ensure you have the package installed: `npm install openai`.
```javascript
const { OpenAI } = require('openai');

const openai = new OpenAI({
  baseURL: 'https://api.maxplus-ai.cc/v1',
  apiKey: 'ccsk-YOUR_API_KEY_HERE'
});

async function main() {
  const completion = await openai.chat.completions.create({
    model: 'gpt-5.5',
    messages: [{ role: 'user', content: 'Explain the event loop in Node.js.' }],
  });

  console.log(completion.choices[0].message.content);
}

main();
```

---

## 📡 Streaming API Request Example (To Avoid Timeouts)
Since MaxPlus gateway has a strict **27-second timeout** for non-streaming calls, always use **Streaming** when calling larger models (like `claude-opus-4-8` or `gpt-5.5`):

```python
import requests
import json

url = "https://api.maxplus-ai.cc/v1/messages"
headers = {
    "Authorization": "Bearer ccsk-YOUR_API_KEY_HERE",
    "anthropic-version": "2023-06-01",
    "content-type": "application/json"
}
data = {
    "model": "claude-opus-4-8",
    "max_tokens": 2000,
    "stream": True,
    "messages": [{"role": "user", "content": "Write a massive code file..."}]
}

# Stream request to prevent gateway timeout
res = requests.post(url, headers=headers, json=data, stream=True)

for line in res.iter_lines():
    if line:
        decoded_line = line.decode('utf-8')
        if decoded_line.startswith('data: '):
            try:
                event_data = json.loads(decoded_line[6:])
                # Extract actual generated text delta
                if event_data.get('type') == 'content_block_delta':
                    delta = event_data.get('delta', {})
                    text = delta.get('text', '')
                    print(text, end='', flush=True)
            except Exception:
                pass
```
