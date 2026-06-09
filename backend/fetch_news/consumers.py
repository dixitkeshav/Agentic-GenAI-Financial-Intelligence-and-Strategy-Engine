import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from . import truedata_bridge as td

logger = logging.getLogger(__name__)


class DashboardConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time dashboard updates (e.g. new sentiment, agent result)."""

    async def connect(self):
        self.room_name = "dashboard"
        self.room_group_name = f"dashboard_{self.room_name}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        ok, msg = False, "disabled"
        if td.is_available():
            ok, msg = td.ws_subscribe()
        await self.send(
            text_data=json.dumps(
                {
                    "type": "ticker_stream_status",
                    "provider": "truedata_ws" if td.is_available() else "rest_poll",
                    "connected": bool(ok),
                    "message": msg,
                }
            )
        )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        # Keep streamer warm across brief UI reconnects (React strict-mode / route changes)
        # to avoid repeated TrueData socket re-open errors.

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            if data.get("type") == "ping":
                await self.send(text_data=json.dumps({"type": "pong"}))
            # Echo or broadcast to group as needed
        except Exception as e:
            logger.warning("DashboardConsumer receive error: %s", e)

    async def dashboard_update(self, event):
        """Send update to client when something changes (e.g. new news, agent run)."""
        await self.send(text_data=json.dumps(event.get("payload", {})))
