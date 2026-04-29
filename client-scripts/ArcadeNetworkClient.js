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
  this.lastNetworkError = "";

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

ArcadeNetworkClient.prototype._failConnection = function (reason, err) {
  var message = "Join failed: " + reason;
  this._setNetworkError(message);
  if (err) {
    console.error("[ArcadeNetworkClient] " + message, err);
    return;
  }

  console.error("[ArcadeNetworkClient] " + message);
};

ArcadeNetworkClient.prototype._connect = async function () {
  if (typeof Colyseus === "undefined") {
    console.error("[ArcadeNetworkClient] Colyseus client library missing.");
    return;
  }

  try {
    this.client = new Colyseus.Client(this._serverUrl);
    this.room = await this.client.joinOrCreate(this._roomName);
  } catch (err) {
    this._failConnection("Unable to join room \"" + this._roomName + "\".", err);
    return;
  }

  this.sessionId = this.room.sessionId;

  console.log("[ArcadeNetworkClient] Connected", this.sessionId);
  this._emit("connected", { sessionId: this.sessionId });

  console.log("room", this.room);
  console.log("room.state", this.room ? this.room.state : null);
  console.log("room.state.players", this.room && this.room.state ? this.room.state.players : null);

  var didBind = this._bindStateListeners();
  if (!didBind) {
    console.warn("[ArcadeNetworkClient] State listeners not ready immediately after join; waiting for state updates.");
  }

  this.room.onStateChange(function () {
    if (!this._hasBoundPlayers) {
      var bound = this._bindStateListeners();
      if (!bound) {
        console.warn("[ArcadeNetworkClient] Waiting for room.state.players to become available.");
      }
    }
  }.bind(this));

  this.room.onLeave((code) => {
    console.warn("[ArcadeNetworkClient] Left room", code);
    this._emit("disconnected", { code: code });
  });

  this.room.onError((code, message) => {
    console.error("[ArcadeNetworkClient] Room error", code, message);
  });
};

ArcadeNetworkClient.prototype._bindStateListeners = function () {
  var self = this;

  if (this._hasBoundPlayers) {
    return true;
  }

  if (!this.room || !this.room.state) {
    this._setNetworkError("State binding failed: room.state is not ready yet.");
    return false;
  }

  if (!this.room.state.players) {
    this._setNetworkError("State binding failed: " + this._buildMissingStateError("room.state.players"));
    return false;
  }

  if (typeof Colyseus.getStateCallbacks !== "function") {
    this._setNetworkError("State binding failed: Colyseus.getStateCallbacks is unavailable. Use Colyseus 0.16 browser client.");
    return false;
  }

  var $ = Colyseus.getStateCallbacks(this.room);
  if (typeof $ !== "function") {
    this._setNetworkError("State binding failed: unable to obtain Colyseus state callback helper.");
    return false;
  }

  this._hasBoundPlayers = true;

  $(this.room.state).players.onAdd(function (player, sessionId) {
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

    $(player).listen("x", function () {
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

    $(player).listen("y", function () {
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

    $(player).listen("z", function () {
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

    $(player).listen("rotY", function () {
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

  $(this.room.state).players.onRemove(function (_player, sessionId) {
    console.log("[ArcadeNetworkClient] player removed", sessionId);
    self._emit("remoteRemoved", { sessionId: sessionId });
  });

  return true;
};

ArcadeNetworkClient.prototype._buildMissingStateError = function (missingPath) {
  var stateRoot = this.room && this.room.state ? this.room.state : {};
  var topLevelKeys = Object.keys(stateRoot);
  return "Missing required network field \"" + missingPath + "\". Available room.state keys: " + JSON.stringify(topLevelKeys);
};

ArcadeNetworkClient.prototype._setNetworkError = function (message) {
  this.lastNetworkError = message;
  this._renderNetworkError(message);
};

ArcadeNetworkClient.prototype._renderNetworkError = function (message) {
  if (typeof document === "undefined") {
    return;
  }

  var labelId = "arcade-network-error-label";
  var label = document.getElementById(labelId);
  if (!label) {
    label = document.createElement("div");
    label.id = labelId;
    label.style.position = "fixed";
    label.style.bottom = "16px";
    label.style.left = "16px";
    label.style.maxWidth = "70vw";
    label.style.padding = "8px 12px";
    label.style.background = "rgba(0,0,0,0.75)";
    label.style.color = "#ff9b9b";
    label.style.fontFamily = "monospace";
    label.style.fontSize = "12px";
    label.style.zIndex = "9999";
    document.body.appendChild(label);
  }

  label.textContent = message;
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
