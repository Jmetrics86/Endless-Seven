# Avatars of Light — Code vs Card Description Review

**Implementation applied:** Constants, AbilityManager, PhaseManager, and GameController were updated so behavior matches the card descriptions below.

## Summary

| Card | Power | Type match | Flip | Activate | Other (Passive / Final Act / Limbo) | Gaps |
|------|-------|------------|------|----------|-------------------------------------|------|
| **The Almighty** | 15 ✓ | God ✓ | Purify Corrupted Seal ✓ | **Missing**: Destroy any one Marker | — |
| **Saint Michael** | 10 ✓ | Avatar ✓ | — | Win con: code uses **7 Seals** (global); card says **Activate: 5+ Seals with Champions** | Final Act: code = "killer gets +3 Weakness"; card = **Limbo: move to Graveyard to destroy a card that battled this turn** |
| **The Allotter** | 9 ✓ | Avatar ✓ | Destroy card on any Seal ✓ | **Missing**: Destroy one Marker | — |
| **The Inevitable** | 9 ✓ | Avatar ✓ | — | **Wrong**: code = gain 2 Power after kill; card = **after destroying a creature, you may destroy another card or Marker in play** | — |
| **The Spinner** | 9 ✓ | Avatar ✓ | +1 per Acolyte in play ✓ (code uses Light) | **Missing**: Activate win con = 4 Acolytes in play + ≥1 Champion on a Seal → win | — |
| **Prophet** | 9 ✓ | Avatar ✓ | — | — | Passive: Purified can't be Corrupted ✓ |
| **Martyr** | 9 ✓ | Avatar ✓ | — | — | Limbo: Purify one Neutral Seal without Champion ✓ |

## Detailed Gaps

1. **The Almighty** — Add **Activate: Destroy any one Marker** (target any card, destroy one Power or Weakness marker). Flip already purifies a seal without a champion; ensure target is **Corrupted** (Dark) only.
2. **Saint Michael** — (1) **Activate win con**: If you control **5 or more Seals with Champions** (not 7 total Seals), you win. (2) **Final Act**: While in Limbo, you may move Saint Michael to Graveyard to **destroy a card that battled this turn** (not "killer gets +3 Weakness"). Requires tracking which cards battled this turn.
3. **The Allotter** — Add **Activate: Destroy one Marker of any type** (same as The Almighty Activate).
4. **The Inevitable** — Replace "gain 2 Power Markers" with **after destroying a creature in battle, you may destroy another card or Marker in play** (targeting step after combat).
5. **The Spinner** — (1) Flip: card says **Acolyte** in play; code uses **Light** faction (treat as same). (2) Add **Activate**: If you have **4 Acolytes in play** with **at least one Champion controlling a Seal**, you win the game.
6. **Prophet** — No code changes; wording only.
7. **Martyr** — No code changes; wording only.

## Notes

- **Acolyte** is implemented as **Light** faction unless a separate subtype exists.
- **Seals with Champions** = seals where `seal.champion != null` and the champion is friendly.
- Win conditions: current global win is "7 Seals (any alignment)"; Saint Michael and The Spinner add **Activate**-based win conditions that need separate checks.
