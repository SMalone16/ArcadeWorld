/* global pc, window, document */
var FreeRoamStatusHud = pc.createScript("freeRoamStatusHud");

FreeRoamStatusHud.attributes.add("networkManagerEntity", {
  type: "entity",
  title: "Network Manager Entity"
});

FreeRoamStatusHud.attributes.add("showDuringManhunt", {
  type: "boolean",
  default: false,
  title: "Show During Manhunt Rounds"
});

FreeRoamStatusHud.attributes.add("hudZIndex", {
  type: "number",
  default: 8800,
  title: "HUD Z Index"
});

FreeRoamStatusHud.prototype.initialize = function () {
  this.networkClient = this._resolveNetworkClient();
  this._root = null;
  this._ticketsLine = null;
  this._playersLine = null;
  this._lastTickets = null;
  this._lastPlayers = null;
  this._lastVisible = null;
  this._lastResolveTime = 0;

  this._createHud();
};

FreeRoamStatusHud.prototype.update = function () {
  if (!this.networkClient || Date.now() - this._lastResolveTime > 1000) {
    this.networkClient = this._resolveNetworkClient();
    this._lastResolveTime = Date.now();
  }

  var shouldShow = this._shouldShowHud();
  if (shouldShow !== this._lastVisible && this._root) {
    this._root.style.display = shouldShow ? "block" : "none";
    this._lastVisible = shouldShow;
  }

  if (!shouldShow) {
    return;
  }

  var tickets = this._getLocalTickets();
  var players = this._getActivePlayerCount();

  if (tickets !== this._lastTickets && this._ticketsLine) {
    this._ticketsLine.textContent = "Tickets: " + tickets;
    this._lastTickets = tickets;
  }

  if (players !== this._lastPlayers && this._playersLine) {
    this._playersLine.textContent = "Players: " + players;
    this._lastPlayers = players;
  }
};

FreeRoamStatusHud.prototype.destroy = function () {
  if (this._root && this._root.parentNode) {
    this._root.parentNode.removeChild(this._root);
  }
  this._root = null;
  this._ticketsLine = null;
  this._playersLine = null;
};

FreeRoamStatusHud.prototype._resolveNetworkClient = function () {
  if (!this.networkManagerEntity || !this.networkManagerEntity.script) {
    return null;
  }
  return this.networkManagerEntity.script.arcadeNetworkClient || null;
};

FreeRoamStatusHud.prototype._createHud = function () {
  if (typeof document === "undefined" || this._root) {
    return;
  }

  var root = document.createElement("div");
  root.setAttribute("aria-label", "Free roam status");
  root.style.position = "fixed";
  root.style.top = "14px";
  root.style.left = "14px";
  root.style.zIndex = String(this.hudZIndex || 8800);
  root.style.padding = "10px 12px";
  root.style.borderRadius = "12px";
  root.style.background = "rgba(12, 18, 28, 0.72)";
  root.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.22)";
  root.style.color = "#ffffff";
  root.style.font = "600 14px/1.35 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  root.style.letterSpacing = "0.01em";
  root.style.textShadow = "0 1px 2px rgba(0, 0, 0, 0.35)";
  root.style.pointerEvents = "none";
  root.style.userSelect = "none";
  root.style.minWidth = "112px";
  root.style.display = "none";

  this._ticketsLine = document.createElement("div");
  this._playersLine = document.createElement("div");
  this._ticketsLine.textContent = "Tickets: 0";
  this._playersLine.textContent = "Players: 1";

  root.appendChild(this._ticketsLine);
  root.appendChild(this._playersLine);
  document.body.appendChild(root);
  this._root = root;
};

FreeRoamStatusHud.prototype._shouldShowHud = function () {
  if (!this._root) {
    return false;
  }

  var state = typeof window !== "undefined" ? window.ArcadeWorldGameState : null;
  if (state === "onboarding" || state === "pregame") {
    return false;
  }
  if (state && state !== "playing") {
    return false;
  }

  if (typeof window !== "undefined" && window.ArcadeMiniGameActive === true) {
    return false;
  }

  if (!this.showDuringManhunt && this.networkClient && this.networkClient.getManhuntState) {
    var manhunt = this.networkClient.getManhuntState();
    var phase = manhunt && manhunt.phase ? manhunt.phase : "lobby";
    if (phase !== "lobby") {
      return false;
    }
  }

  if (!this.networkClient) {
    return false;
  }

  return !!(this.networkClient.room || this.networkClient._isOfflineMode === true);
};

FreeRoamStatusHud.prototype._getLocalTickets = function () {
  if (this.networkClient && this.networkClient.getLocalTickets) {
    return Math.max(0, Math.floor(this.networkClient.getLocalTickets() || 0));
  }

  var leaderboard = this.networkClient && this.networkClient.getTicketLeaderboard ? this.networkClient.getTicketLeaderboard() : [];
  for (var i = 0; i < leaderboard.length; i++) {
    if (leaderboard[i] && leaderboard[i].isLocal) {
      return Math.max(0, Math.floor(leaderboard[i].tickets || 0));
    }
  }

  return 0;
};

FreeRoamStatusHud.prototype._getActivePlayerCount = function () {
  if (this.networkClient && this.networkClient.getActivePlayerCount) {
    return Math.max(0, Math.floor(this.networkClient.getActivePlayerCount() || 0));
  }

  var leaderboard = this.networkClient && this.networkClient.getTicketLeaderboard ? this.networkClient.getTicketLeaderboard() : [];
  if (leaderboard.length > 0) {
    return leaderboard.length;
  }

  return this.networkClient ? 1 : 0;
};
