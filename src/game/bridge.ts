import type { GameEvent } from '../core/sim';
import type { GameState } from '../core/state';

/** What the Phaser scene needs from the rest of the app. */
export interface Bridge {
  state: GameState;
  /** Device pixel ratio the canvas is rendered at. */
  dpr: number;
  /** Space taken by DOM UI at the top and bottom, in CSS pixels. */
  insets(): { top: number; bottom: number };
  /** Where flying coins should land (cash counter), in CSS pixels relative to #app. */
  cashTarget(): { x: number; y: number };
  /** Called with every event the simulation or the player produced. */
  onEvents(events: GameEvent[]): void;
  /** Called on any player input (audio unlock, save scheduling). */
  onInput(): void;
  /** The covered car at the back of the yard was tapped. */
  onBarnTap(): void;
}
