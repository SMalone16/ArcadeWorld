import { InteractionPrompt } from './InteractionPrompt';

export class Hud {
  public readonly interactionPrompt: InteractionPrompt;

  public constructor(container: HTMLElement) {
    this.interactionPrompt = new InteractionPrompt(container);
  }
}
