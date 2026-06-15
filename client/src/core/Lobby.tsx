import { useState } from "react";

export function Lobby({
  onCreate,
  onJoin,
}: {
  onCreate: () => void;
  onJoin: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  return (
    <div>
      <h2>Lobi</h2>
      <button onClick={onCreate}>Yeni Oda Kur</button>
      <hr />
      <label>
        Oda kodu:{" "}
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={12}
        />
      </label>
      <button disabled={code.trim().length === 0} onClick={() => onJoin(code.trim())}>
        Katıl
      </button>
    </div>
  );
}
