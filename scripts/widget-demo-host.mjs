/**
 * Mini-hostpagina om de Wonea-widget echt cross-origin te testen:
 * deze server draait op poort 4199, de widget komt van poort 4123.
 * Start: npm run widget-demo (en in een andere terminal: npm run dev).
 *
 * De pagina doet zich bewust voor als een willekeurige (fictieve) makelaars-
 * site, dus zonder Wonea-huisstijl; alleen het embed-snippet is van ons.
 */
import { createServer } from "node:http";

const POORT = Number(process.env.WONEA_DEMO_POORT ?? 4199);
const WIDGET_ORIGIN = process.env.WONEA_WIDGET_ORIGIN ?? "http://localhost:4123";

const html = `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Demo-site van een makelaar</title>
  <style>
    body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #222222; background: #ffffff; }
    header { background: #f4f4f4; padding: 20px 24px; border-bottom: 1px solid #dddddd; }
    header strong { font-size: 18px; }
    main { max-width: 720px; margin: 0 auto; padding: 32px 24px; line-height: 1.6; }
    .noot { margin-top: 40px; font-size: 13px; color: #777777; border-top: 1px solid #dddddd; padding-top: 16px; }
  </style>
</head>
<body>
  <header>
    <strong>Makelaardij Voorbeeld &amp; Zonen</strong> (fictieve demo-site)
  </header>
  <main>
    <h1>Uw woning verkopen in Eindhoven?</h1>
    <p>
      Wij begeleiden u van waardebepaling tot overdracht. Benieuwd waar u staat?
      Check hieronder direct de geschatte waarde van uw woning.
    </p>

    <h2>Wat is uw huis waard?</h2>
    <script src="${WIDGET_ORIGIN}/widget.js" data-wonea></script>

    <p class="noot">
      Dit is een lokale demo-hostpagina (poort ${POORT}) om de Wonea-widget
      cross-origin te testen. De widget hierboven wordt geladen vanaf
      ${WIDGET_ORIGIN}; start daarvoor de dev-server met "npm run dev".
    </p>
  </main>
</body>
</html>
`;

const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(POORT, () => {
  console.log(`Demo-site van een makelaar draait op http://localhost:${POORT}`);
  console.log(`De widget wordt geladen vanaf ${WIDGET_ORIGIN}/widget.js (dev-server nodig: npm run dev).`);
});
