const test = require("node:test");
const assert = require("node:assert/strict");
const format = require("../js/format");
const engine = require("../js/engine");
const demo = require("../js/demo");
const azioni = require("../js/azioni");

const OGGI = "2026-11-09";

test("i pelati dell'esempio: sfrido, giacenza, un collo Biancalani", function () {
  const stato = demo.statoEsempio(OGGI);
  const sfr = engine.sfridoIngrediente(stato, "LAT-009");
  assert.equal(sfr.fonte, "inventari");
  assert.ok(Math.abs(sfr.reale - 34) < 1e-9);
  assert.ok(Math.abs(sfr.teorico - 29) < 1e-6);
  assert.ok(Math.abs(sfr.coef - 34 / 29) < 1e-6);

  const giacenza = engine.giacenzaIngrediente(stato, "LAT-009", OGGI);
  assert.ok(Math.abs(giacenza - 0.2) < 1e-6);

  const prezzo = engine.prezzoIngrediente(stato, "LAT-009");
  assert.equal(prezzo.fornitore, "Biancalani");
  assert.equal(prezzo.prezzoUdm, 1.1);
  assert.equal(prezzo.qtaConfezione, 15);
  assert.equal(prezzo.tipo, "fattura");

  const ordini = engine.propostaOrdini(stato, { oggi: OGGI });
  const ids = ordini.righe.map(function (r) { return r.id; }).sort();
  assert.deepEqual(ids, ["DET-001", "LAT-009"]);
  const pelati = ordini.righe.find(function (r) { return r.id === "LAT-009"; });
  assert.equal(pelati.colli, 1);
  assert.equal(pelati.fornitore, "Biancalani");
  assert.ok(Math.abs(pelati.daComprare - 9.32) < 1e-6);
  assert.equal(pelati.costo, 16.5);

  const det = ordini.righe.find(function (r) { return r.id === "DET-001"; });
  assert.equal(det.colli, 1);
  assert.equal(det.giorniCopertura, 14);
  assert.ok(Math.abs(det.daComprare - 18 / 7) < 1e-9);
  assert.equal(det.costo, 9);
});

test("food cost Margherita: listino 8 € e incasso 7 €", function () {
  const stato = demo.statoEsempio(OGGI);
  const piatto = engine.foodCost(stato).piatti.find(function (p) { return p.id === "PIZ-001"; });
  assert.ok(Math.abs(piatto.costoTeorico - 1.2545) < 1e-6);
  assert.ok(Math.abs(piatto.costoReale - 1.282) < 1e-6);
  assert.ok(Math.abs(piatto.fcListino - 1.282 / 8) < 1e-6);
  assert.ok(Math.abs(piatto.fcIncasso - 1.282 / 7) < 1e-6);
  assert.equal(engine.foodCost(stato).categorie[0].categoria, "Pizza");
});

test("allerta: il pelato Metro sale da 0,90 a 1,20 ma non vince il prezzo", function () {
  const allerte = engine.allertePrezzi(demo.statoEsempio(OGGI));
  assert.equal(allerte.length, 1);
  assert.equal(allerte[0].fornitore, "Metro");
  assert.ok(Math.abs(allerte[0].delta - (1.2 - 0.9) / 0.9) < 1e-9);
});

test("a parità di data vince la fattura, tra fornitori vince il € più basso con la sua confezione", function () {
  const stato = engine.statoVuoto();
  stato.ingredienti.push({ id: "LAT-009", nome: "Pelati", udm: "kg", tipo: "POS", qtaConfezione: 15, attivo: true });
  stato.offerte.push(
    { idIngrediente: "LAT-009", fornitore: "Metro", tipo: "preventivo", data: "2026-11-01T10:00:00", prezzoUdm: 0.5, qtaConfezione: 15 },
    { idIngrediente: "LAT-009", fornitore: "Metro", tipo: "fattura", data: "2026-11-01T18:00:00", prezzoUdm: 1.2, qtaConfezione: 15 },
    { idIngrediente: "LAT-009", fornitore: "Biancalani", tipo: "fattura", data: "2026-10-01T18:00:00", prezzoUdm: 1.1, qtaConfezione: 10 }
  );
  const prezzo = engine.prezzoIngrediente(stato, "LAT-009");
  assert.equal(prezzo.fornitore, "Biancalani");
  assert.equal(prezzo.prezzoUdm, 1.1);
  assert.equal(prezzo.qtaConfezione, 10);

  stato.offerte.push({
    idIngrediente: "LAT-009", fornitore: "Biancalani", tipo: "preventivo",
    data: "2026-12-01T10:00:00", prezzoUdm: 0.8, qtaConfezione: 12,
  });
  const dopo = engine.prezzoIngrediente(stato, "LAT-009");
  assert.equal(dopo.fornitore, "Biancalani");
  assert.equal(dopo.prezzoUdm, 0.8);
  assert.equal(dopo.qtaConfezione, 12);
  assert.equal(dopo.tipo, "preventivo");
});

test("lo sfuso non si arrotonda a colli; lo sfrido assurdo si ferma a 10", function () {
  const stato = engine.statoVuoto();
  stato.impostazioni.giorniCopertura = 7;
  stato.impostazioni.giorniStorico = 7;
  stato.ingredienti.push({ id: "CAR-001", nome: "Prosciutto", udm: "kg", tipo: "POS", qtaConfezione: 10, acquistoSfuso: true, attivo: true });
  stato.piatti.push({ id: "PIZ-009", nome: "Prosciutto", prezzoListino: 10 });
  stato.ricette.push({ idPiatto: "PIZ-009", idIngrediente: "CAR-001", quantita: 12.4 });
  stato.vendite.push({ idPiatto: "PIZ-009", quantita: 1, prezzoUnitario: 10, at: "2026-11-08T21:00:00" });
  stato.inventari.push({ idIngrediente: "CAR-001", reale: 0, at: "2026-11-09T08:00:00" });
  stato.offerte.push({ idIngrediente: "CAR-001", fornitore: "Banco", tipo: "fattura", data: "2026-11-01T12:00:00", prezzoUdm: 2, qtaConfezione: 10 });
  const riga = engine.propostaOrdini(stato, { oggi: OGGI }).righe[0];
  assert.equal(riga.colli, null);
  assert.equal(riga.unita, "kg");
  assert.ok(Math.abs(riga.quantita - 12.4) < 1e-9);
  assert.equal(riga.costo, 24.8);

  const estremo = engine.statoVuoto();
  estremo.ingredienti.push({ id: "LAT-009", nome: "Pelati", udm: "kg", tipo: "POS", attivo: true });
  estremo.piatti.push({ id: "PIZ-001", nome: "Margherita" });
  estremo.ricette.push({ idPiatto: "PIZ-001", idIngrediente: "LAT-009", quantita: 1 });
  estremo.inventari.push(
    { idIngrediente: "LAT-009", reale: 0, at: "2026-10-01T12:00:00" },
    { idIngrediente: "LAT-009", reale: 0, at: "2026-10-03T12:00:00" }
  );
  estremo.carichi.push({ idIngrediente: "LAT-009", quantita: 50, at: "2026-10-02T12:00:00" });
  estremo.vendite.push({ idPiatto: "PIZ-001", quantita: 1, at: "2026-10-02T18:00:00" });
  const sfr = engine.sfridoIngrediente(estremo, "LAT-009");
  assert.equal(sfr.coef, 10);
  assert.equal(sfr.clamp, "max");
});

test("un periodo con consumo reale negativo non sporca lo sfrido", function () {
  const stato = engine.statoVuoto();
  stato.ingredienti.push({ id: "LAT-009", nome: "Pelati", udm: "kg", tipo: "POS", attivo: true });
  stato.piatti.push({ id: "PIZ-001", nome: "Margherita" });
  stato.ricette.push({ idPiatto: "PIZ-001", idIngrediente: "LAT-009", quantita: 1 });
  stato.inventari.push(
    { idIngrediente: "LAT-009", reale: 10, at: "2026-10-01T12:00:00" },
    { idIngrediente: "LAT-009", reale: 50, at: "2026-10-20T12:00:00" }
  );
  stato.vendite.push({ idPiatto: "PIZ-001", quantita: 1, at: "2026-10-10T12:00:00" });
  const sfr = engine.sfridoIngrediente(stato, "LAT-009");
  assert.equal(sfr.coef, 1);
  assert.equal(sfr.fonte, "manca");
  assert.equal(sfr.periodi.length, 0);
});

test("il carico con prezzo entra nel funnel, l'acquisto diretto no; il conteggio dello stesso giorno si sostituisce", function () {
  const stato = engine.statoVuoto();
  stato.ingredienti.push({ id: "LAT-009", nome: "Pelati", udm: "kg", tipo: "POS", attivo: true });
  const carico = azioni.registraCarico(stato, {
    idIngrediente: "lat-009", quantita: 15, fornitore: "Metro", prezzoUdm: 1.2, qtaConfezione: 15, at: "2026-11-01T18:00:00",
  });
  assert.equal(carico.ok, true);
  assert.equal(stato.offerte.length, 1);
  assert.equal(engine.prezzoIngrediente(stato, "LAT-009").prezzoUdm, 1.2);

  azioni.registraCarico(stato, {
    idIngrediente: "LAT-009", quantita: 2, fornitore: "Mercato", prezzoUdm: 0.4, diretto: true, at: "2026-11-02T18:00:00",
  });
  assert.equal(stato.offerte.length, 1);
  assert.equal(engine.prezzoIngrediente(stato, "LAT-009").fornitore, "Metro");

  azioni.eliminaCarico(stato, carico.id);
  assert.equal(stato.carichi.length, 1);
  assert.equal(stato.offerte.length, 0);

  const primo = azioni.registraInventario(stato, { idIngrediente: "LAT-009", reale: 4, at: "2026-11-09T09:00:00" });
  const secondo = azioni.registraInventario(stato, { idIngrediente: "LAT-009", reale: 6, at: "2026-11-09T21:00:00" });
  assert.equal(secondo.sostituito, true);
  assert.equal(stato.inventari.length, 1);
  assert.equal(stato.inventari[0].reale, 6);
  assert.equal(stato.inventari[0].id, primo.id);
});

test("l'incolla legge la virgola e il punto e virgola", function () {
  const stato = engine.statoVuoto();
  stato.ingredienti.push({ id: "LAT-009", nome: "Pelati", udm: "kg", tipo: "POS", attivo: true });
  const esito = azioni.importaRighe(stato, "carichi", "data;codice;quantità;fornitore;prezzo;confezione\n09/11/2026;LAT-009;15;Biancalani;1,10;15\n");
  assert.equal(esito.n, 1);
  assert.equal(esito.errori.length, 0);
  assert.equal(stato.carichi[0].quantita, 15);
  assert.equal(stato.offerte[0].prezzoUdm, 1.1);
});

test("numeri italiani e backup illeggibile", function () {
  assert.equal(format.parseNumero("1,10"), 1.1);
  assert.equal(format.parseNumero("1.234,56"), 1234.56);
  assert.equal(format.dataISO("09/11/2026"), "2026-11-09");
  assert.throws(function () { engine.normalizzaStato({ ciao: 1 }); });
  assert.throws(function () { engine.normalizzaStato(null); });
  const stato = engine.normalizzaStato({ ingredienti: [] });
  assert.equal(stato.impostazioni.giorniCopertura, 7);
});
