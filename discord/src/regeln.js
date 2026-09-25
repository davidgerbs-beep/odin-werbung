// Würfelregeln von O.D.I.N. (Grundregelwerk, Kapitel IV), gleiche Logik wie im Foundry-System (module/wuerfel.mjs)
// Weiß (Attribut) trifft ab 5, bunt (Fertigkeit) ab 4. Ohne Würfel: Verzweiflungswurf mit einem weißen W6, trifft nur auf 6.

export const SCHWIERIGKEITEN = {
  de: ['Offen', 'Einfach', 'Machbar', 'Schwer', 'Sehr schwer', 'Unmöglich'],
  en: ['Open', 'Easy', 'Feasible', 'Hard', 'Very hard', 'Impossible'],
};

export function pool(weiss, bunt, bonus = 0, malus = 0) {
  weiss += Math.min(3, Math.max(0, bonus));
  let m = Math.max(0, malus);
  const abW = Math.min(weiss, m);
  weiss -= abW;
  m -= abW;
  bunt = Math.max(0, bunt - m);
  return [weiss, bunt];
}

export function w6() {
  // gleichverteilt 1..6 ohne Modulo-Verzerrung
  const a = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(a);
    if (a[0] < 252) return (a[0] % 6) + 1;
  }
}

export function werfen(weiss, bunt) {
  const verzweiflung = weiss + bunt <= 0;
  if (verzweiflung) { weiss = 1; bunt = 0; }
  const w = Array.from({ length: weiss }, w6);
  const b = Array.from({ length: bunt }, w6);
  return { w, b, verzweiflung };
}

export function auswerten({ w, b, verzweiflung }, schw) {
  const erfolge = w.filter((x) => x >= (verzweiflung ? 6 : 5)).length + b.filter((x) => x >= 4).length;
  const einsen = [...w, ...b].filter((x) => x === 1).length;
  const e = { w, b, verzweiflung, schw, erfolge, einsen, erfolg: null, ueberschuss: 0, grandios: false, patzer: false };
  if (schw > 0) {
    e.erfolg = erfolge >= schw;
    e.ueberschuss = e.erfolg ? erfolge - schw : 0;
    e.grandios = e.erfolg && e.ueberschuss >= 3;
    if (!e.erfolg && einsen > erfolge) e.patzer = true;
  } else if (erfolge === 0 && einsen > 0) e.patzer = true;
  if (verzweiflung && w[0] === 1) e.patzer = true;
  return e;
}

export function ergebnisArt(e) {
  if (e.patzer) return 'patzer';
  if (!e.schw) return 'offen';
  if (e.grandios) return 'grandios';
  if (e.erfolg) return 'erfolg';
  return 'fehlschlag';
}
