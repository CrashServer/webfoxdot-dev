#!/usr/bin/env python3
# WebSocket relay — bridges webfoxDot (port 8765) and VJ Workshop (any port)
# that can't share a BroadcastChannel because they're on different origins.
# All connected clients receive every message any client sends.
#
#   python3 relay.py          → listens on ws://localhost:8766
#
import asyncio, json, sys
import websockets
from websockets.server import serve

HOST = '127.0.0.1'
PORT = 8766

clients = set()

async def handler(ws):
    clients.add(ws)
    try:
        async for raw in ws:
            # broadcast to all OTHER clients (sender already has it locally)
            dead = set()
            for c in clients:
                if c is ws: continue
                try:
                    await c.send(raw)
                except websockets.exceptions.ConnectionClosed:
                    dead.add(c)
            clients.difference_update(dead)
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        clients.discard(ws)

async def main():
    print(f"crashdot relay → ws://{HOST}:{PORT}  (Ctrl+C to stop)")
    async with serve(handler, HOST, PORT):
        await asyncio.Future()   # run forever

asyncio.run(main())
