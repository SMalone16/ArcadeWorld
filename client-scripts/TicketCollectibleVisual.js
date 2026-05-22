/* global pc */
var TicketCollectibleVisual = pc.createScript("ticketCollectibleVisual");
TicketCollectibleVisual.attributes.add("rotationSpeed", { type: "number", default: 45 });
TicketCollectibleVisual.attributes.add("bobAmplitude", { type: "number", default: 0.15 });
TicketCollectibleVisual.attributes.add("bobSpeed", { type: "number", default: 2 });
TicketCollectibleVisual.prototype.initialize = function () { this._baseY = this.entity.getLocalPosition().y; this._time = Math.random() * Math.PI * 2; };
TicketCollectibleVisual.prototype.update = function (dt) { this._time += dt * this.bobSpeed; this.entity.rotateLocal(0, this.rotationSpeed * dt, 0); var p = this.entity.getLocalPosition(); p.y = this._baseY + Math.sin(this._time) * this.bobAmplitude; this.entity.setLocalPosition(p); };
