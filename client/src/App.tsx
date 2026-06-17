import { useEffect, useMemo, useState } from "react";
import type { PlayerView } from "@masa/shared";
import { GameSocket } from "./net/socket.js";
import { loadToken, saveToken } from "./token.js";
import { NicknameEntry } from "./core/NicknameEntry.js";
import { Lobby } from "./core/Lobby.js";
import { Room } from "./core/Room.js";
import type { OkeyTableView } from "./games/okey/types.js";
import { OkeyTable } from "./games/okey/OkeyTable.js";
import { turkishError } from "./games/okey/error-messages.js";

type Screen = "nickname" | "lobby" | "room" | "table";

export function App() {
  const [screen, setScreen] = useState<Screen>("nickname");
  const [view, setView] = useState<PlayerView | null>(null);
  const [table, setTable] = useState<OkeyTableView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const socket = useMemo(
    () =>
      new GameSocket({
        onIdentified: ({ token }) => {
          saveToken(token);
          setError(null); // a successful action clears any stale error banner
          setScreen((s) => (s === "nickname" ? "lobby" : s));
        },
        onRoomState: (v) => {
          setError(null);
          setView(v);
          setScreen("room");
        },
        onError: (e) => setError(turkishError(e.code, e.message)),
        onOkeyState: (tv) => { setError(null); setTable(tv); setScreen("table"); },
        onOkeyEnded: (tv) => { setError(null); setTable(tv); setScreen("table"); },
      }),
    [],
  );

  // Auto-identify on reload if we already have a token + remembered nickname.
  useEffect(() => {
    const token = loadToken();
    const nickname = localStorage.getItem("masa.nickname");
    if (token && nickname) {
      socket.identify({ token, nickname });
    }
  }, [socket]);

  const handleNickname = (nickname: string) => {
    localStorage.setItem("masa.nickname", nickname);
    socket.identify({ token: loadToken(), nickname });
  };

  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {screen === "nickname" && <NicknameEntry onSubmit={handleNickname} />}
      {screen === "lobby" && (
        <Lobby onCreate={() => socket.createRoom()} onJoin={(code) => socket.joinRoom({ code })} />
      )}
      {screen === "room" && view && (
        <Room
          view={view}
          socket={socket}
          onLeave={() => { socket.leaveRoom(); setView(null); setScreen("lobby"); }}
        />
      )}
      {screen === "table" && table && (
        <OkeyTable table={table} onMove={(m) => socket.sendMove(m)} onLeave={() => { setTable(null); setScreen("lobby"); }} />
      )}
    </main>
  );
}
