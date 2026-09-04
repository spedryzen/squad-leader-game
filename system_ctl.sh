#!/usr/bin/env bash
# Copyright (c) 2026 Ed Grant, Email: ed@edgrant.com, Phone: (951) 610-8817

PORT=8000
PID_FILE=".server.pid"

start() {
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo "Squad Leader server is already running (PID $(cat "$PID_FILE"))."
        echo "Access it here: http://localhost:$PORT/v2/index.html"
        return
    fi
    echo "Starting Squad Leader: Vietnam server on port $PORT..."
    python3 -m http.server $PORT > server.log 2>&1 &
    echo $! > "$PID_FILE"
    echo "Server started!"
    echo "Play the game at: http://localhost:$PORT/v2/index.html"
}

stop() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 $PID 2>/dev/null; then
            echo "Stopping Squad Leader server (PID $PID)..."
            kill $PID
            echo "Server stopped."
        else
            echo "Server was not running (stale PID file)."
        fi
        rm -f "$PID_FILE"
    else
        echo "No Squad Leader server is currently running."
    fi
}

restart() {
    stop
    sleep 1
    start
}

status() {
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo "Squad Leader server is RUNNING (PID $(cat "$PID_FILE"))."
        echo "Access it here: http://localhost:$PORT/v2/index.html"
    else
        echo "Squad Leader server is STOPPED."
    fi
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        echo ""
        echo "Note: To completely reinitialize your game save, use the 'New Game (Reset)'"
        echo "or 'Clear Save' buttons inside the game's web dashboard (localStorage)."
        exit 1
        ;;
esac
