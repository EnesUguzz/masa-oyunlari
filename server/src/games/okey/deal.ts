import type { NumberedTile, OkeyTile } from "./tile.js";
import { isNumbered } from "./tile.js";

export interface DealResult {
  hands: OkeyTile[][]; // 4 hands; hands[0] = starting player (22), the rest 21
  indicator: NumberedTile;
  drawPile: OkeyTile[];
  startingPlayerIndex: 0;
}

const DECK_SIZE = 106;
const HAND_SIZES = [22, 21, 21, 21] as const;

/**
 * Partition a shuffled 106-tile deck into 4 hands, an indicator, and the draw
 * pile. The indicator is the first numbered tile (fake jokers are skipped, since
 * the gösterge is always a numbered tile). Pure: does not mutate the input.
 */
export function deal(shuffledDeck: readonly OkeyTile[]): DealResult {
  if (shuffledDeck.length !== DECK_SIZE) {
    throw new RangeError(`deal expects ${DECK_SIZE} tiles, got ${shuffledDeck.length}`);
  }
  const pile = shuffledDeck.slice();

  const indicatorIdx = pile.findIndex(isNumbered);
  const indicator = indicatorIdx === -1 ? undefined : pile[indicatorIdx];
  if (indicator === undefined || !isNumbered(indicator)) {
    throw new Error("deck has no numbered tile to use as indicator");
  }
  pile.splice(indicatorIdx, 1);

  const hands: OkeyTile[][] = [];
  for (const size of HAND_SIZES) {
    hands.push(pile.splice(0, size));
  }

  return { hands, indicator, drawPile: pile, startingPlayerIndex: 0 };
}
