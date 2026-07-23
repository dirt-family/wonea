import { loadFont } from "@remotion/fonts";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

/**
 * Fonts lokaal gebundeld (public/fonts, OFL-licentie): geen Google-Fonts-runtime.
 * Variabele bestanden dekken alle gewichten van beide families.
 */
const wachtOpFonts = delayRender("Wonea-fonts laden");

Promise.all([
  loadFont({
    family: "Source Serif 4",
    url: staticFile("fonts/SourceSerif4.ttf"),
    weight: "200 900",
  }),
  loadFont({
    family: "Inter",
    url: staticFile("fonts/Inter.ttf"),
    weight: "100 900",
  }),
])
  .then(() => continueRender(wachtOpFonts))
  .catch((err) => cancelRender(err));
