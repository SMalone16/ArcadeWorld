/* global Colyseus, pc, window */

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

ArcadeNetworkClient.attributes.add("autoConnect", {
  type: "boolean",
  default: true,
  title: "Auto Connect",
  description: "Connect immediately on initialize. Disable when using PregameOverlay."
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

ArcadeNetworkClient.attributes.add("enableOfflineFallback", {
  type: "boolean",
  default: true,
  title: "Enable Offline Fallback"
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
  this.isConnected = false;
  this.lastNetworkError = "";
  this._remoteSessionIds = {};
  this._hasBoundPlayers = false;
  this._isOfflineMode = false;
  this._isConnecting = false;
  this.selectedProfile = null;

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

  if (this.autoConnect) {
    this._setGameState("playing");
    this._connect();
  } else {
    console.log("[ArcadeNetworkClient] Auto connect disabled; waiting for pregame profile.");
  }
};

ArcadeNetworkClient.prototype._validateRequiredAttributes = function () {
  var hasError = false;

  if (!this._serverUrl || !String(this._serverUrl).trim()) {
    this._setNetworkError("Missing serverUrl. Assign serverUrl attribute or window.ArcadeConfig.SERVER_URL.");
    hasError = true;
  }

  if (!this._roomName || !String(this._roomName).trim()) {
    this._setNetworkError("Missing roomName. Assign roomName attribute or window.ArcadeConfig.ROOM_NAME.");
    hasError = true;
  }

  if (!this._resolvedLocalPlayerEntity) {
    this._setNetworkError("Missing localPlayerEntity. Assign the controllable local player entity.");
    hasError = true;
  }

  if (!this._resolvedPlayerTemplate) {
    this._setNetworkError("Missing playerTemplate. Assign template/prefab entity for remote players.");
    hasError = true;
  }

  if (!this._spawnPointsRoot) {
    this._setNetworkError("Missing spawnPointsRoot. Assign the SpawnPoints parent entity.");
    if (!this.enableOfflineFallback) {
      hasError = true;
    }
  }

  if (this._spawnPoints.length === 0) {
    this._setNetworkError("Spawn points missing. Ensure SpawnPoints has enabled child entities to use as spawn points.");
    if (!this.enableOfflineFallback) {
      hasError = true;
    }
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

ArcadeNetworkClient.prototype.connectWithProfile = async function (profile) {
  this.selectedProfile = this._sanitizeProfile(profile);
  window.ArcadePlayerProfile = this.selectedProfile;
  this.app.arcadePlayerProfile = this.selectedProfile;
  console.log("[ArcadeNetworkClient] connectWithProfile using", this.selectedProfile);
  return this._connect();
};

ArcadeNetworkClient.prototype._setGameState = function (state) {
  this.app.arcadeGameState = state;
  window.ArcadeWorldGameState = state;
  this.app.fire("arcade:stateChanged", state);
  if (state === "playing") {
    this.app.fire("arcade:startGame", this.selectedProfile || this.app.arcadePlayerProfile || window.ArcadePlayerProfile || null);
  }
};

ArcadeNetworkClient.prototype._connect = async function () {
  if (this.room || this._isConnecting) {
    if (this.room && this.selectedProfile) {
      this._sendProfile();
      this._applyLocalProfile();
    }
    return this.room;
  }

  this._isConnecting = true;
  if (typeof Colyseus === "undefined") {
    this._setNetworkError("Colyseus client library missing.");
    this._startOfflineFallback("colyseus missing");
    this._isConnecting = false;
    return null;
  }

  try {
    this.client = new Colyseus.Client(this._serverUrl);
    this.room = await this.client.joinOrCreate(this._roomName);
  } catch (err) {
    this._setNetworkError("Join failed: " + this._formatError(err), err);
    this._startOfflineFallback("join failed");
    this._isConnecting = false;
    return null;
  }

  this.sessionId = this.room.sessionId;
  this.isConnected = true;
  this.lastNetworkError = "";
  console.log("[ArcadeNetworkClient] Joined room", this._roomName, this.sessionId);
  this._emit("connected", { sessionId: this.sessionId });

  this._sendProfile();
  this._spawnLocalPlayer();
  this._bindStateListeners();

  this.room.onStateChange(function () {
    if (!this._hasBoundPlayers) {
      this._bindStateListeners();
    }
  }.bind(this));

  this._isConnecting = false;

  this.room.onLeave(function (code) {
    this.isConnected = false;
    this._setNetworkError("Left room with code " + code);
    this._emit("disconnected", { code: code });
  }.bind(this));

  return this.room;
};

ArcadeNetworkClient.prototype._startOfflineFallback = function (reason) {
  if (!this.enableOfflineFallback || this._isOfflineMode) {
    return;
  }

  this._isOfflineMode = true;
  this.isConnected = false;
  if (!this.lastNetworkError) {
    this.lastNetworkError = "Offline fallback: " + reason;
  }
  console.warn("[ArcadeNetworkClient] Offline fallback enabled (" + reason + "). Local player remains playable.");
  this._spawnLocalPlayer();
};

ArcadeNetworkClient.prototype._spawnLocalPlayer = function () {
  var local = this._resolvedLocalPlayerEntity;
  if (!local) {
    return;
  }

  var spawnPosition = local.getPosition().clone();
  if (this._spawnPoints.length > 0) {
    var spawnEntity = this._selectSpawnPoint();
    spawnPosition = spawnEntity.getPosition().clone();
    console.log("[ArcadeNetworkClient] Selected spawn point: " + spawnEntity.name + " @", spawnPosition);
  } else {
    console.warn("[ArcadeNetworkClient] No spawn points available. Keeping local player at current position.");
  }

  local.setPosition(spawnPosition);
  local.enabled = true;
  this._enableLocalControlScripts(local);
  this._applyLocalProfile();

  console.log("[ArcadeNetworkClient] Local player spawned");

  var rotY = local.getEulerAngles().y;
  var spawnName = this.selectedProfile && this.selectedProfile.name ? this.selectedProfile.name : "Student";
  if (!this.selectedProfile || !this.selectedProfile.name) {
    console.log("[ArcadeNetworkClient] Missing selected profile at spawn; using Student fallback for initial move.");
  }
  console.log("[ArcadeNetworkClient] Sending spawn name: " + spawnName);
  this.sendMove(spawnPosition, rotY, spawnName);
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
    console.log("[ArcadeNetworkClient] Local player controller enabled");
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
    if (sessionId !== self.sessionId) {
      self._remoteSessionIds[sessionId] = true;
    }
    self._emit("remoteAdded", self._toPlayerPayload(player, sessionId));

    var playerCallbacks = $(player);
    playerCallbacks.listen("x", function () { self._emit("remoteUpdated", self._toPlayerPayload(player, sessionId)); });
    playerCallbacks.listen("y", function () { self._emit("remoteUpdated", self._toPlayerPayload(player, sessionId)); });
    playerCallbacks.listen("z", function () { self._emit("remoteUpdated", self._toPlayerPayload(player, sessionId)); });
    playerCallbacks.listen("rotY", function () { self._emit("remoteUpdated", self._toPlayerPayload(player, sessionId)); });
    playerCallbacks.listen("name", function () { self._emit("remoteUpdated", self._toPlayerPayload(player, sessionId)); });
    playerCallbacks.listen("color", function () { self._emit("remoteUpdated", self._toPlayerPayload(player, sessionId)); });
    playerCallbacks.listen("hatId", function () { self._emit("remoteUpdated", self._toPlayerPayload(player, sessionId)); });
  });

  stateCallbacks.players.onRemove(function (_player, sessionId) {
    console.log("[ArcadeNetworkClient] Remote player removed", sessionId);
    delete self._remoteSessionIds[sessionId];
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
    name: player.name,
    color: player.color,
    hatId: player.hatId
  };
};

ArcadeNetworkClient.prototype._sendProfile = function () {
  if (!this.room || !this.selectedProfile) {
    return;
  }

  console.log("[ArcadeNetworkClient] Sending profile to server", this.selectedProfile);
  this.room.send("profile", this.selectedProfile);
};

ArcadeNetworkClient.prototype._sanitizeProfile = function (profile) {
  var safe = profile || {};
  var name = typeof safe.name === "string" ? safe.name.trim().slice(0, 24) : "";
  var color = typeof safe.color === "string" && /^#[0-9a-fA-F]{6}$/.test(safe.color) ? safe.color : "#44aaff";
  var hatId = safe.hatId === "Top Hat" || safe.hatId === "Western" || safe.hatId === "No Hat" ? safe.hatId : "No Hat";

  return {
    name: name || this._fallbackName(),
    color: color,
    hatId: hatId
  };
};

ArcadeNetworkClient.prototype._fallbackName = function () {
  console.log("[ArcadeNetworkClient] Empty profile name; using Student fallback.");
  return "Student";
};

ArcadeNetworkClient.prototype._applyLocalProfile = function () {
  var local = this._resolvedLocalPlayerEntity;
  if (!local || !this.selectedProfile) {
    return;
  }

  if (local.script && local.script.localPlayerController && local.script.localPlayerController._onProfileReady) {
    local.script.localPlayerController._onProfileReady(this.selectedProfile);
  }

  if (local.script && local.script.playerAppearance && local.script.playerAppearance.applyProfile) {
    local.script.playerAppearance.applyProfile(this.selectedProfile);
    return;
  }

  if (window.ArcadePlayerAppearance && window.ArcadePlayerAppearance.applyToEntity) {
    window.ArcadePlayerAppearance.applyToEntity(local, this.selectedProfile);
  }
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

ArcadeNetworkClient.prototype.getRemotePlayerCount = function () {
  var count = 0;
  for (var sessionId in this._remoteSessionIds) {
    if (Object.prototype.hasOwnProperty.call(this._remoteSessionIds, sessionId)) {
      count += 1;
    }
  }
  return count;
};

ArcadeNetworkClient.prototype.getDebugSnapshot = function () {
  return {
    connected: this.isConnected === true && !!this.room && !this._isOfflineMode,
    sessionId: this.sessionId || "",
    roomName: this._roomName || "",
    remotePlayersKnown: this.getRemotePlayerCount(),
    lastNetworkError: this.lastNetworkError || "",
    serverUrl: this._serverUrl || "",
    offlineMode: this._isOfflineMode === true,
    selectedProfile: this.selectedProfile || null,
    autoConnect: this.autoConnect === true
  };
};

ArcadeNetworkClient.prototype._setNetworkError = function (message, rawError) {
  this.lastNetworkError = message || "Unknown network error";
  if (rawError) {
    console.error("[ArcadeNetworkClient] " + this.lastNetworkError, rawError);
  } else {
    console.error("[ArcadeNetworkClient] " + this.lastNetworkError);
  }
};

ArcadeNetworkClient.prototype._formatError = function (err) {
  if (!err) {
    return "unknown error";
  }

  if (err.message) {
    return err.message;
  }

  return String(err);
};

ArcadeNetworkClient.prototype.onEvent = function (eventName, callback) {
  if (!this.callbacks[eventName]) return;
  this.callbacks[eventName].push(callback);
};

ArcadeNetworkClient.prototype._emit = function (eventName, payload) {
  var listeners = this.callbacks[eventName] || [];
  for (var i = 0; i < listeners.length; i++) listeners[i](payload);
};
