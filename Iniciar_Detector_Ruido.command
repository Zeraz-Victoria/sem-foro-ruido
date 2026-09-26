#!/bin/bash
# Detector de Ruido Escolar - Script de Inicio Rápido para Mac
cd "$(dirname "$0")"

echo "====================================================="
echo "   Iniciando Detector de Ruido Escolar...           "
echo "====================================================="

# Iniciar servidor local HTTP si no está corriendo
if ! lsof -i:4321 > /dev/null; then
    python3 -m http.server 4321 &
    echo "Servidor HTTP iniciado en puerto 4321"
fi

# Iniciar servidor seguro HTTPS para dispositivos en red local si no está corriendo
if ! lsof -i:4322 > /dev/null; then
    python3 https_server.py &
    echo "Servidor HTTPS iniciado en puerto 4322 (para iPad, celulares y otras computadoras)"
fi

sleep 1

# Abrir en el navegador predeterminado de Mac
open "http://localhost:4321/"

IP_LAN=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "192.168.110.32")

echo ""
echo "✅ Aplicación abierta en tu Mac: http://localhost:4321/"
echo ""
echo "📱 PARA CONECTAR DESDE OTRA COMPUTADORA O TABLET EN LA MISMA RED:"
echo "   Abre en el navegador del otro dispositivo:"
echo "   ➡️  https://${IP_LAN}:4322/"
echo "   (Acepta 'Avanzado -> Continuar' para habilitar permisos de micrófono en red local)"
echo ""
echo "Mantén esta ventana abierta mientras uses el detector en clase."
echo "Presiona Ctrl + C para detener cuando termine tu sesión."
wait
