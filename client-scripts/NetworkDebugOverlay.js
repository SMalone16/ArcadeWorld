/* global pc */

var NetworkDebugOverlay = pc.createScript("networkDebugOverlay");

NetworkDebugOverlay.attributes.add("networkClientEntity", {
  type: "entity",
  title: "Network Client Entity"
});

NetworkDebugOverlay.attributes.add("remotePlayerManagerEntity", {
  type: "entity",
  title: "Remote Player Manager Entity"
});

NetworkDebugOverlay.attributes.add("refreshInterval", {
  type: "number",
  default: 0.25,
  min: 0.05,
  title: "Refresh Interval Seconds"
});

/**
 * Small DOM overlay for live multiplayer playtests.
 * Kept separate from scene rendering so debugging UI can be removed later without touching gameplay.
 */
NetworkDebugOverlay.prototype.initialize = function () {
  this._timer = 0;
  this._networkClient = null;
  this._remotePlayerManager = null;
  this._root = this._createRootElement();

  this._resolveScripts();
  this._render();

  this.on("destroy", this._onDestroy, this);
};

NetworkDebugOverlay.prototype.update = function (dt) {
  this._timer += dt;
  if (this._timer < this.refreshInterval) {
    return;
  }

  this._timer = 0;
  this._resolveScripts();
  this._render();
};

NetworkDebugOverlay.prototype._resolveScripts = function () {
  if (this.networkClientEntity && this.networkClientEntity.script) {
    this._networkClient = this.networkClientEntity.script.arcadeNetworkClient || null;
  }

  if (this.remotePlayerManagerEntity && this.remotePlayerManagerEntity.script) {
    this._remotePlayerManager = this.remotePlayerManagerEntity.script.remotePlayerManager || null;
  }
};

NetworkDebugOverlay.prototype._createRootElement = function () {
  var root = document.createElement("pre");
  root.setAttribute("aria-label", "Network debug overlay");
  root.style.position = "fixed";
  root.style.left = "12px";
  root.style.top = "12px";
  root.style.zIndex = "10000";
  root.style.margin = "0";
  root.style.padding = "10px 12px";
  root.style.maxWidth = "420px";
  root.style.whiteSpace = "pre-wrap";
  root.style.pointerEvents = "none";
  root.style.color = "#dff7ff";
  root.style.background = "rgba(8, 16, 24, 0.82)";
  root.style.border = "1px solid rgba(120, 220, 255, 0.7)";
  root.style.borderRadius = "6px";
  root.style.font = "12px/1.35 Menlo, Consolas, monospace";
  root.style.textShadow = "0 1px 2px rgba(0, 0, 0, 0.8)";

  document.body.appendChild(root);
  return root;
};

NetworkDebugOverlay.prototype._render = function () {
  var snapshot = this._getSnapshot();
  var remotePlayersVisible = this._getRemotePlayersVisible(snapshot);
  var lastNetworkError = snapshot.lastNetworkError || "none";

  this._root.textContent = [
    "Network Debug",
    "Connected: " + (snapshot.connected ? "yes" : "no"),
    "Session ID: " + (snapshot.sessionId || "none"),
    "Room name: " + (snapshot.roomName || "none"),
    "Remote players visible: " + remotePlayersVisible,
    "Last network error: " + lastNetworkError,
    "Server URL: " + (snapshot.serverUrl || "none")
  ].join("\n");
};

NetworkDebugOverlay.prototype._getSnapshot = function () {
  if (this._networkClient && this._networkClient.getDebugSnapshot) {
    return this._networkClient.getDebugSnapshot();
  }

  return {
    connected: false,
    sessionId: "",
    roomName: "",
    remotePlayersKnown: 0,
    lastNetworkError: "ArcadeNetworkClient not found",
    serverUrl: ""
  };
};

NetworkDebugOverlay.prototype._getRemotePlayersVisible = function (snapshot) {
  if (this._remotePlayerManager && this._remotePlayerManager.getVisibleRemoteCount) {
    return this._remotePlayerManager.getVisibleRemoteCount();
  }

  return snapshot.remotePlayersKnown || 0;
};

NetworkDebugOverlay.prototype._onDestroy = function () {
  if (this._root && this._root.parentNode) {
    this._root.parentNode.removeChild(this._root);
  }
};
