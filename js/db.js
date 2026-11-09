/* I dati restano in questo browser (IndexedDB). Il backup è un file JSON. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ErpDb = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const NOME = "erp-leggero";
  const CHIAVE = "stato";
  let memoria = null;
  let avviso = "";

  function disponibile() {
    try {
      return typeof indexedDB !== "undefined" && indexedDB != null;
    } catch (e) {
      return false;
    }
  }

  function apri() {
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open(NOME, 1);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("IndexedDB")); };
    });
  }

  function leggi(db) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction("kv", "readonly");
      const q = tx.objectStore("kv").get(CHIAVE);
      q.onsuccess = function () { resolve(q.result || null); };
      q.onerror = function () { reject(q.error); };
    });
  }

  function scrivi(db, stato) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(stato, CHIAVE);
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error("salvataggio annullato")); };
    });
  }

  async function carica() {
    avviso = "";
    if (!disponibile() || !root.ErpEngine) {
      memoria = root.ErpEngine ? root.ErpEngine.statoVuoto() : { ingredienti: [] };
      avviso = "Questo browser non conserva i dati: scarica spesso il backup.";
      return memoria;
    }
    try {
      const db = await apri();
      const salvato = await leggi(db);
      db.close();
      if (!salvato) return root.ErpEngine.statoVuoto();
      return root.ErpEngine.normalizzaStato(salvato);
    } catch (e) {
      memoria = root.ErpEngine.statoVuoto();
      avviso = "Non riesco a riaprire i dati salvati. Scarica un backup prima di continuare.";
      return memoria;
    }
  }

  async function salva(stato) {
    if (memoria) {
      memoria = stato;
      return;
    }
    const db = await apri();
    await scrivi(db, stato);
    db.close();
  }

  function messaggio() {
    return avviso;
  }

  return { carica: carica, salva: salva, messaggio: messaggio };
});
