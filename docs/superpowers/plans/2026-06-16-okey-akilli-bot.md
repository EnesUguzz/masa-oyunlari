# Okey 101 Akıllı (Sezgisel) Bot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bot koltuklarına, elinde per/çift arayıp eşik dolunca açan, dizebildiğini masaya koyan, bitebiliyorsa bitiren ve kalan taşların ceza puanını düşürecek şekilde atan saf/sezgisel bir bot eklemek.

**Architecture:** Yeni saf modül `server/src/games/okey/bot.ts` tek bir `botMoves(state, seat): Move[]` API'si sunar. Çekirdek el-çözümleme `decompose()` düğüm-sınırlı backtracking ile çalışır (mevcut `isValidMeld`/`meldValue`/`isPair` validatörlerini kullanır). `OkeySession.autoPlayTurn` bot koltuklarında `botMoves`'u, insan zaman aşımında mevcut güvenli `autoMoves`'u kullanır; bot planı dry-run ile doğrulanır, geçersizse `autoMoves`'a düşülür (oyun asla kilitlenmez).

**Tech Stack:** TypeScript (strict, ESM `.js` import uzantıları), Vitest.

**Scope notu:** Çekirdek bot **yalnızca desteden çeker** (drawFromPile). Discard'tan çekme (floor-tile kuralı nedeniyle riskli) ayrı, opsiyonel **Task 5**'e bırakıldı. Spec: `docs/superpowers/specs/2026-06-16-okey-akilli-bot-design.md`.

---

## Dosya yapısı

- **Create:** `server/src/games/okey/bot.ts` — tüm bot mantığı (decompose + planlama).
- **Create:** `server/src/games/okey/bot.test.ts` — birim testleri.
- **Modify:** `server/src/games/okey/session.ts` — `autoPlayTurn` bot/insan ayrımı + dry-run fallback.
- **Modify:** `server/src/games/okey/session.test.ts` — 4-bot uçtan uca el testi.

Test komutu (tek dosya): `pnpm --filter @masa/server test -- bot.test.ts`
Tüm sunucu testleri: `pnpm --filter @masa/server test`
Tip kontrolü: `pnpm typecheck`

---

## Task 1: `decompose` çekirdeği + yardımcılar

**Files:**
- Create: `server/src/games/okey/bot.ts`
- Test: `server/src/games/okey/bot.test.ts`

- [ ] **Step 1: Başarısız testi yaz**

`server/src/games/okey/bot.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { numbered, fakeJoker } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import { decompose } from "./bot.js";

const okey: NumberedTile = numbered("red", 13); // wildcard = red13; fakeJoker da wild

describe("decompose", () => {
  it("bir run'ı tek grup olarak bulur", () => {
    const hand: OkeyTile[] = [numbered("red", 4), numbered("red", 5), numbered("red", 6)];
    const d = decompose(hand, okey, "maxTilesUsed");
    expect(d.groups).toHaveLength(1);
    expect(d.tilesUsed).toBe(3);
    expect(d.value).toBe(15);
  });

  it("bir set'i bulur", () => {
    const hand: OkeyTile[] = [numbered("red", 5), numbered("blue", 5), numbered("black", 5)];
    const d = decompose(hand, okey, "maxValue");
    expect(d.groups).toHaveLength(1);
    expect(d.tilesUsed).toBe(3);
    expect(d.value).toBe(15);
  });

  it("joker'i wildcard olarak per tamamlamada kullanır", () => {
    const hand: OkeyTile[] = [numbered("red", 5), numbered("red", 6), fakeJoker()];
    const d = decompose(hand, okey, "maxTilesUsed");
    expect(d.tilesUsed).toBe(3);
    expect(d.groups).toHaveLength(1);
  });

  it("çözülemeyen elde boş döner", () => {
    const hand: OkeyTile[] = [numbered("red", 5), numbered("blue", 9), numbered("black", 2)];
    const d = decompose(hand, okey, "maxTilesUsed");
    expect(d.groups).toHaveLength(0);
    expect(d.tilesUsed).toBe(0);
    expect(d.value).toBe(0);
  });

  it("iki ayrı per'i birlikte bulur", () => {
    const hand: OkeyTile[] = [
      numbered("red", 4), numbered("red", 5), numbered("red", 6),
      numbered("blue", 7), numbered("blue", 8), numbered("blue", 9),
    ];
    const d = decompose(hand, okey, "maxTilesUsed");
    expect(d.tilesUsed).toBe(6);
    expect(d.groups).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `pnpm --filter @masa/server test -- bot.test.ts`
Expected: FAIL — `Cannot find module './bot.js'` / `decompose is not exported`.

- [ ] **Step 3: Minimal implementasyonu yaz**

`server/src/games/okey/bot.ts` (yeni dosya):

```ts
import type { OkeyTile, NumberedTile } from "./tile.js";
import { isWildcard } from "./okey.js";
import { isValidMeld } from "./meld.js";
import { meldValue } from "./points.js";

export interface Decomposition {
  groups: OkeyTile[][];
  value: number;
  tilesUsed: number;
}

export type DecomposeGoal = "maxValue" | "maxTilesUsed";

const COLOR_ORDER: Record<string, number> = { red: 0, yellow: 1, black: 2, blue: 3 };
const NODE_CAP = 50000;

export function tileKey(t: OkeyTile): string {
  return t.kind === "fakeJoker" ? "fake" : `${t.color}:${t.value}`;
}

export function removeTiles(hand: readonly OkeyTile[], remove: readonly OkeyTile[]): OkeyTile[] {
  const counts = new Map<string, number>();
  for (const t of remove) counts.set(tileKey(t), (counts.get(tileKey(t)) ?? 0) + 1);
  const out: OkeyTile[] = [];
  for (const t of hand) {
    const k = tileKey(t);
    const c = counts.get(k) ?? 0;
    if (c > 0) counts.set(k, c - 1);
    else out.push(t);
  }
  return out;
}

function cmpNatural(a: NumberedTile, b: NumberedTile): number {
  if (a.value !== b.value) return a.value - b.value;
  return (COLOR_ORDER[a.color] ?? 0) - (COLOR_ORDER[b.color] ?? 0);
}

function combinations<T>(arr: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const [head, ...rest] = arr;
  const withHead = combinations(rest, k - 1).map((c) => [head as T, ...c]);
  const without = combinations(rest, k);
  return [...withHead, ...without];
}

export function decompose(
  tiles: readonly OkeyTile[],
  okey: NumberedTile,
  goal: DecomposeGoal,
): Decomposition {
  const n = tiles.length;
  const used: boolean[] = new Array(n).fill(false);
  const wildFlag: boolean[] = tiles.map((t) => isWildcard(t, okey));
  const natOrder: number[] = tiles
    .map((_, i) => i)
    .filter((i) => !wildFlag[i])
    .sort((a, b) => cmpNatural(tiles[a] as NumberedTile, tiles[b] as NumberedTile));

  const best = { groups: [] as OkeyTile[][], value: 0, tilesUsed: 0 };
  const cur: OkeyTile[][] = [];
  let curValue = 0;
  let curTiles = 0;
  let nodes = 0;

  const isBetter = (v: number, t: number): boolean => {
    if (goal === "maxValue") return v > best.value || (v === best.value && t > best.tilesUsed);
    return t > best.tilesUsed || (t === best.tilesUsed && v > best.value);
  };

  const unusedWilds = (): number[] => {
    const out: number[] = [];
    for (let i = 0; i < n; i++) if (wildFlag[i] && !used[i]) out.push(i);
    return out;
  };
  const firstUnusedNatural = (): number => {
    for (const i of natOrder) if (!used[i]) return i;
    return -1;
  };
  const natAt = (color: string, value: number): number => {
    for (const i of natOrder) {
      if (used[i]) continue;
      const t = tiles[i] as NumberedTile;
      if (t.color === color && t.value === value) return i;
    }
    return -1;
  };

  const meldsContaining = (anchor: number): number[][] => {
    const a = tiles[anchor] as NumberedTile;
    const result: number[][] = [];
    const wilds = unusedWilds();

    // sets: aynı değer, farklı renkler
    const byColor = new Map<string, number>();
    for (const i of natOrder) {
      if (used[i] || i === anchor) continue;
      const u = tiles[i] as NumberedTile;
      if (u.value === a.value && u.color !== a.color && !byColor.has(u.color)) byColor.set(u.color, i);
    }
    const otherColorNats = [...byColor.values()];
    for (let o = 0; o <= otherColorNats.length; o++) {
      for (const others of combinations(otherColorNats, o)) {
        for (let w = 0; w <= wilds.length; w++) {
          const size = 1 + o + w;
          if (size < 3 || size > 4) continue;
          const meld = [anchor, ...others, ...wilds.slice(0, w)];
          if (isValidMeld(meld.map((i) => tiles[i]!), okey)) result.push(meld);
        }
      }
    }

    // runs: aynı renk, ardışık değerler, anchor dahil
    for (let lo = Math.max(1, a.value - 12); lo <= a.value; lo++) {
      for (let hi = Math.max(a.value, lo + 2); hi <= 13; hi++) {
        const picks: number[] = [];
        let need = 0;
        for (let v = lo; v <= hi; v++) {
          if (v === a.value) { picks.push(anchor); continue; }
          const idx = natAt(a.color, v);
          if (idx !== -1) picks.push(idx);
          else need++;
        }
        if (need > wilds.length) continue;
        const meld = [...picks, ...wilds.slice(0, need)];
        if (meld.length < 3) continue;
        if (isValidMeld(meld.map((i) => tiles[i]!), okey)) result.push(meld);
      }
    }
    return result;
  };

  const recurse = (): void => {
    nodes++;
    if (isBetter(curValue, curTiles)) {
      best.value = curValue;
      best.tilesUsed = curTiles;
      best.groups = cur.map((g) => [...g]);
    }
    if (nodes > NODE_CAP) return;
    const anchor = firstUnusedNatural();
    if (anchor === -1) return;

    // Branch A: anchor leftover
    used[anchor] = true;
    recurse();
    used[anchor] = false;

    // Branch B: anchor içeren her per
    for (const meld of meldsContaining(anchor)) {
      const tilesArr = meld.map((i) => tiles[i]!);
      const v = meldValue(tilesArr, okey);
      for (const i of meld) used[i] = true;
      cur.push(tilesArr);
      curValue += v;
      curTiles += meld.length;
      recurse();
      curValue -= v;
      curTiles -= meld.length;
      cur.pop();
      for (const i of meld) used[i] = false;
    }
  };

  recurse();
  return { groups: best.groups, value: best.value, tilesUsed: best.tilesUsed };
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `pnpm --filter @masa/server test -- bot.test.ts`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add server/src/games/okey/bot.ts server/src/games/okey/bot.test.ts
git commit -m "$(printf 'feat(okey-bot): decompose el-cozumleme cekirdegi\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: `chooseDiscard` — güvenli atış seçimi

**Files:**
- Modify: `server/src/games/okey/bot.ts`
- Test: `server/src/games/okey/bot.test.ts`

- [ ] **Step 1: Başarısız testi yaz**

`bot.test.ts` sonuna ekle:

```ts
import { chooseDiscard } from "./bot.js";

describe("chooseDiscard", () => {
  it("per'e girmeyen ölü taşı atar", () => {
    const hand: OkeyTile[] = [
      numbered("red", 4), numbered("red", 5), numbered("red", 6), // per
      numbered("black", 12), // ölü, yüksek değer
    ];
    const t = chooseDiscard(hand, okey);
    expect(t).toEqual(numbered("black", 12));
  });

  it("mümkünse joker atmaz", () => {
    const hand: OkeyTile[] = [fakeJoker(), numbered("black", 3)];
    const t = chooseDiscard(hand, okey);
    expect(t).toEqual(numbered("black", 3));
  });

  it("birden çok ölü taştan en yüksek değerliyi atar", () => {
    const hand: OkeyTile[] = [numbered("blue", 2), numbered("black", 9), numbered("red", 4)];
    const t = chooseDiscard(hand, okey);
    expect(t).toEqual(numbered("black", 9));
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `pnpm --filter @masa/server test -- bot.test.ts`
Expected: FAIL — `chooseDiscard is not exported`.

- [ ] **Step 3: Minimal implementasyonu yaz**

`bot.ts` sonuna ekle (decompose'dan sonra):

```ts
function tileVal(t: OkeyTile): number {
  return t.kind === "numbered" ? t.value : 0;
}

export function chooseDiscard(hand: readonly OkeyTile[], okey: NumberedTile): OkeyTile {
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
  return candidates.reduce((worst, t) => (tileVal(t) > tileVal(worst) ? t : worst), candidates[0]!);
}
```

`bot.ts` üst importuna `isWildcard` zaten var (Task 1). Değişiklik gerekmez.

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `pnpm --filter @masa/server test -- bot.test.ts`
Expected: PASS (8 test).

- [ ] **Step 5: Commit**

```bash
git add server/src/games/okey/bot.ts server/src/games/okey/bot.test.ts
git commit -m "$(printf 'feat(okey-bot): chooseDiscard guvenli atis secimi\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: `botMoves` — tur planı (çek / aç / diz / bitir / at)

**Files:**
- Modify: `server/src/games/okey/bot.ts`
- Test: `server/src/games/okey/bot.test.ts`

- [ ] **Step 1: Başarısız testi yaz**

`bot.test.ts` sonuna ekle (st/p yardımcılarını dahil et):

```ts
import { botMoves } from "./bot.js";
import type { OkeyGameState, PlayerHandState } from "./game-state.js";
import type { PlayerId } from "@masa/shared";
import { makeConfig } from "./game-config.js";

function ph(seat: number, hand: OkeyTile[], over: Partial<PlayerHandState> = {}): PlayerHandState {
  return { seat, playerId: `p${seat}` as PlayerId, team: null, hand, opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null, ...over };
}
function gs(over: Partial<OkeyGameState> & { players: PlayerHandState[] }): OkeyGameState {
  return {
    config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", penalty: "cezasiz", targetHands: 11 }),
    indicator: numbered("red", 12), okey, drawPile: [], discards: [[], [], [], []], tableMelds: [],
    turn: 0, turnSeq: 0, phase: "draw", pendingFloorTile: null, highestOpenScore: null, highestOpenPairs: null,
    feedingEvents: [], meldSeq: 0, status: "playing", outcome: null, ...over,
  };
}

describe("botMoves", () => {
  it("çekme fazında desteden çeker", () => {
    const s = gs({ players: [ph(0, [numbered("blue", 4)]), ph(1, []), ph(2, []), ph(3, [])], phase: "draw" });
    expect(botMoves(s, 0)).toEqual([{ kind: "drawFromPile" }]);
  });

  it("eşik tutmuyorsa açmaz, sadece atar", () => {
    const hand = [numbered("blue", 2), numbered("black", 3), numbered("red", 7)];
    const s = gs({ players: [ph(0, hand), ph(1, []), ph(2, []), ph(3, [])], phase: "act" });
    const moves = botMoves(s, 0);
    expect(moves.every((m) => m.kind !== "openMelds" && m.kind !== "openPairs")).toBe(true);
    expect(moves[moves.length - 1]!.kind).toBe("discard");
  });

  it("eşik dolunca per'lerle açar ve sonunda atar", () => {
    const hand = [
      numbered("red", 11), numbered("red", 12), numbered("red", 13), // 36
      numbered("blue", 11), numbered("blue", 12), numbered("blue", 13), // 36
      numbered("black", 9), numbered("black", 10), numbered("black", 11), // 30
      numbered("yellow", 2), // atılacak
    ];
    const s = gs({ players: [ph(0, hand), ph(1, []), ph(2, []), ph(3, [])], phase: "act" });
    const moves = botMoves(s, 0);
    expect(moves[0]!.kind).toBe("openMelds");
    expect(moves[moves.length - 1]!.kind).toBe("discard");
  });

  it("açıkken kalan taşları dizip son taşı atarak biter", () => {
    const hand = [numbered("red", 4), numbered("red", 5), numbered("red", 6), numbered("yellow", 1)];
    const s = gs({
      players: [ph(0, hand, { opened: true, openMode: "melds", openScore: 101 }), ph(1, []), ph(2, []), ph(3, [])],
      phase: "act",
    });
    const moves = botMoves(s, 0);
    expect(moves.some((m) => m.kind === "openNewMeld")).toBe(true);
    const last = moves[moves.length - 1]!;
    expect(last.kind).toBe("discard");
    expect(last).toEqual({ kind: "discard", tile: numbered("yellow", 1) });
  });

  it("sıra onda değilse boş döner", () => {
    const s = gs({ players: [ph(0, []), ph(1, [numbered("blue", 4)]), ph(2, []), ph(3, [])], phase: "act", turn: 1 });
    expect(botMoves(s, 0)).toEqual([]);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `pnpm --filter @masa/server test -- bot.test.ts`
Expected: FAIL — `botMoves is not exported`.

- [ ] **Step 3: Minimal implementasyonu yaz**

`bot.ts` importlarına ekle (dosya başı):

```ts
import { meldThreshold, pairThreshold } from "./helpers.js";
import type { OkeyGameState } from "./game-state.js";
import type { Move } from "./move.js";
```

`bot.ts` sonuna ekle:

```ts
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

function decideAct(state: OkeyGameState, seat: number): Move[] {
  const okey = state.okey;
  const me = state.players[seat]!;
  const moves: Move[] = [];
  let hand = [...me.hand];

  // masadaki dizilebilir per'ler (run/set), işleme sırasında büyüyebilir
  const tableTiles = new Map<string, OkeyTile[]>();
  for (const m of state.tableMelds) if (m.kind !== "pair") tableTiles.set(m.id, [...m.tiles]);

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

  // 3. atış
  moves.push({ kind: "discard", tile: chooseDiscard(hand, okey) });
  return moves;
}

export function botMoves(state: OkeyGameState, seat: number): Move[] {
  if (state.status !== "playing" || state.turn !== seat) return [];
  if (state.phase === "draw") return [{ kind: "drawFromPile" }];
  if (state.pendingFloorTile !== null) return []; // çağıran güvenli fallback'e düşsün
  return decideAct(state, seat);
}
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `pnpm --filter @masa/server test -- bot.test.ts`
Expected: PASS (13 test).

- [ ] **Step 5: Commit**

```bash
git add server/src/games/okey/bot.ts server/src/games/okey/bot.test.ts
git commit -m "$(printf 'feat(okey-bot): botMoves tur plani (ac/diz/bitir/at)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: Session entegrasyonu (bot/insan ayrımı + dry-run fallback)

**Files:**
- Modify: `server/src/games/okey/session.ts:12` (import) ve `session.ts:66-77` (`autoPlayTurn`)
- Test: `server/src/games/okey/session.test.ts`

- [ ] **Step 1: Başarısız testi yaz**

`server/src/games/okey/session.test.ts` zaten `SeededRng`, `makeConfig`, `config` ve `players()` (4 oyuncu) tanımlıyor (satır 1–10). Mevcut `describe("OkeySession", ...)` bloğuna yeni bir `it` ekle. Botlar için `players()`'a `isBot: true` veren yerel bir yardımcı kullan:

```ts
  it("4 bot bir eli yalnızca legal hamlelerle sonuna kadar oynar", () => {
    const bots: Player[] = players().map((p) => ({ ...p, isBot: true }));
    const session = new OkeySession(config, bots, new SeededRng(42));

    let guard = 0;
    while (!session.isOver && guard++ < 100000) {
      session.autoPlayTurn(session.currentSeat);
    }
    expect(session.isOver).toBe(true);
  });
```

> NOT: `Player` tipi `isBot?: boolean` alanını destekliyor (`session.ts:29` `p.isBot ?? false` kullanıyor). `SeededRng` ve `players()` dosyada zaten import/tanımlı — ekstra import gerekmez.

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `pnpm --filter @masa/server test -- session.test.ts`
Expected: FAIL — botlar mevcut `autoMoves` ile asla açmaz/bitmez; deste tükenene kadar oynar ama yine de biter mi? Eğer mevcut davranışla zaten bitiyorsa, test geçebilir; bu durumda Step 3'ü yine de uygula (smart bot entegrasyonu) ve testin geçmeye devam ettiğini doğrula. Asıl amaç: entegrasyondan sonra hâlâ legal ve sonlanıyor.

- [ ] **Step 3: Implementasyonu yaz**

`server/src/games/okey/session.ts` — import ekle (mevcut `autoMoves` import satırının yanına):

```ts
import { botMoves } from "./bot.js";
```

`autoPlayTurn`'ü (satır ~66) şununla değiştir:

```ts
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
```

(`applyMove`, `autoMoves`, `Move` zaten `session.ts`'de import edilmiş durumda.)

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `pnpm --filter @masa/server test`
Expected: PASS — yeni session testi + tüm mevcut testler (handlers, session, auto-move dahil) yeşil.

- [ ] **Step 5: Tip kontrolü ve commit**

Run: `pnpm typecheck`
Expected: hata yok.

```bash
git add server/src/games/okey/session.ts server/src/games/okey/session.test.ts
git commit -m "$(printf 'feat(okey-bot): session bot/insan ayrimi + dry-run fallback\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5 (OPSİYONEL / ertelenebilir): Temkinli discard'tan çekme

> Bu task, botun atılan taşı **yalnızca güvenli** olduğunda (zaten açık + taş mevcut bir masa per'ine `processToMeld` ile hemen eklenebiliyor) almasını sağlar. Floor-tile deadlock riski nedeniyle çekirdekten ayrıldı. Çekirdek (Task 1–4) bunsuz tam çalışır. Bu task'ı yalnızca botun discard kullanmasını istiyorsak uygula.

**Files:**
- Modify: `server/src/games/okey/bot.ts`
- Test: `server/src/games/okey/bot.test.ts`

- [ ] **Step 1: Başarısız testi yaz**

`bot.test.ts` `botMoves` describe'ına ekle:

```ts
it("açıkken, üstteki atılan taş mevcut bir per'e ekleniyorsa discard'tan çeker", () => {
  // sol komşu (seat 3) red 7 atmış; masada red 8-9-10 var; bot açık.
  const tableMeld = { id: "m1", owner: 1, kind: "run" as const, tiles: [numbered("red", 8), numbered("red", 9), numbered("red", 10)] };
  const s = gs({
    players: [ph(0, [numbered("blue", 2), numbered("blue", 3)], { opened: true, openMode: "melds", openScore: 101 }), ph(1, []), ph(2, []), ph(3, [])],
    phase: "draw",
    discards: [[], [], [], [numbered("red", 7)]],
    tableMelds: [tableMeld],
  });
  expect(botMoves(s, 0)).toEqual([{ kind: "drawFromDiscard" }]);
});

it("taş hemen kullanılamıyorsa desteden çeker", () => {
  const s = gs({
    players: [ph(0, [numbered("blue", 2)], { opened: true, openMode: "melds", openScore: 101 }), ph(1, []), ph(2, []), ph(3, [])],
    phase: "draw",
    discards: [[], [], [], [numbered("yellow", 13)]],
    tableMelds: [{ id: "m1", owner: 1, kind: "set", tiles: [numbered("red", 5), numbered("blue", 5), numbered("black", 5)] }],
  });
  expect(botMoves(s, 0)).toEqual([{ kind: "drawFromPile" }]);
});
```

Ayrıca `decideAct`'ın `pendingFloorTile`'ı önce dizmesini test et:

```ts
it("pendingFloorTile'ı önce ilgili per'e işler, sonra atar", () => {
  const floor = numbered("red", 7);
  const s = gs({
    players: [ph(0, [floor, numbered("blue", 2), numbered("blue", 3)], { opened: true, openMode: "melds", openScore: 101 }), ph(1, []), ph(2, []), ph(3, [])],
    phase: "act",
    pendingFloorTile: floor,
    tableMelds: [{ id: "m1", owner: 1, kind: "run", tiles: [numbered("red", 8), numbered("red", 9), numbered("red", 10)] }],
  });
  const moves = botMoves(s, 0);
  expect(moves[0]).toEqual({ kind: "processToMeld", meldId: "m1", tiles: [floor] });
  expect(moves[moves.length - 1]!.kind).toBe("discard");
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `pnpm --filter @masa/server test -- bot.test.ts`
Expected: FAIL — drawFromPile dönüyor / floor işlenmiyor.

- [ ] **Step 3: Implementasyonu yaz**

`bot.ts` — `findProcessTarget` yardımcısını ekle (decideAct'tan önce):

```ts
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
```

`decideAct`'ın başına (hand kurulumundan hemen sonra, "1. açma"dan ÖNCE) floor işleme bloğu ekle:

```ts
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
```

`botMoves`'taki çekme fazını güncelle:

```ts
export function botMoves(state: OkeyGameState, seat: number): Move[] {
  if (state.status !== "playing" || state.turn !== seat) return [];
  if (state.phase === "draw") return [decideDraw(state, seat)];
  return decideAct(state, seat);
}
```

(Eski `if (state.phase === "draw") return [{ kind: "drawFromPile" }];` ve `if (state.pendingFloorTile !== null) return [];` satırlarını kaldır — floor artık decideAct içinde ele alınıyor.)

`decideDraw`'ı ekle:

```ts
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
```

- [ ] **Step 4: Testlerin geçtiğini doğrula**

Run: `pnpm --filter @masa/server test -- bot.test.ts`
Expected: PASS (16 test).

Ardından tam paket + session deadlock guard:

Run: `pnpm --filter @masa/server test`
Expected: PASS — özellikle "4 bot bir eli ... oynar" testi hâlâ sonlanıyor (deadlock yok).

- [ ] **Step 5: Tip kontrolü ve commit**

Run: `pnpm typecheck`
Expected: hata yok.

```bash
git add server/src/games/okey/bot.ts server/src/games/okey/bot.test.ts
git commit -m "$(printf 'feat(okey-bot): temkinli discardtan cekme + floor isleme\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Self-review notları (plan yazarı)

- **Spec kapsamı:** decompose (Yaklaşım 1) → Task 1; açma eşiği/per/çift → Task 3; bitirme → Task 3; güvenli atış → Task 2; bot/insan ayrımı + fallback → Task 4; discard-take + floor kuralı → Task 5 (opsiyonel, spec'teki "yalnızca güvenliyse" tasarımına uygun). Hile yok kuralı: `botMoves` yalnızca `state.players[seat].hand` + açık bilgi okur.
- **Tip tutarlılığı:** `Move` birliği (`move.ts`) ile birebir; `decompose`/`chooseDiscard`/`botMoves`/`tileKey`/`removeTiles` imzaları tasklar arası tutarlı.
- **Determinizm:** sabit renk/değer sıralaması + NODE_CAP → aynı state aynı plan.
- **RNG:** Task 4 testi `SeededRng` (`server/src/core/rng.ts`) ve `session.test.ts`'deki mevcut `players()`/`config` yardımcılarını kullanır — teyit edildi.
```
