/* Interfaccia. I conti stanno in engine.js: qui si scrive e si legge. */
(function () {
  "use strict";

  const NOMI = ["oggi", "conteggio", "giacenza", "spesa", "menu", "magazzino", "ricette", "movimenti", "food", "sfridi", "dati"];
  const BARRA = [
    ["conteggio", "Conteggio"],
    ["giacenza", "Giacenza"],
    ["spesa", "Spesa"],
    ["menu", "Menu"],
  ];
  const TITOLI = {
    oggi: "Oggi",
    conteggio: "Conteggio",
    giacenza: "Giacenza",
    spesa: "Spesa",
    menu: "Menu",
    magazzino: "Magazzino",
    ricette: "Ricette",
    movimenti: "Movimenti",
    food: "Food cost",
    sfridi: "Sfridi",
    dati: "Dati",
  };

  let stato = null;
  let banner = "";
  let bannerErrore = false;
  let infoTesti = {};
  let infoN = 0;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function route() {
    const pezzi = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(function (p) {
      try { return decodeURIComponent(p); } catch (e) { return p; }
    });
    const name = NOMI.indexOf(pezzi[0]) >= 0 ? pezzi[0] : "oggi";
    return { name: name, a: pezzi[1] || "", b: pezzi[2] || "" };
  }

  function vai(path) {
    const prossimo = "#/" + path;
    if (location.hash === prossimo) render();
    else location.hash = prossimo;
  }

  function oggi() {
    return ErpFormat.oggi();
  }

  function nomeIng(id) {
    const ing = (stato.ingredienti || []).find(function (i) { return ErpEngine.codice(i.id) === ErpEngine.codice(id); });
    return ing ? ing.nome : id;
  }

  function nomePiatto(id) {
    const p = (stato.piatti || []).find(function (x) { return ErpEngine.codice(x.id) === ErpEngine.codice(id); });
    return p ? p.nome : id;
  }

  function udmIng(id) {
    const ing = (stato.ingredienti || []).find(function (i) { return ErpEngine.codice(i.id) === ErpEngine.codice(id); });
    return ing ? ing.udm || "" : "";
  }

  function opzioniIngredienti() {
    return (stato.ingredienti || []).filter(function (i) { return i.attivo !== false; })
      .slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, "it"); })
      .map(function (i) { return '<option value="' + esc(i.id) + '">' + esc(i.id) + " — " + esc(i.nome) + "</option>"; })
      .join("");
  }

  function opzioniPiatti() {
    return (stato.piatti || []).slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, "it"); })
      .map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.nome) + "</option>"; })
      .join("");
  }

  function campo(etichetta, inner, largo) {
    return '<label class="campo' + (largo ? " largo" : "") + '"><span>' + etichetta + "</span>" + inner + "</label>";
  }

  function inputTesto(name, valore, placeholder) {
    return '<input name="' + name + '" value="' + esc(valore || "") + '" placeholder="' + esc(placeholder || "") + '" autocomplete="off">';
  }

  function inputNum(name, valore, placeholder) {
    return '<input name="' + name + '" inputmode="decimal" value="' + esc(valore || "") + '" placeholder="' + esc(placeholder || "") + '" autocomplete="off">';
  }

  function tabella(testi, corpo) {
    if (!corpo) return '<p class="muto">Niente da mostrare.</p>';
    return '<div class="scorri"><table class="registro"><thead><tr>'
      + testi.map(function (t) { return "<th>" + t + "</th>"; }).join("")
      + "</tr></thead><tbody>" + corpo + "</tbody></table></div>";
  }

  function bannerHtml() {
    const pezzi = [];
    if (ErpDb.messaggio()) pezzi.push('<p class="banner errore">' + esc(ErpDb.messaggio()) + "</p>");
    if (banner) pezzi.push('<p class="banner' + (bannerErrore ? " errore" : "") + '">' + esc(banner) + "</p>");
    return pezzi.join("");
  }

  function tastoInfo(testo) {
    infoN += 1;
    const id = "n" + infoN;
    infoTesti[id] = testo;
    return '<button type="button" class="tasto-i" data-info="' + id + '" aria-label="Spiegazione">i</button>';
  }

  function chiudiFoglio() {
    infoAperto = false;
    const f = document.getElementById("foglio");
    const t = document.getElementById("foglio-testo");
    if (t) t.textContent = "";
    if (f) f.hidden = true;
  }

  function apriFoglio(testo) {
    const f = document.getElementById("foglio");
    const t = document.getElementById("foglio-testo");
    if (!f || !t) return;
    t.textContent = testo || "";
    f.hidden = false;
    const x = document.getElementById("foglio-x");
    if (x) x.focus();
  }

  function percheOrdine(r) {
    const med = ErpFormat.qta(r.consumoMedio) + " " + r.udm + "/giorno";
    let fonte = "giacenza sotto zero";
    if (r.tipo === "TEMPO") fonte = "consumo fra gli ultimi conteggi";
    else if (r.fonteConsumo === "storico") fonte = "ricetta × sfrido " + ErpFormat.ita(r.coef, 2) + ", ultimi " + r.giorniStorico + " giorni";
    else if (r.fonteConsumo === "stimato") fonte = "stima, non ci sono ancora vendite";
    let coda = "";
    if (r.colli != null) {
      coda = ", " + ErpFormat.qta(r.colli) + (r.colli === 1 ? " collo da " : " colli da ") + ErpFormat.qta(r.qtaConfezione) + " " + r.udm;
    } else if (r.acquistoSfuso) coda = ", a peso";
    if (r.fornitore) coda += ", " + r.fornitore;
    if (r.costo != null) coda += ", " + ErpFormat.euro(r.costo);
    return "Media " + med + " (" + fonte + "). Per " + r.giorniCopertura + " giorni servono "
      + ErpFormat.qta(r.fabbisogno) + " " + r.udm + ". In casa " + ErpFormat.qta(r.giacenza)
      + ". Da comprare " + ErpFormat.qta(r.daComprare) + " " + r.udm + coda + ".";
  }

  function spiegaSfrido(id) {
    const s = ErpEngine.sfridoIngrediente(stato, id);
    const nome = nomeIng(id);
    if (!s || s.fonte !== "inventari") {
      return nome + ". Lo sfrido resta 1 finché non ci sono due conteggi con delle vendite in mezzo.";
    }
    const ult = s.periodi[s.periodi.length - 1];
    let frase = nome + ". Sfrido " + ErpFormat.ita(s.coef, 2) + ".";
    if (ult) {
      frase += " Dal " + ErpFormat.dataIT(ult.da) + " al " + ErpFormat.dataIT(ult.a)
        + " la ricetta ne chiedeva " + ErpFormat.qta(ult.teorico)
        + ", il conteggio ne ha fatti uscire " + ErpFormat.qta(ult.reale)
        + " (da " + ErpFormat.qta(ult.realeInizio) + ", carico " + ErpFormat.qta(ult.carichi)
        + ", restavano " + ErpFormat.qta(ult.realeFine) + ").";
    }
    if (s.clamp) frase += " Tenuto fra 0,10 e 10.";
    return frase;
  }

  function spiegaGiacenza(id) {
    const p = ErpEngine.profiloIngrediente(stato, id, oggi());
    if (!p) return "";
    const inv = (stato.inventari || []).filter(function (i) {
      return ErpEngine.codice(i.idIngrediente) === p.id && i.at;
    }).slice().sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
    const ultimo = inv.length ? inv[inv.length - 1] : null;
    if (!ultimo) {
      return p.nome + ". Nessun conteggio. In casa " + ErpFormat.qta(p.giacenza) + " " + p.udm + ".";
    }
    let carichi = 0;
    (stato.carichi || []).forEach(function (c) {
      if (ErpEngine.codice(c.idIngrediente) !== p.id) return;
      if (String(c.at) > String(ultimo.at)) carichi += Number(c.quantita) || 0;
    });
    const uscite = (Number(ultimo.reale) || 0) + carichi - p.giacenza;
    let frase = p.nome + ". Ultimo conteggio " + ErpFormat.qta(ultimo.reale) + " " + p.udm
      + " il " + ErpFormat.dataIT(ultimo.at) + ". Carichi dopo: " + ErpFormat.qta(carichi) + " " + p.udm
      + ". Uscite dopo: " + ErpFormat.qta(uscite) + " " + p.udm
      + ". In casa " + ErpFormat.qta(p.giacenza) + " " + p.udm + ".";
    if (p.tipo !== "TEMPO" && p.fonteSfrido === "inventari") {
      frase += " " + spiegaSfrido(id).replace(p.nome + ". ", "");
    }
    return frase;
  }

  function vistaHome() {
    if (!(stato.ingredienti || []).length && !stato.scelta) {
      return '<div class="azioni colonna">'
        + '<button type="button" class="tasto-grosso" data-act="esempio">Esempio dei pelati</button>'
        + '<button type="button" class="tasto-grosso tasto-chiaro" data-act="vuoto">Il mio magazzino</button>'
        + tastoInfo("I dati restano in questo telefono. L'esempio è una Margherita con 0,145 kg di pelati: due conteggi e un carico fanno uscire lo sfrido.")
        + "</div>";
    }
    const o = ErpEngine.propostaOrdini(stato, { oggi: oggi() });
    return '<p class="etichetta">Da ordinare</p>'
      + '<p class="numero-hero">' + ErpFormat.euro(o.totale) + "</p>"
      + '<a class="tasto-grosso" href="#/conteggio">Conteggio</a>'
      + '<a class="tasto-grosso" href="#/giacenza">Giacenza</a>'
      + '<a class="tasto-grosso" href="#/spesa">Spesa</a>';
  }

  function vistaConteggio() {
    const id = route().a;
    if (id) return vistaConteggioUno(id);
    const righe = (stato.ingredienti || []).filter(function (i) { return i.attivo !== false; })
      .slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, "it"); });
    if (!righe.length) {
      return '<a class="tasto-grosso" href="#/magazzino/nuovo">Nuovo prodotto</a>';
    }
    return righe.map(function (i) {
      return '<a class="riga riga-link" href="#/conteggio/' + encodeURIComponent(i.id) + '"><span class="riga-nome">' + esc(i.nome) + "</span></a>";
    }).join("") + incolla("inventario", "data;codice;quantità contata", "09/11/2026;LAT-009;6");
  }

  function vistaConteggioUno(id) {
    const ing = (stato.ingredienti || []).find(function (i) { return ErpEngine.codice(i.id) === ErpEngine.codice(id); });
    if (!ing) return '<p class="banner errore">Prodotto non trovato.</p>';
    return '<a class="indietro" href="#/conteggio">Conteggio</a>'
      + '<div class="riga"><span class="riga-nome">' + esc(ing.nome) + "</span>" + tastoInfo(spiegaSfrido(ing.id)) + "</div>"
      + '<form data-form="inventario" class="campi">'
      + '<input type="hidden" name="ing" value="' + esc(ing.id) + '">'
      + '<input type="hidden" name="data" value="' + oggi() + '">'
      + '<input type="hidden" name="ora" value="' + ErpFormat.oraAdesso() + '">'
      + '<label class="campo campo-eroe largo"><span>Quantità contata, ' + esc(ing.udm || "kg") + "</span>"
      + inputNum("reale", "", "0")
      + "</label>"
      + '<div class="azioni largo"><button type="submit" class="tasto-grosso">Salva</button></div>'
      + "</form>";
  }

  function vistaGiacenza() {
    const righe = ErpEngine.cruscotto(stato, oggi()).filter(function (r) { return r.attivo; });
    righe.sort(function (a, b) {
      const ua = a.giacenza <= 0 || (a.autonomia != null && a.autonomia < 3) ? 0 : 1;
      const ub = b.giacenza <= 0 || (b.autonomia != null && b.autonomia < 3) ? 0 : 1;
      if (ua !== ub) return ua - ub;
      return a.nome.localeCompare(b.nome, "it");
    });
    if (!righe.length) return '<p class="etichetta">Nessun prodotto.</p>';
    return righe.map(function (r) {
      const urgente = r.giacenza <= 0 || (r.autonomia != null && r.autonomia < 3);
      return '<div class="riga' + (urgente ? " urgente" : "") + '">'
        + '<a class="riga-nome" href="#/magazzino/scheda/' + encodeURIComponent(r.id) + '">' + esc(r.nome) + "</a>"
        + '<span class="riga-num">' + ErpFormat.qta(r.giacenza) + " " + esc(r.udm) + "</span>"
        + tastoInfo(spiegaGiacenza(r.id))
        + "</div>";
    }).join("");
  }

  function vistaMenu() {
    return [
      ["magazzino", "Magazzino"],
      ["movimenti", "Movimenti"],
      ["ricette", "Ricette"],
      ["food", "Food cost"],
      ["sfridi", "Sfridi"],
      ["dati", "Dati"],
    ].map(function (v) {
      return '<a class="tasto-grosso" href="#/' + v[0] + '">' + v[1] + "</a>";
    }).join("");
  }

  function rigaCompatta(nome, href, numero, testo, urgente) {
    return '<div class="riga' + (urgente ? " urgente" : "") + '">'
      + (href ? '<a class="riga-nome" href="' + href + '">' + esc(nome) + "</a>" : '<span class="riga-nome">' + esc(nome) + "</span>")
      + '<span class="riga-num">' + numero + "</span>"
      + tastoInfo(testo)
      + "</div>";
  }

  function vistaMagazzino() {
    const righe = ErpEngine.cruscotto(stato, oggi());
    const vivi = righe.filter(function (r) { return r.attivo; });
    const spenti = righe.filter(function (r) { return !r.attivo; });
    let html = '<a class="tasto-grosso" href="#/magazzino/nuovo">Nuovo prodotto</a>';
    html += vivi.map(function (r) {
      const prezzo = r.prezzo ? ErpFormat.euro(r.prezzo.prezzoUdm) + "/" + r.udm + " " + r.prezzo.fornitore : "Nessun prezzo.";
      return rigaCompatta(
        r.nome,
        "#/magazzino/scheda/" + encodeURIComponent(r.id),
        ErpFormat.qta(r.giacenza) + " " + esc(r.udm),
        spiegaGiacenza(r.id) + " " + prezzo,
        r.giacenza <= 0
      );
    }).join("");
    if (spenti.length) {
      html += "<details><summary>Archiviati (" + spenti.length + ")</summary>";
      html += spenti.map(function (r) {
        return rigaCompatta(r.nome, "#/magazzino/scheda/" + encodeURIComponent(r.id), ErpFormat.qta(r.giacenza) + " " + esc(r.udm), spiegaGiacenza(r.id), false);
      }).join("");
      html += "</details>";
    }
    return html;
  }

  function formIngrediente(ing) {
    const nuovo = !ing;
    const u = function (val, etichetta) {
      return '<option value="' + val + '"' + (ing && ing.udm === val ? " selected" : "") + ">" + etichetta + "</option>";
    };
    return '<form data-form="ingrediente" class="campi">'
      + (nuovo ? "" : '<input type="hidden" name="id" value="' + esc(ing.id) + '">')
      + (nuovo ? campo("Codice", inputTesto("id", "", "LAT-009")) : '<p class="muto largo">Codice <strong>' + esc(ing.id) + "</strong></p>")
      + campo("Nome", inputTesto("nome", ing && ing.nome, "Pelati"))
      + campo("Categoria", inputTesto("categoria", ing && ing.categoria, "Dispensa"))
      + campo("Unità", '<select name="udm">' + u("kg", "kg") + u("L", "litri") + u("pz", "pezzi") + "</select>")
      + campo("Consumo", '<select name="tipo"><option value="POS"' + (!ing || ing.tipo !== "TEMPO" ? " selected" : "") + '>Da ricetta (POS)</option><option value="TEMPO"' + (ing && ing.tipo === "TEMPO" ? " selected" : "") + ">A tempo (detersivo, carta)</option></select>")
      + campo("Contenuto di una confezione", inputNum("qta", ing && ing.qtaConfezione ? String(ing.qtaConfezione).replace(".", ",") : "", "15"))
      + campo("Giorni di copertura", inputNum("giorni", ing && ing.giorniCopertura ? String(ing.giorniCopertura) : "", "14, solo se è a tempo"))
      + campo("Consumo stimato al giorno", inputNum("stimato", ing && ing.consumoStimato ? String(ing.consumoStimato).replace(".", ",") : "", "se non ci sono ancora vendite"))
      + campo("Consumo forzato al giorno", inputNum("forzato", ing && ing.consumoForzato ? String(ing.consumoForzato).replace(".", ",") : "", "solo detersivi, se vuoi fissarlo"))
      + '<label class="campo largo spunta"><input type="checkbox" name="sfuso"' + (ing && ing.acquistoSfuso ? " checked" : "") + "> Lo compro a peso, senza colli (carne, prosciutto al taglio)</label>"
      + '<div class="azioni largo"><button type="submit" class="btn btn-rosso">' + (nuovo ? "Crea il prodotto" : "Salva anagrafica") + "</button></div>"
      + "</form>";
  }

  function vistaNuovoIng() {
    return "<h2>Nuovo prodotto</h2>" + formIngrediente(null);
  }

  function vistaSchedaIng(id) {
    const ing = (stato.ingredienti || []).find(function (i) { return ErpEngine.codice(i.id) === ErpEngine.codice(id); });
    if (!ing) return '<p class="banner errore">Prodotto non trovato.</p><p><a href="#/magazzino">Torna al magazzino</a></p>';
    const p = ErpEngine.profiloIngrediente(stato, ing.id, oggi());
    let html = '<a class="indietro" href="#/magazzino">Magazzino</a>';
    html += '<div class="riga">'
      + '<span class="riga-nome">Giacenza</span>'
      + '<span class="riga-num">' + ErpFormat.qta(p.giacenza) + " " + esc(p.udm) + "</span>"
      + tastoInfo(spiegaGiacenza(ing.id))
      + "</div>";
    html += '<div class="riga">'
      + '<span class="riga-nome">' + (p.tipo === "TEMPO" ? "Al giorno" : "Sfrido") + "</span>"
      + '<span class="riga-num">' + (p.tipo === "TEMPO" ? ErpFormat.qta(p.consumoMedio) : ErpFormat.ita(p.coef, 2)) + "</span>"
      + tastoInfo(p.tipo === "TEMPO" ? (ing.nome + ". Consumo " + ErpFormat.qta(p.consumoMedio) + " " + p.udm + " al giorno.") : spiegaSfrido(ing.id))
      + "</div>";
    html += '<div class="riga">'
      + '<span class="riga-nome">' + (p.prezzo ? esc(p.prezzo.fornitore) : "Prezzo") + "</span>"
      + '<span class="riga-num">' + (p.prezzo ? ErpFormat.euro(p.prezzo.prezzoUdm) : "—") + "</span>"
      + tastoInfo(p.prezzo
        ? (p.prezzo.fornitore + ", " + (p.prezzo.tipo === "preventivo" ? "preventivo" : "fattura") + " del " + ErpFormat.dataIT(p.prezzo.data) + ", confezione " + ErpFormat.qta(p.qtaConfezione) + " " + p.udm + ".")
        : "Nessuna fattura né preventivo.")
      + "</div>";
    const offerte = (stato.offerte || []).filter(function (o) { return ErpEngine.codice(o.idIngrediente) === p.id; })
      .slice().sort(function (a, b) { return String(b.data || "").localeCompare(String(a.data || "")); });
    html += "<h2>Fatture e preventivi</h2>";
    html += offerte.map(function (o) {
      return '<div class="riga"><span class="riga-nome">' + esc(o.fornitore) + " " + ErpFormat.dataIT(o.data) + "</span>"
        + '<span class="riga-num">' + ErpFormat.euro(o.prezzoUdm) + "</span>"
        + '<button type="button" class="btn btn-ghost" data-act="elimina-offerta" data-id="' + esc(o.id) + '">Togli</button></div>';
    }).join("");
    html += '<h3>Aggiungi un prezzo</h3><form data-form="offerta" class="campi">'
      + '<input type="hidden" name="id" value="' + esc(p.id) + '">'
      + campo("Fornitore", inputTesto("fornitore", "", "Biancalani"))
      + campo("Tipo", '<select name="tipo"><option value="fattura">Fattura</option><option value="preventivo">Preventivo</option></select>')
      + campo("Data", '<input name="data" type="date" value="' + oggi() + '" required>')
      + campo("Prezzo per " + esc(p.udm), inputNum("prezzo", "", "1,10"))
      + campo("Kg (o L, o pz) nella confezione", inputNum("qta", "", "15"))
      + '<div class="azioni largo"><button type="submit" class="btn">Registra il prezzo</button></div></form>';
    html += "<h2>Anagrafica</h2>" + formIngrediente(ing);
    html += '<div class="azioni"><button type="button" class="btn" data-act="archivia" data-id="' + esc(p.id) + '">'
      + (ing.attivo === false ? "Rimetti in uso" : "Archivia") + "</button></div>";
    return html;
  }

  function vistaRicette() {
    const food = ErpEngine.foodCost(stato);
    let html = '<a class="tasto-grosso" href="#/ricette/nuovo">Nuovo piatto</a>';
    html += food.piatti.map(function (p) {
      const testo = p.nome + ". Costo ricetta " + ErpFormat.euro(p.costoTeorico)
        + ". Con sfrido " + ErpFormat.euro(p.costoReale)
        + ". Listino " + ErpFormat.euro(p.listino) + " (" + ErpFormat.pct(p.fcListino) + ")."
        + " Incasso " + ErpFormat.euro(p.incasso) + " (" + ErpFormat.pct(p.fcIncasso) + ")."
        + (p.mancanoPrezzi.length ? " Manca il prezzo di " + p.mancanoPrezzi.join(", ") + "." : "");
      return rigaCompatta(p.nome, "#/ricette/scheda/" + encodeURIComponent(p.id), ErpFormat.pct(p.fcIncasso), testo, false);
    }).join("");
    return html;
  }

  function formPiatto(p) {
    const nuovo = !p;
    return '<form data-form="piatto" class="campi">'
      + (nuovo ? "" : '<input type="hidden" name="id" value="' + esc(p.id) + '">')
      + (nuovo ? campo("Codice", inputTesto("id", "", "PIZ-001")) : '<p class="muto largo">Codice <strong>' + esc(p.id) + "</strong></p>")
      + campo("Nome", inputTesto("nome", p && p.nome, "Margherita"))
      + campo("Categoria", inputTesto("categoria", p && p.categoria, "Pizza"))
      + campo("Prezzo di listino €", inputNum("listino", p && p.prezzoListino != null ? String(p.prezzoListino).replace(".", ",") : "", "8,00"))
      + '<div class="azioni largo"><button type="submit" class="btn btn-rosso">' + (nuovo ? "Crea il piatto" : "Salva il piatto") + "</button></div></form>";
  }

  function vistaSchedaPiatto(id) {
    const p = (stato.piatti || []).find(function (x) { return ErpEngine.codice(x.id) === ErpEngine.codice(id); });
    if (!p) return '<p class="banner errore">Piatto non trovato.</p>';
    const food = ErpEngine.foodCost(stato).piatti.find(function (x) { return x.id === ErpEngine.codice(p.id); });
    let html = '<a class="indietro" href="#/ricette">Ricette</a>';
    if (food) {
      const testo = "Costo ricetta " + ErpFormat.euro(food.costoTeorico)
        + ". Con sfrido " + ErpFormat.euro(food.costoReale)
        + ". Listino " + ErpFormat.euro(food.listino) + " (" + ErpFormat.pct(food.fcListino) + ")."
        + " Incasso " + ErpFormat.euro(food.incasso) + " (" + ErpFormat.pct(food.fcIncasso) + ")."
        + (food.mancanoPrezzi.length ? " Manca il prezzo di " + food.mancanoPrezzi.join(", ") + "." : "");
      html += rigaCompatta(p.nome, "", ErpFormat.pct(food.fcIncasso), testo, false);
      html += food.righe.map(function (r) {
        return rigaCompatta(
          r.nome,
          "#/magazzino/scheda/" + encodeURIComponent(r.id),
          ErpFormat.qta(r.quantita) + " " + r.udm,
          r.nome + ": " + ErpFormat.qta(r.quantita) + " " + r.udm
            + ", " + (r.prezzoUdm == null ? "prezzo mancante" : ErpFormat.euro(r.prezzoUdm) + "/" + r.udm)
            + ", sfrido " + ErpFormat.ita(r.coef, 2)
            + ", costo " + ErpFormat.euro(r.costoReale) + ".",
          false
        );
      }).join("");
    }
    html += "<h2>Ingredienti</h2>";
    if (!(stato.ingredienti || []).length) html += '<p class="muto">Prima serve un prodotto in magazzino.</p>';
    else {
      html += '<form data-form="riga" class="campi"><input type="hidden" name="piatto" value="' + esc(p.id) + '">'
        + campo("Ingrediente", '<select name="ing">' + opzioniIngredienti() + "</select>")
        + campo("Quantità in ricetta", inputNum("qta", "", "0,145"))
        + '<div class="azioni largo"><button type="submit" class="btn">Aggiungi o aggiorna</button></div></form>';
    }
    const righe = (stato.ricette || []).filter(function (r) { return ErpEngine.codice(r.idPiatto) === ErpEngine.codice(p.id); });
    if (righe.length) {
      html += righe.map(function (r) {
        return '<div class="riga"><span class="riga-nome">' + esc(nomeIng(r.idIngrediente)) + "</span>"
          + '<span class="riga-num">' + ErpFormat.qta(r.quantita) + " " + esc(udmIng(r.idIngrediente)) + "</span>"
          + '<button type="button" class="btn btn-ghost" data-act="togli-riga" data-piatto="' + esc(p.id) + '" data-ing="' + esc(r.idIngrediente) + '">Togli</button></div>';
      }).join("");
    }
    html += "<h2>Piatto</h2>" + formPiatto(p);
    html += '<div class="azioni"><button type="button" class="btn" data-act="elimina-piatto" data-id="' + esc(p.id) + '">Elimina il piatto</button></div>';
    return html;
  }

  function vistaMovimenti() {
    const tab = route().a === "vendite" ? "vendite" : "carichi";
    const tabs = [
      ["carichi", "Carichi"],
      ["vendite", "Vendite"],
    ];
    let html = '<div class="sottomenu">';
    tabs.forEach(function (t) {
      html += '<a href="#/movimenti/' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : "") + ">" + t[1] + "</a>";
    });
    html += "</div>";
    const dataOra = campo("Data", '<input name="data" type="date" value="' + oggi() + '" required>')
      + campo("Ora", '<input name="ora" type="time" value="' + ErpFormat.oraAdesso() + '">');
    if (tab === "carichi") {
      if (!(stato.ingredienti || []).length) html += '<a class="tasto-grosso" href="#/magazzino/nuovo">Nuovo prodotto</a>';
      else {
        html += '<form data-form="carico" class="campi">' + dataOra
          + campo("Prodotto", '<select name="ing">' + opzioniIngredienti() + "</select>")
          + campo("Quantità", inputNum("qta", "", "30"))
          + campo("Fornitore", inputTesto("fornitore", "", "Biancalani"))
          + campo("Prezzo", inputNum("prezzo", "", "1,10"))
          + campo("Confezione", inputNum("conf", "", "15"))
          + '<label class="campo largo spunta"><input type="checkbox" name="diretto"> Acquisto diretto</label>'
          + '<div class="azioni largo"><button type="submit" class="tasto-grosso">Registra</button></div></form>';
      }
      const lista = (stato.carichi || []).slice().sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }).slice(0, 40);
      html += lista.map(function (c) {
        return '<div class="riga"><span class="riga-nome">' + esc(nomeIng(c.idIngrediente)) + "</span>"
          + '<span class="riga-num">' + ErpFormat.qta(c.quantita) + " " + esc(udmIng(c.idIngrediente)) + "</span>"
          + '<button type="button" class="btn btn-ghost" data-act="elimina-carico" data-id="' + esc(c.id) + '">Togli</button></div>';
      }).join("");
      html += incolla("carichi", "data;codice;quantità;fornitore;prezzo;confezione;diretto", "09/11/2026;LAT-009;15;Biancalani;1,10;15");
    } else {
      if (!(stato.piatti || []).length) html += '<a class="tasto-grosso" href="#/ricette/nuovo">Nuovo piatto</a>';
      else {
        html += '<form data-form="vendita" class="campi">' + dataOra
          + campo("Piatto", '<select name="piatto">' + opzioniPiatti() + "</select>")
          + campo("Quantità", inputNum("qta", "", "12"))
          + campo("Prezzo incassato", inputNum("prezzo", "", "7,00"))
          + '<div class="azioni largo"><button type="submit" class="tasto-grosso">Registra</button></div></form>';
      }
      const lista = (stato.vendite || []).slice().sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }).slice(0, 40);
      html += lista.map(function (v) {
        return '<div class="riga"><span class="riga-nome">' + esc(nomePiatto(v.idPiatto)) + "</span>"
          + '<span class="riga-num">' + ErpFormat.qta(v.quantita) + "</span>"
          + '<button type="button" class="btn btn-ghost" data-act="elimina-vendita" data-id="' + esc(v.id) + '">Togli</button></div>';
      }).join("");
      html += incolla("vendite", "data;codice piatto;quantità;prezzo incassato", "09/11/2026;PIZ-001;12;7,00");
    }
    return html;
  }

  function incolla(tipo, colonne, esempio) {
    return '<details class="noprint"><summary>Incolla</summary>'
      + tastoInfo("Una riga per movimento, campi separati da punto e virgola. Colonne: " + colonne + ".")
      + '<form data-form="incolla" data-tipo="' + tipo + '"><textarea name="testo" rows="4" placeholder="' + esc(esempio) + '"></textarea>'
      + '<div class="azioni"><button type="submit" class="btn">Importa</button></div></form></details>';
  }

  function vistaSpesa() {
    const imp = stato.impostazioni;
    const o = ErpEngine.propostaOrdini(stato, { oggi: oggi() });
    let html = '<form data-form="copertura" class="giorni noprint">'
      + '<label>Giorni<input name="giorni" inputmode="numeric" value="' + esc(String(imp.giorniCopertura)) + '"></label>'
      + '<label>Indietro<input name="storico" inputmode="numeric" value="' + esc(String(imp.giorniStorico)) + '"></label>'
      + tastoInfo("I giorni valgono per le ricette. Detersivi e carta usano i giorni scritti sulla scheda del prodotto.")
      + '<button type="submit" class="btn">Ok</button></form>';
    html += '<p class="numero-hero">' + ErpFormat.euro(o.totale) + "</p>";
    if (!o.righe.length) {
      html += '<p class="etichetta">Niente da comprare.</p>';
      return html;
    }
    o.gruppi.forEach(function (g) {
      html += "<h2>" + esc(g.fornitore) + "</h2>";
      g.righe.forEach(function (r) {
        const ordine = r.colli != null
          ? ErpFormat.qta(r.colli) + (r.colli === 1 ? " collo" : " colli")
          : ErpFormat.qta(r.quantita) + " " + r.unita;
        html += '<div class="riga riga-spesa"><span class="riga-nome">' + esc(r.nome) + "</span>"
          + '<span class="riga-num">' + ordine + "</span>"
          + '<span class="riga-euro">' + ErpFormat.euro(r.costo) + "</span>"
          + tastoInfo(percheOrdine(r) + (r.avviso ? " " + r.avviso : ""))
          + "</div>";
      });
    });
    return html;
  }

  function vistaFood() {
    const food = ErpEngine.foodCost(stato);
    let html = food.categorie.map(function (c) {
      return rigaCompatta(c.categoria, "", ErpFormat.pct(c.fc), c.categoria + ". Food cost sull'incasso " + ErpFormat.pct(c.fc) + ".", false);
    }).join("");
    html += food.piatti.map(function (p) {
      const testo = p.nome + ". Costo ricetta " + ErpFormat.euro(p.costoTeorico)
        + ". Con sfrido " + ErpFormat.euro(p.costoReale)
        + ". Listino " + ErpFormat.euro(p.listino) + " (" + ErpFormat.pct(p.fcListino) + ")."
        + " Incasso " + ErpFormat.euro(p.incasso) + " (" + ErpFormat.pct(p.fcIncasso) + ").";
      return rigaCompatta(p.nome, "#/ricette/scheda/" + encodeURIComponent(p.id), ErpFormat.pct(p.fcIncasso), testo, false);
    }).join("");
    return html;
  }

  function vistaSfridi() {
    const righe = ErpEngine.cruscotto(stato, oggi()).filter(function (r) { return r.attivo && r.tipo !== "TEMPO"; });
    return righe.map(function (r) {
      const s = ErpEngine.sfridoIngrediente(stato, r.id);
      return rigaCompatta(r.nome, "#/magazzino/scheda/" + encodeURIComponent(r.id), ErpFormat.ita(s.coef, 2), spiegaSfrido(r.id), s.coef > 1.15);
    }).join("");
  }

  function vistaDati() {
    const imp = stato.impostazioni;
    let html = '<div class="riga"><span class="riga-nome">Questo telefono</span><span></span>'
      + tastoInfo("I dati non vanno su un server: stanno in questo telefono. Per spostarli, scarica il backup e caricalo sull'altro. Il codice su GitHub è pubblico: non caricare lì il backup. Non c'è la lettura dei PDF né lo scarico dal Drive. Per pubblicare: repository solo di questa cartella, Settings, Pages, branch main, cartella root.")
      + "</div>";
    html += '<div class="azioni"><button type="button" class="btn btn-rosso" data-act="backup">Scarica il backup</button>'
      + '<label class="btn">Carica un backup<input id="file-backup" type="file" accept="application/json,.json" hidden></label></div>';
    html += '<form data-form="impostazioni" class="campi">'
      + campo("Nome", inputTesto("nome", imp.nomeLocale, "Pizzeria"))
      + campo("Giorni ricette", inputNum("giorni", String(imp.giorniCopertura), "7"))
      + campo("Giorni indietro", inputNum("storico", String(imp.giorniStorico), "30"))
      + campo("Allerta prezzo %", inputNum("soglia", String(Math.round(imp.sogliaAllerta * 1000) / 10), "10"))
      + '<div class="azioni largo"><button type="submit" class="btn btn-rosso">Salva</button></div></form>';
    html += '<div class="azioni"><button type="button" class="btn" data-act="esempio">Esempio dei pelati</button>'
      + '<button type="button" class="btn" data-act="svuota">Svuota</button></div>';
    return html;
  }

  function corpo() {
    const r = route();
    if (r.name === "magazzino" && r.a === "nuovo") return vistaNuovoIng();
    if (r.name === "magazzino" && r.a === "scheda") return vistaSchedaIng(r.b);
    if (r.name === "ricette" && r.a === "nuovo") return "<h2>Nuovo piatto</h2>" + formPiatto(null);
    if (r.name === "ricette" && r.a === "scheda") return vistaSchedaPiatto(r.b);
    if (r.name === "conteggio") return vistaConteggio();
    if (r.name === "giacenza") return vistaGiacenza();
    if (r.name === "menu") return vistaMenu();
    if (r.name === "magazzino") return vistaMagazzino();
    if (r.name === "ricette") return vistaRicette();
    if (r.name === "movimenti") return vistaMovimenti();
    if (r.name === "spesa") return vistaSpesa();
    if (r.name === "food") return vistaFood();
    if (r.name === "sfridi") return vistaSfridi();
    if (r.name === "dati") return vistaDati();
    return vistaHome();
  }

  function titolo() {
    const r = route();
    if (r.name === "magazzino" && r.a === "scheda") return nomeIng(r.b);
    if (r.name === "ricette" && r.a === "scheda") return nomePiatto(r.b);
    if (r.name === "conteggio" && r.a) return nomeIng(r.a);
    return TITOLI[r.name] || "Oggi";
  }

  function render() {
    const vista = document.getElementById("vista");
    const barra = document.getElementById("barra");
    const h = document.getElementById("titolo");
    const dove = document.getElementById("dove");
    infoTesti = {};
    infoN = 0;
    chiudiFoglio();
    try {
      const r = route();
      if (h) h.textContent = titolo();
      if (dove) dove.textContent = (stato.impostazioni && stato.impostazioni.nomeLocale) || "";
      document.title = titolo() + " · ERP leggero";
      if (barra) {
        barra.innerHTML = BARRA.map(function (v) {
          const acceso = v[0] === r.name;
          return '<a href="#/' + v[0] + '"' + (acceso ? ' aria-current="page"' : "") + ">" + v[1] + "</a>";
        }).join("");
      }
      if (vista) vista.innerHTML = bannerHtml() + corpo();
    } catch (e) {
      if (vista) vista.innerHTML = '<p class="banner errore">Errore nel disegno della pagina: ' + esc(e.message) + "</p>";
    }
  }

  function numeroCampo(fd, nome, obbligatorio, etichetta) {
    const raw = String(fd.get(nome) || "").trim();
    if (!raw) return obbligatorio ? { errore: "Manca " + etichetta + "." } : { valore: "" };
    const n = ErpFormat.parseNumero(raw);
    if (n == null) return { errore: etichetta + ": scrivi il numero con la virgola, per esempio 0,145." };
    return { valore: n };
  }

  function msg(testo, errore) {
    banner = testo;
    bannerErrore = !!errore;
  }

  async function persisti() {
    try {
      await ErpDb.salva(stato);
    } catch (e) {
      msg("Non sono riuscito a salvare in questo browser. Scarica il backup da Dati.", true);
    }
    render();
  }

  function leggiAt(fd) {
    return ErpFormat.componiAt(fd.get("data"), fd.get("ora"));
  }

  async function onSubmit(form) {
    const tipo = form.dataset.form;
    const fd = new FormData(form);
    if (tipo === "ingrediente") {
      const id = ErpEngine.codice(fd.get("id"));
      if (!id) { msg("Scrivi il codice, per esempio LAT-009.", true); render(); return; }
      const nome = String(fd.get("nome") || "").trim();
      if (!nome) { msg("Scrivi il nome.", true); render(); return; }
      const qta = numeroCampo(fd, "qta", false, "la confezione");
      const giorni = numeroCampo(fd, "giorni", false, "i giorni");
      const stimato = numeroCampo(fd, "stimato", false, "il consumo stimato");
      const forzato = numeroCampo(fd, "forzato", false, "il consumo forzato");
      if (qta.errore || giorni.errore || stimato.errore || forzato.errore) {
        msg((qta.errore || giorni.errore || stimato.errore || forzato.errore), true);
        render();
        return;
      }
      let ing = (stato.ingredienti || []).find(function (i) { return ErpEngine.codice(i.id) === id; });
      const nuovo = !form.querySelector('input[type="hidden"][name="id"]');
      if (nuovo && ing) { msg("Questo codice c'è già.", true); render(); return; }
      if (!ing) {
        ing = { id: id, attivo: true };
        stato.ingredienti.push(ing);
      }
      ing.nome = nome;
      ing.categoria = String(fd.get("categoria") || "").trim();
      const udm = String(fd.get("udm") || "kg");
      ing.udm = udm === "L" || udm === "pz" ? udm : "kg";
      ing.tipo = fd.get("tipo") === "TEMPO" ? "TEMPO" : "POS";
      ing.qtaConfezione = qta.valore === "" ? 0 : qta.valore;
      ing.giorniCopertura = giorni.valore === "" ? 0 : giorni.valore;
      ing.consumoStimato = stimato.valore === "" ? 0 : stimato.valore;
      ing.consumoForzato = forzato.valore === "" ? 0 : forzato.valore;
      ing.acquistoSfuso = fd.get("sfuso") === "on";
      stato.scelta = true;
      msg(nuovo ? "Prodotto creato." : "Anagrafica salvata.", false);
      if (nuovo) {
        await ErpDb.salva(stato);
        vai("magazzino/scheda/" + encodeURIComponent(id));
        return;
      }
      await persisti();
      return;
    }
    if (tipo === "offerta") {
      const prezzo = numeroCampo(fd, "prezzo", true, "il prezzo");
      const qta = numeroCampo(fd, "qta", false, "la confezione");
      if (prezzo.errore || qta.errore) { msg(prezzo.errore || qta.errore, true); render(); return; }
      const esito = ErpAzioni.registraOfferta(stato, {
        idIngrediente: fd.get("id"),
        fornitore: fd.get("fornitore"),
        tipo: fd.get("tipo"),
        data: ErpFormat.componiAt(fd.get("data"), "12:00"),
        prezzoUdm: prezzo.valore,
        qtaConfezione: qta.valore === "" ? 0 : qta.valore,
      });
      if (!esito.ok) { msg(esito.errore, true); render(); return; }
      msg("Prezzo registrato.", false);
      await persisti();
      return;
    }
    if (tipo === "piatto") {
      const id = ErpEngine.codice(fd.get("id"));
      const nome = String(fd.get("nome") || "").trim();
      const listino = numeroCampo(fd, "listino", false, "il listino");
      if (!nome) { msg("Scrivi il nome del piatto.", true); render(); return; }
      if (listino.errore) { msg(listino.errore, true); render(); return; }
      let p = (stato.piatti || []).find(function (x) { return ErpEngine.codice(x.id) === id; });
      const nuovo = !form.querySelector('input[type="hidden"][name="id"]');
      const codice = id || ("PIA-" + String((stato.piatti || []).length + 1).padStart(3, "0"));
      if (nuovo && p) { msg("Questo codice c'è già.", true); render(); return; }
      if (!p) {
        p = { id: codice };
        stato.piatti.push(p);
      }
      p.nome = nome;
      p.categoria = String(fd.get("categoria") || "").trim();
      p.prezzoListino = listino.valore === "" ? 0 : listino.valore;
      stato.scelta = true;
      msg(nuovo ? "Piatto creato." : "Piatto salvato.", false);
      if (nuovo) {
        await ErpDb.salva(stato);
        vai("ricette/scheda/" + encodeURIComponent(p.id));
        return;
      }
      await persisti();
      return;
    }
    if (tipo === "riga") {
      const qta = numeroCampo(fd, "qta", true, "la quantità in ricetta");
      if (qta.errore) { msg(qta.errore, true); render(); return; }
      if (!(qta.valore > 0)) { msg("La quantità in ricetta deve essere maggiore di zero.", true); render(); return; }
      const piatto = ErpEngine.codice(fd.get("piatto"));
      const ing = ErpEngine.codice(fd.get("ing"));
      const i = (stato.ricette || []).findIndex(function (r) {
        return ErpEngine.codice(r.idPiatto) === piatto && ErpEngine.codice(r.idIngrediente) === ing;
      });
      if (i >= 0) stato.ricette[i].quantita = qta.valore;
      else stato.ricette.push({ idPiatto: piatto, idIngrediente: ing, quantita: qta.valore });
      msg("Ricetta aggiornata.", false);
      await persisti();
      return;
    }
    if (tipo === "carico") {
      const qta = numeroCampo(fd, "qta", true, "la quantità");
      const prezzo = numeroCampo(fd, "prezzo", false, "il prezzo");
      const conf = numeroCampo(fd, "conf", false, "la confezione");
      if (qta.errore || prezzo.errore || conf.errore) { msg(qta.errore || prezzo.errore || conf.errore, true); render(); return; }
      const esito = ErpAzioni.registraCarico(stato, {
        at: leggiAt(fd),
        idIngrediente: fd.get("ing"),
        quantita: qta.valore,
        fornitore: fd.get("fornitore"),
        prezzoUdm: prezzo.valore,
        qtaConfezione: conf.valore,
        diretto: fd.get("diretto") === "on",
      });
      if (!esito.ok) { msg(esito.errore, true); render(); return; }
      msg("Carico registrato.", false);
      await persisti();
      return;
    }
    if (tipo === "vendita") {
      const qta = numeroCampo(fd, "qta", true, "la quantità");
      const prezzo = numeroCampo(fd, "prezzo", false, "il prezzo incassato");
      if (qta.errore || prezzo.errore) { msg(qta.errore || prezzo.errore, true); render(); return; }
      const esito = ErpAzioni.registraVendita(stato, {
        at: leggiAt(fd),
        idPiatto: fd.get("piatto"),
        quantita: qta.valore,
        prezzoUnitario: prezzo.valore,
      });
      if (!esito.ok) { msg(esito.errore, true); render(); return; }
      msg("Vendita registrata.", false);
      await persisti();
      return;
    }
    if (tipo === "inventario") {
      const reale = numeroCampo(fd, "reale", true, "la quantità contata");
      if (reale.errore) { msg(reale.errore, true); render(); return; }
      const esito = ErpAzioni.registraInventario(stato, {
        at: leggiAt(fd),
        idIngrediente: fd.get("ing"),
        reale: reale.valore,
      });
      if (!esito.ok) { msg(esito.errore, true); render(); return; }
      msg(esito.sostituito ? "Conteggio di oggi aggiornato." : "Conteggio salvato.", false);
      await persisti();
      return;
    }
    if (tipo === "incolla") {
      const esito = ErpAzioni.importaRighe(stato, form.dataset.tipo, fd.get("testo"));
      if (!esito.n && esito.errori.length) { msg(esito.errori.join(" "), true); render(); return; }
      msg("Importate " + esito.n + " righe." + (esito.errori.length ? " " + esito.errori.join(" ") : ""), esito.errori.length > 0);
      await persisti();
      return;
    }
    if (tipo === "copertura" || tipo === "impostazioni") {
      const giorni = numeroCampo(fd, "giorni", true, "i giorni");
      const storico = numeroCampo(fd, "storico", true, "i giorni indietro");
      if (giorni.errore || storico.errore) { msg(giorni.errore || storico.errore, true); render(); return; }
      if (!(giorni.valore >= 1) || !(storico.valore >= 1)) { msg("I giorni devono essere almeno 1.", true); render(); return; }
      stato.impostazioni.giorniCopertura = Math.round(giorni.valore);
      stato.impostazioni.giorniStorico = Math.round(storico.valore);
      if (tipo === "impostazioni") {
        stato.impostazioni.nomeLocale = String(fd.get("nome") || "").trim() || "Pizzeria";
        const soglia = numeroCampo(fd, "soglia", false, "la soglia");
        if (soglia.errore) { msg(soglia.errore, true); render(); return; }
        if (soglia.valore !== "") stato.impostazioni.sogliaAllerta = Number(soglia.valore) / 100;
      }
      msg("Salvato.", false);
      await persisti();
    }
  }

  async function onClick(act, nodo) {
    if (act === "esempio") {
      if ((stato.ingredienti || []).length && !window.confirm("Sostituisco i dati di questo browser con l'esempio dei pelati?")) return;
      stato = ErpDemo.statoEsempio(oggi());
      msg("Esempio caricato.", false);
      await persisti();
      vai("oggi");
      return;
    }
    if (act === "vuoto") {
      stato.scelta = true;
      msg("", false);
      await persisti();
      return;
    }
    if (act === "svuota") {
      if (!window.confirm("Cancello giacenze, ricette e vendite da questo browser?")) return;
      stato = ErpEngine.statoVuoto();
      stato.scelta = true;
      msg("Browser svuotato.", false);
      await persisti();
      vai("oggi");
      return;
    }
    if (act === "backup") {
      const blob = new Blob([JSON.stringify(stato, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "erp-leggero-" + oggi() + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      return;
    }
    if (act === "stampa") {
      window.print();
      return;
    }
    if (act === "elimina-carico") {
      if (!window.confirm("Tolgo questo carico? Se aveva un prezzo, tolgo anche quello dal confronto.")) return;
      ErpAzioni.eliminaCarico(stato, nodo.dataset.id);
      msg("Carico tolto.", false);
      await persisti();
      return;
    }
    if (act === "elimina-vendita") {
      if (!window.confirm("Tolgo questa vendita?")) return;
      ErpAzioni.eliminaVendita(stato, nodo.dataset.id);
      msg("Vendita tolta.", false);
      await persisti();
      return;
    }
    if (act === "elimina-inventario") {
      if (!window.confirm("Tolgo questo conteggio? Lo sfrido si ricalcola.")) return;
      ErpAzioni.eliminaInventario(stato, nodo.dataset.id);
      msg("Conteggio tolto.", false);
      await persisti();
      return;
    }
    if (act === "elimina-offerta") {
      if (!window.confirm("Tolgo questo prezzo dal confronto?")) return;
      ErpAzioni.eliminaOfferta(stato, nodo.dataset.id);
      msg("Prezzo tolto.", false);
      await persisti();
      return;
    }
    if (act === "togli-riga") {
      const piatto = ErpEngine.codice(nodo.dataset.piatto);
      const ing = ErpEngine.codice(nodo.dataset.ing);
      stato.ricette = (stato.ricette || []).filter(function (r) {
        return !(ErpEngine.codice(r.idPiatto) === piatto && ErpEngine.codice(r.idIngrediente) === ing);
      });
      msg("Ingrediente tolto dalla ricetta.", false);
      await persisti();
      return;
    }
    if (act === "elimina-piatto") {
      if (!window.confirm("Elimino il piatto e la sua ricetta?")) return;
      const id = ErpEngine.codice(nodo.dataset.id);
      stato.piatti = (stato.piatti || []).filter(function (p) { return ErpEngine.codice(p.id) !== id; });
      stato.ricette = (stato.ricette || []).filter(function (r) { return ErpEngine.codice(r.idPiatto) !== id; });
      msg("Piatto eliminato.", false);
      await ErpDb.salva(stato);
      vai("ricette");
      return;
    }
    if (act === "archivia") {
      const id = ErpEngine.codice(nodo.dataset.id);
      const ing = (stato.ingredienti || []).find(function (i) { return ErpEngine.codice(i.id) === id; });
      if (!ing) return;
      ing.attivo = ing.attivo === false;
      msg(ing.attivo ? "Prodotto rimesso in uso." : "Prodotto archiviato: non entra più nella spesa.", false);
      await persisti();
    }
  }

  async function onFile(file) {
    if (!file) return;
    if ((stato.ingredienti || []).length && !window.confirm("Sostituisco i dati di questo browser con il file?")) return;
    let json;
    try { json = JSON.parse(await file.text()); }
    catch (e) { msg("Questo file non è un JSON.", true); render(); return; }
    try { stato = ErpEngine.normalizzaStato(json); }
    catch (e) { msg(e.message || "File non riconosciuto", true); render(); return; }
    msg("Backup caricato.", false);
    await persisti();
  }

  document.body.addEventListener("submit", function (e) {
    const form = e.target;
    if (!form || !form.dataset || !form.dataset.form) return;
    e.preventDefault();
    onSubmit(form).catch(function (err) {
      msg(err && err.message ? err.message : "Errore", true);
      render();
    });
  });

  document.body.addEventListener("click", function (e) {
    const nodo = e.target.closest("[data-act]");
    if (!nodo) return;
    onClick(nodo.dataset.act, nodo).catch(function (err) {
      msg(err && err.message ? err.message : "Errore", true);
      render();
    });
  });

  document.body.addEventListener("change", function (e) {
    if (e.target && e.target.id === "file-backup") {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      onFile(file);
    }
  });

  window.addEventListener("hashchange", render);

  let timerInfo = 0;
  let infoAperto = false;
  let puntatore = "mouse";
  let partenza = null;

  function fermaPressione() {
    clearTimeout(timerInfo);
    timerInfo = 0;
    partenza = null;
  }

  document.addEventListener("pointerdown", function (e) {
    const b = e.target.closest(".tasto-i");
    if (!b) return;
    puntatore = e.pointerType || "mouse";
    if (puntatore === "mouse") return;
    partenza = { x: e.clientX, y: e.clientY, id: b.dataset.info };
    timerInfo = setTimeout(function () {
      infoAperto = true;
      apriFoglio(infoTesti[b.dataset.info] || "");
      partenza = null;
    }, 500);
  });

  document.addEventListener("pointermove", function (e) {
    if (!partenza) return;
    if (Math.abs(e.clientX - partenza.x) > 14 || Math.abs(e.clientY - partenza.y) > 14) fermaPressione();
  });

  document.addEventListener("pointerup", fermaPressione);
  document.addEventListener("pointercancel", fermaPressione);

  document.addEventListener("click", function (e) {
    const b = e.target.closest(".tasto-i");
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    if (infoAperto) {
      infoAperto = false;
      return;
    }
    if (puntatore === "touch" || puntatore === "pen") return;
    apriFoglio(infoTesti[b.dataset.info] || "");
  }, true);

  document.addEventListener("contextmenu", function (e) {
    if (e.target.closest && e.target.closest(".tasto-i")) e.preventDefault();
  });

  const chiudi = document.getElementById("foglio-x");
  if (chiudi) chiudi.addEventListener("click", chiudiFoglio);

  ErpDb.carica().then(function (s) {
    stato = s;
    if (!location.hash) location.hash = "#/oggi";
    render();
  }).catch(function (e) {
    const vista = document.getElementById("vista");
    if (vista) vista.textContent = "Non riesco ad aprire i dati: " + (e && e.message ? e.message : e);
  });
})();
