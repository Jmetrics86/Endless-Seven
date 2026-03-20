# Endless Seven

A browser-based tactical card game built with **React**, **Three.js**, and **TypeScript**. You choose **Light** or **Darkness**, place creatures on seven **Seals**, and resolve each Seal in order during the **Resolution** phase. Card definitions and stats live in [`src/constants.ts`](src/constants.ts); rules engine flow is driven by [`src/game/PhaseManager.ts`](src/game/PhaseManager.ts) and [`src/game/AbilityManager.ts`](src/game/AbilityManager.ts).

---

## Objective

- **Light** tries to **Purify** Seals (Light alignment); **Darkness** tries to **Corrupt** them (Dark alignment). Seals can also sit **Neutral**.
- After **three full rounds** (each round = Prep → Resolution across all seven Seals), the game scores by **who controls more Seals** (your alignment vs the opponent’s). Ties are a draw.
- The match can end **immediately** if one side holds **all seven** Seals (see scoring in `GameController.updateGlobalScores`).
- Several **alternate win conditions** exist on specific cards (activated during resolution)—see [Alternate wins](#alternate-wins).

---

## Decks and factions

When you pick a side:

- **Light** → you play the Light pool; the AI plays the Dark pool.
- **Darkness** → reversed.

**Deck construction** (`GameController.buildDeck`):

| Pool | Copies per card |
|------|-----------------|
| **Celestial**, **Lycan**, **Daemon**, **Vampyre** | 3 each |
| **Light** / **Darkness** (Avatars, Horsemen, Gods) | 1 each |

Decks are **shuffled** at game start.

---

## Board zones

- **Seven Seals** — central column; each Seal has a slot for **your** creature and **enemy** creature (same index), and optionally a **Champion** on the Seal itself.
- **Deck** — draw pile; cards removed from the top during Prep.
- **Hand** (player only, during Prep) — up to eight cards drawn from your deck; you assign them to Seal slots.
- **Limbo** — after Prep, your unpicked hand cards go here; some abilities target Limbo (e.g. Sentinel, Hades, Saint Michael / Lilith Final Act).
- **Graveyard** — destroyed cards and some ability costs (e.g. Luna nullify).

The enemy does not use a visible hand the same way: during Prep it draws eight cards and **auto-fills empty** enemy battlefield slots from that draw.

---

## Phases

### Prep

1. Player draws **8** cards (or until the deck is empty).
2. Player **places** cards from the hand onto empty slots on their side of the seven Seals (face down until resolution).
3. Enemy reinforces vacant slots from its own eight-card draw.
4. **End Prep** sends the remaining hand to **Limbo** and starts **Resolution**.

### Resolution

Seals are resolved **in order** from Seal 1 through Seal 7. For each Seal, the engine runs:

1. **Step 0 — Haste** (if applicable)  
   Units with **Haste** fight **before** the Flip step. If an **enemy Champion** sits on the Seal, the player’s creature fights that Champion first (and vice versa for the enemy). Otherwise the two lane creatures fight each other. **Fledgeling** cannot battle or be battled—Haste/combat is skipped when that rule applies.

2. **Step A — The Flip**  
   Face-down creatures **rotate face up** (visual flip).

3. **Step B — Flip & Activate abilities**  
   - **Order**: lower **effective power** resolves Flip effects first; if tied, order is **random**. The Seal’s **Champion** (if any) is processed after player and enemy lane creatures.  
   - **Effective power** = printed power + power markers − weakness markers.  
   - **Nullify** (e.g. Archangel, Baron) can cancel an opponent’s **Flip** if they are still face down and not immune.  
   - **Activate** abilities on cards that have `hasActivate` run in this step when it is their turn (not only on flip—implementation treats activate as part of this pass).  
   - Many effects require **targets** or **allocation** (power/weakness pools, markers)—the UI enters sub-phases such as `ABILITY_TARGETING`, `SEAL_TARGETING`, `COUNTER_ALLOCATION`, etc.  
   - After all abilities in this step, **any creature at 0 or lower effective power is destroyed** (`enforceZeroPowerDestruction`), even if it had combat invulnerability.

4. **Step C — Combat**  
   - If **Fledgeling** is in the lane, combat is skipped (**stymied**).  
   - Otherwise: fight **enemy Champion** first if present, then **player Champion**, then **lane vs lane** if both lanes still have creatures and no blocking Champion rules prevent it.  
   - Higher effective power wins; equal power can cause **mutual destruction** (subject to protections).  
   - **Invulnerability** (e.g. Nephilim flip text, Greed flip) and other protections can **stymie** a fight so neither side destroys the other.  
   - **Wrath**: cannot be destroyed in battle by a creature that has **weakness markers** (special stymie rules).  
   - **Elder**: the **loser** may be put on top of its owner’s **deck** instead of destroyed.  
   - **Wild Wolf** marks opponents for **end-of-round** destruction.

5. **Step D — Siege**  
   If combat was **stymied**, the Seal becomes **Neutral**.  
   Otherwise the **survivor** (if any) **claims** the Seal toward their alignment (**Purify** / **Corrupt**), subject to **Luna** (optional nullify from Limbo), **Prophet** (blocks corrupting already-Purified Seals, with a **Lust** exception), and **Nephilim** seal lock.

6. **Step E — Ascension**  
   If a **surviving Champion** remains in the lane and the Seal has **no Champion** yet, that card **ascends** onto the Seal as its Champion.

**End of round** (after all seven Seals): effects such as **Wild Wolf** delayed kills, **Delta** sacrifice buff, **Noble** +2 power, **Fledgeling** sacrifice, etc., run in `cleanupEndOfRoundEffects`.  
If the game is not over, **round** increments and **Prep** begins again. After **round 3**’s resolution completes, `finalizeGame()` runs using final Seal counts.

---

## Seals, Champions, and influence

- **Champions** are stronger cards (flag `isChampion` in data). They can **ascend** to a Seal after winning the lane, and they **block** the opponent from influencing that Seal via normal siege until removed.
- **Influence** is stored per Seal as `Alignment`: Light, Dark, or Neutral (`SealEntity`).
- **claimSeal** centralizes influence changes and side effects (Luna, Prophet, logging).

---

## Ability system (high level)

- Card behavior is declared with flags and strings on **`CardData`** in [`src/types.ts`](src/types.ts) (e.g. `hasHaste`, `hasNullify`, `hasSealTargetAbility`, `abilityImmune`, `effect`, `targetType`).
- **`PhaseManager.resolveSeal`** implements the sequence above and branches on **card name** and flags for many Flip effects.
- **`AbilityManager`** handles immunity (e.g. **Sloth** vs creature abilities; **Seraphim** shielding other Celestials), targeted effects, global effects, Activate abilities, seal targeting, and post-combat triggers (**War**, **Alpha**, **The Inevitable**).

For the exact text and numbers on every card, use the `LIGHT_POOL` and `DARK_POOL` entries in [`src/constants.ts`](src/constants.ts).

---

## Alternate wins

These call `PhaseManager.finalizeGame(...)` with a descriptive win string when their conditions are met:

| Card | Condition (as implemented) |
|------|----------------------------|
| **Saint Michael** / **Lilith** | **Activate**: you control **5+** Seals that each have **your** Champion. |
| **Death** | **Activate**: **4+** Horsemen in play **and** at least one **your** Champion on **a** Seal. |
| **The Spinner** | **Activate**: **4+** face-up cards with **`faction === "Light"`** in play **and** at least one **your** Champion on a Seal. (Card flavor says “Acolyte”; the code keys off the **Light** faction field on `CardData`.) |

---

## Project structure (logic)

| Area | Role |
|------|------|
| [`src/game/GameController.ts`](src/game/GameController.ts) | Board setup, decks, input, `claimSeal`, `destroyCard`, orchestration; implements `IGameController`. |
| [`src/game/PhaseManager.ts`](src/game/PhaseManager.ts) | Prep, resolution loop, per-Seal steps, combat/siege/ascension, round limit, game-over messaging. |
| [`src/game/AbilityManager.ts`](src/game/AbilityManager.ts) | Targeting, markers, Activate paths, immunity, global/seal abilities. |
| [`src/game/UIManager.ts`](src/game/UIManager.ts) | React-facing game state and logs. |
| [`src/App.tsx`](src/App.tsx) | UI shell, phase-specific dialogs (marker type, Lust seal choice, Luna, etc.). |
| [`src/constants.ts`](src/constants.ts) | Card roster + `GAME_VERSION`. |

---

## Run locally

**Prerequisites:** Node.js 20+ recommended (matches CI-style builds).

```bash
npm install
npm run dev
```

Open the URL Vite prints (default port **3000**).

### Build

```bash
npm run build
```

### GitHub Pages

The workflow builds with base path `/Endless-Seven/`. Locally:

```bash
npm run build:pages
```

---

## Tests

```bash
npm test
```

Card interaction and combat cases live in [`src/game/__tests__/card-interactions.test.ts`](src/game/__tests__/card-interactions.test.ts).

---

## License

SPDX-License-Identifier: Apache-2.0 (see file headers in `src/`).
