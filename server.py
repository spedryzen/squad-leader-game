#!/usr/bin/env python3
# Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

"""
================================================================================
File: server.py
Purpose:
  Provides a standalone HTTP and REST API server for "Squad Leader: Vietnam".
  It combines static file serving for the HTML5/ES6 client with persistent
  server-side disk storage for game saves.

Architecture & Responsibilities:
  1. Static Asset Serving:
     - Serves web application assets (HTML, CSS, ES modules, icons) from the
       workspace root directory using Python's built-in SimpleHTTPRequestHandler.
     - Ensures proper MIME typing for JavaScript modules (.js -> application/javascript).

  2. REST API Persistence Layer:
     - POST /api/save:
       Receives campaign state JSON from client SaveManager. Saves snapshot
       atomically to `saves/squad_leader_save.json` using a temporary file
       replacement strategy to avoid corrupted saves during power/process termination.
       Returns confirmation with sceneId and timestamp.

     - GET /api/load:
       Reads `saves/squad_leader_save.json` and returns the serialized campaign
       state object. Returns HTTP 404 with JSON explanation if no save file exists.

     - POST /api/clear or DELETE /api/save:
       Deletes `saves/squad_leader_save.json` from disk to reset the campaign to
       fresh recruit status.

     - GET /api/status:
       Provides server health status, whether a persistent save exists on disk,
       and its last modification ISO timestamp.

  3. Process & Networking:
     - Binds by default to localhost (127.0.0.1) on port 8080 (configurable via
       CLI argument or PORT environment variable).
     - Multi-threaded request handling via ThreadingHTTPServer for responsive UI interaction.
================================================================================
"""

import os
import sys
import json
import datetime
import mimetypes
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# Initialize correct MIME types for modern web browser compatibility
mimetypes.init()
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/json', '.json')

# Workspace root directory where static assets reside
WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))

# Dedicated directory and filepath for persistent JSON campaign saves
SAVES_DIR = os.path.join(WORKSPACE_DIR, 'saves')
SAVE_FILE = os.path.join(SAVES_DIR, 'squad_leader_save.json')

# Ensure the saves directory exists on disk
os.makedirs(SAVES_DIR, exist_ok=True)


class SquadLeaderRequestHandler(SimpleHTTPRequestHandler):
    """
    HTTP Request Handler combining static web serving with
    disk-backed REST API endpoints for game persistence.
    """

    def __init__(self, *args, **kwargs):
        # Serve static files from workspace root
        super().__init__(*args, directory=WORKSPACE_DIR, **kwargs)

    def _send_json_response(self, status_code: int, payload: dict):
        """Helper to send standardized JSON response with CORS headers."""
        response_data = json.dumps(payload, ensure_ascii=False, indent=2).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(response_data)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.end_headers()
        self.wfile.write(response_data)

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_GET(self):
        """Handle GET requests for API endpoints or fallback to static files."""
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path == '/api/status':
            has_save = os.path.isfile(SAVE_FILE)
            last_modified = None
            if has_save:
                mtime = os.path.getmtime(SAVE_FILE)
                last_modified = datetime.datetime.fromtimestamp(mtime, tz=datetime.timezone.utc).isoformat()

            self._send_json_response(200, {
                "status": "ok",
                "hasSave": has_save,
                "lastModified": last_modified,
                "saveFile": "saves/squad_leader_save.json"
            })
            return

        if path == '/api/load':
            if not os.path.isfile(SAVE_FILE):
                self._send_json_response(404, {
                    "success": False,
                    "message": "No save file found on server"
                })
                return

            try:
                with open(SAVE_FILE, 'r', encoding='utf-8') as f:
                    save_data = json.load(f)

                self._send_json_response(200, {
                    "success": True,
                    "data": save_data
                })
            except Exception as err:
                self._send_json_response(500, {
                    "success": False,
                    "error": f"Failed to read save file: {err}"
                })
            return

        # Fallback to standard static file serving
        super().do_GET()

    def do_POST(self):
        """Handle POST requests for state persistence and save clearing."""
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path == '/api/save':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length <= 0:
                    self._send_json_response(400, {
                        "success": False,
                        "error": "Empty request body"
                    })
                    return

                body_bytes = self.rfile.read(content_length)
                save_data = json.loads(body_bytes.decode('utf-8'))

                # Atomic write: write to temp file then replace target file
                temp_file = os.path.join(SAVES_DIR, f"squad_leader_save.tmp.{os.getpid()}")
                with open(temp_file, 'w', encoding='utf-8') as f:
                    json.dump(save_data, f, indent=2, ensure_ascii=False)

                os.replace(temp_file, SAVE_FILE)

                scene_id = save_data.get('sceneId', 'unknown')
                timestamp = save_data.get('timestamp') or datetime.datetime.now(datetime.timezone.utc).isoformat()

                self._send_json_response(200, {
                    "success": True,
                    "message": "Saved to server disk",
                    "sceneId": scene_id,
                    "timestamp": timestamp
                })
            except Exception as err:
                # Clean up temp file if present
                temp_file = os.path.join(SAVES_DIR, f"squad_leader_save.tmp.{os.getpid()}")
                if os.path.isfile(temp_file):
                    try:
                        os.remove(temp_file)
                    except OSError:
                        pass

                self._send_json_response(400, {
                    "success": False,
                    "error": f"Failed to write save to server: {err}"
                })
            return

        if path == '/api/clear':
            try:
                if os.path.isfile(SAVE_FILE):
                    os.remove(SAVE_FILE)
                self._send_json_response(200, {
                    "success": True,
                    "message": "Server save cleared"
                })
            except Exception as err:
                self._send_json_response(500, {
                    "success": False,
                    "error": f"Failed to clear save file: {err}"
                })
            return

        self._send_json_response(404, {
            "success": False,
            "error": f"Endpoint '{path}' not found"
        })

    def do_DELETE(self):
        """Handle DELETE requests for save clearing."""
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path in ('/api/save', '/api/clear'):
            try:
                if os.path.isfile(SAVE_FILE):
                    os.remove(SAVE_FILE)
                self._send_json_response(200, {
                    "success": True,
                    "message": "Server save cleared"
                })
            except Exception as err:
                self._send_json_response(500, {
                    "success": False,
                    "error": f"Failed to clear save file: {err}"
                })
            return

        self._send_json_response(404, {
            "success": False,
            "error": f"Endpoint '{path}' not found"
        })


def run_server():
    """Starts the ThreadingHTTPServer with configured port."""
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    else:
        port = int(os.environ.get('PORT', 8080))

    server_address = ('127.0.0.1', port)
    httpd = ThreadingHTTPServer(server_address, SquadLeaderRequestHandler)
    print(f"Squad Leader: Vietnam server running on http://127.0.0.1:{port}")
    print(f"Serving files from: {WORKSPACE_DIR}")
    print(f"Persistent saves path: {SAVE_FILE}")
    sys.stdout.flush()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server gracefully...")
        httpd.server_close()


if __name__ == '__main__':
    run_server()
