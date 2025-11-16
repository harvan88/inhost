# INHOST - API Gateway

Multi-channel messaging platform with WhatsApp, Telegram, Web, and SMS support.

## 🚀 Quick Start

```bash
# Terminal 1: API Server
start-server.bat

# Terminal 2: Testing Dashboard
start-testing.bat

# Browser
http://localhost:5500
```

**Full guide**: [QUICK-START.md](QUICK-START.md)

---

## 📋 Current Status

**Sprint 3 (WebSocket Real-time)** - ✅ **COMPLETED**

- ✅ WebSocket Real-time (`/realtime`)
- ✅ WebSocket Rate Limiting (12 free, 30 premium)
- ✅ WebSocket Message Validation (TypeBox)
- ✅ WebSocket Size Validation (1MB max)
- 📄 [Sprint 3 Report](docs/sprints/sprint3-report.md)

---

## 🏗️ Architecture

```
inhost/
├── apps/
│   └── api-gateway/          # Main API server (Elysia.js + Bun)
│       ├── src/
│       │   ├── core/         # Business logic & interfaces
│       │   ├── middleware/   # Rate limiting, validation, timeout
│       │   ├── routes/       # API endpoints
│       │   └── index.ts      # Server entry point
│       └── package.json
│
├── testing/                  # Testing dashboard
│   ├── index.html           # Main dashboard
│   ├── tests/               # Individual test files
│   └── server.js            # HTTP server for testing
│
├── docs/                     # Documentation
│   ├── architecture/        # System design & planning
│   ├── guides/              # Testing & usage guides
│   └── troubleshooting/     # Problem solving
│
├── scripts/                  # Utility scripts
├── start-server.bat         # Start API server
└── start-testing.bat        # Start testing dashboard
```

**Details**: [docs/architecture/plan-modular.md](docs/architecture/plan-modular.md)

---

## 🧪 Testing

### Automated Tests

**HTTP Endpoints:**
```bash
# Sprint 2 - HTTP protection tests
scripts\test-sprint2-simple.bat
```

**WebSocket:**
```bash
# Sprint 3 - WebSocket protection tests
bun scripts/test-websocket.js

# Expected: 5/5 tests pass
# - Connection
# - Valid message
# - Invalid message (rejected)
# - Large message (rejected)
# - Rate limiting (~12 messages accepted)
```

### Manual Testing
1. Open `http://localhost:5500`
2. Select test suite from sidebar
3. Run tests

**Guides**:
- [Sprint 1 Testing](docs/guides/sprint1-testing.md)
- [Sprint 2 Testing](docs/guides/sprint2-testing.md)

---

## 🚨 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Failed to fetch" | [docs/troubleshooting/failed-to-fetch.md](docs/troubleshooting/failed-to-fetch.md) |
| Multiple instances | [docs/troubleshooting/multiple-instances.md](docs/troubleshooting/multiple-instances.md) |
| Server won't start | Check processes → Kill all → Restart |

---

## 📚 Documentation

### Essential
- [QUICK-START.md](QUICK-START.md) - Get started in 2 minutes
- [CLAUDE.md](CLAUDE.md) - Development guide for AI assistants

### Sprint Reports
- [Sprint 3 Report](docs/sprints/sprint3-report.md) - WebSocket Real-time (COMPLETED)
- [Sprint 2 Report](docs/sprints/sprint2-report.md) - Protection & Security (COMPLETED)

### Architecture & Planning
- [docs/architecture/plan-modular.md](docs/architecture/plan-modular.md) - Modular development plan
- [docs/architecture/frontend-strategy.md](docs/architecture/frontend-strategy.md) - Frontend strategy

### Testing Guides
- [docs/guides/sprint1-testing.md](docs/guides/sprint1-testing.md) - MessageCore testing
- [docs/guides/sprint2-testing.md](docs/guides/sprint2-testing.md) - Protection & Security testing

### Troubleshooting
- [docs/troubleshooting/failed-to-fetch.md](docs/troubleshooting/failed-to-fetch.md) - "Failed to fetch" errors
- [docs/troubleshooting/multiple-instances.md](docs/troubleshooting/multiple-instances.md) - Multiple server instances

---

## 🛠️ Tech Stack

- **Runtime**: Bun
- **Framework**: Elysia.js
- **Validation**: TypeBox
- **Database**: PostgreSQL (Prisma)
- **Testing**: Custom dashboard

---

## 📖 Sprints

- ✅ **Sprint 1**: MessageCore + Basic Routes
- ✅ **Sprint 1.5**: Support Services (Logger, Storage, RateLimiter)
- ✅ **Sprint 2**: Protection & Security - [Report](docs/sprints/sprint2-report.md)
- ✅ **Sprint 3**: WebSocket Real-time (Rate limiting + Validation)

**Next**: Sprint 4 (Persistence - Redis/PostgreSQL)

---

**Last Updated**: 2025-11-16
