import "./index.css";
import "./fonts";
import React from "react";
import { Composition } from "remotion";
import { Biedadvies } from "./scenes/Biedadvies";
import { Budget } from "./scenes/Budget";
import { Hero } from "./scenes/Hero";
import { Hypotheek } from "./scenes/Hypotheek";
import { Makelaar } from "./scenes/Makelaar";
import { Verduurzamen } from "./scenes/Verduurzamen";
import { Waarde } from "./scenes/Waarde";
import { Woz } from "./scenes/Woz";
import { DUUR, Formaat, FORMATEN, FPS } from "./theme";

/**
 * 8 concepten x 3 formaten = 24 composities. Elke scene is 1 component die het
 * formaat als prop krijgt; de compositie-id is "<concept>-<formaat>" en is ook
 * de bestandsnaam van de render (public/banners/<id>.mp4).
 */
const SCENES: Array<{ id: string; component: React.FC<{ formaat: Formaat }> }> = [
  { id: "hero", component: Hero },
  { id: "waarde", component: Waarde },
  { id: "woz", component: Woz },
  { id: "budget", component: Budget },
  { id: "hypotheek", component: Hypotheek },
  { id: "biedadvies", component: Biedadvies },
  { id: "verduurzamen", component: Verduurzamen },
  { id: "makelaar", component: Makelaar },
];

const ALLE_FORMATEN: Formaat[] = ["breed", "vierkant", "story"];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {SCENES.map((scene) =>
        ALLE_FORMATEN.map((formaat) => (
          <Composition
            key={`${scene.id}-${formaat}`}
            id={`${scene.id}-${formaat}`}
            component={scene.component}
            durationInFrames={DUUR}
            fps={FPS}
            width={FORMATEN[formaat].breedte}
            height={FORMATEN[formaat].hoogte}
            defaultProps={{ formaat }}
          />
        )),
      )}
    </>
  );
};
