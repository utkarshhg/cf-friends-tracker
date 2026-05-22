# CF Friends Tracker 👥

A Chrome extension that shows which of your Codeforces friends have solved or attempted the problem you're currently viewing — with **inline code viewing**.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-brightgreen?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![Codeforces](https://img.shields.io/badge/Codeforces-API-red?logo=codeforces)

## ✨ Features

- 🔍 **Auto-detects** the problem when you visit any Codeforces problem page
- 👥 **Shows friends** who solved or attempted the problem with their verdict
- 📝 **Inline code viewing** — read your friend's solution right in the panel
- 📋 **Copy code** to clipboard with one click
- 🎨 **CF rating colors** — handles are colored by rating (gray → red)
- 📊 **Submission history** — see all attempts from each friend
- ⚡ **Smart caching** — instant load on revisit (friends cached 1hr, submissions 30min)
- 🔒 **Secure** — API credentials stored locally, never sent to third parties

## 📸 How It Works

When you visit a Codeforces problem page, a panel appears in the sidebar showing:

```
┌─────────────────────────────────┐
│  👥 Friends Tracker             │
│  ─────────────────────────────  │
│  ✅ tourist (3800)              │
│     Accepted · C++17 · 46ms     │
│     [View Code]                 │
│                                 │
│  ❌ friend_2 (1800)             │
│     Wrong Answer on test 5      │
│     [View Code]                 │
│                                 │
│  3 solved · 2 attempted         │
└─────────────────────────────────┘
```

## 🚀 Installation

### Step 1: Download
```bash
git clone https://github.com/utkarshhg/cf-friends-tracker.git
```
Or click **Code → Download ZIP** and extract it.

### Step 2: Load in Chrome
1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `cf-friends-tracker` folder

### Step 3: Configure
1. Go to [codeforces.com/settings/api](https://codeforces.com/settings/api) and generate an **API Key** and **API Secret**
2. Click the extension icon in your Chrome toolbar
3. Enter your **Codeforces handle**, **API Key**, and **API Secret**
4. Click **Save Settings**
5. Click **Test Connection** to verify ✅

## 🎯 Supported Pages

The extension works on:
- `codeforces.com/problemset/problem/{contestId}/{index}`
- `codeforces.com/contest/{contestId}/problem/{index}`
- `codeforces.com/gym/{contestId}/problem/{index}`

## 🛡️ Privacy

- Your API key and secret are stored **locally** in Chrome's storage (`chrome.storage.local`)
- All API calls go **directly** to `codeforces.com` — no third-party servers involved
- No data is collected, tracked, or transmitted anywhere

## 🔧 Technical Details

| Component | Details |
|-----------|---------|
| Manifest | V3 (latest Chrome standard) |
| Auth | SHA-512 API signature per CF spec |
| Rate Limiting | 300ms between API calls (under CF's 5 req/sec limit) |
| Caching | Friends list: 1 hour, Submissions: 30 min |
| Code Viewing | Scraped from CF submission pages, HTML decoded |

## 📁 Project Structure

```
cf-friends-tracker/
├── manifest.json       # Extension configuration
├── background.js       # API layer (auth, caching, rate limiting)
├── content.js          # UI panel injected into problem pages
├── content.css         # Dark-themed panel styles
├── popup.html          # Settings popup
├── popup.css           # Popup styles
├── popup.js            # Settings logic
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 🤝 Contributing

Pull requests are welcome! Feel free to:
- Report bugs via [Issues](../../issues)
- Suggest features
- Improve the UI/UX

## 📄 License

MIT License — free to use, modify, and distribute.
