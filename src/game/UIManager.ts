import { GameState } from '../types';

export class UIManager {
  private state: GameState;
  private onStateChange: (state: GameState) => void;

  constructor(initialState: GameState, onStateChange: (state: GameState) => void) {
    this.state = initialState;
    this.onStateChange = onStateChange;
  }

  public updateState(patch: Partial<GameState>, playerDeckCount: number, enemyDeckCount: number, playerGraveyardCount: number = 0, enemyGraveyardCount: number = 0) {
    this.state = {
      ...this.state,
      ...patch,
      playerDeckCount,
      enemyDeckCount,
      playerGraveyardCount: playerGraveyardCount || this.state.playerGraveyardCount,
      enemyGraveyardCount: enemyGraveyardCount || this.state.enemyGraveyardCount
    };
    this.onStateChange(this.state);
  }

  public addLog(msg: string) {
    const logs = [...this.state.logs, msg];
    if (logs.length > 50) logs.shift();
    this.updateState({ logs }, this.state.playerDeckCount, this.state.enemyDeckCount, this.state.playerGraveyardCount, this.state.enemyGraveyardCount);
  }

  public getState(): GameState {
    return this.state;
  }
}
