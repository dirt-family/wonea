/** Kleine formatters voor bedragen en percentages in lopende gids-tekst. */

/** In lopende tekst: "470.000 euro" leest rustiger dan een euroteken. */
export function euroTekst(n: number): string {
  return `${n.toLocaleString("nl-NL", { maximumFractionDigits: 2 })} euro`;
}

/** Kort bedrag voor cijfer-rijen: "€ 16,25" of "€ 470.000". */
export function euroKort(n: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

/** "22,6 procent"; met decimalen: pctTekst(5, 1) geeft "5,0 procent". */
export function pctTekst(n: number, minDecimalen = 0): string {
  return `${n.toLocaleString("nl-NL", { minimumFractionDigits: minDecimalen, maximumFractionDigits: 2 })} procent`;
}
