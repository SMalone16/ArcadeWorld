import type { IMiniGame } from '../game/types';
import { ExampleMiniGame } from './example/ExampleMiniGame';

const miniGames = new Map<string, IMiniGame>();

function registerDefaults(): void {
  const example = new ExampleMiniGame();
  miniGames.set(example.id, example);
}

registerDefaults();

export function getMiniGameById(id: string): IMiniGame | undefined {
  return miniGames.get(id);
}

export function listMiniGames(): IMiniGame[] {
  return Array.from(miniGames.values());
}
