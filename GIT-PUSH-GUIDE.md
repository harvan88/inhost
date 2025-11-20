# Guía: Git Push Seguro desde Máquina Local

**Fecha:** 2025-11-20
**Rama de trabajo:** `claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe`

---

## 🎯 Opción 1: Push Automático (Recomendado)

Desde PowerShell en el directorio del proyecto:

```powershell
.\safe-push.bat
```

Este script hace:
1. ✅ Verifica que estés en la rama correcta
2. ✅ Muestra el estado del repositorio
3. ✅ Hace pull para sincronizar
4. ✅ Push con retry automático (2 intentos)
5. ✅ Muestra los últimos commits para confirmar

---

## 🔧 Opción 2: Push Manual (Control Total)

### Paso 1: Verificar rama actual

```powershell
git branch --show-current
```

**Salida esperada:**
```
claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
```

❌ **Si no estás en esta rama:**
```powershell
git checkout claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
```

### Paso 2: Verificar estado

```powershell
git status
```

**Salida esperada:**
```
On branch claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
Your branch is up to date with 'origin/claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe'.

nothing to commit, working tree clean
```

❌ **Si hay archivos sin commit:**
```powershell
git add .
git commit -m "Tu mensaje de commit aquí"
```

### Paso 3: Sincronizar con remote (pull)

```powershell
git pull origin claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
```

**Salida esperada:**
```
Already up to date.
```

❌ **Si hay conflictos:** Resuélvelos antes de continuar.

### Paso 4: Push a remote

```powershell
git push -u origin claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
```

**Salida esperada:**
```
Enumerating objects: X, done.
Counting objects: 100% (X/X), done.
To http://127.0.0.1:XXXXX/git/harvan88/inhost
   XXXXXXX..XXXXXXX  claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe -> claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
```

### Paso 5: Verificar resultado

```powershell
git log --oneline -5
```

**Salida esperada:**
```
5065d6f docs: Add comprehensive integration status document
05a5640 fix: Add scripts to populate lastMessage fields in conversations
7d3cb32 fix: Make /initial endpoint work by extracting token manually
f679c10 debug: Add temporary test endpoint to bypass auth middleware
5019c14 fix: Use onBeforeHandle instead of derive for auth middleware
```

---

## ⚠️ Problemas Comunes y Soluciones

### Error 1: "refusing to push"

**Causa:** Tu rama local está desactualizada

**Solución:**
```powershell
git pull origin claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
git push -u origin claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
```

### Error 2: "403 Forbidden"

**Causa:** La rama no cumple con el patrón requerido (debe empezar con `claude/` y terminar con session ID)

**Solución:** La rama actual YA cumple con este requisito. Si el error persiste:
```powershell
# Verificar nombre de rama
git branch --show-current

# Debe ser exactamente:
# claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
```

### Error 3: "Network error" / "Connection refused"

**Causa:** Problemas de red temporales

**Solución:**
```powershell
# Esperar 2 segundos y reintentar
timeout /t 2
git push -u origin claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
```

### Error 4: "Updates were rejected"

**Causa:** Alguien más hizo push mientras trabajabas

**Solución:**
```powershell
git pull --rebase origin claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
git push -u origin claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
```

---

## 📋 Checklist Pre-Push

Antes de hacer push, verifica:

- [ ] Estás en la rama correcta (`git branch --show-current`)
- [ ] No hay cambios sin commit (`git status`)
- [ ] Hiciste pull reciente (`git pull origin ...`)
- [ ] Los tests pasan (si los hay)
- [ ] El servidor arranca sin errores (`start-server.bat`)

---

## 🔒 Política de Ramas

**Rama actual:** `claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe`

**Reglas:**
1. ✅ **SIEMPRE** hacer push a esta rama
2. ❌ **NUNCA** hacer push a `main` o `master` directamente
3. ✅ Nombre de rama debe empezar con `claude/`
4. ✅ Nombre de rama debe terminar con el session ID (`01Ybr2mAfT7KboLrZ7pSSpUe`)

**Después del push:**
- Crea un Pull Request para merge a la rama principal
- Espera revisión (si aplica)
- Merge cuando esté aprobado

---

## 📊 Commits Actuales en esta Rama

```
5065d6f - docs: Add comprehensive integration status document
05a5640 - fix: Add scripts to populate lastMessage fields in conversations
7d3cb32 - fix: Make /initial endpoint work by extracting token manually
f679c10 - debug: Add temporary test endpoint to bypass auth middleware
5019c14 - fix: Use onBeforeHandle instead of derive for auth middleware
```

**Total:** 5 commits listos para push

---

## 🚀 Comandos Rápidos

```powershell
# Ver rama actual
git branch --show-current

# Ver estado
git status

# Ver últimos commits
git log --oneline -5

# Push seguro (después de verificar todo)
git push -u origin claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe

# Ver branches remotos
git branch -r

# Ver diferencias con remote
git diff origin/claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
```

---

## ✅ Siguiente Paso Después del Push

Después de un push exitoso:

1. **Verificar en GitHub** (si tienes acceso web)
   - Ve al repositorio
   - Busca tu rama
   - Verifica que los commits estén ahí

2. **Crear Pull Request** (cuando estés listo)
   ```powershell
   # Si tienes gh CLI instalado
   gh pr create --title "Frontend-Backend Integration" --body "Integración completa de sync endpoint con frontend"
   ```

3. **Informar al equipo**
   - Avisa que hiciste push
   - Comparte el link del PR (si aplica)
   - Documenta cambios importantes

---

**Última actualización:** 2025-11-20
**Estado:** ✅ Listo para push
