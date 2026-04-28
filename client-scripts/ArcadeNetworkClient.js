/* global Colyseus, pc */

var ArcadeNetworkClient = pc.createScript("arcadeNetworkClient");

ArcadeNetworkClient.attributes.add("serverUrl", {
  type: "string",
  default: "",
  title: "Server URL (optional override)",
  description: "Leave empty to use window.ArcadeConfig.SERVER_URL"
});

ArcadeNetworkClient.attributes.add("roomName", {
  type: "string",
  default: "",
  title: "Room Name (optional override)",
  description: "Leave empty to use window.ArcadeConfig.ROOM_NAME"
});

/**
 * Minimal event-based wrapper around Colyseus.
 * Other scripts (LocalPlayerController, RemotePlayerManager) subscribe to events.
 */
ArcadeNetworkClient.prototype.initialize = function () {
  this.callbacks = {
    connected: [],
    disconnected: [],
    remoteAdded: [],
    remoteUpdated: [],
    remoteRemoved: []
  };

  this.sessionId = null;
  this.room = null;
  this.client = null;

  var cfg = window.ArcadeConfig || {};
  this._serverUrl = this.serverUrl || cfg.SERVER_URL || "ws://localhost:2567";
  this._roomName = this.roomName || cfg.ROOM_NAME || "arcade_lobby";

  this._connect();
};

ArcadeNetworkClient.prototype._connect = async function () {
  if (typeof Colyseus === "undefined") {
    console.error("[ArcadeNetworkClient] Colyseus client library missing.");
    return;
  }

  try {
    this.client = new Colyseus.Client(this._serverUrl);
    this.room = await this.client.joinOrCreate(this._roomName);
    this.sessionId = this.room.sessionId;

    console.log("[ArcadeNetworkClient] Connected", this.sessionId);
    this._emit("connected", { sessionId: this.sessionId });

    this._bindStateListeners();

    this.room.onLeave((code) => {
      console.warn("[ArcadeNetworkClient] Left room", code);
      this._emit("disconnected", { code: code });
    });

    this.room.onError((code, message) => {
      console.error("[ArcadeNetworkClient] Room error", code, message);
    });
  } catch (err) {
    console.error("[ArcadeNetworkClient] Connection failed", err);
  }
};

ArcadeNetworkClient.prototype._bindStateListeners = function () {
  var self = this;

  this.room.state.players.onAdd(function (player, sessionId) {
    self._emit("remoteAdded", {
      sessionId: sessionId,
      x: player.x,
      y: player.y,
      z: player.z,
      yaw: player.yaw,
      name: player.name
    });

    player.onChange(function () {
      self._emit("remoteUpdated", {
        sessionId: sessionId,
        x: player.x,
        y: player.y,
        z: player.z,
        yaw: player.yaw,
        name: player.name
      });
    });
  });

  this.room.state.players.onRemove(function (_player, sessionId) {
    self._emit("remoteRemoved", { sessionId: sessionId });
  });
};

ArcadeNetworkClient.prototype.sendMove = function (position, yaw, name) {
  if (!this.room) {
    return;
  }

  this.room.send("move", {
    x: position.x,
    y: position.y,
    z: position.z,
    yaw: yaw,
    name: name
  });
};

ArcadeNetworkClient.prototype.onEvent = function (eventName, callback) {
  if (!this.callbacks[eventName]) {
    console.warn("[ArcadeNetworkClient] Unknown event", eventName);
    return;
  }

  this.callbacks[eventName].push(callback);
};

ArcadeNetworkClient.prototype._emit = function (eventName, payload) {
  var listeners = this.callbacks[eventName] || [];
  for (var i = 0; i < listeners.length; i++) {
    listeners[i](payload);
  }
};
