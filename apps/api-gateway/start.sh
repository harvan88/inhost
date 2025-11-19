#!/bin/bash
# Script para iniciar el servidor API Gateway
# Uso: ./start.sh

echo "🚀 Iniciando INHOST API Gateway..."
echo ""

# Matar procesos bun anteriores
echo "🔫 Matando procesos bun anteriores..."
pkill -9 bun 2>/dev/null || true
sleep 1

# Iniciar servidor
echo "🦊 Iniciando servidor en puerto 3000..."
cd "$(dirname "$0")"
bun run src/index.ts
