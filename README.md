# GitHub GUI

> Web app for managing GitHub repositories: compare branches vs ZIPs, select files in a tree, and commit via a clean UI.

**Version:** 0.0.0  
**License:** Private / Internal

---

## 🚀 Features

- Compare branches or branch vs uploaded ZIP
- Interactive diff viewer with tri-state file selection
- Create new branches directly from the UI
- Commit selected files or folders to GitHub
- Virtualized list rendering for large diffs
- Dark/light mode support (GitHub-style)
- Token-based GitHub OAuth authentication

---

## 🧱 Tech Stack

- **React 19 + Vite 7** – fast, modern SPA foundation  
- **Material UI (MUI)** – consistent GitHub-like styling  
- **diff-match-patch** – efficient text diff algorithm  
- **JSZip** – ZIP file unpacking and comparison  
- **react-virtuoso / react-window** – performant file lists  
- **framer-motion** – UI transitions and animations  
- **react-hot-toast** – notifications  
- **GitHub OAuth App** – secure authentication

---

## 🧭 Project Structure
```
src/
 ├── api/                 # GitHub API wrapper
 ├── components/          # Panels, bars, layout and dialogs
 ├── hooks/               # useGitHubOAuth
 ├── theme/               # MUI theme (dark/light)
 ├── utils/               # ZIP, diff, file tree, serialization logic
 ├── App.jsx              # Root component
 └── main.jsx             # Entry point
```

---

## ⚙️ Scripts

| Command | Description |
|----------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Build production bundle |
| `npm run preview` | Serve built app locally |
| `npm run lint` | Run ESLint |
| `npm run deploy` | Deploy to GitHub Pages |

---

## 🧩 Key Components

| Component | Purpose |
|------------|----------|
| `BranchDiffPanel.jsx` | Compare two branches and view diffs |
| `ZipDiffPanel.jsx` | Compare branch with ZIP upload |
| `BranchSelectorBar.jsx` | Choose source and target branches |
| `ZipSelectorBar.jsx` | Upload ZIP, choose target branch |
| `CommitBar.jsx` | Commit selected files |
| `FileTreeView.jsx` | Tri-state file/folder selector |
| `DiffPanelBase.jsx` | Shared logic for diff displays |
| `AuthPanel.jsx` | GitHub OAuth login |
| `githubApi.js` | REST API integration |
| `serializeDiffForCommit.js` | Converts diff results to GitHub commit payloads |

---

## 🧪 Development

### Requirements
- Node.js ≥ 18  
- npm ≥ 9

### Local Run
```bash
npm install
npm run dev
```
Runs on http://localhost:5173

### Production Build
```bash
npm run build
```
Output → `/dist`

### Deploy to GitHub Pages
```bash
npm run deploy
```

### Deploy to Vercel
- Set environment variables:  
  - `VITE_GITHUB_CLIENT_ID`  
  - `VITE_REDIRECT_URL`  
- Build command: `npm run build`  
- Output directory: `dist`

---

## 🔒 Security Notes

- Tokens are stored in memory only (not persisted)
- Minimal OAuth scopes: `read:user`, `repo`, `repo:status`
- All API calls go to `api.github.com` over HTTPS
- ZIP uploads sanitized against path traversal

---

## 🛠️ Roadmap

- [ ] Add Pull Request creation from commit flow  
- [ ] Improve XML diff visualization  
- [ ] Persist user settings (repo, theme)  
- [ ] Add Jest test suite  
- [ ] Enhance CI/CD automation

---

## 🧾 License

Private internal project.  
Not intended for public redistribution.

---

**Maintainers:** Project GitHub GUI Team  
**Last Update:** October 2025
