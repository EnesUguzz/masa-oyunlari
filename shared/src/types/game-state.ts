/**
 * Generic base for per-game state. TPublic is the shape every player may see.
 * The Okey slice will extend this; here it stays minimal (YAGNI).
 */
export interface GameState<TPublic> {
  public: TPublic;
}
