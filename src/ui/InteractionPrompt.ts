export class InteractionPrompt {
  private readonly element: HTMLDivElement;

  public constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.style.position = 'absolute';
    this.element.style.left = '50%';
    this.element.style.bottom = '48px';
    this.element.style.transform = 'translateX(-50%)';
    this.element.style.padding = '10px 14px';
    this.element.style.borderRadius = '8px';
    this.element.style.background = 'rgba(0, 0, 0, 0.65)';
    this.element.style.color = '#f4f7ff';
    this.element.style.fontWeight = '600';
    this.element.style.fontSize = '14px';
    this.element.style.display = 'none';

    container.appendChild(this.element);
  }

  public show(message: string): void {
    this.element.textContent = message;
    this.element.style.display = 'block';
  }

  public hide(): void {
    this.element.style.display = 'none';
  }
}
