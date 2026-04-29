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

ArcadeNetworkClient.attributes.add("playerTemplate", {
  type: "entity",
  title: "Player Prefab/Template (optional)"
});

ArcadeNetworkClient.attributes.add("remotePlayerManagerEntity", {
  type: "entity",
  title: "Remote Player Manager Entity (optional)"
});

ArcadeNetworkClient.attributes.add("localPlayerEntity", {
  type: "entity",
  title: "Local Player Entity (optional)"
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
  this._resolvedPlayerTemplate = this.playerTemplate || null;
  this._resolvedRemotePlayerManagerEntity = this.remotePlayerManagerEntity || null;
  this._resolvedLocalPlayerEntity = this.localPlayerEntity || null;

  console.log("[ArcadeNetworkClient] Resolved attributes", {
    serverUrl: this._serverUrl,
    roomName: this._roomName,
    hasPlayerTemplate: !!this._resolvedPlayerTemplate,
    hasRemotePlayerManagerEntity: !!this._resolvedRemotePlayerManagerEntity,
    hasLocalPlayerEntity: !!this._resolvedLocalPlayerEntity
  });

  this._validateRequiredAttributes();

  this._connect();
};

ArcadeNetworkClient.prototype._validateRequiredAttributes = function () {
  var missing = [];

  if (!this._serverUrl || !String(this._serverUrl).trim()) {
    missing.push("serverUrl (or window.ArcadeConfig.SERVER_URL)");
  }

  if (!this._roomName || !String(this._roomName).trim()) {
    missing.push("roomName (or window.ArcadeConfig.ROOM_NAME)");
  }

  if (!this._resolvedPlayerTemplate) {
    missing.push("playerTemplate (assign your player prefab/template entity)");
  }

  if (missing.length > 0) {
    var message = "[ArcadeNetworkClient] Missing required attributes: " + missing.join(", ") + ". Fix the script attributes on this entity before launch.";
    console.error(message);
    throw new Error(message);
  }
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

    console.log("[ArcadeNetworkClient] room.state after join", this.room.state);
    console.log(
      "[ArcadeNetworkClient] room.state.players exists:",
      !!(this.room.state && this.room.state.players)
    );

    if (!this.room || !this.room.state) {
      console.error("[ArcadeNetworkClient] joinOrCreate resolved but room/state missing.");
      return;
    }

    this._bindStateListeners();

    this.room.onStateChange(function () {
      if (!this._hasBoundPlayers && this.room && this.room.state && this.room.state.players) {
        console.log("[ArcadeNetworkClient] players map appeared after state patch; binding listeners now.");
        this._bindStateListeners();
      }
    }.bind(this));

    this.room.onLeave((code) => {
      console.warn("[ArcadeNetworkClient] Left room", code);
      this._emit("disconnected", { code: code });
    });

    this.room.onError((code, message) => {
      console.error("[ArcadeNetworkClient] Room error", code, message);
    });
  } catch (err) {
    var hasRoom = !!this.room;
    var hasState = !!(this.room && this.room.state);
    var hasPlayers = !!(this.room && this.room.state && this.room.state.players);

    if (!hasPlayers) {
      console.error("[ArcadeNetworkClient] Connection failed: missing state.players", {
        hasRoom: hasRoom,
        hasState: hasState
      }, err);
      return;
    }

    console.error("[ArcadeNetworkClient] Connection failed", err);
  }
};

ArcadeNetworkClient.prototype._bindStateListeners = function () {
  var self = this;

  if (!this.room || !this.room.state) {
    console.error("[ArcadeNetworkClient] Cannot bind state listeners: room or room.state is missing.");
    return;
  }

  if (!this.room.state.players) {
    var stateKeys = Object.keys(this.room.state || {});
    console.error("[ArcadeNetworkClient] Cannot bind players listeners: missing state.players. Available state keys:", stateKeys);

    if (!this._hasRetriedBind) {
      this._hasRetriedBind = true;
      setTimeout(function () {
        console.warn("[ArcadeNetworkClient] Retrying players listener bind on next tick.");
        this._bindStateListeners();
      }.bind(this), 0);
    }

    return;
  }

  if (this._hasBoundPlayers) {
    return;
  }

  this._hasBoundPlayers = true;

  this.room.state.players.onAdd(function (player, sessionId) {
    console.log("[ArcadeNetworkClient] player added", sessionId, player);

    self._emit("remoteAdded", {
      sessionId: sessionId,
      id: player.id,
      x: player.x,
      y: player.y,
      z: player.z,
      rotY: typeof player.rotY === "number" ? player.rotY : (player.yaw || 0),
      name: player.name
    });

    player.onChange(function () {
      console.log("[ArcadeNetworkClient] player changed", sessionId, player);
      self._emit("remoteUpdated", {
        sessionId: sessionId,
        id: player.id,
        x: player.x,
        y: player.y,
        z: player.z,
        rotY: typeof player.rotY === "number" ? player.rotY : (player.yaw || 0),
        name: player.name
      });
    });
  });

  this.room.state.players.onRemove(function (_player, sessionId) {
    console.log("[ArcadeNetworkClient] player removed", sessionId);
    self._emit("remoteRemoved", { sessionId: sessionId });
  });
};

ArcadeNetworkClient.prototype.sendMove = function (position, rotY, name) {
  if (!this.room) {
    return;
  }

  this.room.send("move", {
    x: position.x,
    y: position.y,
    z: position.z,
    rotY: rotY,
    yaw: rotY,
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
