# FitQuest · app per Android e iPhone

Questa è FitQuest come app vera (Capacitor). Dentro c'è la stessa web app di https://mglive89.github.io/marcogallo/ (ramo `gh-pages`), più quello che il browser non può fare:

- **Passi anche in background**: legge i passi giornalieri da Health Connect (Android) e Apple Salute (iPhone), fino a 30 giorni indietro (`native-web/native.js` → `window.FitQuestHealth`).
- **Login Google/Apple**: si apre il browser di sistema e si torna nell'app con `com.mglive89.fitquest://auth`.

## Come si prepara

```bash
npm ci
node scripts/make-www.mjs <cartella con il ramo gh-pages>   # copia il sito in www/ e aggiunge il ponte nativo
npx cap sync
```

- Android: `cd android && ./gradlew assembleDebug` (o la GitHub Action "App Android (prova)", che produce l'APK da installare).
- iPhone: serve un Mac con Xcode e l'account Apple Developer (`npx cap open ios`, capability HealthKit già nelle entitlements).
- Icone e schermata di avvio: `python3 scripts/make-icons.py` da `resources/icon.png`.

Il ramo `main` (sito Netlify) non si tocca.
