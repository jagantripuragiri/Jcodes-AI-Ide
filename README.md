# J Code's - AI-Powered IDE

<div align="center">

# ⚡️ J Code's
### The Next-Generation AI-First IDE Built for Developers

[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue?style=flat-square)](https://github.com/jagantripuragiri/J-code/releases)
[![Apple Silicon](https://img.shields.io/badge/Apple%20Silicon-M1%20%2F%20M2%20%2F%20M3%20%2F%20M4-success?style=flat-square&logo=apple)](https://github.com/jagantripuragiri/J-code/releases)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE.txt)
[![Built on](https://img.shields.io/badge/built%20on-VS%20Code%201.99-blueviolet?style=flat-square&logo=visualstudiocode)](https://github.com/microsoft/vscode)

<p align="center">
  <b>J Code's</b> is an open-source, AI-native development environment designed to supercharge developer productivity with deep workspace context, inline intelligent autocomplete, agentic coding workflows, and multi-model support.
</p>

[**⬇️ Download Latest Release**](#-downloads) • [**🚀 Features**](#-core-features) • [**🛠 Building from Source**](#-building-from-source) • [**⚙️ Configuration**](#%EF%B8%8F-ai-configuration)

</div>

---

## 📥 Downloads

Download the latest version of **J Code's** for your operating system:

| Platform | Architecture | Type | Direct Download Link |
| :--- | :--- | :--- | :--- |
| 🍏 **macOS** | **Apple Silicon (M1 / M2 / M3 / M4)** | App Bundle (`.zip`) | [**⬇️ Download for Apple Silicon (.zip)**](https://github.com/jagantripuragiri/Jcodes-AI-Ide/releases/latest/download/J-Codes-darwin-arm64.zip) |
| 🪟 **Windows** | **64-bit (x64)** | Setup Installer (`.exe`) | [**⬇️ Download Windows Installer (.exe)**](https://github.com/jagantripuragiri/Jcodes-AI-Ide/releases/latest/download/J-Codes-UserSetup-x64.exe) |
| 🐧 **Linux** | **Debian / Ubuntu (x64)** | `.deb` Package | [**⬇️ Download Linux Debian (.deb)**](https://github.com/jagantripuragiri/Jcodes-AI-Ide/releases/latest/download/j-codes_amd64.deb) |

> 💡 *Or view all assets on the [GitHub Releases page](https://github.com/jagantripuragiri/Jcodes-AI-Ide/releases).*

---

## 🚀 Installation Guide

### 🍏 macOS (Apple Silicon M1 / M2 / M3 / M4)
1. Download **`J-Codes-darwin-arm64.zip`**.

<img width="466.5" height="292" alt="image" src="https://github.com/user-attachments/assets/e91c1ce5-8e20-40ae-9118-f9a88b9c102f" />


2. Double-click the downloaded `.zip` file to extract `J code's.app`.
<img width="466.5" height="292" alt="image" src="https://github.com/user-attachments/assets/8bee5b68-d1e6-4842-a768-3d41d23dea18" />

3. Drag and drop **`J code's.app`** into your `/Applications` folder.
<img width="466.5" height="292" alt="image" src="https://github.com/user-attachments/assets/00c47cde-6bd0-4bad-a368-3cf285565dba" />

4. **First Launch Note (Gatekeeper):** If macOS displays *"Apple cannot check it for malicious software"* or *"App is damaged"*:
   - Open **Terminal** and run:
     ```bash
     xattr -cr "/Applications/J code's.app"
     ```
   - *Or* Right-click **`J code's.app`** in Finder and click **Open**, then click **Open** in the dialog.


<img width="466.5" height="292" alt="Group 1" src="https://github.com/user-attachments/assets/1ea8d306-f3e1-4977-a14a-75808585ffdd" />
<img width="466.5" height="292" alt="image" src="https://github.com/user-attachments/assets/affcd65c-8d96-4f94-80ac-e6b8ffb95ef5" />



---


### 🪟 Windows (10 / 11)
1. Download and run **`J-Codes-UserSetup-x64.exe`**.
2. Follow the on-screen installer instructions.
3. If Windows SmartScreen displays *"Windows protected your PC"*, click **"More info"** ➔ **"Run anyway"**.
4. The installer creates Desktop & Start Menu shortcuts automatically.

---

### 🐧 Linux (Ubuntu, Debian)
1. Download **`j-codes_amd64.deb`**.
2. Install via terminal:
   ```bash
   sudo dpkg -i j-codes_amd64.deb
   sudo apt-get install -f   # Fix any missing dependencies
   ```

---

## ✨ Core Features

- 🧠 **Multi-Model AI Support:** Seamlessly connect and switch between **Anthropic Claude 3.7 / 3.5 Sonnet**, **Google Gemini 2.0 / 1.5 Pro**, **OpenAI GPT-4o / o1 / o3**, **DeepSeek R1 / V3**, **Groq**, and **Local Ollama**.
- ⚡️ **AI Inline Autocomplete & Edit:** Instant multi-line completions and smart editing directly inside your editor buffer.
- 🤖 **Autonomous Agentic Coding:** Let the IDE execute multi-step coding tasks, inspect errors, search workspaces, and apply diffs autonomously.
- 🔍 **Project Brain & Workspace Context:** Indexes your entire codebase for semantic search, architecture-aware completions, and project-level reasoning.
- 🔌 **Model Context Protocol (MCP) Support:** Connect external tools, databases, and APIs to give the AI direct access to your workflows.
- 🛡 **Built on VS Code:** Full compatibility with VS Code keybindings, settings, syntax highlighting, and extensions.

---

## ⚙️ AI Configuration

After launching **J Code's**, open the Settings pane (`Cmd + ,` on Mac or `Ctrl + ,` on Windows) to configure your AI providers:

1. Click on the **J Code's Settings** icon in the sidebar or top bar.
2. Select your preferred provider (**Anthropic**, **Gemini**, **OpenAI**, **Ollama**, **Groq**, etc.).
3. Enter your API Key or local host URL (`http://localhost:11434` for Ollama).
4. Choose your preferred models for **Chat**, **Autocomplete**, and **Apply Edits**.



## 📄 License

This project is licensed under the [MIT License](LICENSE.txt).
Based on the open-source [VS Code](https://github.com/microsoft/vscode) (Microsoft) and [Void](https://github.com/voideditor/void).
Third-party notices and licenses are documented in `ThirdPartyNotices.txt`.
