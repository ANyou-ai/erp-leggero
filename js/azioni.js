/* Scritture: un carico aggiorna il prezzo, un acquisto diretto no,
   un secondo conteggio nello stesso giorno sostituisce il primo. */
(function (root, factory) {
  let engine = root && root.ErpEngine;
  if (!engine) engine = require("./engine");
  let format = root && root.ErpFormat;
  if (!format) format = require("./format");
  const api = factory(engine, format);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ErpAzioni = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (engine, format) {
  "use strict";

  function nuovoId(prefisso) {
    return prefisso + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function giornoDi(at) {
    return String(at || "").slice(0, 10);
  }

  function celle(riga) {
    return String(riga || "").split(/[;\t]/).map(function (s) { return s.trim(); });
  }

  function registraOfferta(stato, input) {
    const idIng = engine.codice(input.idIngrediente);
    if (!idIng) return { ok: false, errore: "Scegli il prodotto." };
    const fornitore = String(input.fornitore || "").trim();
    if (!fornitore) return { ok: false, errore: "Scrivi il fornitore." };
    const prezzo = Number(input.prezzoUdm);
    if (!(prezzo > 0)) return { ok: false, errore: "Il prezzo al kg (o al litro, o al pezzo) non è un numero." };
    const tipo = input.tipo === "preventivo" ? "preventivo" : "fattura";
    if (!input.data) return { ok: false, errore: "Manca la data." };
    stato.offerte.push({
      id: input.id || nuovoId("off"),
      idIngrediente: idIng,
      fornitore: fornitore,
      tipo: tipo,
      data: input.data,
      prezzoUdm: prezzo,
      qtaConfezione: Number(input.qtaConfezione) > 0 ? Number(input.qtaConfezione) : 0,
      origine: input.origine || "",
    });
    return { ok: true };
  }

  function registraCarico(stato, input) {
    const idIng = engine.codice(input.idIngrediente);
    if (!idIng) return { ok: false, errore: "Scegli il prodotto." };
    const quantita = Number(input.quantita);
    if (!(quantita > 0)) return { ok: false, errore: "La quantità caricata non è un numero." };
    if (!input.at) return { ok: false, errore: "Manca la data del carico." };
    const diretto = !!input.diretto;
    const fornitore = String(input.fornitore || "").trim();
    const prezzo = input.prezzoUdm == null || input.prezzoUdm === "" ? null : Number(input.prezzoUdm);
    if (prezzo != null && !(prezzo > 0)) return { ok: false, errore: "Il prezzo non è un numero." };
    if (!diretto && prezzo > 0 && !fornitore) {
      return { ok: false, errore: "Scrivi il fornitore, altrimenti il prezzo non entra nel confronto." };
    }
    const rec = {
      id: input.id || nuovoId("car"),
      idIngrediente: idIng,
      quantita: quantita,
      fornitore: fornitore,
      prezzoUdm: prezzo,
      qtaConfezione: Number(input.qtaConfezione) > 0 ? Number(input.qtaConfezione) : 0,
      diretto: diretto,
      at: input.at,
      note: String(input.note || ""),
    };
    stato.carichi.push(rec);
    if (!diretto && prezzo > 0 && fornitore) {
      registraOfferta(stato, {
        idIngrediente: idIng,
        fornitore: fornitore,
        tipo: "fattura",
        data: rec.at,
        prezzoUdm: prezzo,
        qtaConfezione: rec.qtaConfezione,
        origine: rec.id,
      });
    }
    return { ok: true, id: rec.id };
  }

  function eliminaCarico(stato, id) {
    stato.carichi = (stato.carichi || []).filter(function (c) { return c.id !== id; });
    stato.offerte = (stato.offerte || []).filter(function (o) { return o.origine !== id; });
  }

  function registraVendita(stato, input) {
    const idPiatto = engine.codice(input.idPiatto);
    if (!idPiatto) return { ok: false, errore: "Scegli il piatto." };
    const quantita = Number(input.quantita);
    if (!(quantita > 0)) return { ok: false, errore: "Quante ne hai vendute?" };
    if (!input.at) return { ok: false, errore: "Manca la data della vendita." };
    let prezzo = null;
    if (input.prezzoUnitario != null && input.prezzoUnitario !== "") {
      prezzo = Number(input.prezzoUnitario);
      if (!(prezzo >= 0)) return { ok: false, errore: "Il prezzo incassato non è un numero." };
    }
    stato.vendite.push({
      id: input.id || nuovoId("ven"),
      idPiatto: idPiatto,
      quantita: quantita,
      prezzoUnitario: prezzo,
      at: input.at,
    });
    return { ok: true };
  }

  function eliminaVendita(stato, id) {
    stato.vendite = (stato.vendite || []).filter(function (v) { return v.id !== id; });
  }

  function registraInventario(stato, input) {
    const idIng = engine.codice(input.idIngrediente);
    if (!idIng) return { ok: false, errore: "Scegli il prodotto." };
    const reale = Number(input.reale);
    if (!Number.isFinite(reale) || reale < 0) return { ok: false, errore: "La giacenza contata non è un numero." };
    if (!input.at) return { ok: false, errore: "Manca la data del conteggio." };
    const giorno = giornoDi(input.at);
    const gia = (stato.inventari || []).find(function (i) {
      return engine.codice(i.idIngrediente) === idIng && giornoDi(i.at) === giorno;
    });
    if (gia) {
      gia.reale = reale;
      gia.at = input.at;
      return { ok: true, sostituito: true, id: gia.id };
    }
    const rec = {
      id: input.id || nuovoId("inv"),
      idIngrediente: idIng,
      reale: reale,
      at: input.at,
    };
    stato.inventari.push(rec);
    return { ok: true, sostituito: false, id: rec.id };
  }

  function eliminaInventario(stato, id) {
    stato.inventari = (stato.inventari || []).filter(function (i) { return i.id !== id; });
  }

  function eliminaOfferta(stato, id) {
    stato.offerte = (stato.offerte || []).filter(function (o) { return o.id !== id; });
  }

  function importaRighe(stato, tipo, testo) {
    const righe = String(testo || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    const errori = [];
    let n = 0;
    righe.forEach(function (riga, indice) {
      if (indice === 0 && /data/i.test(riga) && /codice|piatto|quant/i.test(riga)) return;
      const c = celle(riga);
      const data = format.dataISO(c[0]);
      if (!data) {
        errori.push("Riga " + (indice + 1) + ": data non letta (" + c[0] + ").");
        return;
      }
      const at = data + "T12:00:00";
      let esito;
      if (tipo === "carichi") {
        esito = registraCarico(stato, {
          at: at,
          idIngrediente: c[1],
          quantita: format.parseNumero(c[2]),
          fornitore: c[3] || "",
          prezzoUdm: c[4] ? format.parseNumero(c[4]) : "",
          qtaConfezione: c[5] ? format.parseNumero(c[5]) : "",
          diretto: /^(si|sì|diretto|1)$/i.test(c[6] || ""),
        });
      } else if (tipo === "vendite") {
        esito = registraVendita(stato, {
          at: at,
          idPiatto: c[1],
          quantita: format.parseNumero(c[2]),
          prezzoUnitario: c[3] ? format.parseNumero(c[3]) : "",
        });
      } else if (tipo === "inventario") {
        esito = registraInventario(stato, {
          at: at,
          idIngrediente: c[1],
          reale: format.parseNumero(c[2]),
        });
      } else {
        esito = { ok: false, errore: "Tipo sconosciuto." };
      }
      if (!esito.ok) errori.push("Riga " + (indice + 1) + ": " + esito.errore);
      else n += 1;
    });
    return { n: n, errori: errori };
  }

  return {
    nuovoId: nuovoId,
    registraOfferta: registraOfferta,
    registraCarico: registraCarico,
    eliminaCarico: eliminaCarico,
    registraVendita: registraVendita,
    eliminaVendita: eliminaVendita,
    registraInventario: registraInventario,
    eliminaInventario: eliminaInventario,
    eliminaOfferta: eliminaOfferta,
    importaRighe: importaRighe,
  };
});
