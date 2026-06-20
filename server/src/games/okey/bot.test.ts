import { describe, expect, it } from "vitest";
import { numbered, fakeJoker } from "./tile.js";
import type { NumberedTile, OkeyTile } from "./tile.js";
import { decompose, tileKey, removeTiles, chooseDiscard, botMoves } from "./bot.js";
import { isValidMeld } from "./meld.js";
import type { OkeyGameState, PlayerHandState } from "./game-state.js";
import type { PlayerId } from "@masa/shared";
import { makeConfig } from "./game-config.js";

const okey: NumberedTile = numbered("red", 13); // wildcard = the real red 13 tile (fake joker is a concrete red 13, NOT wild)

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

  it("okey taşını (wildcard) per tamamlamada kullanır", () => {
    const hand: OkeyTile[] = [numbered("red", 5), numbered("red", 6), numbered("red", 13)]; // red13 = okey (wild) -> 5-6-7
    const d = decompose(hand, okey, "maxTilesUsed");
    expect(d.tilesUsed).toBe(3);
    expect(d.groups).toHaveLength(1);
  });

  it("sahte okey somut okey-taşıdır: ardışıklığı dolduramaz", () => {
    // fake joker = red 13, so [red5, red6, fake] is red5-red6-red13: not a valid run
    const hand: OkeyTile[] = [numbered("red", 5), numbered("red", 6), fakeJoker()];
    const d = decompose(hand, okey, "maxTilesUsed");
    expect(d.tilesUsed).toBe(0);
    expect(d.groups).toHaveLength(0);
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

describe("tileKey / removeTiles", () => {
  it("tileKey numbered ve joker için ayırt edici anahtar üretir", () => {
    expect(tileKey(numbered("blue", 7))).toBe("blue:7");
    expect(tileKey(fakeJoker())).toBe("fake");
  });

  it("removeTiles çoklu-küme olarak siler, kopyaları korur", () => {
    const hand: OkeyTile[] = [numbered("red", 5), numbered("red", 5), numbered("blue", 3)];
    const out = removeTiles(hand, [numbered("red", 5)]);
    expect(out).toEqual([numbered("red", 5), numbered("blue", 3)]);
  });
});

describe("decompose ek davranışlar", () => {
  it("maxValue okey taşını (wildcard) en yüksek değeri verecek konuma yerleştirir", () => {
    const hand: OkeyTile[] = [numbered("red", 10), numbered("red", 11), numbered("red", 13)]; // red13 wild -> 12
    const d = decompose(hand, okey, "maxValue");
    expect(d.value).toBe(33); // 10 + 11 + 12
  });

  it("döndürülen tüm gruplar geçerli per'dir (tam ele yakın)", () => {
    const hand: OkeyTile[] = [
      numbered("red", 1), numbered("red", 2), numbered("red", 3), numbered("red", 4),
      numbered("blue", 6), numbered("blue", 7), numbered("blue", 8),
      numbered("black", 9), numbered("yellow", 9), numbered("red", 9),
      fakeJoker(), numbered("blue", 13),
    ];
    const d = decompose(hand, okey, "maxTilesUsed");
    expect(d.groups.length).toBeGreaterThan(0);
    for (const g of d.groups) expect(isValidMeld(g, okey)).toBe(true);
  });
});

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

  it("masadaki bir pere islenebilen tasi atmaz (islek cezasindan kacinir)", () => {
    const melds = [{ id: "m", owner: 1, kind: "run" as const, tiles: [numbered("yellow", 9), numbered("yellow", 10), numbered("yellow", 11)] }];
    // yellow 12 ölü ve yüksek değerli ama yellow run'a işlenebilir → +101 riski.
    const hand: OkeyTile[] = [numbered("yellow", 12), numbered("black", 5)];
    const t = chooseDiscard(hand, okey, melds);
    expect(t).toEqual(numbered("black", 5));
  });
});

function ph(seat: number, hand: OkeyTile[], over: Partial<PlayerHandState> = {}): PlayerHandState {
  return { seat, playerId: `p${seat}` as PlayerId, team: null, hand, opened: false, openMode: null, openScore: 0, pairCount: 0, openedOnTurn: null, floorPenalty: false, ...over };
}
function gs(over: Partial<OkeyGameState> & { players: PlayerHandState[] }): OkeyGameState {
  return {
    config: makeConfig({ pairing: "essiz", escalation: "katlamasiz", targetHands: 11 }),
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
      numbered("red", 11), numbered("red", 12), numbered("red", 13),
      numbered("blue", 11), numbered("blue", 12), numbered("blue", 13),
      numbered("black", 9), numbered("black", 10), numbered("black", 11),
      numbered("yellow", 2),
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

  it("açıkken, üstteki atılan taş mevcut bir per'e ekleniyorsa discard'tan çeker", () => {
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
});
