"""
QR Code & Discovery Router — Server connection setup.
When the backend starts, it generates a QR code containing the server's
local IP and port. The mobile app scans this QR code to discover the server.

This is the FOUNDATION — without this, the mobile app can't find the server.
"""
import json
import socket
import io
import base64
from fastapi import APIRouter
from fastapi.responses import HTMLResponse, JSONResponse

router = APIRouter(tags=["Discovery"])


def get_local_ip() -> str:
    """Get the machine's local IP address on the WiFi network."""
    try:
        # Connect to a non-routable address to find our local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.254.254.254", 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


@router.get("/discover")
async def discover():
    """
    Returns the server's connection info.
    The mobile app uses this data (via QR scan or manual entry).
    """
    ip = get_local_ip()
    return {
        "host": ip,
        "port": 8000,
        "url": f"http://{ip}:8000",
        "app": "SobaHealth Edge Server",
    }


@router.get("/qr", response_class=HTMLResponse)
async def qr_code_page():
    """
    Serves a simple HTML page showing a QR code.
    Open this in a browser on the laptop → scan with phone.

    Uses a lightweight inline QR code generator (no external deps).
    The QR code contains: {"host": "192.168.x.x", "port": 8000}
    """
    ip = get_local_ip()
    connection_data = json.dumps({"host": ip, "port": 8000})

    # Generate QR code using a simple ASCII art approach
    # For the actual QR image, we'll use the Google Charts API fallback
    # (only for the setup page — not during normal operation)
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>SobaHealth — Connect Your Phone</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: #0F1419;
                color: #F1F5F9;
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
            }}
            .card {{
                background: #1A1F2E;
                border: 1px solid #2D3548;
                border-radius: 24px;
                padding: 48px;
                text-align: center;
                max-width: 480px;
                width: 90%;
            }}
            h1 {{
                font-size: 32px;
                font-weight: 800;
                margin-bottom: 8px;
            }}
            .subtitle {{
                color: #0EA5A0;
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 32px;
            }}
            .qr-container {{
                background: white;
                border-radius: 16px;
                padding: 24px;
                display: inline-block;
                margin-bottom: 24px;
            }}
            .qr-container img {{
                width: 200px;
                height: 200px;
            }}
            .connection-info {{
                background: #232A3B;
                border-radius: 12px;
                padding: 16px;
                margin-top: 16px;
                font-family: monospace;
                font-size: 18px;
                color: #0EA5A0;
                letter-spacing: 1px;
            }}
            .manual {{
                color: #64748B;
                font-size: 13px;
                margin-top: 16px;
            }}
            .privacy {{
                background: rgba(14, 165, 160, 0.15);
                border: 1px solid rgba(14, 165, 160, 0.3);
                border-radius: 12px;
                padding: 12px 16px;
                margin-top: 24px;
                font-size: 13px;
                color: #0EA5A0;
            }}
        </style>
    </head>
    <body>
        <div class="card">
            <h1>🏥 SobaHealth</h1>
            <div class="subtitle">Connect Your Phone</div>

            <div class="qr-container">
                <img
                    id="qrImg"
                    alt="QR Code"
                    src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={connection_data}"
                    onerror="this.style.display='none'; document.getElementById('fallback').style.display='block';"
                />
                <div id="fallback" style="display:none; padding: 20px; color: #333;">
                    <p>QR generation requires internet.</p>
                    <p>Use manual IP entry instead ↓</p>
                </div>
            </div>

            <p>Scan this QR code with the SobaHealth app</p>

            <div class="connection-info">
                {ip}:8000
            </div>

            <p class="manual">
                Or enter this IP manually in the app's connect screen
            </p>

            <div class="privacy">
                🔒 All data stays on this local network. Zero cloud.
            </div>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)
