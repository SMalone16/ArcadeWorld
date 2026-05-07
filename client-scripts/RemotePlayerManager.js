/* global pc, document, window */

var RemotePlayerManager = pc.createScript("remotePlayerManager");

RemotePlayerManager.attributes.add("networkClientEntity", {
  type: "entity",
  title: "Network Client Entity"
});

RemotePlayerManager.attributes.add("avatarColor", {
  type: "rgb",
  default: [0.25, 0.8, 1.0],
  title: "Remote Avatar Color"
});

RemotePlayerManager.attributes.add("playerTemplate", {
  type: "entity",
  title: "Remote Player Template"
});

RemotePlayerManager.attributes.add("nameplateHeightOffset", {
  type: "number",
  default: 2.2,
  min: 0,
  title: "Nameplate Height Offset"
});

/**
 * Creates lightweight placeholder avatars for remote players.
 * Keeps scene/editor setup easy for teachers and students.
 */
RemotePlayerManager.prototype.initialize = function () {
  this.remoteEntities = {};
  this.remoteProfiles = {};
  this.nameplates = {};
  this._screenPosition = new pc.Vec3();
  this._nameplateWorldPosition = new pc.Vec3();
  this._nameplateRoot = this._createNameplateRoot();

  if (!this.networkClientEntity || !this.networkClientEntity.script) {
    console.warn("[RemotePlayerManager] networkClientEntity is not configured.");
    return;
  }

  this.networkClient = this.networkClientEntity.script.arcadeNetworkClient;
  if (!this.networkClient) {
    console.warn("[RemotePlayerManager] ArcadeNetworkClient script missing.");
    return;
  }

  this.networkClient.onEvent("remoteAdded", this._onRemoteAdded.bind(this));
  this.networkClient.onEvent("remoteUpdated", this._onRemoteUpdated.bind(this));
  this.networkClient.onEvent("remoteRemoved", this._onRemoteRemoved.bind(this));

  this.on("destroy", this._onDestroy, this);
};

RemotePlayerManager.prototype.update = function () {
  this._updateNameplates();
};

RemotePlayerManager.prototype._onRemoteAdded = function (data) {
  if (this.networkClient.sessionId === data.sessionId) {
    return; // Do not spawn a duplicate for local player.
  }

  if (this.remoteEntities[data.sessionId]) {
    this._onRemoteUpdated(data);
    return;
  }

  var remote = null;
  if (this.playerTemplate && this.playerTemplate.clone) {
    remote = this.playerTemplate.clone();
    remote.enabled = true;
    remote.name = "Remote_" + data.sessionId;
  } else {
    remote = new pc.Entity("Remote_" + data.sessionId);
    remote.addComponent("model", { type: "box" });
    remote.setLocalScale(3, 3, 3);

    var material = new pc.StandardMaterial();
    material.diffuse = this._colorFromHex(data.color) || this.avatarColor.clone();
    material.update();
    remote.model.material = material;
  }

  remote.setPosition(data.x, data.y, data.z);
  remote.setEulerAngles(0, (typeof data.rotY === "number" ? data.rotY : (data.yaw || 0)), 0);

  this.app.root.addChild(remote);
  this.remoteEntities[data.sessionId] = remote;
  this.remoteProfiles[data.sessionId] = this._sanitizeProfile(data);
  this._applyProfile(remote, this.remoteProfiles[data.sessionId]);
  this._createOrUpdateNameplate(data.sessionId);
};

RemotePlayerManager.prototype._onRemoteUpdated = function (data) {
  if (this.networkClient.sessionId === data.sessionId) {
    return;
  }

  var remote = this.remoteEntities[data.sessionId];
  if (!remote) {
    this._onRemoteAdded(data);
    remote = this.remoteEntities[data.sessionId];
  }

  if (!remote) {
    return;
  }

  remote.setPosition(data.x, data.y, data.z);
  remote.setEulerAngles(0, (typeof data.rotY === "number" ? data.rotY : (data.yaw || 0)), 0);

  this.remoteProfiles[data.sessionId] = this._sanitizeProfile(data);
  this._applyProfile(remote, this.remoteProfiles[data.sessionId]);
  this._createOrUpdateNameplate(data.sessionId);
};

RemotePlayerManager.prototype._applyProfile = function (remote, profile) {
  if (!remote || !profile) {
    return;
  }

  if (remote.script && remote.script.playerAppearance && remote.script.playerAppearance.applyProfile) {
    remote.script.playerAppearance.applyProfile(profile);
    return;
  }

  if (window.ArcadePlayerAppearance && window.ArcadePlayerAppearance.applyToEntity) {
    window.ArcadePlayerAppearance.applyToEntity(remote, profile);
  }
};

RemotePlayerManager.prototype._sanitizeProfile = function (data) {
  var name = typeof data.name === "string" ? data.name.trim().slice(0, 24) : "";
  var color = typeof data.color === "string" && /^#[0-9a-fA-F]{6}$/.test(data.color) ? data.color : "#44aaff";
  var hatId = data.hatId === "Top Hat" || data.hatId === "Western" || data.hatId === "No Hat" ? data.hatId : "No Hat";

  return {
    name: name || "Student",
    color: color,
    hatId: hatId
  };
};

RemotePlayerManager.prototype._createNameplateRoot = function () {
  var root = document.createElement("div");
  root.setAttribute("aria-label", "Remote player nametags");
  root.style.position = "fixed";
  root.style.left = "0";
  root.style.top = "0";
  root.style.width = "100%";
  root.style.height = "100%";
  root.style.pointerEvents = "none";
  root.style.zIndex = "9000";
  document.body.appendChild(root);
  return root;
};

RemotePlayerManager.prototype._createOrUpdateNameplate = function (sessionId) {
  var profile = this.remoteProfiles[sessionId];
  if (!profile) {
    return;
  }

  var plate = this.nameplates[sessionId];
  if (!plate) {
    plate = document.createElement("div");
    plate.style.position = "absolute";
    plate.style.transform = "translate(-50%, -100%)";
    plate.style.padding = "3px 8px";
    plate.style.borderRadius = "999px";
    plate.style.background = "rgba(6, 16, 28, 0.82)";
    plate.style.border = "2px solid #44aaff";
    plate.style.color = "#ffffff";
    plate.style.font = "700 13px/1.2 Arial, sans-serif";
    plate.style.textShadow = "0 1px 2px rgba(0, 0, 0, 0.9)";
    plate.style.whiteSpace = "nowrap";
    this._nameplateRoot.appendChild(plate);
    this.nameplates[sessionId] = plate;
  }

  plate.textContent = profile.name;
  plate.style.borderColor = profile.color;
  plate.style.color = profile.color;
};

RemotePlayerManager.prototype._updateNameplates = function () {
  var cameraEntity = this._findActiveCameraEntity();
  if (!cameraEntity || !cameraEntity.camera) {
    this._hideAllNameplates();
    return;
  }

  var width = this.app.graphicsDevice.width;
  var height = this.app.graphicsDevice.height;
  for (var sessionId in this.remoteEntities) {
    if (!Object.prototype.hasOwnProperty.call(this.remoteEntities, sessionId)) {
      continue;
    }

    var remote = this.remoteEntities[sessionId];
    var plate = this.nameplates[sessionId];
    if (!remote || !plate) {
      continue;
    }

    this._nameplateWorldPosition.copy(remote.getPosition());
    this._nameplateWorldPosition.y += this.nameplateHeightOffset;
    cameraEntity.camera.worldToScreen(this._nameplateWorldPosition, this._screenPosition);

    var visible = this._screenPosition.z > 0 &&
      this._screenPosition.x >= 0 && this._screenPosition.x <= width &&
      this._screenPosition.y >= 0 && this._screenPosition.y <= height;

    plate.style.display = visible ? "block" : "none";
    if (visible) {
      plate.style.left = this._screenPosition.x + "px";
      plate.style.top = this._screenPosition.y + "px";
    }
  }
};

RemotePlayerManager.prototype._findActiveCameraEntity = function () {
  return this._findActiveCameraInTree(this.app.root);
};

RemotePlayerManager.prototype._findActiveCameraInTree = function (entity) {
  if (!entity || !entity.enabled) {
    return null;
  }

  if (entity.camera && entity.camera.enabled) {
    return entity;
  }

  var children = entity.children || [];
  for (var i = 0; i < children.length; i++) {
    var found = this._findActiveCameraInTree(children[i]);
    if (found) {
      return found;
    }
  }

  return null;
};

RemotePlayerManager.prototype._hideAllNameplates = function () {
  for (var sessionId in this.nameplates) {
    if (Object.prototype.hasOwnProperty.call(this.nameplates, sessionId)) {
      this.nameplates[sessionId].style.display = "none";
    }
  }
};

RemotePlayerManager.prototype._colorFromHex = function (hex) {
  if (typeof hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }

  var value = parseInt(hex.slice(1), 16);
  return new pc.Color(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
};

RemotePlayerManager.prototype.getVisibleRemoteCount = function () {
  var count = 0;
  for (var sessionId in this.remoteEntities) {
    if (Object.prototype.hasOwnProperty.call(this.remoteEntities, sessionId)) {
      count += 1;
    }
  }
  return count;
};

RemotePlayerManager.prototype._onRemoteRemoved = function (data) {
  var remote = this.remoteEntities[data.sessionId];
  if (remote) {
    remote.destroy();
  }

  var plate = this.nameplates[data.sessionId];
  if (plate && plate.parentNode) {
    plate.parentNode.removeChild(plate);
  }

  delete this.remoteEntities[data.sessionId];
  delete this.remoteProfiles[data.sessionId];
  delete this.nameplates[data.sessionId];
};

RemotePlayerManager.prototype._onDestroy = function () {
  for (var sessionId in this.remoteEntities) {
    if (Object.prototype.hasOwnProperty.call(this.remoteEntities, sessionId)) {
      this.remoteEntities[sessionId].destroy();
    }
  }

  if (this._nameplateRoot && this._nameplateRoot.parentNode) {
    this._nameplateRoot.parentNode.removeChild(this._nameplateRoot);
  }
};
