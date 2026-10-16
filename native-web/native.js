/* FitQuest app nativa: ponte tra la web app e il telefono.
   - window.FitQuestHealth: passi giornalieri da Health Connect (Android) / Apple Salute (iPhone), anche quelli fatti con l'app chiusa
   - window.FitQuestNative: login Google/Apple nel browser di sistema e ritorno con com.mglive89.fitquest://auth */
(function () {
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var Health = C.registerPlugin("Health"), App = C.registerPlugin("App"), Browser = C.registerPlugin("Browser");
  var Haptics = C.registerPlugin("Haptics"), lastTap = 0;
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
    // passi per ora di un giorno ("AAAA-MM-GG") → array di 24 numeri
    hourlySteps: function (day) {
      var p = day.split("-").map(Number), start = new Date(p[0], p[1] - 1, p[2]), end = new Date(p[0], p[1] - 1, p[2] + 1);
      return Health.queryAggregated({ dataType: "steps", startDate: start.toISOString(), endDate: end.toISOString(), bucket: "hour", aggregation: "sum" })
        .then(function (r) {
          var h = []; for (var i = 0; i < 24; i++) h.push(0);
          ((r && r.samples) || []).forEach(function (s) { var d = new Date(s.startDate); if (dayKey(d) === day) h[d.getHours()] += Math.round(Number(s.value) || 0); });
          return h;
        });
    },
    openSettings: function () { return Health.openHealthConnectSettings ? Health.openHealthConnectSettings() : Promise.resolve(); }
  };

  window.FitQuestNative = {
    platform: C.getPlatform(),
    openAuth: function (url) { return Browser.open({ url: url, presentationStyle: "popover" }); },
    // tocco leggero sui pulsanti (rispetta le impostazioni di vibrazione del telefono)
    tap: function () { var t = Date.now(); if (t - lastTap < 60) return; lastTap = t; Haptics.impact({ style: "LIGHT" }).catch(function () {}); }
  };

  App.addListener("appUrlOpen", function (ev) {
    var url = ev && ev.url || "";
    if (url.indexOf("com.mglive89.fitquest://") !== 0) return;
    Browser.close().catch(function () {});
    var go = function () { if (window.fqAuthReturn) window.fqAuthReturn(url); else setTimeout(go, 300); };
    go();
  });
  // tasto Indietro: lo gestisce FitQuest (chiude la serie, torna alla schermata prima); sulla Home l'app va in secondo piano
  App.addListener("backButton", function () { if (!(window.fqBack && window.fqBack())) App.minimizeApp(); });

  // --- Quello che il browser ha e la WebView di Android no ---

  // voce dell'istruttore: speechSynthesis → sintesi vocale del telefono
  var TTS = C.registerPlugin("TextToSpeech");
  function Utterance(text) { this.text = String(text || ""); this.lang = "it-IT"; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null; this.onstart = this.onend = this.onerror = null; }
  var synth = {
    speaking: false, pending: false, paused: false, onvoiceschanged: null,
    getVoices: function () { return []; },
    speak: function (u) {
      synth.speaking = true;
      if (u.onstart) try { u.onstart({}); } catch (e) {}
      TTS.speak({ text: u.text, lang: u.lang || "it-IT", rate: Math.max(0.1, Math.min(2, u.rate || 1)), pitch: Math.max(0.5, Math.min(2, u.pitch || 1)), volume: u.volume == null ? 1 : u.volume, category: "playback", queueStrategy: 1 })
        .then(function () { synth.speaking = false; if (u.onend) try { u.onend({}); } catch (e) {} })
        .catch(function (err) { synth.speaking = false; if (u.onerror) try { u.onerror(err); } catch (e) {} });
    },
    cancel: function () { synth.speaking = false; TTS.stop().catch(function () {}); },
    pause: function () {}, resume: function () {},
    addEventListener: function () {}, removeEventListener: function () {}
  };
  if (C.getPlatform() === "android") {
    try { Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true, writable: true }); } catch (e) { window.speechSynthesis = synth; }
    window.SpeechSynthesisUtterance = Utterance;
  }

  // schermo sempre acceso durante l'allenamento: navigator.wakeLock → KeepAwake
  var KeepAwake = C.registerPlugin("KeepAwake");
  if (!("wakeLock" in navigator)) {
    var wakeLock = {
      request: function () {
        return KeepAwake.keepAwake().then(function () {
          var lock = { released: false, type: "screen", onrelease: null, addEventListener: function () {}, removeEventListener: function () {},
            release: function () { lock.released = true; return KeepAwake.allowSleep().catch(function () {}); } };
          return lock;
        });
      }
    };
    try { Object.defineProperty(navigator, "wakeLock", { value: wakeLock, configurable: true }); } catch (e) {}
  }

  // condividi il codice amico o la sfida: navigator.share → menu Condividi del telefono
  var Share = C.registerPlugin("Share");
  var share = function (d) {
    d = d || {};
    return Share.share({ title: d.title, text: d.text, url: d.url, dialogTitle: d.title }).then(function () {}).catch(function (err) {
      var msg = String(err && err.message || err);
      if (/cancel/i.test(msg)) { var ab = new Error("Condivisione annullata"); ab.name = "AbortError"; throw ab; }
      throw err;
    });
  };
  try { Object.defineProperty(navigator, "share", { value: share, configurable: true }); } catch (e) { navigator.share = share; }
})();
