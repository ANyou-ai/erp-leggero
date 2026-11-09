/* Numeri e date come li scrive il locale: virgola decimale, euro, GG/MM/AAAA. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ErpFormat = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function oggi(data) {
    const d = data instanceof Date ? data : new Date();
    const z = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate());
  }

  function oraAdesso(data) {
    const d = data instanceof Date ? data : new Date();
    const z = function (n) { return String(n).padStart(2, "0"); };
    return z(d.getHours()) + ":" + z(d.getMinutes());
  }

  function parseNumero(valore) {
    if (typeof valore === "number") return Number.isFinite(valore) ? valore : null;
    if (valore == null) return null;
    let t = String(valore).trim().replace(/\s/g, "").replace("€", "");
    if (!t) return null;
    if (t.indexOf(",") >= 0 && t.indexOf(".") >= 0) {
      t = t.replace(/\./g, "").replace(",", ".");
    } else if (t.indexOf(",") >= 0) {
      t = t.replace(",", ".");
    }
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  function dataISO(valore) {
    const t = String(valore || "").trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    if (m) return m[1] + "-" + m[2] + "-" + m[3];
    m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(t);
    if (!m) return "";
    const z = function (n) { return String(n).padStart(2, "0"); };
    return m[3] + "-" + z(m[2]) + "-" + z(m[1]);
  }

  function ita(n, decimali) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    const opt = { maximumFractionDigits: decimali == null ? 3 : decimali };
    if (decimali != null) opt.minimumFractionDigits = decimali;
    return new Intl.NumberFormat("it-IT", opt).format(x);
  }

  function qta(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(x);
  }

  function euro(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(x);
  }

  function pct(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 1 }).format(x);
  }

  function dataIT(iso) {
    const s = String(iso || "").slice(0, 10);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return "—";
    return m[3] + "/" + m[2] + "/" + m[1];
  }

  function componiAt(data, ora) {
    const g = dataISO(data);
    if (!g) return "";
    const o = /^(\d{2}):(\d{2})/.exec(String(ora || ""));
    const hh = o ? o[1] + ":" + o[2] + ":00" : "12:00:00";
    return g + "T" + hh;
  }

  return {
    oggi: oggi,
    oraAdesso: oraAdesso,
    parseNumero: parseNumero,
    dataISO: dataISO,
    ita: ita,
    qta: qta,
    euro: euro,
    pct: pct,
    dataIT: dataIT,
    componiAt: componiAt,
  };
});
