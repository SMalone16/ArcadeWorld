import { InteractionPrompt } from './InteractionPrompt';
import { ManhuntHud } from './ManhuntHud';

export class Hud {
  public readonly interactionPrompt: InteractionPrompt;
  public readonly manhuntHud: ManhuntHud;

  public constructor(container: HTMLElement) {
    this.interactionPrompt = new InteractionPrompt(container);
    this.manhuntHud = new ManhuntHud(container);
  }
}
