import type { Entity } from 'playcanvas';

export interface Interactable {
  readonly id: string;
  readonly label: string;
  entity: Entity;
  interact(): void;
}
