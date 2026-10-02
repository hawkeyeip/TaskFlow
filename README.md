# ⚡ TaskFlow — Modern Kanban Task Manager

> **Organize. Prioritize. Execute.**  
> A high-performance, dark-mode Kanban task management system with priority tagging, overdue deadline tracking, and SQLite/JSON persistence. Designed both as a standalone web application and as an integrated native module for [Digital Bestie](https://github.com/hawkeyeip/digital-bestie).

---

## 🌌 Highlights

- **Visual Kanban Board:** Three dynamic status columns (*To Do*, *In Progress*, *Done*) with HTML5 drag-and-drop card movement.
- **Priority Matrix:** Color-coded badges with glowing neon accents for `Critical`, `High`, `Medium`, and `Low` priority tasks.
- **Real-Time Search & Filters:** Instant live search across titles, descriptions, and tags with 300ms debounce; filter by priority and sort by position, due date, created date, or title.
- **Due Date Intelligence:** Smart relative date calculation (*Today*, *Tomorrow*, *Yesterday*, *In X days*, *X days overdue*) with visual overdue warnings.
- **Tagging System:** Freeform tag pills with keyboard entry (`Enter` / `,`) and click-to-remove.
- **Persistent Storage:** SQLite with WAL mode (`tasks.db`) for standalone mode, and hardware/keychain-backed `safeStorage` encrypted JSON when running inside Digital Bestie.
- **Dual Architecture:** Operates both as a standalone Node.js/Express web app (default port `3847`) and as a native Electron sidebar view inside Digital Bestie.

---

## 📁 Directory Structure

```
taskflow/
├── backend/
│   ├── db.js             # SQLite database layer (WAL mode, CRUD, reorder, stats)
│   ├── routes/
│   │   └── tasks.js      # RESTful API endpoints (/api/tasks, /api/tasks/stats)
│   └── server.js         # Express web server (port 3847) + static asset serving
├── frontend/
│   ├── css/
│   │   └── style.css     # Neon dark-theme design system & glassmorphism
│   ├── js/
│   │   ├── api.js        # Client-side REST API client
│   │   ├── components.js # Pure rendering functions & XSS sanitization
│   │   └── app.js        # Controller, drag-and-drop, modals, and hotkeys
│   └── index.html        # SPA shell with Kanban columns & modals
├── data/
│   ├── .gitkeep          # Tracks data directory
│   └── tasks.db          # Local SQLite storage (gitignored)
├── package.json
├── handoff.md            # Cross-agent operations protocol & changelog
└── README.md
```

---

## 🚀 Quick Start (Standalone Mode)

### Prerequisites

- Node.js (v18 or newer recommended)
- npm

### Installation & Run

```bash
# Clone or navigate to the repository
cd taskflow

# Install dependencies
npm install

# Start the application
npm start
```

Visit **`http://localhost:3847`** in your browser.

For hot-reload development mode:
```bash
npm run dev
```

---

## 🔌 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tasks` | Query tasks (`status`, `priority`, `search`, `sort`, `order`) |
| `GET` | `/api/tasks/stats` | Aggregate dashboard statistics (todo, in_progress, done, overdue, priority counts) |
| `GET` | `/api/tasks/:id` | Fetch a single task by UUID |
| `POST` | `/api/tasks` | Create a new task |
| `PATCH` | `/api/tasks/:id` | Update task fields (status, priority, position, etc.) |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `POST` | `/api/tasks/reorder` | Batch update card positions within a column |
| `GET` | `/api/health` | Service health status |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl` / `⌘` + `N` | Open Create Task modal |
| `/` | Focus search input |
| `Esc` | Close active modal |

---

## 🤖 Digital Bestie Integration

TaskFlow is also integrated into **Digital Bestie** (`~/Desktop/digital bestie`):
- **Sidebar Nav:** Dedicated **📋** button in the main sidebar.
- **Encrypted Persistence:** Saves to `~/.digital-bestie/taskflow.json`.
- **AI Context Awareness:** Automatically injects active task counts, overdue items, and top critical focus tasks into Digital Bestie's system prompt during conversations.
- **Neon Brain Sync:** Bidirectional sync bridge to link Kanban action items with second-brain backlogs.

---

## 📄 License

MIT © [hawkeyeip](https://github.com/hawkeyeip)
