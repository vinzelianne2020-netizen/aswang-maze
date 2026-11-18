---
name: aswang-horror-polish
description: Add atmosphere and scares to a canvas raycasting horror game using Web Audio and Canvas effects. Covers dynamic heartbeat, footsteps, spatial/stereo enemy audio, ambient loops, flashlight flicker, vignette, head bob, screen shake, jumpscare timing, dread pacing, and audio unlock rules. Use this skill whenever the user wants the Aswang Maze to feel scarier, mentions sound, audio, jumpscare, flashlight, fog mood, vignette, tension, atmosphere, or horror polish, even if they just say "make it creepy".
---

# Horror Polish (Phase 6)

Scares come from anticipation. Sound is about 70% of the effect, so do audio first.

## Principles
1. **Contrast beats volume.** Silence before a sound makes it hit harder. Do not loop constant noise on top of everything.
2. **Information in darkness.** Players should hear where the aswang is long before they see it.
3. **Reward the build-up.** Intensity should be a single value (0 to 1) driven by gameplay, and every effect reads from it.

## Tension meter (the core system)
```js
// 0 = calm, 1 = about to be caught
tension = clamp(1 - nearestEnemyPathDist / 12, 0, 1);
if (enemy.state === 'CHASE') tension = Math.max(tension, 0.7);
smoothTension += (tension - smoothTension) * Math.min(1, dt * 2); // never jump
```
Everything below scales with `smoothTension`.

## Audio setup
- One `AudioContext`, created or `resume()`d on the first user click (browsers block autoplay).
- Preload buffers with `fetch` + `decodeAudioData` and play with `AudioBufferSourceNode`. Use `<audio>` only for the long music bed.
- Master gain node plus separate buses: `sfx`, `ambient`, `heartbeat`. The Settings volume slider controls master.
- Randomize pitch ±5% and pick from 3 to 4 variants for footsteps to avoid machine-gun repetition.

## Heartbeat
Trigger beats on a timer instead of looping a file, so the tempo can change smoothly:
```js
interval = lerp(1.1, 0.35, smoothTension);   // seconds between beats
volume   = lerp(0.0, 0.9, smoothTension);
```
Fade it out completely below tension 0.15 so calm moments feel safe.

## Spatial enemy audio
```js
const panner = ctx.createStereoPanner();
const rel = angleToEnemy - player.angle;           // wrap to [-PI, PI]
panner.pan.value = Math.sin(rel);                  // -1 left, 1 right
gain.gain.value = clamp(1 / (1 + dist * 0.5), 0, 1);
```
Add a low-pass filter whose cutoff falls with distance (walls muffle sound). Whisper/growl one-shots every 8 to 20 s while the enemy is within 15 tiles, even when it is not chasing.

## Visual effects (Canvas 2D)
- **Vignette:** precompute one radial-gradient canvas, draw it each frame with `globalAlpha = 0.5 + 0.4 * smoothTension`.
- **Flashlight:** draw darkness over the scene, then cut a soft cone with `globalCompositeOperation = 'destination-out'` and a radial gradient. Gate it by battery.
- **Flicker:** when `tension > 0.6`, multiply light radius by `1 - rand*0.35` at random 50 to 200 ms intervals. Occasional full blackout of 80 ms at tension > 0.85.
- **Head bob:** `offsetY = sin(t * stepRate) * amp` applied to the horizon line; `amp` grows when sprinting. Keep it under 6 px at the internal resolution or it causes motion sickness. Provide a setting to disable it.
- **Fog:** bump the fog constant with tension (`fogK * (1 + tension)`) so the world closes in.
- **Chromatic glitch / noise:** a few random 1px colored offsets on tension > 0.8, subtle.

## Jumpscare
1. On catch: freeze the player, 0.3 s slow zoom toward the enemy sprite.
2. Hard cut to the jumpscare image at full screen, play the scream at peak volume, shake the screen for 0.5 s.
3. After about 1.2 s fade to the Game Over modal.
Rules: one jumpscare variation per death is fine; never fire it on a mistaken restart or when the player pauses. Add an accessibility toggle ("reduce flashing and sudden loud sounds") that replaces it with a fade to red and a muted sound.

## Pacing
- First 20 s of every level: quiet, ambient only. Teach the player the space.
- Place one scripted event per level (a distant door slam, a light dies) to sell the setting.
- Never spawn the aswang within 6 tiles of the player's start.
- After an escape from a chase, drop tension slowly (about 10 s) so the player can breathe.

## Free asset sources
freesound.org, pixabay.com/sound-effects, opengameart.org. Check each license (CC0 or CC-BY with credit) and add a Credits entry to the menu.

## Checklist
- [ ] Audio unlocks on first click; no console warnings
- [ ] Heartbeat tempo follows tension smoothly
- [ ] Enemy sounds are left/right correct (test with headphones)
- [ ] Reduce-effects setting exists and works
- [ ] 60 FPS maintained with every effect on
