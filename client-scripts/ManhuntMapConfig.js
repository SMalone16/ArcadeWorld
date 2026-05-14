/* global pc, document */

var ManhuntMapConfig = pc.createScript("manhuntMapConfig");

ManhuntMapConfig.attributes.add("networkManagerEntity", { type: "entity", title: "Network Manager Entity" });
ManhuntMapConfig.attributes.add("safeZoneEntity", { type: "entity", title: "Safe Zone Entity" });
ManhuntMapConfig.attributes.add("seekerSpawnEntity", { type: "entity", title: "Seeker Spawn / Home Base Entity" });
ManhuntMapConfig.attributes.add("hiderSpawnAEntity", { type: "entity", title: "Hider Spawn A Entity" });
ManhuntMapConfig.attributes.add("hiderSpawnBEntity", { type: "entity", title: "Hider Spawn B Entity" });
ManhuntMapConfig.attributes.add("hiderSpawnCEntity", { type: "entity", title: "Hider Spawn C Entity" });
ManhuntMapConfig.attributes.add("lobbySpawnEntity", { type: "entity", title: "Lobby Spawn Entity" });
ManhuntMapConfig.attributes.add("spectatorCameraEntity", { type: "entity", title: "Spectator Camera Entity (optional)" });
ManhuntMapConfig.attributes.add("safeZoneRadius", { type: "number", default: 15, min: 1, title: "Safe Zone Radius" });
ManhuntMapConfig.attributes.add("sendOnConnect", { type: "boolean", default: true, title: "Send On Connect" });
ManhuntMapConfig.attributes.add("showDebugInfo", { type: "boolean", default: true, title: "Show Debug Info" });

ManhuntMapConfig.prototype.initialize = function () {
  this.networkClient = this._resolveScript(this.networkManagerEntity, "arcadeNetworkClient");
  this._hud = null;
  this._hudTimeout = null;
  this._sentOnce = false;

  this._validateSetup();

  if (this.sendOnConnect) {
    this._sendWhenConnected();
  }

  this.on("destroy", this._onDestroy, this);
};

ManhuntMapConfig.prototype.update = function () {
  if (!this.app.keyboard || !this.app.keyboard.wasPressed(pc.KEY_O)) {
    return;
  }

  var config = this.buildConfig();
  console.log("[ManhuntMapConfig] Debug resend requested with O key", config);
  this.sendConfig(config, "Debug resend sent. Check server terminal for [ManhuntMapConfig] logs.");
};

ManhuntMapConfig.prototype.buildConfig = function () {
  var config = {
    safeZone: this._positionWithRadius(this.safeZoneEntity),
    seekerStart: this._position(this.seekerSpawnEntity),
    hiderStarts: [
      this._position(this.hiderSpawnAEntity),
      this._position(this.hiderSpawnBEntity),
      this._position(this.hiderSpawnCEntity)
    ],
    lobbySpawn: this._position(this.lobbySpawnEntity)
  };

  if (this.spectatorCameraEntity) {
    config.spectatorCamera = this._positionWithRotation(this.spectatorCameraEntity);
  }

  return config;
};

ManhuntMapConfig.prototype.sendConfig = function (config, successMessage) {
  if (!this.networkClient || !this.networkClient.sendManhuntMapConfig) {
    this._showDebug("Manhunt map config not sent: ArcadeNetworkClient is missing.");
    return false;
  }

  if (!this._isConfigComplete(config)) {
    console.warn("[ManhuntMapConfig] Config not sent because required marker entities are missing.", config);
    this._showDebug("Manhunt map config not sent: assign all required marker entities.");
    return false;
  }

  var sent = this.networkClient.sendManhuntMapConfig(config);
  if (!sent) {
    this._showDebug("Manhunt map config not sent: not connected to server yet.");
    return false;
  }

  this._sentOnce = true;
  console.log("[ManhuntMapConfig] Sent marker config to server", config);
  this._showDebug(successMessage || "Manhunt marker config sent to server.");
  return true;
};

ManhuntMapConfig.prototype._sendWhenConnected = function () {
  if (!this.networkClient) {
    return;
  }

  if (this.networkClient.isConnected && this.networkClient.room) {
    this.sendConfig(this.buildConfig());
    return;
  }

  if (this.networkClient.onConnected) {
    this.networkClient.onConnected(function () {
      this.sendConfig(this.buildConfig());
    }.bind(this));
  } else if (this.networkClient.onEvent) {
    this.networkClient.onEvent("connected", function () {
      this.sendConfig(this.buildConfig());
    }.bind(this));
  }
};

ManhuntMapConfig.prototype._position = function (entity) {
  if (!entity || !entity.getPosition) {
    return null;
  }

  var position = entity.getPosition();
  return { x: position.x, y: position.y, z: position.z };
};

ManhuntMapConfig.prototype._positionWithRadius = function (entity) {
  var position = this._position(entity);
  if (!position) {
    return null;
  }

  position.radius = this.safeZoneRadius;
  return position;
};

ManhuntMapConfig.prototype._positionWithRotation = function (entity) {
  var position = this._position(entity);
  if (!position) {
    return null;
  }

  var rotation = entity.getEulerAngles ? entity.getEulerAngles() : { x: 0, y: 0, z: 0 };
  position.rotX = rotation.x;
  position.rotY = rotation.y;
  position.rotZ = rotation.z;
  return position;
};

ManhuntMapConfig.prototype._isConfigComplete = function (config) {
  return !!(
    config &&
    config.safeZone &&
    config.seekerStart &&
    config.lobbySpawn &&
    Array.isArray(config.hiderStarts) &&
    config.hiderStarts.length === 3 &&
    config.hiderStarts[0] &&
    config.hiderStarts[1] &&
    config.hiderStarts[2]
  );
};

ManhuntMapConfig.prototype._resolveScript = function (entity, scriptName) {
  return entity && entity.script && entity.script[scriptName] ? entity.script[scriptName] : null;
};

ManhuntMapConfig.prototype._validateSetup = function () {
  if (!this.networkClient) console.warn("[ManhuntMapConfig] networkManagerEntity is missing ArcadeNetworkClient.");
  if (!this.safeZoneEntity) console.warn("[ManhuntMapConfig] safeZoneEntity is required.");
  if (!this.seekerSpawnEntity) console.warn("[ManhuntMapConfig] seekerSpawnEntity is required.");
  if (!this.hiderSpawnAEntity || !this.hiderSpawnBEntity || !this.hiderSpawnCEntity) console.warn("[ManhuntMapConfig] all three hider spawn marker entities are required.");
  if (!this.lobbySpawnEntity) console.warn("[ManhuntMapConfig] lobbySpawnEntity is required.");
};

ManhuntMapConfig.prototype._showDebug = function (message) {
  if (!this.showDebugInfo) {
    return;
  }

  console.log("[ManhuntMapConfig] " + message);
  if (typeof document === "undefined") {
    return;
  }

  if (!this._hud) {
    this._hud = document.createElement("div");
    this._hud.style.position = "fixed";
    this._hud.style.left = "16px";
    this._hud.style.bottom = "16px";
    this._hud.style.zIndex = "9999";
    this._hud.style.padding = "10px 12px";
    this._hud.style.borderRadius = "8px";
    this._hud.style.background = "rgba(20, 30, 45, 0.88)";
    this._hud.style.color = "#e9f5ff";
    this._hud.style.font = "14px sans-serif";
    document.body.appendChild(this._hud);
  }

  this._hud.textContent = message;
  this._hud.style.display = "block";

  if (this._hudTimeout) {
    clearTimeout(this._hudTimeout);
  }

  this._hudTimeout = setTimeout(function () {
    if (this._hud) this._hud.style.display = "none";
  }.bind(this), 3000);
};

ManhuntMapConfig.prototype._onDestroy = function () {
  if (this._hudTimeout) {
    clearTimeout(this._hudTimeout);
  }
  if (this._hud && this._hud.parentNode) {
    this._hud.parentNode.removeChild(this._hud);
  }
};
