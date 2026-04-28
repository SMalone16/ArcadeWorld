import type { INetworkClient } from '../game/types';
import { LocalMockNetworkClient } from './LocalMockNetworkClient';

/**
 * Single creation point for networking so future migration to Colyseus stays isolated.
 */
export function createNetworkClient(): INetworkClient {
  return new LocalMockNetworkClient();
}
