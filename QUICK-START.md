# 🚀 Quick Start - INHOST

## ⚡ 4-Step Startup (2 minutes)

### 1️⃣ Start API Server

**Option A - Automated (Recommended):**
```bash
start-server.bat
```

**Option B - Manual:**
```bash
# Stop any previous processes
cmd //c "taskkill /F /IM bun.exe"

# Start server
bun --cwd apps/api-gateway dev
```

### 2️⃣ Verify Server Status

```bash
# Must show EXACTLY 3 lines
tasklist | findstr bun.exe
```

**Expected output:**
```
bun.exe    XXXXX    Console    6    ~44 KB    ✅
bun.exe    XXXXX    Console    6    ~23 KB    ✅
bun.exe    XXXXX    Console    6   ~170 KB    ✅
```

⚠️ **6+ lines = Multiple instances = Problem** → See [Troubleshooting](#troubleshooting)

### 3️⃣ Start Testing Dashboard Server

⚠️ **IMPORTANT**: Run in a SECOND terminal

```bash
start-testing.bat
```

**Why?** Browser blocks `file://` → `localhost` requests (CORS policy)

### 4️⃣ Open Dashboard

1. Open in browser: **http://localhost:5500**
2. Verify indicator: 🟢 **Server: Online** (top right)
3. Select "Sprint 2 Protection" from menu
4. Run tests

⚠️ **DO NOT** open `file:///.../testing/index.html` directly

---

## 🔧 Quick Health Check

```bash
# Test API server
curl http://localhost:3000/health

# Test message endpoint
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -H "X-User-Id: test" \
  -d '{"type":"incoming","channel":"whatsapp","content":{"text":"Test"},"metadata":{"from":"+1","to":"+2","timestamp":"2025-11-16T10:00:00Z"}}'
```

---

## 🚨 Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| "Failed to fetch" (all requests) | Dashboard opened from `file://` | Use `start-testing.bat` → `http://localhost:5500` |
| "Failed to fetch" (intermittent) | Multiple API instances | See [docs/troubleshooting/multiple-instances.md](docs/troubleshooting/multiple-instances.md) |
| 🔴 Server: Offline | API server not running | Run `start-server.bat` |
| 6+ bun processes | 2+ server instances | Stop all: `cmd //c "taskkill /F /IM bun.exe"` |

---

## 📚 Documentation

- **Architecture**: [docs/architecture/](docs/architecture/)
- **Testing Guides**: [docs/guides/](docs/guides/)
- **Troubleshooting**: [docs/troubleshooting/](docs/troubleshooting/)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)

---

## 🎯 Daily Checklist

### Before Starting:
- [ ] Verify NO processes: `tasklist | findstr bun.exe` (empty)
- [ ] Terminal 1: `start-server.bat`
- [ ] Verify 3 processes: `tasklist | findstr bun.exe`
- [ ] Terminal 2: `start-testing.bat`
- [ ] Browser: `http://localhost:5500`
- [ ] Verify: 🟢 Server: Online

### When Finishing:
- [ ] Press `Ctrl+C` in both terminals
- [ ] Verify no processes remain: `tasklist | findstr bun.exe`
