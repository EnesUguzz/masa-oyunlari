import type { Player, PlayerId } from "@masa/shared";
import type { Rng } from "../../core/rng.js";
import { InvalidMoveError } from "../../core/errors/index.js";
import type { OkeyGameConfig } from "./game-config.js";
import type { OkeyGameState } from "./game-state.js";
import type { Move } from "./move.js";
import { createHand } from "./setup.js";
import { applyMove } from "./apply.js";
import { scoreHand } from "./scoring.js";
import { createMatch, applyHandScore, type MatchState } from "./match.js";
import { toOkeyPlayerView } from "./view.js";
import { autoMoves } from "./auto-move.js";
import { botMoves } from "./bot.js";
import type { OkeyTableView, SeatInfo } from "./table-view.js";

/** Per-room live okey game: wraps the pure engine, advances hands, projects views. */
export class OkeySession {
  private hand: OkeyGameState;
  private match: MatchState;
  private handNumber = 1;
  private readonly seats: SeatInfo[];
  private readonly ids: PlayerId[];

  constructor(
    readonly config: OkeyGameConfig,
    seating: readonly Player[],
    private readonly rng: Rng,
  ) {
    if (seating.length !== 4) throw new InvalidMoveError("okey requires exactly 4 players");
    this.seats = seating.map((p, seat) => ({ seat, playerId: p.id, nickname: p.nickname, isBot: p.isBot ?? false }));
    this.ids = seating.map((p) => p.id);
    this.match = createMatch(config, this.ids);
    this.hand = createHand(config, this.ids, rng);
  }

  get currentSeat(): number {
    return this.hand.turn;
  }
  get isOver(): boolean {
    return this.match.status === "finished";
  }
  get handNo(): number {
    return this.handNumber;
  }

  seatOf(playerId: PlayerId): number | null {
    const found = this.seats.find((s) => s.playerId === playerId);
    return found ? found.seat : null;
  }

  isBotSeat(seat: number): boolean {
    return this.seats[seat]?.isBot ?? false;
  }

  apply(bySeat: number, move: Move): void {
    this.hand = applyMove(this.hand, move, bySeat);
    if (this.hand.status === "finished") {
      this.match = applyHandScore(this.match, scoreHand(this.hand));
      if (this.match.status === "playing") {
        this.handNumber += 1;
        this.hand = createHand(this.config, this.ids, this.rng);
      }
    }
  }

  /** Auto-play a seat's turn. Bots use the heuristic planner; humans (timeout) use safe autoMoves. */
  autoPlayTurn(seat: number): void {
    const hn = this.handNumber;
    let guard = 0;
    while (this.handNumber === hn && this.hand.status === "playing" && this.hand.turn === seat && guard++ < 12) {
      const moves = this.planTurn(seat);
      if (moves.length === 0) break;
      for (const m of moves) {
        this.apply(seat, m);
        if (this.handNumber !== hn || this.hand.turn !== seat) break;
      }
    }
  }

  /** Bot seat -> heuristic plan validated by dry-run; on any problem fall back to safe autoMoves. */
  private planTurn(seat: number): Move[] {
    if (this.isBotSeat(seat)) {
      try {
        const moves = botMoves(this.hand, seat);
        if (moves.length > 0 && this.movesAreLegal(seat, moves)) return moves;
      } catch {
        // düş
      }
    }
    return autoMoves(this.hand);
  }

  /** Dry-run on cloned state (applyMove is pure) so a buggy plan never corrupts the live hand. */
  private movesAreLegal(seat: number, moves: Move[]): boolean {
    let s = this.hand;
    for (const m of moves) {
      try {
        s = applyMove(s, m, s.turn);
      } catch {
        return false;
      }
      if (s.status !== "playing" || s.turn !== seat) break;
    }
    return true;
  }

  seatList(): SeatInfo[] {
    return this.seats;
  }

  tableViewFor(seat: number): OkeyTableView {
    return {
      view: toOkeyPlayerView(this.hand, seat),
      match: {
        seatTotals: [...this.match.seatTotals],
        teamTotals: this.match.teamTotals === null ? null : [...this.match.teamTotals],
        handsPlayed: this.match.handsPlayed,
        targetHands: this.config.targetHands,
        status: this.match.status,
        winner: this.match.winner,
      },
      handNumber: this.handNumber,
      seating: this.seats.map((s) => ({ ...s })),
    };
  }
}
