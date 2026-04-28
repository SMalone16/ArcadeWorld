/* global pc */

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

/**
 * Creates lightweight placeholder avatars for remote players.
 * Keeps scene/editor setup easy for teachers and students.
 */
RemotePlayerManager.prototype.initialize = function () {
  this.remoteEntities = {};

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
};

RemotePlayerManager.prototype._onRemoteAdded = function (data) {
  if (this.networkClient.sessionId === data.sessionId) {
    return; // Do not spawn a duplicate for local player.
  }

  if (this.remoteEntities[data.sessionId]) {
    return;
  }

  var remote = new pc.Entity("Remote_" + data.sessionId);
  remote.addComponent("model", { type: "capsule" });

  var material = new pc.StandardMaterial();
  material.diffuse = this.avatarColor.clone();
  material.update();
  remote.model.material = material;

  remote.setPosition(data.x, data.y, data.z);
  remote.setEulerAngles(0, data.yaw || 0, 0);

  this.app.root.addChild(remote);
  this.remoteEntities[data.sessionId] = remote;
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
  remote.setEulerAngles(0, data.yaw || 0, 0);
};

RemotePlayerManager.prototype._onRemoteRemoved = function (data) {
  var remote = this.remoteEntities[data.sessionId];
  if (!remote) {
    return;
  }

  remote.destroy();
  delete this.remoteEntities[data.sessionId];
};
