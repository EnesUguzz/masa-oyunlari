import { useEffect, useMemo, useRef, useState } from "react";
import type { PlayerView } from "@masa/shared";
import { GameSocket } from "./net/socket.js";
import { loadToken, saveToken } from "./token.js";
import { NicknameEntry } from "./core/NicknameEntry.js";
import { Lobby } from "./core/Lobby.js";
import { Room } from "./core/Room.js";

type Screen = "nickname" | "lobby" | "room";

export function App() {
  const [screen, setScreen] = useState<Screen>("nickname");
  const [view, setView] = useState<PlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nicknameRef = useRef<string>("");

  const socket = useMemo(
    () =>
      new GameSocket({
        onIdentified: ({ token }) => {
          saveToken(token);
          setScreen((s) => (s === "nickname" ? "lobby" : s));
        },
        onRoomState: (v) => {
          setView(v);
          setScreen("room");
        },
        onError: (e) => setError(`${e.code}: ${e.message}`),
      }),
    [],
  );

  // Auto-identify on reload if we already have a token + remembered nickname.
  useEffect(() => {
    const token = loadToken();
    const nickname = localStorage.getItem("masa.nickname");
    if (token && nickname) {
      nicknameRef.current = nickname;
      socket.identify({ token, nickname });
    }
  }, [socket]);

  const handleNickname = (nickname: string) => {
    nicknameRef.current = nickname;
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
          onLeave={() => {
            socket.leaveRoom();
            setView(null);
            setScreen("lobby");
          }}
        />
      )}
    </main>
  );
}
