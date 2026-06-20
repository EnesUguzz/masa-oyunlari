import type { OkeyTile, NumberedTile } from "./tile.js";
import { isWildcard } from "./okey.js";
import { isValidMeld } from "./meld.js";
import { meldThreshold, pairThreshold } from "./helpers.js";
import type { OkeyGameState } from "./game-state.js";
import type { Move } from "./move.js";
import { decompose, tileKey, removeTiles } from "./decompose.js";

// Re-exported for back-compat: the pure hand-decomposition helpers now live in
// decompose.ts so both the bot and the engine's autoOpen can share them.
export { decompose, tileKey, removeTiles } from "./decompose.js";
export type { Decomposition, DecomposeGoal } from "./decompose.js";

function tileVal(t: OkeyTile): number {
  return t.kind === "numbered" ? t.value : 0;
}

export function chooseDiscard(
  hand: readonly OkeyTile[],
  okey: NumberedTile,
  tableMelds: OkeyGameState["tableMelds"] = [],
): OkeyTile {
  if (hand.length === 0) throw new Error("chooseDiscard: empty hand");
  const nonWild = hand.filter((t) => !isWildcard(t, okey));
  const pool = nonWild.length > 0 ? nonWild : [...hand];

  // En çok taş kullanan çözümlemede yer almayan taşlar "ölü"dür.
  const best = decompose(hand, okey, "maxTilesUsed");
  const remainingUsed = new Map<string, number>();
  for (const g of best.groups) for (const t of g) {
    const k = tileKey(t);
    remainingUsed.set(k, (remainingUsed.get(k) ?? 0) + 1);
  }
  const dead: OkeyTile[] = [];
  for (const t of pool) {
    const k = tileKey(t);
    const c = remainingUsed.get(k) ?? 0;
    if (c > 0) remainingUsed.set(k, c - 1);
    else dead.push(t);
  }
  const candidates = dead.length > 0 ? dead : pool;
  // Avoid the işlek-taş penalty (+101): never discard a tile that could be
  // processed onto a table run/set when a safe alternative exists.
  const safe = candidates.filter((t) => findProcessTarget(tableMelds, t, okey) === null);
  const finalPool = safe.length > 0 ? safe : candidates;
  return finalPool.reduce((worst, t) => (tileVal(t) > tileVal(worst) ? t : worst), finalPool[0]!);
}

function findPairs(hand: readonly OkeyTile[], okey: NumberedTile): OkeyTile[][] {
  const wilds: OkeyTile[] = [];
  const byKey = new Map<string, OkeyTile[]>();
  for (const t of hand) {
    if (isWildcard(t, okey)) { wilds.push(t); continue; }
    const k = tileKey(t);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(t);
  }
  const pairs: OkeyTile[][] = [];
  const singles: OkeyTile[] = [];
  for (const arr of byKey.values()) {
    let i = 0;
    for (; i + 1 < arr.length; i += 2) pairs.push([arr[i]!, arr[i + 1]!]);
    if (i < arr.length) singles.push(arr[i]!);
  }
  let wi = 0;
  for (const s of singles) {
    if (wi < wilds.length) { pairs.push([s, wilds[wi]!]); wi++; }
  }
  for (; wi + 1 < wilds.length; wi += 2) pairs.push([wilds[wi]!, wilds[wi + 1]!]);
  return pairs;
}

function findProcessTarget(
  tableMelds: OkeyGameState["tableMelds"],
  tile: OkeyTile,
  okey: NumberedTile,
): string | null {
  for (const m of tableMelds) {
    if (m.kind === "pair") continue;
    if (isValidMeld([...m.tiles, tile], okey)) return m.id;
  }
  return null;
}

function decideAct(state: OkeyGameState, seat: number): Move[] {
  const okey = state.okey;
  const me = state.players[seat]!;
  const moves: Move[] = [];
  let hand = [...me.hand];

  const tableTiles = new Map<string, OkeyTile[]>();
  for (const m of state.tableMelds) if (m.kind !== "pair") tableTiles.set(m.id, [...m.tiles]);

  // 0. pendingFloorTile varsa önce onu masaya işle (yoksa atış legal olmaz)
  if (state.pendingFloorTile !== null) {
    const floor = state.pendingFloorTile;
    const targetId = findProcessTarget(state.tableMelds, floor, okey);
    if (targetId === null) return []; // güvenli değil; çağıran fallback'e düşsün
    moves.push({ kind: "processToMeld", meldId: targetId, tiles: [floor] });
    hand = removeTiles(hand, [floor]);
    const cur = tableTiles.get(targetId);
    if (cur) tableTiles.set(targetId, [...cur, floor]);
  }

  let opened = me.opened;
  let openMode: "melds" | "pairs" | null = me.openMode;

  // 1. açma
  if (!opened) {
    const dMax = decompose(hand, okey, "maxValue");
    if (dMax.groups.length > 0 && dMax.value >= meldThreshold(state)) {
      moves.push({ kind: "openMelds", melds: dMax.groups.map((g) => [...g]) });
      hand = removeTiles(hand, dMax.groups.flat());
      opened = true; openMode = "melds";
    } else {
      const pairs = findPairs(hand, okey);
      if (pairs.length >= pairThreshold(state)) {
        moves.push({ kind: "openPairs", pairs: pairs.map((p) => [...p]) });
        hand = removeTiles(hand, pairs.flat());
        opened = true; openMode = "pairs";
      }
    }
  }

  // 2. açıksa daha fazla diz (atış için en az 1 taş bırak)
  if (opened && openMode === "melds") {
    let more = true;
    while (more) {
      more = false;
      const d = decompose(hand, okey, "maxTilesUsed");
      for (const g of d.groups) {
        if (hand.length - g.length >= 1) {
          moves.push({ kind: "openNewMeld", tiles: [...g] });
          hand = removeTiles(hand, g);
          more = true;
          break;
        }
      }
    }
    let processed = true;
    while (processed && hand.length > 1) {
      processed = false;
      for (const t of hand) {
        for (const [id, tiles] of tableTiles) {
          const cand = [...tiles, t];
          if (isValidMeld(cand, okey)) {
            moves.push({ kind: "processToMeld", meldId: id, tiles: [t] });
            tableTiles.set(id, cand);
            hand = removeTiles(hand, [t]);
            processed = true;
            break;
          }
        }
        if (processed) break;
      }
    }
  } else if (opened && openMode === "pairs") {
    for (const p of findPairs(hand, okey)) {
      if (hand.length - 2 >= 1) {
        moves.push({ kind: "openNewMeld", tiles: [...p] });
        hand = removeTiles(hand, p);
      }
    }
  }

  // 3. atış — güncel masadaki perlere (bu tur işlenenler dahil) işlenebilen taşı atma.
  const liveMelds = [...tableTiles.entries()].map(([id, tiles]) => ({ id, owner: seat, kind: "run" as const, tiles }));
  moves.push({ kind: "discard", tile: chooseDiscard(hand, okey, liveMelds) });
  return moves;
}

function decideDraw(state: OkeyGameState, seat: number): Move {
  const me = state.players[seat]!;
  if (me.opened && me.openMode !== "pairs") {
    const prev = (seat + 3) % 4;
    const pile = state.discards[prev]!;
    const top = pile[pile.length - 1];
    if (top && findProcessTarget(state.tableMelds, top, state.okey) !== null) {
      return { kind: "drawFromDiscard" };
    }
  }
  return { kind: "drawFromPile" };
}

export function botMoves(state: OkeyGameState, seat: number): Move[] {
  if (state.status !== "playing" || state.turn !== seat) return [];
  if (state.phase === "draw") return [decideDraw(state, seat)];
  return decideAct(state, seat);
}
