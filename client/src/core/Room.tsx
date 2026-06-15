import type { PlayerView } from "@masa/shared";

export function Room({ view, onLeave }: { view: PlayerView; onLeave: () => void }) {
  const { room } = view;
  return (
    <div>
      <h2>Oda: {room.code}</h2>
      <p>Durum: {room.status}</p>
      <p>
        Oyuncular ({room.players.length}/{room.capacity}):
      </p>
      <ul>
        {room.players.map((p) => (
          <li key={p.id}>
            {p.nickname}
            {p.id === room.ownerId ? " 👑" : ""}
            {p.id === room.you ? " (sen)" : ""}
          </li>
        ))}
      </ul>
      <button onClick={onLeave}>Odadan Ayrıl</button>
    </div>
  );
}
