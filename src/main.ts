import { ArcadeGame } from './game/ArcadeGame';

const appContainer = document.getElementById('app');
if (!appContainer) {
  throw new Error('App container not found.');
}

const canvas = document.createElement('canvas');
appContainer.appendChild(canvas);

const game = new ArcadeGame(canvas, appContainer);
void game.start();
