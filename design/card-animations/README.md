# Card animation studies

Three purple holo proposals, rendered with the real `LiveCard` and app CSS.
**Approved on 13 October:** Pearl refraction, at the intensity between the
first subtle and second stronger renditions, and the seamless gold loop.
Both are implemented in the shared card CSS; layout and typography stay the same.

1. **Pearl refraction** — broad lilac, icy blue and pink reflections, gently
   moving across the surface. Closest to laminated holographic foil.
2. **Violet aurora** — soft pools of amethyst and orchid light that breathe
   around the card. More atmospheric, less like a travelling shine.
3. **Foil glints** — sparse little star reflections, in two alternating
   groups, over a quiet violet glaze. More collectible and magical.

The comparison preserves the old holo in `legacy-holo.css` and gold before/after.
The selected pearl study is retained as the independent approval reference;
the build compares the app's holo against it at five phases and both sizes.
The gold fix is in `src/app/globals.css`: a repeating gradient travels exactly
one tile in nine seconds. Its pennant uses the same fix; Elite keeps its own
animation. Reduced motion and injury styling still take precedence.

Run `node design/card-animations/build.mjs`. Open
`.release-evidence/card-animations/index.html` in a browser. Pause, scrub or
replay all cards together; switch to album size; optionally select a local
photo to compare the effects over your own artwork. The photo stays in the
browser. The build checks desktop/mobile layout, reduced motion and the
gold loop, and saves screenshots beside the preview.
