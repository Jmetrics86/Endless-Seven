# AI Opponent: Current Design & Strategic Recommendations

This document describes how the enemy AI is currently implemented in Endless Seven and recommends changes to make it more strategic.

---

## 1. Current AI Design

### 1.1 Prep Phase: Reinforcement (Placement)

**Location:** `PhaseManager.enemyReinforce()`

**Behavior:**
- Draws up to 8 cards from the enemy deck into a temporary hand.
- Fills **vacant battlefield slots in slot-index order** (0 → 6).
- Places one card per vacant slot by **taking the next card from the hand** in draw order (no selection).
- No consideration of: card power, type, abilities, or which seal the slot corresponds to.

**Effect:** Placement is effectively random with respect to strategy. High-value or combo pieces are not prioritized for key seals; the AI does not try to match strong cards to contested seals or protect Champions.

---

### 1.2 Resolution Phase: Execution Order

**Location:** `PhaseManager.resolveSeal()` (per-seal flip order)

**Behavior:**
- At each seal, who flips first is decided by **`Math.random() < 0.5`** (player vs enemy).
- No consideration of initiative advantage (e.g., flipping first to nullify or apply weakness before the opponent flips).

---

### 1.3 Ability Targeting (General)

**Location:** `AbilityManager.handleTargetedAbility()`, `handleSlothDestroyAction()`, and related

**Behavior:**
- **Champion (Lord):** Random champion from all valid targets.
- **Limbo creature (Sentinel):** Random creature in Limbo (no preference for highest Power Value).
- **Envy (creature_power_gte):** Random valid target.
- **Generic destroy/place_weakness/creature:** Uses **first valid target** (`targets[0]`) for the generic branch when `isAI`.
- **Sloth (destroy creature with Weakness):** Random valid target.
- **The Inevitable (destroy another card/marker after combat):** Random card on board.

**Effect:** No prioritization of high-value targets (e.g., enemy Champions, high-Power or high-Marker units, or units that block win conditions).

---

### 1.4 Counter Allocation (Delta, Pestilence, etc.)

**Location:** `AbilityManager.allocateCounters()`

**Behavior (AI):**
- Power markers: Applied to **first ally** in `enemyBattlefield` (order-based), respecting immunity.
- Weakness markers: Applied to **first enemy** in `playerBattlefield`, respecting immunity.
- No spreading, no preference for key units (e.g., stacking Power on a single strong attacker or Weakness on the biggest threat).

---

### 1.5 Seal-Targeting Abilities (Thrones, Regent, The Almighty, etc.)

**Location:** `AbilityManager.handleSealTargetAbility()`

**Behavior (AI):**
- Builds list of valid seals (no champion, correct alignment/neutral).
- Picks **first valid seal** (`validSeals[0].index`) to Purify/Corrupt.
- No preference for seals that are contested, that complete a win condition, or that deny the player a key seal.

---

### 1.6 Activate Abilities

**Location:** `AbilityManager.handleActivateAbility()`

**Behavior (AI):**
- **Nephilim (lock seal):** Random seal index `Math.floor(Math.random() * 7)`.
- **The Almighty / The Destroyer (destroy all Power or all Weakness):** Chooses the type that has more total markers in play (already somewhat strategic).
- **The Allotter (destroy one marker):** Random card among those with markers.
- **Greed / Saint Michael / Lilith / Death:** Same logic as player (no choice or win-check only).

---

### 1.7 Death (Flip): Creature Type Choice

**Location:** `PhaseManager.resolveSeal()` (Death Flip handling)

**Behavior (AI):**
- **Random type** among types present in play (`typesInPlay[Math.floor(Math.random() * typesInPlay.length)]`).
- No preference for destroying the type that gives the best board swing (e.g., most enemy units or enemy Champions).

---

### 1.8 Lust: Seal Influence After Sacrifice

**Location:** `PhaseManager.resolveSeal()` (Lust effect)

**Behavior (AI):**
- **Random alignment** `Math.random() < 0.5 ? LIGHT : DARK` for the seal.
- No tie-in to overall seal count or win condition.

---

### 1.9 Hades (Secondary): Limbo → Deck

**Location:** `PhaseManager.resolveSeal()` (Hades Secondary)

**Behavior (AI):**
- Picks a random card from the AI’s Limbo to place on top of deck.
- No preference for high-Value cards to draw next or combo pieces.

---

### 1.10 Delta End-of-Round: Sacrifice and Buff Target

**Location:** `PhaseManager.cleanupEndOfRoundEffects()`

**Behavior (AI):**
- Delta sacrifices; **random ally** (battlefield + seals) receives the +3 Power Markers.
- No preference for a Champion on a seal or the unit that will benefit most.

---

### 1.11 Luna Nullify (Enemy)

**Location:** `GameController.claimSeal()`

**Behavior (AI):**
- When the player would change a seal and enemy has Luna in Limbo, **50% chance** to use Luna to nullify (`Math.random() < 0.5`).
- No evaluation of how important the seal is (e.g., 4th seal for win, or blocking player’s 5-Seal win).

---

## 2. Summary: What the AI Does Not Do

- **Placement:** Does not consider seal importance, card strength, or synergies when assigning cards to slots.
- **Targeting:** Does not prioritize high-value or game-ending targets (Champions, high-Power/Marker units, win-condition pieces).
- **Seals:** Does not prefer seals that advance its own win condition or deny the player’s (e.g., 4 seals, 5 Champions).
- **Execution order:** Does not use flip order to maximize value of nullify/weakness/destroy.
- **Counters:** Does not concentrate Power on key attackers or Weakness on the biggest threats.
- **Luna / Nephilim / Lust / Death / Hades / Delta:** All use random or first-valid choices instead of outcome-based evaluation.

---

## 3. Recommendations for a More Strategic AI

### 3.1 Centralize AI Decisions (Strategy Module)

- Introduce an **AI strategy module** (e.g. `AIDecisionService` or `EnemyAI.ts`) used by `PhaseManager` and `AbilityManager` whenever `isAI` is true.
- Pass in **game state** (board, seals, limbo, graveyard, scores, hand size) and **valid options**; return a **chosen option** (and optionally a reason for logging).
- Keeps game rules in PhaseManager/AbilityManager and “what to choose” in one place, easier to tune and test.

### 3.2 Prep Phase: Smarter Placement

- **Score cards** by: base Power, Champion status, key abilities (e.g. Lord, Duke, Death, Famine), and synergy with faction (e.g. Horsemen count).
- **Score slots** by: seal index (e.g. center seals might be more contested), current seal alignment, and whether the slot is opposite a strong player card.
- Place **highest-value cards** in **highest-impact slots** (e.g. Champions on seals that are neutral or favorable; strong flip cards opposite weak player cards).
- Optional: simple “threat model” (e.g. which seals the player is likely to contest) and place accordingly.

### 3.3 Resolution: Flip Order

- Instead of 50/50, **evaluate** who benefits more from flipping first at this seal (e.g. nullify, apply weakness, destroy before opponent flips).
- Use a small heuristic: e.g. “If I have Archangel/Cherubim and enemy has a strong flip, prefer flipping first” or “If enemy has Pride/Envy, prefer flipping second to avoid eating -3 Weakness before I flip.”
- Can be a simple score: sum of “benefit if I go first” minus “benefit if enemy goes first”; if positive, AI goes first.

### 3.4 Targeting: Value-Based Choices

- **Destroy / return-to-deck / place weakness:**  
  Rank targets by: Champion > high effective Power > high Markers > on a seal.  
  Prefer **enemy** Champions and units that block seal control or enable the player’s win condition.
- **Lord (Champion to deck):** Prefer **enemy** Champion on a seal, then enemy Champion on battlefield, then high-Power enemy Champion.
- **Sentinel (Limbo absorb):** Prefer **highest Power Value** in Limbo (yours or enemy’s by card text) to maximize markers.
- **Envy / Sloth / The Inevitable:** Prefer enemy Champion or highest effective Power / most threatening marker stack.
- **The Allotter (one marker):** Prefer enemy card with the most Power Markers (or that is blocking a seal).

### 3.5 Counter Allocation

- **Power markers:** Prefer the ally that will **battle this round** or is on a seal, and/or the one with highest base Power (to maximize combat wins).
- **Weakness markers:** Prefer the **enemy** with highest effective Power or the one on a seal / Champion, to maximize removal or stymie.

### 3.6 Seal-Targeting Abilities

- **Purify/Corrupt:** Prefer seals that:
  - Get the AI closer to 4 (or 7) seals for its alignment.
  - Deny the player’s 4th/5th/7th seal.
  - Are currently neutral (swing value).
- Score each valid seal; pick the one with highest score instead of `validSeals[0]`.

### 3.7 Death (Flip): Creature Type

- For each type in play, compute **net gain**: e.g. (enemy units of that type destroyed) − (friendly units of that type destroyed), possibly weighted by Power or Champion.
- Choose the type that **maximizes net gain** (or minimizes enemy presence).

### 3.8 Lust / Nephilim / Luna / Hades / Delta

- **Lust (seal influence):** Choose LIGHT or DARK so that the resulting seal count is better for the AI (e.g. prefer alignment that gets AI closer to 4 or 7).
- **Nephilim (lock seal):** Prefer sealing the seal that is most critical for the **player** (e.g. the one that would give player 4th or 5th seal), or the most contested one.
- **Luna (nullify):** Use Luna when the seal being changed is **important** (e.g. would give player 4th/5th/7th seal, or would take away AI’s 4th seal). Use a threshold or simple “seal importance” score.
- **Hades (Limbo → deck):** Prefer the card in Limbo with **highest Power** or best ability for next draw (e.g. Champion or key piece).
- **Delta (+3 target):** Prefer an **ally** that is on a seal (Champion) or will battle next round, or has the highest base Power to maximize combat wins.

### 3.9 Win Condition Awareness

- Before any decision, optionally compute:  
  - “Seals I need to win” and “Seals player needs to win.”
- Use this to:
  - Prioritize Purify/Corrupt and seal-target abilities toward those seals.
  - Prefer destroying or weakening units that are one seal away from giving the player 5 Champions on seals (Saint Michael / Lilith).
  - Prefer not destroying your own Horsemen if Death’s Activate (4 Horsemen + Champion on seal) is close.

### 3.10 Difficulty / Personality (Optional)

- **Easy:** Keep more random/first-valid choices; only apply a few recommendations (e.g. Death type, Lord target).
- **Medium:** Apply most recommendations with simple heuristics.
- **Hard:** Add lightweight look-ahead (e.g. “If I destroy this, how many seals do I get next?”) and prefer moves that improve seal count or deny player’s win.

---

## 4. Implementation Order (Suggested)

1. **Strategy module** – Create `AIDecisionService` (or similar) and pass game state + valid options; replace `Math.random()` and `targets[0]` with calls to it.
2. **Targeting** – Implement value-based targeting (destroy/weakness/return to deck, Lord, Sentinel, Envy, Sloth, The Inevitable, The Allotter).
3. **Seal targeting** – Implement seal scoring for Purify/Corrupt and use it in `handleSealTargetAbility`.
4. **Death type** – Implement “best type” for Death’s Flip.
5. **Counter allocation** – Prefer best ally for Power and best enemy for Weakness.
6. **Prep placement** – Score cards and slots; place best cards in best slots.
7. **Flip order** – Simple “who benefits from going first” heuristic.
8. **Lust / Nephilim / Luna / Hades / Delta** – Tie each to seal importance or board value as above.
9. **Win-condition awareness** – Add seal-count and win-condition checks and use them in 3–8.
10. **Difficulty levels** – Tune how much randomness remains for Easy/Medium/Hard.

This order gives quick gains (targeting and seals) before larger refactors (placement and execution order).
