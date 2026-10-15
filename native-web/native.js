/* FitQuest app nativa: ponte tra la web app e il telefono.
   - window.FitQuestHealth: passi giornalieri da Health Connect (Android) / Apple Salute (iPhone), anche quelli fatti con l'app chiusa
   - window.FitQuestNative: login Google/Apple nel browser di sistema e ritorno con com.mglive89.fitquest://auth */
(function () {
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var Health = C.registerPlugin("Health"), App = C.registerPlugin("App"), Browser = C.registerPlugin("Browser");
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var dayKey = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  var LINKED = "fq:healthLinked";

  window.FitQuestHealth = {
    available: function () {
      return Health.isAvailable().then(function (r) { return !!(r && r.available); }).catch(function () { return false; });
    },
    connected: function () { try { return localStorage.getItem(LINKED) === "1"; } catch (e) { return false; } },
    connect: function () {
      return Health.requestAuthorization({ read: ["steps"], write: [] }).then(function (st) {
        var ok = C.getPlatform() === "ios" || !st || (st.readAuthorized || []).indexOf("steps") >= 0; // iOS non dice mai se la lettura è concessa
        try { localStorage.setItem(LINKED, ok ? "1" : "0"); } catch (e) {}
        return ok;
      });
    },
    // dal: "AAAA-MM-GG" (incluso), al: "AAAA-MM-GG" (incluso) → [{ day, steps }]
    dailySteps: function (from, to) {
      var p = from.split("-").map(Number), q = to.split("-").map(Number);
      var start = new Date(p[0], p[1] - 1, p[2]), end = new Date(q[0], q[1] - 1, q[2] + 1);
      return Health.queryAggregated({ dataType: "steps", startDate: start.toISOString(), endDate: end.toISOString(), bucket: "day", aggregation: "sum" })
        .then(function (r) {
          return ((r && r.samples) || []).map(function (s) { return { day: dayKey(new Date(s.startDate)), steps: Math.round(Number(s.value) || 0) }; });
        });
    },
    openSettings: function () { return Health.openHealthConnectSettings ? Health.openHealthConnectSettings() : Promise.resolve(); }
  };

  window.FitQuestNative = {
    platform: C.getPlatform(),
    openAuth: function (url) { return Browser.open({ url: url, presentationStyle: "popover" }); }
  };

  App.addListener("appUrlOpen", function (ev) {
    var url = ev && ev.url || "";
    if (url.indexOf("com.mglive89.fitquest://") !== 0) return;
    Browser.close().catch(function () {});
    var go = function () { if (window.fqAuthReturn) window.fqAuthReturn(url); else setTimeout(go, 300); };
    go();
  });
  App.addListener("backButton", function (ev) { if (ev && ev.canGoBack) history.back(); else App.minimizeApp(); });
})();
