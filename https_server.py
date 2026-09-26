import http.server
import ssl
import os
import subprocess
import socket

os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Auto-generar certificado si no existe
if not os.path.exists('cert.pem') or not os.path.exists('key.pem'):
    print("Generando certificado SSL autofirmado...")
    subprocess.run([
        'openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
        '-keyout', 'key.pem', '-out', 'cert.pem', '-days', '365',
        '-subj', '/CN=localhost'
    ], check=True)

def get_lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return 'localhost'

server_address = ('0.0.0.0', 4322)
httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)

context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(certfile='cert.pem', keyfile='key.pem')
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

lan_ip = get_lan_ip()
print(f"Servidor HTTPS activo en https://localhost:4322/ y https://{lan_ip}:4322/")
httpd.serve_forever()
