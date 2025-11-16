# 🚨 Troubleshooting: "Failed to fetch" Errors

## Two Main Causes

### 1. Dashboard Opened from `file://` Protocol (CORS Issue)

**Symptoms:**
- ✅ API server running (port 3000)
- ✅ `curl http://localhost:3000/health` works
- ✅ Dashboard indicator shows 🟢 Online
- ❌ ALL dashboard tests fail with "Failed to fetch"
- ❌ Hard refresh (Ctrl+Shift+R) doesn't fix it

**Cause:**
Browser blocks `file://` → `localhost` HTTP requests due to CORS policy.

**Solution:**
```bash
# Terminal 2 (API server must be running in Terminal 1)
start-testing.bat

# Browser
http://localhost:5500  # NOT file:///...
```

**Why it works:**
`http://localhost:5500` → `http://localhost:3000` = Same protocol (HTTP), CORS allowed

---

### 2. Multiple Server Instances

**Symptoms:**
- ⚠️ "Failed to fetch" appears intermittently
- ⚠️ Works sometimes, fails other times
- ⚠️ Hard refresh temporarily fixes it
- ⚠️ Happens in all browsers including incognito

**Diagnosis:**
```bash
tasklist | findstr bun.exe
```

**Problem indicators:**
- 3 lines = 1 instance ✅ CORRECT
- 6+ lines = 2+ instances ❌ PROBLEM

**Cause:**
Multiple server instances compete for port 3000. Requests randomly hit different instances causing intermittent failures.

**Solution (30 seconds):**
```bash
# 1. Stop ALL instances
cmd //c "taskkill /F /IM bun.exe"

# 2. Wait 2 seconds
timeout /t 2

# 3. Start ONE instance
bun --cwd apps/api-gateway dev
```

**Verify fix:**
```bash
# Must show EXACTLY 3 lines
tasklist | findstr bun.exe
```

**Prevention:**
Use `start-server.bat` - it checks for existing processes before starting.

---

## Quick Diagnosis Table

| Symptom | Check | If TRUE → Cause |
|---------|-------|-----------------|
| ALL requests fail | Dashboard URL starts with `file://` | CORS issue |
| Intermittent failures | `tasklist \| findstr bun.exe` shows 6+ lines | Multiple instances |
| 🔴 Server: Offline | `curl http://localhost:3000/health` fails | Server not running |

---

## Additional Resources

- **Quick Start**: [QUICK-START.md](../../QUICK-START.md)
- **Multiple Instances Details**: [multiple-instances.md](multiple-instances.md)
