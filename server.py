import http.server
import socketserver
import os
import json

port = 8000
web_directory = "./" 
html_file = "index.html"

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Content-type', 'text/html')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        http.server.SimpleHTTPRequestHandler.end_headers(self)

httpd = socketserver.TCPServer(("", port), MyHandler)
print(f"Serveur démarré sur le port {port}")
httpd.serve_forever()