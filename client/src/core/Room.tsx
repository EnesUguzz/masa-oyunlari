import type { JSX } from "react";
import type { PlayerView } from "@masa/shared";
import type { GameSocket } from "../net/socket.js";
import { StartGamePanel } from "../games/okey/StartGamePanel.js";

export function Room({ view, socket, onLeave }: { view: PlayerView; socket: GameSocket; onLeave: () => void }): JSX.Element {
  const { room } = view;
  const isOwner = room.you === room.ownerId;
  const canStart = isOwner && room.status === "waiting" && room.players.length === room.capacity;
  return (
    <div>
      <h2>Oda: {room.code}</h2>
      <p>Durum: {room.status}</p>
      <p>Oyuncular ({room.players.length}/{room.capacity}):</p>
      <ul>
        {room.players.map((p) => (
          <li key={p.id}>
            {p.nickname}
            {p.id === room.ownerId ? " 👑" : ""}
            {p.id === room.you ? " (sen)" : ""}
          </li>
        ))}
      </ul>
      {canStart && <StartGamePanel onStart={(config) => socket.startGame(config)} />}
      {isOwner && room.status === "waiting" && room.players.length < room.capacity && (
        <p><em>Başlatmak için {room.capacity} oyuncu gerekli.</em></p>
      )}
      <button onClick={onLeave}>Odadan Ayrıl</button>
    </div>
  );
}
