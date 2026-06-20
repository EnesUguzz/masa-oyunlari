import { z } from "zod";
import type { Move } from "./move.js";

export const OkeyClientEvents = { startGame: "okey:startGame", move: "okey:move" } as const;
export const OkeyServerEvents = { state: "okey:state", ended: "okey:ended" } as const;

const colorSchema = z.enum(["red", "yellow", "black", "blue"]);
const tileSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("numbered"), color: colorSchema, value: z.number().int().min(1).max(13) }).strict(),
  z.object({ kind: z.literal("fakeJoker") }).strict(),
]);

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("drawFromPile") }).strict(),
  z.object({ kind: z.literal("drawFromDiscard") }).strict(),
  z.object({ kind: z.literal("returnFloorTile") }).strict(),
  z.object({ kind: z.literal("openMelds"), melds: z.array(z.array(tileSchema)) }).strict(),
  z.object({ kind: z.literal("autoOpen") }).strict(),
  z.object({ kind: z.literal("openPairs"), pairs: z.array(z.array(tileSchema)) }).strict(),
  z.object({ kind: z.literal("openNewMeld"), tiles: z.array(tileSchema) }).strict(),
  z.object({ kind: z.literal("processToMeld"), meldId: z.string(), tiles: z.array(tileSchema) }).strict(),
  z.object({ kind: z.literal("swapOkey"), meldId: z.string(), tile: tileSchema }).strict(),
  z.object({ kind: z.literal("discard"), tile: tileSchema }).strict(),
]);

export const startGameSchema = z
  .object({
    pairing: z.enum(["essiz", "esli"]),
    escalation: z.enum(["katlamasiz", "katlamali"]),
    partnerEscalation: z.enum(["ese-katlamali", "ese-katlamasiz"]).optional(),
    targetHands: z.union([z.literal(7), z.literal(11), z.literal(21)]),
    assist: z.enum(["destekli", "desteksiz"]).optional(),
  })
  .strict();

export const okeyMoveSchema = z.object({ move: moveSchema }).strict();

export type OkeyMovePayload = z.infer<typeof moveSchema>;
export type StartGamePayload = z.infer<typeof startGameSchema>;

// Compile-time guard: a validated payload must satisfy the engine Move union.
const _moveGuard = (m: OkeyMovePayload): Move => m;
void _moveGuard;
