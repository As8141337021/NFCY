# NFCY — Design Package

Tier 1, single journey. Written before the build. Every line of copy below ships verbatim.

---

## 1. The brand premise

One idea, and the whole site teaches it: **the card is the key, the profile is the thing.**

A printed card is a photograph of you from the day it was printed. It goes stale the moment anything changes, and reprinting a box costs more than the card ever did. A NFCY card carries one short link and nothing else. Everything a person sees when they tap it lives on a profile you change from your phone in ten seconds. The card stays the same forever. You do not.

This premise is also the answer to the sharpest objection found in research ("the chip is just a link, the profile is doing the work"). We do not argue with it. We agree with it out loud and then make the profile worth paying for.

---

## 2. The palette as CSS tokens

Sampled from the hero's world: black glass, a plane of cyan light, one gold reserved for metal.

```css
:root{
  --canvas:#090B10;         /* deep blue-charcoal, never pure black */
  --canvas-2:#0E1119;       /* the next surface up */
  --panel:#151A24;          /* cards and raised surfaces */
  --line:#232B39;           /* hairlines */
  --line-strong:#33405A;    /* interactive borders, 3:1 capable */
  --accent:#34E0F0;         /* the CTA and rare emphasis */
  --accent-hover:#5CE9F6;
  --accent-muted:rgba(52,224,240,.16);   /* borders, glows, particles */
  --gold:#D9B06A;           /* premium metal only, nowhere else */
  --text-primary:#EAF0F6;   /* 12.2:1 on canvas */
  --text-secondary:#96A2B4; /* 7.6:1 on canvas */
  --ink:#06080C;            /* text on the accent */
}
```

Measured contrast on canvas: primary text 12.2:1, secondary text 7.6:1, accent 12.2:1, gold 9.6:1. Ink on accent 12.5:1.

The accent appears in exactly five places: the primary CTA, focus rings, the tap ring motif, the Most Popular badge, and the hero's plane of light. Nowhere else.

---

## 3. The type trio

- **Display: Space Grotesk**, 600 and 700. Technical, slightly mechanical, built for hardware. Not Inter, not Roboto.
- **Body: Manrope**, 400 / 500 / 600. Quiet, wide apertures, reads well at small sizes on phones.
- **Mono: JetBrains Mono**, 400 / 500. Small labels, prices, card IDs, the tap readout.

Trimmed to those weights only, with `preconnect`.

---

## 4. The band map

Hero height **620vh**, so the scroll range is 520vh. Four bands.

**Stated deviation:** the skill's ramp formula caps at 0.02 of progress, which is tuned for a 900vh chained journey where 0.02 equals 18vh. On a 520vh range that cap produces a 10vh ramp, half the intended feel. So the build computes ramps in vh and converts: `f = min(20 / scrollRangeVh, (b - a) / 3)`. Same intent, correct at any hero height.

| Band | Range (starting point) | Footage moment | Copy (verbatim) | Entrance |
|---|---|---|---|---|
| 1 | 0.00 to 0.25 | The card falls through darkness, small and distant, turning slowly | "A paper card is you from the day it was printed." | Drift-down. Words start above their resting spot and fall into place, because the card is falling. |
| 2 | 0.27 to 0.52 | The card grows as it nears the plane of cyan light below | "This one changes when you do." / small line: "Edit your profile from your phone. Every card you ever handed out updates at once." | Approach-from-depth. The line starts slightly small and grows into place, because the card is approaching. |
| 3 | 0.54 to 0.77 | The card breaks the surface. Light splashes up its edges, the lens catches a beat of blur | "One tap. No app." / small line: "They tap, your profile opens. Nothing to install, on either side." | Word-punch with overshoot. The words land as the impact lands. |
| 4 | 0.79 to 1.00 | The card rests flat, floating, the plane bloomed into a soft glowing field around it | "Your digital identity. One tap away." / "Contact, business, socials, products and location. Shared in one second. Changed in ten." / CTAs: "See the cards" and "How it works" | Word-by-word rise into a staged settle. Headline rises, then the subline, then the CTA row. Three arrivals, one band. |

Band 1 skips the opacity ease-in and gets the one-time load ramp. Band 4 skips the ease-out.

**Until the hero video exists,** the same four bands run over a hand-drawn SVG scene that performs the identical journey: card descends, crosses a plane of light, blooms, settles. Driven by the same progress value, same band math, same entrances. When the video lands it fades in over the scene and nothing else changes.

---

## 5. The static-hero copy block

For phones, portrait tablets and reduced motion.

- Headline: **Your digital identity. One tap away.**
- Subline: **One NFC card. Your whole profile behind it. Change it any time, from your phone.**
- CTA: **See the cards** / secondary: **How it works**

---

## 6. The below-fold outline

Every section funnels to one call to action: **the enquiry, which opens WhatsApp to 918141337021.**

**1. Trust strip.** Four claims, all true today, no numbers invented.
"No app for them. No app for you." · "Works on iPhone and Android." · "QR printed on the back, always." · "Change it any time, free."

**2. How it works.** Four steps, equal treatment, each with its own drawn SVG.
- 01 **Pick your card.** "Six of them. From ₹499."
- 02 **Build your profile.** "Name, business, socials, WhatsApp, products, location. Takes about ten minutes."
- 03 **Your card arrives.** "Printed, chipped, and already pointed at your profile."
- 04 **Tap and share.** "Hold it near any phone. Your profile opens. That is the whole thing."

A self-drawing SVG line runs through all four as you scroll.

**3. The one interactive moment: "Hold the card to the phone."**
The visitor presses and holds a drawn NFCY card against a drawn phone. A cyan ring fills while they hold. Release early and it eases back down, it never snaps. Complete it and the profile assembles on the phone line by line, and the three claims beside it light up in sequence. The visitor performs the premise instead of reading it.
- Instruction: **"Press and hold the card."**
- On completion: **"That is what your customer sees. You wrote it. You can change it in ten seconds."**
- Reduced motion gets the finished state with no hold required.

**4. Choose your card.** Six products, real prices, drawn not photographed.
Section headline: **Choose your card.** Subline: **Every one of them opens the same profile. Pick the one you want to hand over.**

| Card | Price | Line | Badge |
|---|---|---|---|
| Classic NFC Card | ₹499 | "The everyday card. Full digital profile, QR on the back, share your contact in one tap." | — |
| Black Matte Gold | ₹699 | "Matte black with gold detail. The one people turn over in their hand before they hand it back." | Most Popular |
| Premium Metal | ₹2,399 | "Machined metal, real weight. Laser finish, premium profile design, lead capture built in." | Premium |
| Google Review Card | ₹699 | "Sits at your counter. Customers tap and land on your Google review page. No searching, no typing." | — |
| Google Review Stand | ₹899 | "The tabletop version. Restaurant tables, reception desks, salon counters." | — |
| Instagram NFC Card | ₹699 | "One tap opens your Instagram. Change which profile it points at whenever you want." | — |

Every card carries the same footer line: **"Renewal ₹299/year after the first year."** Stated on the card itself, not buried.

**5. Paper against NFCY.** Two columns, honest, no invented statistics.
Paper: "Printed once, wrong forever." · "Reprint the whole box to fix one line." · "Ends up in a drawer." · "Tells them your number and nothing else." · "You never know if anyone looked."
NFCY: "Change it from your phone." · "One card, forever." · "They save your contact in one tap." · "Business, products, location, socials, payment." · "You see every tap, scan and click."
CTA anchor: **Upgrade your identity.**

**6. What sits behind the tap.** The profile, described concretely.
Headline: **It is not a link page. It is your business.**
Groups: Who you are · Your business · What you sell · How they reach you · What you learn.
Copy per group written plain, listing what actually goes on a profile: photo and cover, designation, bio, business name and logo, hours, services, products with prices, gallery, WhatsApp, call, Google Maps directions, UPI details, an enquiry form, and the analytics behind all of it.

**7. For counters, not pockets.** The review and Instagram products, aimed at shops.
Headline: **Some cards never leave the counter.**
Copy: "A customer who is already happy will leave a review. They just will not go looking for your listing. Put the card in front of them and it takes fifteen seconds."
Use cases named plainly: restaurants, salons, clinics, hotels, jewellery, retail, workshops.
Honest line, kept: **"NFCY sends people to your real Google listing. Nothing more. Reviews are theirs to write."**

**8. For teams.** Corporate and bulk.
Headline: **Fifty people, one identity.**
Copy: "Order in bulk, brand every card, and manage every employee profile from one place. New joiner gets a card and a profile the same week. Someone leaves and you switch their card off."
Volumes named: 10, 50, 100, 500, 1000+. CTA: **Talk about a bulk order.**

**9. The renewal, said out loud.** The section that answers the competitor's "zero recurring fees" headline.
Headline: **About the ₹299.**
Copy: "Your card is yours. You buy it once. The ₹299 a year keeps your profile online: the hosting, the short link on your card, the QR, the analytics, and the right to change any of it whenever you want. If you stop paying, the card is not bricked. The profile pauses until you renew. We will remind you before it happens, four times, and you will never find out by having your card fail in front of someone."
Then the honest dashboard line: **"You will always see your plan, your activation date, your renewal date and the days left."**

**10. Questions people actually ask.** FAQ, in buyers' words, answering the researched objections.
- "Do they need an app?" — "No. Their phone opens your profile in its browser, the same way it opens a website. Nothing to install."
- "Does it work on iPhone?" — "Yes. Every iPhone from the XS onward reads a NFCY card without an app. Older iPhones use the QR on the back."
- "Does it work on Android?" — "Yes, on any Android with NFC, which is most of them. QR covers the rest."
- "Honestly, is this just a link? Could I not do this for free?" — "You could. The link is the easy part. What you are buying is the thing that link opens, the ability to change it forever, the analytics behind it, and an object worth handing to someone. If you only want a free link page, take one. We built this for people who want the object too."
- "What if I change my phone number?" — "Change it on your profile. Every card you ever gave out points at the new number instantly. Nothing gets reprinted."
- "What if I lose my card?" — "Switch it off from your dashboard and order a replacement. Your profile and your link stay exactly the same."
- "Can I change where my Instagram card points?" — "Yes, any time, from the dashboard. The card never changes."
- "What if NFC does not work on their phone?" — "Every card has a QR code printed on the back. It goes to the same place."
- "How long does delivery take?" — "We tell you the real date at checkout and you track it from your dashboard. We would rather quote a date we can hit."
- "Can a company order fifty?" — "Yes. Bulk pricing, your branding, and one dashboard for every employee profile."

**11. The one call to action.**
Headline: **Get your card.**
Subline: **Tell us what you do and which card you want. We reply on WhatsApp.**
Form fields: Name, WhatsApp number, What you do, Which card (a select listing all six). Button: **Send on WhatsApp**. On submit it opens WhatsApp to 918141337021 with the message composed, and the page shows the success state: **"Opening WhatsApp. If it did not open, message us on 8141337021."**
This is honest: the form does not pretend to store anything. It hands the message to WhatsApp, and the success copy says exactly that.

**12. Footer.** Contact, the six policy links required for an Indian storefront (Privacy, Terms, Refund, Shipping, Cancellation, Cookies), and one plain disclosure line: **"NFCY is a new brand. The card visuals on this page are renders, and they will be replaced with photographs of the real product."**

---

## 7. The vector layer plan

Everything drawn by hand. No stock, no photographs, nothing generated yet.

- **The six cards**, each a distinct SVG: matte black with a gold hairline, brushed metal with a machined bevel, plain charcoal, a review card carrying a star motif, a stand drawn at a three-quarter angle, and an Instagram card with a gradient edge. Each tilts and catches a moving sheen on hover.
- **The signature element: the tap ring.** Three concentric arcs radiating from a point, the NFC wave drawn as a mark. It is the favicon, the section dividers (which draw themselves on scroll), the hold interaction's progress ring, and the shape the hero's plane of light blooms into. Remove it and the page loses its identity, which is the test.
- **The fixed background environment.** One layer behind everything: a slow cyan glow drifting on a 90 second cycle plus fine grain. Scrolling feels like moving through one place.
- **The self-drawing connector line** through the four how-it-works steps.
- **Whisper particles** in the hero settle and the interactive section, at four to nine percent opacity, cycles of 12 seconds and longer, negative delays so they are mid-cycle at first paint.
- Reduced motion shows every final state and stops every drive.

---

## 8. The engineering list

The full standard, named so the build cannot half-remember it: Blob fetch with the streamed loading ring over 8MB, poster painted from JS inside the gated path, dt-normalized lerp in a rAF loop that rests, gated seeks with the error-handler deadlock escape, delta-gated DOM writes, band pacing validated by the flick test at 120 / 240 / 360px, the four-layer legibility system with the worst-frame audit at 3.5:1, the five static-hero gates matched character for character in CSS and JS and kept live with change listeners, reduced motion honoured live in both directions, complete-without-video, `overflow-x: clip` on html and body, and the whole-site-animated standard below the fold.

Plus, for this build specifically: the SVG hero scene is driven by the same progress value and the same delta gating as the video, so dropping the video in later changes one code path and nothing else.

---

## 9. The copy gate

Every viewer-facing line above ships verbatim. The built page must pass the Phase 9 grep gate before anyone sees it: zero em dashes, zero instances of leverage, seamless, empower, unlock, robust, actionable, data-driven, solutions, and a body sweep for testament, landscape, delve, elevate, "it's not just X it's Y", false ranges, vague attributions and generic big-finish conclusions.

Deliberate devices that stay, because the package chose them on purpose: the staccato pair "One tap. No app.", the parallel comparison columns, and the repeated "That is the whole thing."

---

# Build log: what changed after the package was written

Recorded so the package stays the truth about the site, not the plan it started as.

**Deviations, said out loud**

1. **The ramp formula.** The skill caps caption ramps at 0.02 of scroll progress, tuned for a 900vh chained journey. On this 520vh range that cap gives a 10vh ramp, half the intended feel. The build computes ramps in vh and converts to progress: `f = min(20 / scrollRangeVh, (b - a) / 3)`. Same intent, correct at any hero height. Validated by the flick test afterwards.

2. **The hero runs on a drawn scene, not footage, for now.** No Higgsfield credits were available, so the four bands ride a hand-drawn SVG journey that performs the identical beats: the card falls through darkness, breaks a plane of cyan light with a beat of lens blur and a ring of light, and settles glowing. It is driven by the same progress value, the same delta gating and the same band math as the video would be. `HAS_VIDEO` in `assets/site.js` is the single switch: set it to `true` once `assets/hero-scrub.mp4` and `assets/hero-poster.jpg` exist and the Blob path takes over. Nothing else changes.

3. **Every product image is drawn, not photographed or generated.** Six distinct SVG cards, each with its own material: charcoal, matte black with a gold hairline, brushed metal, a review card with a star row, a stand at a three-quarter angle, and an Instagram card with a gradient edge. They tilt and catch a sheen on hover. This honours the Phase 2 decision to swap in photographs of the real product later.

**Copy added during the build, and why**

- **"What happens next" in the call-to-action section** (three numbered lines). The left column was a dead half. The lines are true and useful, so the hole got content instead of padding.
- **The teams diagram caption:** "COMPANY / TEAMS / CARDS" and "Every card switched on and off from one place."
- **Labels drawn onto the cards themselves:** the NFCY wordmark, "Rate us on Google", "TAP OR SCAN", "@yourhandle". Law 9: an unbranded object reads as a placeholder.

**What the self-test proved**

| Check | Result |
|---|---|
| Flick test, 120 / 240 / 360px | Every band peaks at full opacity. 8 / 6 / 6 / 8 consecutive readable steps at 120px. No beat skippable at 360px. |
| Worst-frame legibility, floor 3.5:1 | Worst measured band 5.75:1. Best 13.6:1. Measured by hiding the glyphs and sampling the real composited page. |
| The five static-hero gates | All five behave identically in CSS and JS. Phone, portrait tablet, landscape phone and narrow desktop all get the static hero and request zero video bytes. |
| Rotation mid-session | Portrait tablet rotated to landscape re-arms the scrub. No blank hero. |
| Reduced motion, live, both directions | On: everything pins to its final state, the hold interaction completes itself, no video request. Off again: the scrub re-arms and every pin is removed. |
| Entrances | All 71 reveal elements fire. Every stagger delay retires, so no later sibling hovers late. |
| Overflow | Document width equals window width at 1440, 1280, 768, 720, 700 and 375. No anchor link shifts the page sideways. |
| Touch targets | Every interactive target is at least 44px tall under a coarse pointer. |
| Form | Blocks an empty submit, blocks a short phone number, and opens WhatsApp with the message composed. |
| Copy gate | Zero em dashes. Zero stock words. Zero AI tells. |
| Console | Zero errors on every viewport tested. |
| Weight | 27KB over the wire, gzipped, for the whole site. Four requests. 231ms load locally. |
