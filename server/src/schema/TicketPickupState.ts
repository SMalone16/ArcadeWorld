import { Schema, type } from "@colyseus/schema";

export class TicketPickupState extends Schema {
  @type("string")
  id = "";

  @type("number")
  spawnIndex = -1;

  @type("number")
  x = 0;

  @type("number")
  y = 0;

  @type("number")
  z = 0;

  @type("boolean")
  active = false;

  @type("number")
  version = 0;
}
