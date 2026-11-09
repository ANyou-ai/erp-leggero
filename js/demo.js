/* Dati di esempio: una Margherita e i pelati, più un detersivo a tempo.
   Le date sono relative a "oggi", così la finestra di 30 giorni resta vera. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ErpDemo = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function giornoShift(iso, delta) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!m) return "";
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3]) + delta * 86400000;
    const d = new Date(t);
    const z = function (n) { return String(n).padStart(2, "0"); };
    return d.getUTCFullYear() + "-" + z(d.getUTCMonth() + 1) + "-" + z(d.getUTCDate());
  }

  function at(g, ora) {
    return g + "T" + (ora || "12:00:00");
  }

  function statoEsempio(oggi) {
    const g = function (n) { return giornoShift(oggi, n); };
    return {
      versione: 1,
      demo: true,
      scelta: true,
      impostazioni: {
        nomeLocale: "Pizzeria (esempio)",
        giorniCopertura: 7,
        giorniStorico: 30,
        sogliaAllerta: 0.1,
      },
      ingredienti: [
        { id: "LAT-009", nome: "Pelati", categoria: "Dispensa", udm: "kg", tipo: "POS", qtaConfezione: 15, acquistoSfuso: false, attivo: true },
        { id: "LAT-003", nome: "Fior di latte", categoria: "Latticini", udm: "kg", tipo: "POS", qtaConfezione: 3, acquistoSfuso: false, attivo: true },
        { id: "FAR-001", nome: "Farina 00", categoria: "Dispensa", udm: "kg", tipo: "POS", qtaConfezione: 25, acquistoSfuso: false, attivo: true },
        { id: "OLI-001", nome: "Olio EVO", categoria: "Dispensa", udm: "L", tipo: "POS", qtaConfezione: 5, acquistoSfuso: false, attivo: true },
        { id: "DET-001", nome: "Detersivo lavastoviglie", categoria: "Pulizia", udm: "L", tipo: "TEMPO", qtaConfezione: 5, acquistoSfuso: false, giorniCopertura: 14, attivo: true },
      ],
      offerte: [
        { id: "off-p1", idIngrediente: "LAT-009", fornitore: "Metro", tipo: "fattura", data: at(g(-70), "18:00:00"), prezzoUdm: 0.9, qtaConfezione: 15 },
        { id: "off-p2", idIngrediente: "LAT-009", fornitore: "Metro", tipo: "fattura", data: at(g(-20), "18:00:00"), prezzoUdm: 1.2, qtaConfezione: 15 },
        { id: "off-p3", idIngrediente: "LAT-009", fornitore: "Biancalani", tipo: "preventivo", data: at(g(-50), "10:00:00"), prezzoUdm: 1.4, qtaConfezione: 15 },
        { id: "off-p4", idIngrediente: "LAT-009", fornitore: "Biancalani", tipo: "fattura", data: at(g(-3), "18:00:00"), prezzoUdm: 1.1, qtaConfezione: 15 },
        { id: "off-l", idIngrediente: "LAT-003", fornitore: "Metro", tipo: "fattura", data: at(g(-15), "18:00:00"), prezzoUdm: 6.8, qtaConfezione: 3 },
        { id: "off-f", idIngrediente: "FAR-001", fornitore: "Metro", tipo: "fattura", data: at(g(-15), "18:00:00"), prezzoUdm: 0.85, qtaConfezione: 25 },
        { id: "off-o", idIngrediente: "OLI-001", fornitore: "Metro", tipo: "fattura", data: at(g(-15), "18:00:00"), prezzoUdm: 9.2, qtaConfezione: 5 },
        { id: "off-d", idIngrediente: "DET-001", fornitore: "Metro", tipo: "fattura", data: at(g(-20), "18:00:00"), prezzoUdm: 1.8, qtaConfezione: 5 },
      ],
      piatti: [
        { id: "PIZ-001", nome: "Margherita", categoria: "Pizza", prezzoListino: 8 },
      ],
      ricette: [
        { idPiatto: "PIZ-001", idIngrediente: "LAT-009", quantita: 0.145 },
        { idPiatto: "PIZ-001", idIngrediente: "LAT-003", quantita: 0.125 },
        { idPiatto: "PIZ-001", idIngrediente: "FAR-001", quantita: 0.18 },
        { idPiatto: "PIZ-001", idIngrediente: "OLI-001", quantita: 0.01 },
      ],
      carichi: [
        { id: "car-p", idIngrediente: "LAT-009", quantita: 30, fornitore: "Biancalani", prezzoUdm: 1.1, qtaConfezione: 15, diretto: false, at: at(g(-35), "18:00:00") },
      ],
      vendite: [
        { id: "ven-1", idPiatto: "PIZ-001", quantita: 200, prezzoUnitario: 7, at: at(g(-25), "21:00:00") },
        { id: "ven-2", idPiatto: "PIZ-001", quantita: 40, prezzoUnitario: 7, at: at(g(-4), "21:00:00") },
      ],
      inventari: [
        { id: "inv-p1", idIngrediente: "LAT-009", reale: 10, at: at(g(-40)) },
        { id: "inv-p2", idIngrediente: "LAT-009", reale: 6, at: at(g(-10)) },
        { id: "inv-l", idIngrediente: "LAT-003", reale: 40, at: at(g(-1)) },
        { id: "inv-f", idIngrediente: "FAR-001", reale: 80, at: at(g(-1)) },
        { id: "inv-o", idIngrediente: "OLI-001", reale: 10, at: at(g(-1)) },
        { id: "inv-d1", idIngrediente: "DET-001", reale: 10, at: at(g(-30)) },
        { id: "inv-d2", idIngrediente: "DET-001", reale: 2, at: at(g(-2)) },
      ],
    };
  }

  return { statoEsempio: statoEsempio };
});
