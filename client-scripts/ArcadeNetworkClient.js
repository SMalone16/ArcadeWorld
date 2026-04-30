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
  title: "Player Prefab/Template (required for remotes)"
});

ArcadeNetworkClient.attributes.add("remotePlayerManagerEntity", {
  type: "entity",
  title: "Remote Player Manager Entity (optional)"
});

ArcadeNetworkClient.attributes.add("localPlayerEntity", {
  type: "entity",
  title: "Local Player Entity"
});

ArcadeNetworkClient.attributes.add("spawnPointsRoot", {
  type: "entity",
  title: "Spawn Points Root (SpawnPoints)"
});

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
  this._hasBoundPlayers = false;

  var cfg = window.ArcadeConfig || {};
  this._serverUrl = this.serverUrl || cfg.SERVER_URL || "";
  this._roomName = this.roomName || cfg.ROOM_NAME || "arcade_lobby";
  this._resolvedPlayerTemplate = this.playerTemplate || null;
  this._resolvedLocalPlayerEntity = this.localPlayerEntity || null;
  this._spawnPointsRoot = this.spawnPointsRoot || null;
  this._spawnPoints = this._collectSpawnPoints();

  if (!this._validateRequiredAttributes()) {
    return;
  }

  this._connect();
};

ArcadeNetworkClient.prototype._validateRequiredAttributes = function () {
  var hasError = false;

  if (!this._serverUrl || !String(this._serverUrl).trim()) {
    console.error("[ArcadeNetworkClient] Missing serverUrl. Assign serverUrl attribute or window.ArcadeConfig.SERVER_URL.");
    hasError = true;
  }

  if (!this._roomName || !String(this._roomName).trim()) {
    console.error("[ArcadeNetworkClient] Missing roomName. Assign roomName attribute or window.ArcadeConfig.ROOM_NAME.");
    hasError = true;
  }

  if (!this._resolvedLocalPlayerEntity) {
    console.error("[ArcadeNetworkClient] Missing localPlayerEntity. Assign the controllable local player entity.");
    hasError = true;
  }

  if (!this._resolvedPlayerTemplate) {
    console.error("[ArcadeNetworkClient] Missing playerTemplate. Assign template/prefab entity for remote players.");
    hasError = true;
  }

  if (!this._spawnPointsRoot) {
    console.error("[ArcadeNetworkClient] Missing spawnPointsRoot. Assign the SpawnPoints parent entity.");
    hasError = true;
  }

  if (this._spawnPoints.length === 0) {
    console.error("[ArcadeNetworkClient] Spawn points missing. Ensure SpawnPoints has enabled child entities to use as spawn points.");
    hasError = true;
  }

  return !hasError;
};

ArcadeNetworkClient.prototype._collectSpawnPoints = function () {
  if (!this.spawnPointsRoot) {
    return [];
  }

  var children = this.spawnPointsRoot.children || [];
  var enabled = [];
  for (var i = 0; i < children.length; i++) {
    if (children[i] && children[i].enabled) {
      enabled.push(children[i]);
    }
  }

  console.log("[ArcadeNetworkClient] Spawn points found: " + enabled.length);
  return enabled;
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
    console.error("[ArcadeNetworkClient] Join failed.", err);
    return;
  }

  this.sessionId = this.room.sessionId;
  console.log("[ArcadeNetworkClient] Joined room", this._roomName, this.sessionId);
  this._emit("connected", { sessionId: this.sessionId });

  this._spawnLocalPlayer();
  this._bindStateListeners();

  this.room.onStateChange(function () {
    if (!this._hasBoundPlayers) {
      this._bindStateListeners();
    }
  }.bind(this));

  this.room.onLeave(function (code) {
    console.warn("[ArcadeNetworkClient] Left room", code);
    this._emit("disconnected", { code: code });
  }.bind(this));
};

ArcadeNetworkClient.prototype._spawnLocalPlayer = function () {
  var local = this._resolvedLocalPlayerEntity;
  if (!local || this._spawnPoints.length === 0) {
    return;
  }

  var spawnEntity = this._selectSpawnPoint();
  var spawnPosition = spawnEntity.getPosition().clone();

  console.log("[ArcadeNetworkClient] Selected spawn point: " + spawnEntity.name + " @", spawnPosition);

  local.setPosition(spawnPosition);
  local.enabled = true;
  this._enableLocalControlScripts(local);

  console.log("[ArcadeNetworkClient] Local player spawned at:", spawnPosition);
  console.log("[ArcadeNetworkClient] Local controls enabled");

  var rotY = local.getEulerAngles().y;
  this.sendMove(spawnPosition, rotY, null);
};

ArcadeNetworkClient.prototype._selectSpawnPoint = function () {
  if (this._spawnPoints.length === 1) {
    return this._spawnPoints[0];
  }

  var seed = 0;
  if (this.sessionId) {
    for (var i = 0; i < this.sessionId.length; i++) {
      seed = ((seed << 5) - seed) + this.sessionId.charCodeAt(i);
      seed |= 0;
    }
  } else {
    seed = Math.floor(Math.random() * 10000);
  }

  var idx = Math.abs(seed) % this._spawnPoints.length;
  return this._spawnPoints[idx];
};

ArcadeNetworkClient.prototype._enableLocalControlScripts = function (localEntity) {
  if (!localEntity.script) {
    return;
  }

  var scripts = localEntity.script;
  if (scripts.localPlayerController) {
    scripts.localPlayerController.enabled = true;
  }
  if (scripts.characterController) {
    scripts.characterController.enabled = true;
  }
  if (scripts.firstPersonCamera) {
    scripts.firstPersonCamera.enabled = true;
  }
};

ArcadeNetworkClient.prototype._bindStateListeners = function () {
  if (this._hasBoundPlayers || !this.room || !this.room.state || typeof Colyseus.getStateCallbacks !== "function") {
    return false;
  }

  var self = this;
  var $ = Colyseus.getStateCallbacks(this.room);
  var stateCallbacks = $(this.room.state);
  if (!stateCallbacks || !stateCallbacks.players) {
    return false;
  }

  this._hasBoundPlayers = true;

  stateCallbacks.players.onAdd(function (player, sessionId) {
    console.log("[ArcadeNetworkClient] Remote player added", sessionId);
    self._emit("remoteAdded", self._toPlayerPayload(player, sessionId));

    var playerCallbacks = $(player);
    playerCallbacks.listen("x", function () { self._emit("remoteUpdated", self._toPlayerPayload(player, sessionId)); });
    playerCallbacks.listen("y", function () { self._emit("remoteUpdated", self._toPlayerPayload(player, sessionId)); });
    playerCallbacks.listen("z", function () { self._emit("remoteUpdated", self._toPlayerPayload(player, sessionId)); });
    playerCallbacks.listen("rotY", function () { self._emit("remoteUpdated", self._toPlayerPayload(player, sessionId)); });
  });

  stateCallbacks.players.onRemove(function (_player, sessionId) {
    console.log("[ArcadeNetworkClient] Remote player removed", sessionId);
    self._emit("remoteRemoved", { sessionId: sessionId });
  });

  return true;
};

ArcadeNetworkClient.prototype._toPlayerPayload = function (player, sessionId) {
  return {
    sessionId: sessionId,
    id: player.id,
    x: player.x,
    y: player.y,
    z: player.z,
    rotY: typeof player.rotY === "number" ? player.rotY : (player.yaw || 0),
    name: player.name
  };
};

ArcadeNetworkClient.prototype.sendMove = function (position, rotY, name) {
  if (!this.room) return;

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
  if (!this.callbacks[eventName]) return;
  this.callbacks[eventName].push(callback);
};

ArcadeNetworkClient.prototype._emit = function (eventName, payload) {
  var listeners = this.callbacks[eventName] || [];
  for (var i = 0; i < listeners.length; i++) listeners[i](payload);
};
