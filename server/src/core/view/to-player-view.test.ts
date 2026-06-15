import { describe, it, expect } from "vitest";
import { toPlayerView } from "./to-player-view.js";
import type { Player, PlayerId, Room } from "@masa/shared";

function player(id: string, nickname: string): Player {
  return { id: id as PlayerId, nickname };
}

const room: Room = {
  code: "ABCD",
  ownerId: "p1" as PlayerId,
  status: "waiting",
  players: [player("p1", "Ada"), player("p2", "Grace")],
  capacity: 4,
};

describe("toPlayerView", () => {
  it("produces a view scoped to the requesting player", () => {
    const view = toPlayerView(room, "p2" as PlayerId);
    expect(view.room.code).toBe("ABCD");
    expect(view.room.you).toBe("p2");
    expect(view.room.ownerId).toBe("p1");
    expect(view.room.players.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(view.room.status).toBe("waiting");
    expect(view.room.capacity).toBe(4);
  });

  it("returns a fresh players array, not the room's own reference", () => {
    const view = toPlayerView(room, "p1" as PlayerId);
    expect(view.room.players).not.toBe(room.players);
  });
});
