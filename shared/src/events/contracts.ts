import { z } from "zod";

/** Client -> Server event names. */
export const ClientEvents = {
  identify: "identify",
  createRoom: "createRoom",
  joinRoom: "joinRoom",
  leaveRoom: "leaveRoom",
} as const;

/** Server -> Client event names. */
export const ServerEvents = {
  identified: "identified",
  roomState: "roomState",
  errorEvent: "errorEvent",
} as const;

// ---- Client -> Server payload schemas ----
// Inbound schemas are .strict(): unknown keys are rejected, not silently
// stripped. Server authority means we never quietly accept unexpected client
// data (see CLAUDE.md "asla ham/güvenilmeyen veriye güvenme").

export const identifySchema = z
  .object({
    token: z.string().min(1).optional(),
    nickname: z.string().trim().min(1).max(24),
  })
  .strict();
export type IdentifyPayload = z.infer<typeof identifySchema>;

export const createRoomSchema = z.object({}).strict();
export type CreateRoomPayload = z.infer<typeof createRoomSchema>;

export const joinRoomSchema = z
  .object({
    code: z.string().trim().min(1).max(12),
  })
  .strict();
export type JoinRoomPayload = z.infer<typeof joinRoomSchema>;

export const leaveRoomSchema = z.object({}).strict();
export type LeaveRoomPayload = z.infer<typeof leaveRoomSchema>;

// ---- Server -> Client payload schemas (for documentation/shared typing) ----

// The `roomState` event carries a per-player PlayerView. Aliased here so the
// event<->payload contract is explicit and discoverable from @masa/shared.
export type { PlayerView as RoomStateEventPayload } from "../types/player-view.js";

export const identifiedSchema = z.object({
  playerId: z.string(),
  token: z.string(),
});
export type IdentifiedPayload = z.infer<typeof identifiedSchema>;

export const errorEventSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type ErrorEventPayload = z.infer<typeof errorEventSchema>;
