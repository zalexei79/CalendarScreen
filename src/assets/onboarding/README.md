# Onboarding idle artwork

Created from the user's supplied `Фото 1.jpg` and the supplied onboarding films with the built-in `image_gen` tool. The original films are unchanged. Generated PNGs were converted to WebP with alpha preserved.

- `presenter-emotions.webp`: equal-width smiling and sad panels, left to right.
- `presenter-angry.webp`: single transparent pointing character, stern expression.
- `idle-desktop.webp`, `idle-mobile.webp`: background restoration plates. Only masked regions behind the presenter and connector are displayed; the original film retains the rest of the interface.

The waiting scene starts after the film ends. At 15 visible seconds it becomes sad; at 20 it becomes angry and starts a 10-second countdown. At 30 only the restart action remains. The character smiles again and points at restart, with a flowing connector and an ambient calendar behind it. From there, smile, sadness and anger repeat every 10 visible seconds. Restart replays the life-to-calendar animation and film without changing the user's setup or entries. Background tabs pause the waiting clock. Reduced motion disables continuous movement and morph animation.

## Face morph geometry

`presenter-mesh.json` contains 468 face landmarks per expression, the canonical tessellation and face contour. These were prepared locally using MediaPipe Face Landmarker 0.10.14 ([Google documentation](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js)). Neither the detector nor its model is loaded by the app.

The renderer aligns the eye corners, anchors the outer contour to the smiling head, then interpolates facial geometry and texture over 3.2 seconds using a smooth quintic curve. Hair, torso and pointing hand always use the same smiling body. Eye/mouth openings are explicitly filled so the old smile cannot show through closed lips. WebGL renders the small face overlay; Canvas 2D provides the same mesh warp when graphics acceleration is unavailable. Rapid expression changes start from the current blend rather than snapping to a previous image.

## Generation prompts

### Smiling and sad sprite sheet

Edit the supplied reference into ONE production UI character sprite sheet, transparent PNG. Use ONLY the BOTTOM LEFT pointing man as the edit target. Preserve his exact recognizable identity, brown hair, short beard, black turtleneck and black blazer, pointing gesture toward the right, body framing, realistic photographic lighting. Layout: exactly TWO equal-width panels side by side, no margins outside panels; each panel contains the same waist-up man at exactly identical position and scale with bottom aligned, all hair and pointing finger inside panel, transparent background. LEFT panel: original warm smiling expression. RIGHT panel: exact same pointing pose, head angle, body, clothing, lighting and alignment, but mildly sad/disappointed expression: closed mouth with corners slightly lowered, gently raised inner eyebrows, no tears, no exaggerated cartoon emotions. His face must remain the same person. Only facial expression differs. Photorealistic cutout, clean alpha edges, no white background, no labels, no text, no UI, no calendar. This sheet will crossfade between halves so alignment must be precise.

### Angry character

Edit target: the LEFT smiling pointing man in this two-panel transparent sprite reference. Output only ONE character cutout (not a sheet, not two figures), transparent background, portrait slightly wider than tall, exact same framing and pointing pose as the LEFT 972x809 panel of the reference. Preserve the exact same recognizable identity, hair, beard, head angle, body, black turtleneck and blazer, hand pointing right, photographic lighting. Change ONLY expression to mildly angry / sternly impatient: knitted eyebrows, narrowed eyes, closed mouth and tight lips, no violence, no aggression, no shouting, no tears. Keep his head and facial features aligned to the reference so this can crossfade with the original smiling panel. Waist-up body aligned at bottom, fully visible hair and finger, clean alpha edges, no props, no text, no background. A restrained realistic emotion for a playful app mascot.

### Desktop restoration plate

Edit target: supplied 1920x1080 DAYRIS screenshot. Remove ONLY the photographed man in the bottom left, reconstructing the existing dark teal gradient background and very faint diagonal background lines naturally behind him. Preserve absolutely everything else: full canvas framing, dimensions/aspect ratio, calendar geometry, all Russian text, all dates, brand icons, borders, colors and buttons in their exact positions. No new UI, no redesign, no new character. Output clean background plate of this exact layout with the man removed. The calendar and left text card must remain untouched.

### Mobile restoration plate

Edit target: supplied 1080x1920 vertical DAYRIS screenshot. Remove ONLY the photographed man in the bottom left, reconstructing the existing dark teal gradient background and very faint diagonal background lines naturally behind him. Preserve absolutely everything else: full portrait canvas framing/aspect ratio, calendar geometry, all Russian text, all dates, brand icons, borders, colors and buttons in their exact positions. No new UI, no redesign, no new character. Output clean background plate of this exact layout with the man removed. Calendar and bottom-right text card must remain untouched.
