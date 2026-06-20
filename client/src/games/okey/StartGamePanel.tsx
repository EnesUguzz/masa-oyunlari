import type { JSX } from "react";
import { useState } from "react";
import type { StartGameConfig, PairingMode, EscalationMode, PartnerEscalation, TargetHands, AssistMode } from "./types.js";

export function StartGamePanel({ onStart }: { onStart: (config: StartGameConfig) => void }): JSX.Element {
  const [pairing, setPairing] = useState<PairingMode>("essiz");
  const [escalation, setEscalation] = useState<EscalationMode>("katlamasiz");
  const [partnerEscalation, setPartnerEscalation] = useState<PartnerEscalation>("ese-katlamali");
  const [targetHands, setTargetHands] = useState<TargetHands>(11);
  const [assist, setAssist] = useState<AssistMode>("destekli");
  const showPartner = pairing === "esli" && escalation === "katlamali";

  const start = (): void => {
    const config: StartGameConfig = { pairing, escalation, targetHands, assist };
    if (showPartner) config.partnerEscalation = partnerEscalation;
    onStart(config);
  };

  return (
    <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, marginTop: 12 }}>
      <strong>Oyunu başlat</strong>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
        <label>Eş: <select value={pairing} onChange={(e) => setPairing(e.target.value as PairingMode)}><option value="essiz">Eşsiz</option><option value="esli">Eşli</option></select></label>
        <label>Katlama: <select value={escalation} onChange={(e) => setEscalation(e.target.value as EscalationMode)}><option value="katlamasiz">Katlamasız</option><option value="katlamali">Katlamalı</option></select></label>
        {showPartner && (
          <label>Eşe: <select value={partnerEscalation} onChange={(e) => setPartnerEscalation(e.target.value as PartnerEscalation)}><option value="ese-katlamali">Eşe-katlamalı</option><option value="ese-katlamasiz">Eşe-katlamasız</option></select></label>
        )}
        <label>El: <select value={targetHands} onChange={(e) => setTargetHands(Number(e.target.value) as TargetHands)}><option value={7}>7</option><option value={11}>11</option><option value={21}>21</option></select></label>
        <label>Yardım: <select value={assist} onChange={(e) => setAssist(e.target.value as AssistMode)}><option value="destekli">Destekli</option><option value="desteksiz">Desteksiz</option></select></label>
      </div>
      <button style={{ marginTop: 8 }} onClick={start}>Oyunu Başlat</button>
    </div>
  );
}
