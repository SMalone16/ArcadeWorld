/* global pc, window */

var PlayerAppearance = pc.createScript("playerAppearance");

var ArcadePlayerAppearance = {
  defaultColor: "#44aaff",
  defaultHatId: "No Hat",
  validHatIds: ["No Hat", "Top Hat", "Western"],

  applyToEntity: function (entity, profile) {
    if (!entity) {
      return;
    }

    var safeProfile = this.sanitizeProfile(profile);
    this.applyBodyColor(entity, safeProfile.color);
    this.applyHat(entity, safeProfile.hatId);
  },

  sanitizeProfile: function (profile) {
    var safe = profile || {};
    var color = typeof safe.color === "string" && /^#[0-9a-fA-F]{6}$/.test(safe.color)
      ? safe.color
      : this.defaultColor;
    var hatId = this.validHatIds.indexOf(safe.hatId) !== -1 ? safe.hatId : this.defaultHatId;
    var name = typeof safe.name === "string" ? safe.name.trim().slice(0, 24) : "";

    return {
      name: name || "Player",
      color: color,
      hatId: hatId
    };
  },

  applyBodyColor: function (entity, colorHex) {
    var visual = this.findChild(entity, "Visual") || entity;
    var body = this.findChild(visual, "Body");
    if (!body) {
      console.warn("[PlayerAppearance] Body child missing on " + entity.name + ". Skipping body color.");
      return;
    }

    var color = this.hexToColor(colorHex);
    var meshInstances = this.getMeshInstances(body);
    if (meshInstances.length === 0) {
      console.warn("[PlayerAppearance] Body has no render/model mesh instances on " + entity.name + ".");
      return;
    }

    for (var i = 0; i < meshInstances.length; i++) {
      var meshInstance = meshInstances[i];
      if (!meshInstance || !meshInstance.material) {
        continue;
      }

      if (!meshInstance._arcadeAppearanceMaterial) {
        meshInstance._arcadeAppearanceMaterial = meshInstance.material.clone();
        meshInstance.material = meshInstance._arcadeAppearanceMaterial;
      }

      meshInstance.material.diffuse = color.clone();
      meshInstance.material.update();
    }
  },

  applyHat: function (entity, hatId) {
    var visual = this.findChild(entity, "Visual") || entity;
    var hats = this.findChild(visual, "Hats");
    if (!hats) {
      console.warn("[PlayerAppearance] Hats child missing on " + entity.name + ". Skipping hat selection.");
      return;
    }

    var selectedHatId = this.validHatIds.indexOf(hatId) !== -1 ? hatId : this.defaultHatId;
    var foundSelectedHat = false;
    for (var i = 0; i < hats.children.length; i++) {
      var child = hats.children[i];
      var isSelected = child.name === selectedHatId;
      child.enabled = isSelected;
      foundSelectedHat = foundSelectedHat || isSelected;
    }

    if (!foundSelectedHat) {
      console.warn("[PlayerAppearance] Hat child '" + selectedHatId + "' missing under Hats on " + entity.name + ".");
    }
  },

  findChild: function (entity, name) {
    if (!entity) {
      return null;
    }

    if (entity.name === name) {
      return entity;
    }

    if (entity.findByName) {
      var found = entity.findByName(name);
      if (found) {
        return found;
      }
    }

    var children = entity.children || [];
    for (var i = 0; i < children.length; i++) {
      var childFound = this.findChild(children[i], name);
      if (childFound) {
        return childFound;
      }
    }

    return null;
  },

  getMeshInstances: function (entity) {
    var meshInstances = [];
    this.collectMeshInstances(entity, meshInstances);
    return meshInstances;
  },

  collectMeshInstances: function (entity, meshInstances) {
    if (!entity) {
      return;
    }

    if (entity.render && entity.render.meshInstances) {
      for (var i = 0; i < entity.render.meshInstances.length; i++) {
        meshInstances.push(entity.render.meshInstances[i]);
      }
    }

    if (entity.model && entity.model.meshInstances) {
      for (var j = 0; j < entity.model.meshInstances.length; j++) {
        meshInstances.push(entity.model.meshInstances[j]);
      }
    }

    var children = entity.children || [];
    for (var k = 0; k < children.length; k++) {
      this.collectMeshInstances(children[k], meshInstances);
    }
  },

  hexToColor: function (hex) {
    var safeHex = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : this.defaultColor;
    var value = parseInt(safeHex.slice(1), 16);
    var r = ((value >> 16) & 255) / 255;
    var g = ((value >> 8) & 255) / 255;
    var b = (value & 255) / 255;
    return new pc.Color(r, g, b);
  }
};

window.ArcadePlayerAppearance = ArcadePlayerAppearance;

PlayerAppearance.prototype.initialize = function () {
  this._profile = null;
};

PlayerAppearance.prototype.applyProfile = function (profile) {
  this._profile = ArcadePlayerAppearance.sanitizeProfile(profile);
  ArcadePlayerAppearance.applyToEntity(this.entity, this._profile);
};
