"""Synthetic UI only; binds loopback and never connects to a database."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os

os.chdir(Path(__file__).parent)


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?')[0] not in ['/app.js', '/app.css', '/styles.css']:
            self.path = '/index.html'
        super().do_GET()


ThreadingHTTPServer(('127.0.0.1', 4318), Handler).serve_forever()
