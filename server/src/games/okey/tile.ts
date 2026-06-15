export type OkeyColor = "red" | "yellow" | "black" | "blue";

export interface NumberedTile {
  readonly kind: "numbered";
  readonly color: OkeyColor;
  readonly value: number; // 1..13
}

export interface FakeJoker {
  readonly kind: "fakeJoker";
}

export type OkeyTile = NumberedTile | FakeJoker;

export const OKEY_COLORS: readonly OkeyColor[] = ["red", "yellow", "black", "blue"];
export const MIN_VALUE = 1;
export const MAX_VALUE = 13;

export function numbered(color: OkeyColor, value: number): NumberedTile {
  if (!Number.isInteger(value) || value < MIN_VALUE || value > MAX_VALUE) {
    throw new RangeError(`Tile value must be ${MIN_VALUE}..${MAX_VALUE}, got ${value}`);
  }
  return { kind: "numbered", color, value };
}

export function fakeJoker(): FakeJoker {
  return { kind: "fakeJoker" };
}

export function isNumbered(t: OkeyTile): t is NumberedTile {
  return t.kind === "numbered";
}

export function isFakeJoker(t: OkeyTile): t is FakeJoker {
  return t.kind === "fakeJoker";
}

export function tilesEqual(a: OkeyTile, b: OkeyTile): boolean {
  if (a.kind === "fakeJoker" && b.kind === "fakeJoker") return true;
  if (a.kind === "numbered" && b.kind === "numbered") {
    return a.color === b.color && a.value === b.value;
  }
  return false;
}
