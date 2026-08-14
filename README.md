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
| 🍏 **macOS** | **Intel (x64)** | App Bundle (`.zip`) | [**⬇️ Download for Intel Mac (.zip)**](https://github.com/jagantripuragiri/Jcodes-AI-Ide/releases/latest/download/J-Codes-darwin-x64.zip) |
| 🪟 **Windows** | **64-bit (x64)** | Setup Installer (`.exe`) | [**⬇️ Download Windows Installer (.exe)**](https://github.com/jagantripuragiri/Jcodes-AI-Ide/releases/latest/download/J-Codes-UserSetup-x64.exe) |
| 🪟 **Windows** | **64-bit (x64)** | Portable (`.zip`) | [**⬇️ Download Windows Portable (.zip)**](https://github.com/jagantripuragiri/Jcodes-AI-Ide/releases/latest/download/J-Codes-win32-x64.zip) |
| 🐧 **Linux** | **Debian / Ubuntu (x64)** | `.deb` Package | [**⬇️ Download Linux Debian (.deb)**](https://github.com/jagantripuragiri/Jcodes-AI-Ide/releases/latest/download/j-codes_amd64.deb) |
| 🐧 **Linux** | **64-bit (x64)** | Portable (`.tar.gz`) | [**⬇️ Download Linux Tarball (.tar.gz)**](https://github.com/jagantripuragiri/Jcodes-AI-Ide/releases/latest/download/J-Codes-linux-x64.tar.gz) |

> 💡 *Or view all assets on the [GitHub Releases page](https://github.com/jagantripuragiri/Jcodes-AI-Ide/releases).*

---

## 🚀 Installation Guide

### 🍏 macOS (Apple Silicon / Intel)
1. Download the `J-Codes-darwin-arm64.zip` (for M1/M2/M3/M4) or `J-Codes-darwin-x64.zip` (for Intel).
2. Double-click the downloaded `.zip` file to extract `J code's.app`.
3. Drag and drop **`J code's.app`** into your `/Applications` folder.
4. **First Launch Note (Gatekeeper):** If macOS displays *"Apple cannot check it for malicious software"* or *"App is damaged"*:
   - Open **Terminal** and run:
     ```bash
     xattr -cr "/Applications/J code's.app"
     ```
   - *Or* Right-click **`J code's.app`** in Finder and click **Open**, then click **Open** in the dialog.

---

### 🪟 Windows (10 / 11)
#### Portable Version (`.zip`):
1. Download `J-Codes-win32-x64.zip`.
2. Right-click the `.zip` file and select **"Extract All..."**.
3. Open the extracted folder and double-click **`J code's.exe`** to launch the editor.
4. *(Optional)* Right-click `J code's.exe` ➔ **"Show more options"** ➔ **"Send to"** ➔ **"Desktop (create shortcut)"**.

#### Installer Version (`.exe`):
1. Run the `J-Codes-Setup-x64.exe` installer and follow the on-screen instructions.
2. If Windows SmartScreen shows *"Windows protected your PC"*, click **"More info"** ➔ **"Run anyway"**.

---

### 🐧 Linux (Ubuntu, Debian, Fedora, Arch)
```bash
# Debian / Ubuntu (.deb)
sudo dpkg -i j-codes_amd64.deb

# Or extract tarball
tar -xzf J-Codes-linux-x64.tar.gz
cd J-Codes-linux-x64 && ./j-codes
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

---

## 🛠 Building from Source

### Prerequisites
- **Node.js**: `v20.18.1` or `v22.x`
- **npm**: `v10.x` or later
- **Python**: `3.x` (for native compilation)
- **C/C++ Compiler Toolchain** (Xcode Command Line Tools on Mac, Visual Studio C++ Build Tools on Windows, `build-essential` on Linux)

### Setup & Local Development
```bash
# 1. Clone the repository
git clone https://github.com/jagantripuragiri/J-code.git
cd J-code

# 2. Install dependencies
npm install

# 3. Build React UI components
npm run buildreact

# 4. Start watcher in one terminal
npm run watch

# 5. Launch development build
# On macOS / Linux:
./scripts/code.sh

# On Windows:
.\scripts\code.bat
```

### Packaging Production Builds

```bash
# Build for Apple Silicon Mac (M1/M2/M3/M4)
node --max-old-space-size=8192 ./node_modules/gulp/bin/gulp.js vscode-darwin-arm64

# Build for Intel Mac
node --max-old-space-size=8192 ./node_modules/gulp/bin/gulp.js vscode-darwin-x64

# Build for Windows 64-bit (run on Windows host or CI)
node --max-old-space-size=8192 ./node_modules/gulp/bin/gulp.js vscode-win32-x64

# Build for Linux 64-bit
node --max-old-space-size=8192 ./node_modules/gulp/bin/gulp.js vscode-linux-x64
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE.txt).
Based on the open-source [VS Code](https://github.com/microsoft/vscode) (Microsoft) and [Void](https://github.com/voideditor/void).
Third-party notices and licenses are documented in `ThirdPartyNotices.txt`.
