/* global pc */
var TicketPickupManager = pc.createScript("ticketPickupManager");
TicketPickupManager.attributes.add("networkManagerEntity", { type: "entity" });
TicketPickupManager.attributes.add("localPlayerEntity", { type: "entity" });
TicketPickupManager.attributes.add("ticketSpawnRoot", { type: "entity" });
TicketPickupManager.attributes.add("ticketTemplate", { type: "entity" });
TicketPickupManager.attributes.add("collectRadius", { type: "number", default: 2.2 });
TicketPickupManager.attributes.add("collectVerticalTolerance", { type: "number", default: 3 });
TicketPickupManager.attributes.add("collectSfx", { type: "asset", assetType: "audio" });
TicketPickupManager.attributes.add("showDebugOverlay", {
    type: "boolean",
    default: true,
    title: "Show Ticket Debug Overlay"
});

TicketPickupManager.prototype.initialize = function () {
    this.networkClient = this.networkManagerEntity && this.networkManagerEntity.script ? this.networkManagerEntity.script.arcadeNetworkClient : null;
    this._ticketEntities = {};
    this._requested = {};
    this._requestTimeouts = {};
    this._fx = [];

    this._spawnPositions = [];
    this._hasSentSpawnConfig = false;
    this._lastSpawnSendResult = "not attempted";
    this._lastWarning = "";
    this._debugOverlay = null;
    this._debugEnabled = this.showDebugOverlay === true;
    this._lastServerSpawnAck = null;
    this._lastCollectDebug = null;
    this._lastCollectRequest = null;
    this._lastCollectSuccess = null;
    this._lastCollectRejection = null;
    this._lastCheckCollectDebug = null;
    this._debugSnapshotMessage = "";

    if (!this.networkClient) {
        this._setWarning("Missing ArcadeNetworkClient");
    }
    if (!this.ticketSpawnRoot) {
        this._setWarning("Missing ticketSpawnRoot");
    }
    if (!this.ticketTemplate) {
        this._setWarning("Missing ticketTemplate");
    }

    if (this.ticketTemplate) {
        this.ticketTemplate.enabled = false;
    }

    this._spawnPositions = this._collectSpawnPositions();
    this._trySendSpawnConfig();

    if (this.networkClient && this.networkClient.onConnected) {
        this.networkClient.onConnected(this._trySendSpawnConfig.bind(this));
    }
    if (this.networkClient && this.networkClient.onTicketCollected) {
        this.networkClient.onTicketCollected(this._onTicketCollected.bind(this));
    }
    if (this.networkClient && this.networkClient.onTicketCollectRejected) {
        this.networkClient.onTicketCollectRejected(this._onTicketCollectRejected.bind(this));
    }
    if (this.networkClient && this.networkClient.onTicketSpawnConfigResult) {
        this.networkClient.onTicketSpawnConfigResult(this._onTicketSpawnConfigResult.bind(this));
    }

    this._onDebugKeyDownBound = this._onDebugKeyDown.bind(this);
    if (typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener("keydown", this._onDebugKeyDownBound);
    }
};

TicketPickupManager.prototype.update = function (dt) {
    this._trySendSpawnConfig();
    this._syncTickets();
    this._checkCollects();
    this._updateFx(dt);
    this._updateDebugOverlay();
};

TicketPickupManager.prototype.destroy = function () {
    if (this._onDebugKeyDownBound && typeof window !== "undefined" && window.removeEventListener) {
        window.removeEventListener("keydown", this._onDebugKeyDownBound);
    }
    this._clearAllRequestTimeouts();
    this._removeDebugOverlay();
};

TicketPickupManager.prototype._setWarning = function (message) {
    this._lastWarning = message;
    console.warn("[Tickets] " + message);
};

TicketPickupManager.prototype._collectSpawnPositions = function () {
    var out = [];
    var kids = this.ticketSpawnRoot ? this.ticketSpawnRoot.children : [];
    for (var i = 0; i < kids.length; i++) {
        if (kids[i] && kids[i].enabled) {
            var p = kids[i].getPosition();
            out.push({ x: p.x, y: p.y, z: p.z });
        }
    }
    console.log("[Tickets] Spawn positions found: " + out.length);
    return out;
};

TicketPickupManager.prototype._trySendSpawnConfig = function () {
    if (this._hasSentSpawnConfig) {
        return;
    }

    if (!this.networkClient) {
        this._lastSpawnSendResult = "missing network client";
        this._setWarning("Missing ArcadeNetworkClient");
        return;
    }

    var spawnCount = this._spawnPositions ? this._spawnPositions.length : 0;
    if (spawnCount !== 16) {
        this._lastSpawnSendResult = "invalid spawn count";
        this._setWarning("Expected 16 spawn positions, found " + spawnCount);
        return;
    }

    if (!this.networkClient.room) {
        this._lastSpawnSendResult = "waiting for room";
        this._setWarning("Waiting for Colyseus room before sending ticket spawn config");
        console.log("[Tickets] Waiting for room connection...");
        return;
    }

    console.log("[Tickets] Attempting spawn config send", { count: spawnCount });
    var sent = this.networkClient.sendTicketSpawnConfig ? this.networkClient.sendTicketSpawnConfig(this._spawnPositions) : false;
    this._lastSpawnSendResult = sent ? "true" : "false";

    if (sent) {
        this._hasSentSpawnConfig = true;
        this._lastWarning = "";
        console.log("[Tickets] Spawn config sent successfully client-side.");
    } else {
        this._setWarning("sendTicketSpawnConfig returned false");
    }
};

TicketPickupManager.prototype._syncTickets = function () {
    if (!this.networkClient) {
        return;
    }

    var tickets = this.networkClient.getTicketsState ? this.networkClient.getTicketsState() : {};
    var ids = Object.keys(tickets);
    var activeCount = 0;

    for (var existingId in this._ticketEntities) {
        if (!Object.prototype.hasOwnProperty.call(this._ticketEntities, existingId)) {
            continue;
        }
        if (!Object.prototype.hasOwnProperty.call(tickets, existingId)) {
            var removedEnt = this._ticketEntities[existingId];
            if (removedEnt) {
                removedEnt.enabled = false;
                if (removedEnt.destroy) {
                    removedEnt.destroy();
                }
            }
            delete this._ticketEntities[existingId];
            this._clearRequestedTicket(existingId);
            console.log("[Tickets] Removed stale ticket visual for missing state id " + existingId);
        }
    }

    for (var id in tickets) {
        if (!Object.prototype.hasOwnProperty.call(tickets, id)) {
            continue;
        }

        var t = tickets[id];
        var ent = this._ticketEntities[id];

        if (!ent && this.ticketTemplate) {
            ent = this.ticketTemplate.clone();
            ent.enabled = true;
            this.app.root.addChild(ent);
            this._ticketEntities[id] = ent;
            console.log("[Tickets] Cloned fresh ticket entity for " + id + " at " + t.x + "," + t.y + "," + t.z);
        }

        if (!ent) {
            continue;
        }

        ent.setPosition(t.x, t.y, t.z);
        ent.enabled = t.active === true;

        if (t.active === true) {
            activeCount += 1;
        }
    }

    console.log("[Tickets] Known tickets: " + ids.length + " active: " + activeCount + " cloned: " + Object.keys(this._ticketEntities).length);
};

TicketPickupManager.prototype._onTicketSpawnConfigResult = function (payload) {
    this._lastServerSpawnAck = payload || null;
    console.log("[Tickets] Server spawn config result received", payload || null);
};

TicketPickupManager.prototype._checkCollects = function () {
    var local = this.localPlayerEntity;
    if (!local || !this.networkClient || !this.networkClient.sendTicketCollectRequest) {
        this._lastCheckCollectDebug = {
            sentRequest: false,
            reason: !local ? "missing-local-player" : "missing-network-client-or-send-method",
            timestamp: Date.now()
        };
        return;
    }

    var lp = local.getPosition();
    var tickets = this.networkClient.getTicketsState ? this.networkClient.getTicketsState() : {};
    var sentThisFrame = false;
    var nearest = this._getNearestAuthoritativeTicket(lp, tickets);

    for (var id in tickets) {
        if (!Object.prototype.hasOwnProperty.call(tickets, id)) continue;
        var t = tickets[id];
        if (!t.active || this._requested[id]) continue;
        var dx = lp.x - t.x, dy = lp.y - t.y, dz = lp.z - t.z;
        var fullDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        var xzDistance = Math.sqrt(dx * dx + dz * dz);
        if (xzDistance <= this.collectRadius && Math.abs(dy) <= this.collectVerticalTolerance) {
            this._requestTicketCollect(id, lp, t, fullDistance, xzDistance);
            sentThisFrame = true;
        }
    }

    this._lastCheckCollectDebug = {
        sentRequest: sentThisFrame,
        nearestTicketId: nearest ? nearest.id : "none",
        nearestDistanceXZ: nearest ? nearest.distanceXZ : null,
        nearestVerticalDistance: nearest ? nearest.verticalDistance : null,
        nearestWithinRange: nearest ? nearest.withinRange : false,
        pendingRequests: Object.keys(this._requested),
        timestamp: Date.now()
    };
};

TicketPickupManager.prototype._requestTicketCollect = function (ticketId, playerPosition, ticket, fullDistance, xzDistance) {
    this._requested[ticketId] = true;

    if (this.networkClient && this.networkClient.sendMove) {
        var rotY = this.localPlayerEntity ? this.localPlayerEntity.getEulerAngles().y : 0;
        this.networkClient.sendMove(playerPosition, rotY, null);
    }

    var sent = this.networkClient.sendTicketCollectRequest(ticketId, playerPosition);
    this._lastCollectDebug = {
        type: sent ? "requested" : "send-failed",
        reason: sent ? "sent-to-server" : "missing-room-or-ticket-id",
        ticketId: ticketId,
        playerPosition: { x: playerPosition.x, y: playerPosition.y, z: playerPosition.z },
        ticketPosition: ticket ? { x: ticket.x, y: ticket.y, z: ticket.z } : null,
        distance: fullDistance,
        distanceXZ: xzDistance,
        active: ticket ? ticket.active === true : null,
        collectRadius: this.collectRadius,
        verticalTolerance: this.collectVerticalTolerance,
        timestamp: Date.now()
    };
    this._lastCollectRequest = this._lastCollectDebug;
    console.log("[Tickets] Collect request", this._lastCollectDebug);

    if (!sent) {
        this._clearRequestedTicket(ticketId);
        return;
    }

    this._setRequestTimeout(ticketId);
};

TicketPickupManager.prototype._setRequestTimeout = function (ticketId) {
    this._clearRequestTimeout(ticketId);
    this._requestTimeouts[ticketId] = setTimeout(function () {
        if (this._requested[ticketId]) {
            delete this._requested[ticketId];
            this._lastCollectDebug = {
                type: "timeout",
                reason: "no-success-or-rejection-within-500ms",
                ticketId: ticketId,
                timestamp: Date.now()
            };
            this._lastCollectRejection = this._lastCollectDebug;
            console.warn("[Tickets] Collect request timed out; retry is now allowed", this._lastCollectDebug);
        }
        delete this._requestTimeouts[ticketId];
    }.bind(this), 500);
};

TicketPickupManager.prototype._clearRequestTimeout = function (ticketId) {
    if (this._requestTimeouts[ticketId]) {
        clearTimeout(this._requestTimeouts[ticketId]);
        delete this._requestTimeouts[ticketId];
    }
};

TicketPickupManager.prototype._clearRequestedTicket = function (ticketId) {
    delete this._requested[ticketId];
    this._clearRequestTimeout(ticketId);
};

TicketPickupManager.prototype._clearAllRequestTimeouts = function () {
    for (var id in this._requestTimeouts) {
        if (Object.prototype.hasOwnProperty.call(this._requestTimeouts, id)) {
            clearTimeout(this._requestTimeouts[id]);
        }
    }
    this._requestTimeouts = {};
};

TicketPickupManager.prototype._onTicketCollected = function (payload) {
    if (!payload || !payload.ticketId) return;
    this._clearRequestedTicket(payload.ticketId);
    this._lastCollectDebug = { type: "collected", reason: "server-confirmed", ticketId: payload.ticketId, ticketPosition: { x: payload.x, y: payload.y, z: payload.z }, tickets: payload.tickets, timestamp: Date.now() };
    this._lastCollectSuccess = this._lastCollectDebug;
    console.log("[Tickets] Collect confirmed", this._lastCollectDebug);
    if (this.collectSfx && this.entity.sound) {
        this.entity.sound.play(this.collectSfx.name);
    }
    this._spawnFx(payload.x, payload.y, payload.z);
};

TicketPickupManager.prototype._onTicketCollectRejected = function (payload) {
    if (!payload || !payload.ticketId) return;
    this._clearRequestedTicket(payload.ticketId);
    this._lastCollectDebug = payload;
    this._lastCollectRejection = payload;
    console.warn("[Tickets] Collect rejected; retry is now allowed", payload);
};

TicketPickupManager.prototype._spawnFx = function (x, y, z) {
    for (var i = 0; i < 8; i++) {
        var e = new pc.Entity("ticketFx");
        e.addComponent("render", { type: "sphere" });
        e.setLocalScale(0.12, 0.12, 0.12);
        e.setPosition(x, y + 0.5, z);
        this.app.root.addChild(e);
        this._fx.push({
            e: e,
            v: new pc.Vec3((Math.random() - 0.5) * 2, Math.random() * 2 + 1, (Math.random() - 0.5) * 2),
            life: 0.8
        });
    }
};

TicketPickupManager.prototype._updateFx = function (dt) {
    for (var i = this._fx.length - 1; i >= 0; i--) {
        var f = this._fx[i];
        f.life -= dt;
        f.e.translate(f.v.x * dt, f.v.y * dt, f.v.z * dt);
        var s = Math.max(0.01, f.life);
        f.e.setLocalScale(s, s, s);
        if (f.life <= 0) {
            f.e.destroy();
            this._fx.splice(i, 1);
        }
    }
};


TicketPickupManager.prototype._formatTicketVec = function (position) {
    if (!position) return "n/a";
    return "(" + Number(position.x || 0).toFixed(2) + ", " + Number(position.y || 0).toFixed(2) + ", " + Number(position.z || 0).toFixed(2) + ")";
};

TicketPickupManager.prototype._getNearestAuthoritativeTicket = function (playerPosition, tickets) {
    if (!playerPosition || !tickets) return null;
    var nearest = null;
    for (var id in tickets) {
        if (!Object.prototype.hasOwnProperty.call(tickets, id)) continue;
        var t = tickets[id];
        var dx = playerPosition.x - t.x;
        var dy = playerPosition.y - t.y;
        var dz = playerPosition.z - t.z;
        var xzDistance = Math.sqrt(dx * dx + dz * dz);
        var verticalDistance = Math.abs(dy);
        var entry = {
            id: id,
            position: { x: t.x, y: t.y, z: t.z },
            active: t.active === true,
            distanceXZ: xzDistance,
            verticalDistance: verticalDistance,
            withinRange: xzDistance <= this.collectRadius && verticalDistance <= this.collectVerticalTolerance
        };
        if (!nearest || xzDistance < nearest.distanceXZ) {
            nearest = entry;
        }
    }
    return nearest;
};

TicketPickupManager.prototype._getNearestVisualTicket = function (playerPosition) {
    if (!playerPosition) return null;
    var nearest = null;
    for (var id in this._ticketEntities) {
        if (!Object.prototype.hasOwnProperty.call(this._ticketEntities, id)) continue;
        var ent = this._ticketEntities[id];
        if (!ent || ent.enabled !== true) continue;
        var p = ent.getPosition();
        var dx = playerPosition.x - p.x;
        var dz = playerPosition.z - p.z;
        var xzDistance = Math.sqrt(dx * dx + dz * dz);
        var entry = { id: id, position: { x: p.x, y: p.y, z: p.z }, distanceXZ: xzDistance };
        if (!nearest || xzDistance < nearest.distanceXZ) {
            nearest = entry;
        }
    }
    return nearest;
};

TicketPickupManager.prototype._updateDebugOverlay = function () {
    if (typeof document === "undefined") {
        return;
    }

    var shouldShow = (this._debugEnabled && this.showDebugOverlay) || !!this._debugSnapshotMessage;
    if (!shouldShow) {
        this._removeDebugOverlay();
        return;
    }

    if (!this._debugOverlay) {
        this._debugOverlay = document.createElement("pre");
        this._debugOverlay.style.position = "fixed";
        this._debugOverlay.style.top = "12px";
        this._debugOverlay.style.right = "12px";
        this._debugOverlay.style.zIndex = "9999";
        this._debugOverlay.style.margin = "0";
        this._debugOverlay.style.padding = "10px";
        this._debugOverlay.style.background = "rgba(0,0,0,0.78)";
        this._debugOverlay.style.color = "#b8ffb8";
        this._debugOverlay.style.font = "12px/1.3 monospace";
        this._debugOverlay.style.maxWidth = "420px";
        this._debugOverlay.style.pointerEvents = "none";
        document.body.appendChild(this._debugOverlay);
    }

    var tickets = this.networkClient && this.networkClient.getTicketsState ? this.networkClient.getTicketsState() : {};
    var ticketIds = Object.keys(tickets);
    var activeCount = 0;
    for (var i = 0; i < ticketIds.length; i++) {
        if (tickets[ticketIds[i]] && tickets[ticketIds[i]].active) {
            activeCount += 1;
        }
    }

    var localPosition = this.localPlayerEntity ? this.localPlayerEntity.getPosition() : null;
    var nearestAuth = this._getNearestAuthoritativeTicket(localPosition, tickets);
    var nearestVisual = this._getNearestVisualTicket(localPosition);
    var checkAgeMs = this._lastCheckCollectDebug ? Date.now() - this._lastCheckCollectDebug.timestamp : null;

    var lines = [];
    lines.push("[Ticket Debug]");
    lines.push("Keys: F8 toggle overlay, T log console snapshot + show this overlay");
    if (this._debugSnapshotMessage) {
        lines.push(this._debugSnapshotMessage);
    }
    lines.push("Network Client: " + (this.networkClient ? "yes" : "no"));
    lines.push("Connected: " + (this.networkClient && this.networkClient.room ? "yes" : "no"));
    lines.push("Session ID: " + (this.networkClient && this.networkClient.room && this.networkClient.room.sessionId ? this.networkClient.room.sessionId : "n/a"));
    lines.push("Room Name: " + (this.networkClient && this.networkClient._roomName ? this.networkClient._roomName : "n/a"));
    lines.push("Spawn Positions Found: " + (this._spawnPositions ? this._spawnPositions.length : 0));
    lines.push("Spawn Config Sent: " + (this._hasSentSpawnConfig ? "yes" : "no"));
    lines.push("Last Spawn Send Result: " + this._lastSpawnSendResult);
    var rawStateCount = this.networkClient && this.networkClient.getRawTicketStateCount ? this.networkClient.getRawTicketStateCount() : 0;
    var rawActiveCount = this.networkClient && this.networkClient.getRawActiveTicketStateCount ? this.networkClient.getRawActiveTicketStateCount() : 0;
    var ack = this._lastServerSpawnAck || (this.networkClient && this.networkClient.getLastTicketSpawnConfigResult ? this.networkClient.getLastTicketSpawnConfigResult() : null);
    lines.push("Last Client Warning: " + (this._lastWarning || "none"));
    lines.push("Last Server Spawn Ack reason: " + (ack && ack.reason ? ack.reason : "none"));
    lines.push("Last Server Spawn Ack accepted: " + (ack && typeof ack.accepted === "boolean" ? String(ack.accepted) : "n/a"));
    lines.push("Last Server reported stateTicketCount: " + (ack && typeof ack.stateTicketCount === "number" ? ack.stateTicketCount : "n/a"));
    lines.push("Raw Room State Tickets: " + rawStateCount);
    lines.push("Raw Active Room State Tickets: " + rawActiveCount);
    lines.push("Known Tickets Cache Count: " + ticketIds.length);
    lines.push("Known Active Tickets Cache Count: " + activeCount);
    lines.push("Cloned Ticket Entity Count: " + Object.keys(this._ticketEntities).length);
    lines.push("Pending Collect Requests: " + (Object.keys(this._requested).length ? Object.keys(this._requested).join(", ") : "none"));
    lines.push("Local Player Pos: " + this._formatTicketVec(localPosition));
    if (nearestAuth) {
        lines.push("Nearest Auth Ticket: " + nearestAuth.id + " pos=" + this._formatTicketVec(nearestAuth.position) + " active=" + nearestAuth.active);
        lines.push("Nearest Auth Dist: xz=" + nearestAuth.distanceXZ.toFixed(2) + " vertical=" + nearestAuth.verticalDistance.toFixed(2) + " within=" + nearestAuth.withinRange);
    } else {
        lines.push("Nearest Auth Ticket: none");
    }
    if (nearestVisual) {
        lines.push("Nearest Visual Clone: " + nearestVisual.id + " pos=" + this._formatTicketVec(nearestVisual.position) + " xz=" + nearestVisual.distanceXZ.toFixed(2));
    } else {
        lines.push("Nearest Visual Clone: none");
    }
    lines.push("_checkCollects sent request: " + (this._lastCheckCollectDebug ? String(this._lastCheckCollectDebug.sentRequest) : "n/a") + (checkAgeMs !== null ? " (" + checkAgeMs + "ms ago)" : ""));
    lines.push("_checkCollects detail: " + (this._lastCheckCollectDebug ? JSON.stringify(this._lastCheckCollectDebug) : "none"));
    lines.push("Last Collect Request: " + (this._lastCollectRequest ? JSON.stringify(this._lastCollectRequest) : "none"));
    lines.push("Last Collect Success: " + (this._lastCollectSuccess ? JSON.stringify(this._lastCollectSuccess) : "none"));
    var reject = this._lastCollectRejection || (this.networkClient && this.networkClient.getLastTicketCollectRejected ? this.networkClient.getLastTicketCollectRejected() : null);
    lines.push("Last Collect Rejection: " + (reject ? JSON.stringify(reject) : "none"));
    lines.push("Last Collect Debug: " + (this._lastCollectDebug ? JSON.stringify(this._lastCollectDebug) : "none"));
    lines.push("Ticket IDs: " + (ticketIds.length ? ticketIds.join(", ") : "none"));
    this._debugOverlay.textContent = lines.join("\n");
};

TicketPickupManager.prototype._removeDebugOverlay = function () {
    if (this._debugOverlay && this._debugOverlay.parentNode) {
        this._debugOverlay.parentNode.removeChild(this._debugOverlay);
    }
    this._debugOverlay = null;
};

TicketPickupManager.prototype._onDebugKeyDown = function (evt) {
    if (!evt || evt.repeat) {
        return;
    }

    if (evt.key === "F8") {
        this._debugEnabled = !this._debugEnabled;
        console.log("[Tickets] Debug overlay toggled", this._debugEnabled);
        return;
    }

    if (evt.key === "t" || evt.key === "T") {
        var tickets = this.networkClient && this.networkClient.getTicketsState ? this.networkClient.getTicketsState() : {};
        var localPosition = this.localPlayerEntity ? this.localPlayerEntity.getPosition() : null;
        var snapshot = {
            spawnPositions: this._spawnPositions,
            knownTickets: tickets,
            ticketEntities: Object.keys(this._ticketEntities),
            nearestAuthoritativeTicket: this._getNearestAuthoritativeTicket(localPosition, tickets),
            nearestVisualTicket: this._getNearestVisualTicket(localPosition),
            roomState: {
                hasNetworkClient: !!this.networkClient,
                hasRoom: !!(this.networkClient && this.networkClient.room),
                sessionId: this.networkClient && this.networkClient.room ? this.networkClient.room.sessionId : null
            },
            hasSentSpawnConfig: this._hasSentSpawnConfig,
            lastSpawnSendResult: this._lastSpawnSendResult,
            lastWarning: this._lastWarning,
            requestedTickets: Object.keys(this._requested),
            lastCheckCollectDebug: this._lastCheckCollectDebug,
            lastCollectRequest: this._lastCollectRequest,
            lastCollectSuccess: this._lastCollectSuccess,
            lastCollectRejection: this._lastCollectRejection || (this.networkClient && this.networkClient.getLastTicketCollectRejected ? this.networkClient.getLastTicketCollectRejected() : null),
            lastCollectDebug: this._lastCollectDebug
        };
        console.log("[Tickets] Debug snapshot", snapshot);
        this._debugEnabled = true;
        this._debugSnapshotMessage = "Debug snapshot logged to console at " + new Date().toLocaleTimeString();
        this._updateDebugOverlay();
    }
};
