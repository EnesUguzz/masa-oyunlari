import { useState } from "react";

export function NicknameEntry({ onSubmit }: { onSubmit: (nickname: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div>
      <h1>Masa Oyunları</h1>
      <label>
        Takma ad:{" "}
        <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={24} />
      </label>
      <button disabled={value.trim().length === 0} onClick={() => onSubmit(value.trim())}>
        Devam
      </button>
    </div>
  );
}
