/*
 * Motore dell'ERP leggero. Stesse regole del gestionale sul Mac, senza database:
 * - giacenza food = ultimo conteggio + carichi successivi − vendite × ricetta
 * - sfrido = consumo reale cumulato / consumo teorico cumulato, fra 0,10 e 10
 * - lista spesa food = (vendite × ricetta × sfrido negli ultimi N giorni / N) × giorni − giacenza
 * - TEMPO (detersivi): consumo fra gli ultimi due conteggi, senza sfrido da ricetta
 * - fornitore: per ciascuno vince l'ultimo documento (a parità di data, la fattura);
 *   tra i fornitori vince il €/U.D.M. più basso, con la SUA confezione
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ErpEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const EPS = 1e-9;

  function statoVuoto() {
    return {
      versione: 1,
      demo: false,
      scelta: false,
      impostazioni: {
        nomeLocale: "Pizzeria",
        giorniCopertura: 7,
        giorniStorico: 30,
        sogliaAllerta: 0.1,
      },
      ingredienti: [],
      offerte: [],
      piatti: [],
      ricette: [],
      carichi: [],
      vendite: [],
      inventari: [],
    };
  }

  function normalizzaStato(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("File non riconosciuto");
    }
    const noti = ["ingredienti", "piatti", "ricette", "carichi", "vendite", "inventari", "offerte", "impostazioni", "versione"];
    if (!noti.some(function (k) { return Object.prototype.hasOwnProperty.call(raw, k); })) {
      throw new Error("File non riconosciuto");
    }
    if (raw.versione != null && Number(raw.versione) > 1) {
      throw new Error("Questo backup è di una versione più nuova dell'app");
    }
    const base = statoVuoto();
    const stato = {
      versione: 1,
      demo: !!raw.demo,
      scelta: raw.scelta != null ? !!raw.scelta : (raw.ingredienti || []).length > 0,
      impostazioni: Object.assign({}, base.impostazioni, raw.impostazioni || {}),
      ingredienti: raw.ingredienti || [],
      offerte: raw.offerte || [],
      piatti: raw.piatti || [],
      ricette: raw.ricette || [],
      carichi: raw.carichi || [],
      vendite: raw.vendite || [],
      inventari: raw.inventari || [],
    };
    stato.impostazioni.giorniCopertura = Math.max(1, Number(stato.impostazioni.giorniCopertura) || 7);
    stato.impostazioni.giorniStorico = Math.max(1, Number(stato.impostazioni.giorniStorico) || 30);
    stato.impostazioni.sogliaAllerta = Number(stato.impostazioni.sogliaAllerta);
    if (!Number.isFinite(stato.impostazioni.sogliaAllerta)) stato.impostazioni.sogliaAllerta = 0.1;
    return stato;
  }

  function codice(id) {
    return String(id || "").trim().toUpperCase();
  }

  function chiaveFornitore(nome) {
    return String(nome || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("it");
  }

  function parteGiorno(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!m) return null;
    return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  }

  function aggiungiGiorni(iso, n) {
    const t = parteGiorno(iso);
    if (t == null) return "";
    const d = new Date(t + n * 86400000);
    const z = function (x) { return String(x).padStart(2, "0"); };
    return d.getUTCFullYear() + "-" + z(d.getUTCMonth() + 1) + "-" + z(d.getUTCDate());
  }

  function giorniTra(a, b) {
    const da = parteGiorno(a);
    const db = parteGiorno(b);
    if (da == null || db == null) return 0;
    return Math.round((db - da) / 86400000);
  }

  function fineGiorno(iso) {
    const g = String(iso || "").slice(0, 10);
    return g ? g + "T23:59:59" : "";
  }

  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function trovaIng(stato, id) {
    const k = codice(id);
    return (stato.ingredienti || []).find(function (i) { return codice(i.id) === k; }) || null;
  }

  function trovaPiatto(stato, id) {
    const k = codice(id);
    return (stato.piatti || []).find(function (p) { return codice(p.id) === k; }) || null;
  }

  function nelPeriodo(at, daEscluso, aIncluso) {
    const t = String(at || "");
    if (!t) return false;
    if (daEscluso && !(t > daEscluso)) return false;
    if (aIncluso && t > aIncluso) return false;
    return true;
  }

  function sommaCarichi(stato, id, daEscluso, aIncluso) {
    const k = codice(id);
    let tot = 0;
    (stato.carichi || []).forEach(function (c) {
      if (codice(c.idIngrediente) !== k) return;
      if (!nelPeriodo(c.at, daEscluso, aIncluso)) return;
      tot += Number(c.quantita) || 0;
    });
    return tot;
  }

  function consumoTeorico(stato, id, daEscluso, aIncluso) {
    const k = codice(id);
    let tot = 0;
    (stato.vendite || []).forEach(function (v) {
      if (!nelPeriodo(v.at, daEscluso, aIncluso)) return;
      const qv = Number(v.quantita) || 0;
      if (qv <= 0) return;
      (stato.ricette || []).forEach(function (r) {
        if (codice(r.idPiatto) !== codice(v.idPiatto)) return;
        if (codice(r.idIngrediente) !== k) return;
        tot += qv * (Number(r.quantita) || 0);
      });
    });
    return tot;
  }

  function inventariDi(stato, id) {
    const k = codice(id);
    return (stato.inventari || [])
      .filter(function (i) { return codice(i.idIngrediente) === k && i.at; })
      .slice()
      .sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
  }

  function documentoPiuRecente(a, b) {
    const da = String(a.data || "");
    const db = String(b.data || "");
    if (da !== db) return da > db ? a : b;
    const fa = a.tipo === "fattura" ? 1 : 0;
    const fb = b.tipo === "fattura" ? 1 : 0;
    if (fa !== fb) return fa > fb ? a : b;
    return a;
  }

  function prezzoIngrediente(stato, id) {
    const ing = trovaIng(stato, id);
    const k = codice(id);
    const perFornitore = new Map();
    (stato.offerte || []).forEach(function (o) {
      if (codice(o.idIngrediente) !== k) return;
      if (!(Number(o.prezzoUdm) > 0)) return;
      const fk = chiaveFornitore(o.fornitore);
      if (!fk) return;
      const cur = perFornitore.get(fk);
      perFornitore.set(fk, cur ? documentoPiuRecente(o, cur) : o);
    });
    let best = null;
    perFornitore.forEach(function (o) {
      if (!best || Number(o.prezzoUdm) < Number(best.prezzoUdm) - 1e-12) best = o;
    });
    if (!best) return null;
    const qtaDoc = Number(best.qtaConfezione) || 0;
    const qtaAna = ing ? Number(ing.qtaConfezione) || 0 : 0;
    return {
      fornitore: String(best.fornitore || "").trim(),
      prezzoUdm: Number(best.prezzoUdm),
      qtaConfezione: qtaDoc > 0 ? qtaDoc : qtaAna,
      tipo: best.tipo === "preventivo" ? "preventivo" : "fattura",
      data: best.data || "",
    };
  }

  function sfridoIngrediente(stato, id) {
    const ing = trovaIng(stato, id);
    const tempo = !!(ing && ing.tipo === "TEMPO");
    const vuoto = {
      coef: 1,
      fonte: tempo ? "tempo" : "manca",
      periodi: [],
      reale: 0,
      teorico: 0,
    };
    if (!ing || tempo) return vuoto;
    const inv = inventariDi(stato, id);
    const periodi = [];
    let sumR = 0;
    let sumT = 0;
    for (let i = 1; i < inv.length; i += 1) {
      const a = inv[i - 1];
      const b = inv[i];
      const theo = consumoTeorico(stato, id, a.at, b.at);
      if (theo <= EPS) continue;
      const car = sommaCarichi(stato, id, a.at, b.at);
      const real = (Number(a.reale) || 0) + car - (Number(b.reale) || 0);
      if (real < 0) continue;
      sumR += real;
      sumT += theo;
      periodi.push({
        da: a.at,
        a: b.at,
        realeInizio: Number(a.reale) || 0,
        realeFine: Number(b.reale) || 0,
        carichi: car,
        reale: real,
        teorico: theo,
      });
    }
    if (sumT <= EPS) return Object.assign(vuoto, { periodi: periodi, reale: sumR, teorico: sumT });
    let coef = sumR / sumT;
    let clamp = "";
    if (coef < 0.1) { coef = 0.1; clamp = "min"; }
    if (coef > 10) { coef = 10; clamp = "max"; }
    return { coef: coef, fonte: "inventari", periodi: periodi, reale: sumR, teorico: sumT, clamp: clamp };
  }

  function consumoTempo(stato, id, oggi) {
    const ing = trovaIng(stato, id);
    if (!ing || ing.tipo !== "TEMPO") {
      return { giornaliero: 0, fonte: "non_applicabile", giorni: 0 };
    }
    if (Number(ing.consumoForzato) > 0) {
      return { giornaliero: Number(ing.consumoForzato), fonte: "forzatura", giorni: 0 };
    }
    const inv = inventariDi(stato, id);
    if (inv.length >= 2) {
      const a = inv[inv.length - 2];
      const b = inv[inv.length - 1];
      const giorni = giorniTra(a.at, b.at);
      if (giorni > 0) {
        const car = sommaCarichi(stato, id, a.at, b.at);
        const tot = (Number(a.reale) || 0) + car - (Number(b.reale) || 0);
        if (tot > EPS) {
          return { giornaliero: tot / giorni, fonte: "conteggi", giorni: giorni, consumo: tot };
        }
      }
    }
    if (Number(ing.consumoStimato) > 0) {
      return { giornaliero: Number(ing.consumoStimato), fonte: "stimato", giorni: 0 };
    }
    return { giornaliero: 0, fonte: "nessuno", giorni: 0 };
  }

  function giacenzaIngrediente(stato, id, oggi) {
    const ing = trovaIng(stato, id);
    if (!ing) return 0;
    const fino = fineGiorno(oggi);
    const inv = inventariDi(stato, id);
    const ultimo = inv.length ? inv[inv.length - 1] : null;
    if (ing.tipo === "TEMPO") {
      const rate = consumoTempo(stato, id, oggi).giornaliero;
      if (!ultimo) {
        const tutti = (stato.carichi || []).filter(function (c) {
          return codice(c.idIngrediente) === codice(id) && nelPeriodo(c.at, "", fino);
        });
        if (!tutti.length) return 0;
        const primo = tutti.slice().sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); })[0];
        const tot = tutti.reduce(function (s, c) { return s + (Number(c.quantita) || 0); }, 0);
        return tot - rate * Math.max(0, giorniTra(primo.at, oggi));
      }
      const giorni = Math.max(0, giorniTra(ultimo.at, oggi));
      const car = sommaCarichi(stato, id, ultimo.at, fino);
      return (Number(ultimo.reale) || 0) + car - rate * giorni;
    }
    if (!ultimo) {
      return sommaCarichi(stato, id, "", fino) - consumoTeorico(stato, id, "", fino);
    }
    return (Number(ultimo.reale) || 0)
      + sommaCarichi(stato, id, ultimo.at, fino)
      - consumoTeorico(stato, id, ultimo.at, fino);
  }

  function opzioniDi(stato, opts) {
    const imp = (stato && stato.impostazioni) || {};
    const o = opts || {};
    return {
      oggi: o.oggi,
      giorniCopertura: Math.max(1, Number(o.giorniCopertura || imp.giorniCopertura) || 7),
      giorniStorico: Math.max(1, Number(o.giorniStorico || imp.giorniStorico) || 30),
    };
  }

  function profiloIngrediente(stato, id, oggi, opts) {
    const ing = trovaIng(stato, id);
    if (!ing) return null;
    const op = opzioniDi(stato, Object.assign({ oggi: oggi }, opts || {}));
    const tempo = ing.tipo === "TEMPO";
    const sfr = sfridoIngrediente(stato, id);
    const giacenza = giacenzaIngrediente(stato, id, op.oggi);
    const prezzo = prezzoIngrediente(stato, id);
    let consumoMedio = 0;
    let fonte = "nessuno";
    let giorniCop = op.giorniCopertura;
    if (tempo) {
      const c = consumoTempo(stato, id, op.oggi);
      consumoMedio = c.giornaliero;
      fonte = c.fonte === "conteggi" ? "tempo" : c.fonte;
      giorniCop = Math.max(1, Number(ing.giorniCopertura) || op.giorniCopertura);
    } else {
      const lo = fineGiorno(aggiungiGiorni(op.oggi, -op.giorniStorico));
      const theo = consumoTeorico(stato, id, lo, fineGiorno(op.oggi));
      if (theo > EPS) {
        consumoMedio = (theo * sfr.coef) / op.giorniStorico;
        fonte = "storico";
      } else if (Number(ing.consumoStimato) > 0) {
        consumoMedio = Number(ing.consumoStimato);
        fonte = "stimato";
      }
    }
    const fabbisogno = consumoMedio * giorniCop;
    const daComprare = Math.max(0, fabbisogno - giacenza);
    return {
      id: codice(ing.id),
      nome: ing.nome || codice(ing.id),
      categoria: ing.categoria || "Senza categoria",
      udm: ing.udm || "kg",
      tipo: tempo ? "TEMPO" : "POS",
      attivo: ing.attivo !== false,
      coef: sfr.coef,
      fonteSfrido: sfr.fonte,
      giacenza: giacenza,
      consumoMedio: consumoMedio,
      fonteConsumo: fonte,
      giorniCopertura: giorniCop,
      giorniStorico: op.giorniStorico,
      fabbisogno: fabbisogno,
      daComprare: daComprare,
      autonomia: consumoMedio > EPS ? giacenza / consumoMedio : null,
      prezzo: prezzo,
      acquistoSfuso: !!ing.acquistoSfuso,
      qtaConfezione: prezzo && prezzo.qtaConfezione > 0
        ? prezzo.qtaConfezione
        : (Number(ing.qtaConfezione) || 0),
    };
  }

  function rigaOrdine(p) {
    if (!p || !p.attivo || p.daComprare <= EPS) return null;
    const qta = p.qtaConfezione;
    let colli = null;
    let quantita = p.daComprare;
    let unita = p.udm;
    const avvisi = [];
    if (p.acquistoSfuso) {
      quantita = Math.round(p.daComprare * 1000) / 1000;
      unita = p.udm;
    } else if (qta > 0) {
      colli = Math.max(1, Math.ceil(p.daComprare / qta - 1e-12));
      quantita = colli;
      unita = "collo";
    } else {
      avvisi.push("Manca quanto contiene una confezione: l'ordine resta in " + p.udm + ".");
    }
    let costo = null;
    if (p.prezzo && p.prezzo.prezzoUdm > 0) {
      if (colli != null && qta > 0) costo = round2(colli * p.prezzo.prezzoUdm * qta);
      else costo = round2(quantita * p.prezzo.prezzoUdm);
    } else {
      avvisi.push("Nessun prezzo: aggiungi una fattura o un preventivo.");
    }
    return {
      id: p.id,
      nome: p.nome,
      categoria: p.categoria,
      udm: p.udm,
      tipo: p.tipo,
      fornitore: p.prezzo ? p.prezzo.fornitore : "",
      prezzoUdm: p.prezzo ? p.prezzo.prezzoUdm : null,
      tipoPrezzo: p.prezzo ? p.prezzo.tipo : "",
      dataPrezzo: p.prezzo ? p.prezzo.data : "",
      qtaConfezione: qta,
      acquistoSfuso: p.acquistoSfuso,
      consumoMedio: p.consumoMedio,
      fonteConsumo: p.fonteConsumo,
      coef: p.coef,
      fabbisogno: p.fabbisogno,
      giacenza: p.giacenza,
      daComprare: p.daComprare,
      autonomia: p.autonomia,
      giorniCopertura: p.giorniCopertura,
      giorniStorico: p.giorniStorico,
      colli: colli,
      quantita: quantita,
      unita: unita,
      costo: costo,
      avviso: avvisi.join(" "),
    };
  }

  function propostaOrdini(stato, opts) {
    const op = opzioniDi(stato, opts);
    const righe = [];
    (stato.ingredienti || []).forEach(function (ing) {
      const r = rigaOrdine(profiloIngrediente(stato, ing.id, op.oggi, op));
      if (r) righe.push(r);
    });
    righe.sort(function (a, b) {
      const fa = a.fornitore || "Senza fornitore";
      const fb = b.fornitore || "Senza fornitore";
      if (fa !== fb) return fa.localeCompare(fb, "it");
      return a.nome.localeCompare(b.nome, "it");
    });
    const map = new Map();
    righe.forEach(function (r) {
      const k = r.fornitore || "Senza fornitore";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    const gruppi = [];
    map.forEach(function (rs, fornitore) {
      const noti = rs.every(function (r) { return r.costo != null; });
      const totale = rs.reduce(function (s, r) { return s + (r.costo || 0); }, 0);
      gruppi.push({ fornitore: fornitore, righe: rs, totale: noti ? round2(totale) : null, parziale: !noti });
    });
    gruppi.sort(function (a, b) { return a.fornitore.localeCompare(b.fornitore, "it"); });
    const tuttiNoti = righe.every(function (r) { return r.costo != null; });
    const totale = righe.reduce(function (s, r) { return s + (r.costo || 0); }, 0);
    return {
      righe: righe,
      gruppi: gruppi,
      totale: righe.length && tuttiNoti ? round2(totale) : (righe.length ? round2(totale) : 0),
      parziale: !tuttiNoti,
      giorniCopertura: op.giorniCopertura,
      giorniStorico: op.giorniStorico,
    };
  }

  function foodCost(stato) {
    const piatti = [];
    (stato.piatti || []).forEach(function (p) {
      const righe = [];
      let costoTeorico = 0;
      let costoReale = 0;
      const mancano = [];
      (stato.ricette || []).forEach(function (r) {
        if (codice(r.idPiatto) !== codice(p.id)) return;
        const ing = trovaIng(stato, r.idIngrediente);
        const prezzo = prezzoIngrediente(stato, r.idIngrediente);
        const euroU = prezzo ? prezzo.prezzoUdm : 0;
        const coef = ing && ing.tipo === "TEMPO" ? 1 : sfridoIngrediente(stato, r.idIngrediente).coef;
        const q = Number(r.quantita) || 0;
        const ct = q * euroU;
        const cr = q * coef * euroU;
        costoTeorico += ct;
        costoReale += cr;
        if (!prezzo) mancano.push(ing ? ing.nome : codice(r.idIngrediente));
        righe.push({
          id: codice(r.idIngrediente),
          nome: ing ? ing.nome : codice(r.idIngrediente),
          quantita: q,
          udm: ing ? ing.udm || "" : "",
          prezzoUdm: prezzo ? prezzo.prezzoUdm : null,
          fornitore: prezzo ? prezzo.fornitore : "",
          coef: coef,
          costoTeorico: ct,
          costoReale: cr,
        });
      });
      let qtaVenduta = 0;
      let ricavo = 0;
      let qtaConPrezzo = 0;
      (stato.vendite || []).forEach(function (v) {
        if (codice(v.idPiatto) !== codice(p.id)) return;
        const q = Number(v.quantita) || 0;
        if (q <= 0) return;
        qtaVenduta += q;
        if (v.prezzoUnitario != null && Number(v.prezzoUnitario) >= 0 && v.prezzoUnitario !== "") {
          ricavo += q * Number(v.prezzoUnitario);
          qtaConPrezzo += q;
        }
      });
      const listino = Number(p.prezzoListino);
      const incasso = qtaConPrezzo > 0 ? ricavo / qtaConPrezzo : null;
      piatti.push({
        id: codice(p.id),
        nome: p.nome || codice(p.id),
        categoria: p.categoria || "Senza categoria",
        costoTeorico: costoTeorico,
        costoReale: costoReale,
        listino: Number.isFinite(listino) && listino > 0 ? listino : null,
        incasso: incasso,
        fcListino: Number.isFinite(listino) && listino > 0 ? costoReale / listino : null,
        fcIncasso: incasso > 0 ? costoReale / incasso : null,
        fcListinoTeorico: Number.isFinite(listino) && listino > 0 ? costoTeorico / listino : null,
        qtaVenduta: qtaVenduta,
        ricavo: qtaConPrezzo > 0 ? ricavo : 0,
        righe: righe,
        mancanoPrezzi: mancano,
      });
    });
    piatti.sort(function (a, b) {
      const fa = a.fcIncasso == null ? -1 : a.fcIncasso;
      const fb = b.fcIncasso == null ? -1 : b.fcIncasso;
      return fb - fa;
    });
    const cat = new Map();
    piatti.forEach(function (p) {
      if (!cat.has(p.categoria)) cat.set(p.categoria, { categoria: p.categoria, costo: 0, ricavo: 0, n: 0 });
      const c = cat.get(p.categoria);
      c.n += 1;
      if (p.qtaVenduta > 0 && p.incasso != null) {
        c.costo += p.costoReale * p.qtaVenduta;
        c.ricavo += p.ricavo;
      }
    });
    const categorie = [];
    cat.forEach(function (c) {
      c.fc = c.ricavo > 0 ? c.costo / c.ricavo : null;
      categorie.push(c);
    });
    categorie.sort(function (a, b) { return a.categoria.localeCompare(b.categoria, "it"); });
    return { piatti: piatti, categorie: categorie };
  }

  function allertePrezzi(stato) {
    const soglia = Number(stato.impostazioni && stato.impostazioni.sogliaAllerta);
    const limite = Number.isFinite(soglia) ? soglia : 0.1;
    const gruppi = new Map();
    (stato.offerte || []).forEach(function (o) {
      if (o.tipo === "preventivo") return;
      if (!(Number(o.prezzoUdm) > 0)) return;
      const k = codice(o.idIngrediente) + "|" + chiaveFornitore(o.fornitore);
      if (!chiaveFornitore(o.fornitore)) return;
      if (!gruppi.has(k)) gruppi.set(k, []);
      gruppi.get(k).push(o);
    });
    const out = [];
    gruppi.forEach(function (arr) {
      arr.sort(function (a, b) { return String(a.data || "").localeCompare(String(b.data || "")); });
      if (arr.length < 2) return;
      const prima = arr[arr.length - 2];
      const dopo = arr[arr.length - 1];
      const delta = (Number(dopo.prezzoUdm) - Number(prima.prezzoUdm)) / Number(prima.prezzoUdm);
      if (delta + 1e-12 < limite) return;
      const ing = trovaIng(stato, dopo.idIngrediente);
      out.push({
        id: codice(dopo.idIngrediente),
        nome: ing ? ing.nome : codice(dopo.idIngrediente),
        udm: ing ? ing.udm || "" : "",
        fornitore: String(dopo.fornitore || "").trim(),
        prima: Number(prima.prezzoUdm),
        dopo: Number(dopo.prezzoUdm),
        dataPrima: prima.data || "",
        dataDopo: dopo.data || "",
        delta: delta,
      });
    });
    out.sort(function (a, b) { return b.delta - a.delta; });
    return out;
  }

  function cruscotto(stato, oggi, opts) {
    return (stato.ingredienti || []).map(function (ing) {
      return profiloIngrediente(stato, ing.id, oggi, opts);
    }).filter(Boolean).sort(function (a, b) {
      return a.nome.localeCompare(b.nome, "it");
    });
  }

  return {
    statoVuoto: statoVuoto,
    normalizzaStato: normalizzaStato,
    codice: codice,
    aggiungiGiorni: aggiungiGiorni,
    giorniTra: giorniTra,
    fineGiorno: fineGiorno,
    prezzoIngrediente: prezzoIngrediente,
    sfridoIngrediente: sfridoIngrediente,
    consumoTempo: consumoTempo,
    giacenzaIngrediente: giacenzaIngrediente,
    profiloIngrediente: profiloIngrediente,
    propostaOrdini: propostaOrdini,
    foodCost: foodCost,
    allertePrezzi: allertePrezzi,
    cruscotto: cruscotto,
  };
});
