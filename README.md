# ScanLate v3

ScanLate is a powerful browser extension and local backend server that translates manga directly in your browser. By utilizing a local OCR engine combined with large language models (LLMs), it overlays translated text onto manga pages seamlessly.

## Features

- **On-the-fly Translation**: Detects, translates, and overlays manga text in the browser.
- **Multimodal LLM Translation**: Sends the image context to the AI (e.g., Gemini Flash, GPT-4o) for superior translation accuracy and context awareness.
- **LLM OCR (Advanced)**: Uses AI models to extract text from manga pages, overcoming the limitations of traditional OCR models. Features smart bounding box merging for context-aware text detection.
- **Auto Glossary**: Automatically extracts and saves character names and specific terminology so the AI remembers them in future pages.
- **Customizable Overlays**: Auto-scales font size and samples background/text colors to match the original art style seamlessly.
- **Local Server**: A lightweight Python backend that bridges the extension, the OCR engine (`manga-image-translator`), and the LLM API (`LiteLLM`).

## Prerequisites

- **Python 3.10+** (Added to PATH)
- **Chromium-based Browser** (Google Chrome, Microsoft Edge, Brave, etc.)
- A valid API key for an LLM provider (e.g., Google Gemini API, OpenRouter, or OpenAI).

## Installation

### 1. Setup the Local Server
1. Clone this repository to your local machine:
   ```bash
   git clone https://github.com/Bigthap/ScanLate.git
   ```
2. Double-click the `ScanLate.bat` file. This automated script will:
   - Create a Python virtual environment.
   - Install all required dependencies (including `manga-image-translator`).
   - Start the local API server on port `5000`.

### 2. Install the Browser Extension
1. Open your browser and go to the extensions page (`chrome://extensions/`).
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked** and select the `extension` folder inside the cloned repository.

### 3. Configuration
1. Click the ScanLate extension icon in your browser to open the popup.
2. Go to **Settings** (the gear icon).
3. Under **General**, input your **LLM API Key**, select your provider (e.g. OpenRouter, Gemini), and set your preferred translation model.
4. Under **Advanced Features**, you can enable:
   - **LLM OCR Configuration** for much higher text recognition accuracy.
   - **Multimodal Translation** to provide the manga image as context to the AI translator.
   - **Auto Glossary** to build a dynamic dictionary of names and terms.

## Usage
- Open a manga reading website.
- The ScanLate popup will allow you to select your translation profile and target language.
- Click the **Translate** button (or use the auto-translate features) to process the current page. 
- You can adjust font sizes and configurations on the fly!

## Disclaimer
This tool is intended for personal and educational use. Please support the official releases of the manga you read.
