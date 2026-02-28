/**
 * Paths to card art under public/card-art. Keys are card names (must match constants).
 * Used to load face textures. Back is shared: endless seven card back.png
 */

/** Base URL for public assets (Vite: '' or e.g. '/my-app/'). No trailing slash. */
const PUBLIC_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '';

/**
 * Returns a full URL for a path under public/, with path segments encoded so spaces and special chars work.
 */
export function cardArtUrl(path: string): string {
  const encoded = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
  return `${PUBLIC_BASE}${encoded}`;
}

export const CARD_BACK_PATH = 'card-art/endless seven card back.png';

export const CARD_ART_PATHS: Record<string, string> = {
  // Avatars of Light
  'The Spinner': 'card-art/Avatars of light/The Spinner copy.png',
  'The Allotter': 'card-art/Avatars of light/The Allotter copy.png',
  'Prophet': 'card-art/Avatars of light/Prophet copy.png',
  'The Inevitable': 'card-art/Avatars of light/The Ineviatable copy.png',
  'Saint Michael': 'card-art/Avatars of light/Saint Michael copy.png',
  'Martyr': 'card-art/Avatars of light/Martyr copy.png',
  'The Almighty': 'card-art/Avatars of light/The Almighty copy.png',
  // Celestial
  'Archangel': 'card-art/Celestial/archangel copy.png',
  'Cherubim': 'card-art/Celestial/cheribum copy.png',
  'Fallen One': 'card-art/Celestial/fallen angel copy.png',
  'Herald': 'card-art/Celestial/herald copy.png',
  'Nephilim': 'card-art/Celestial/nephilim copy.png',
  'Seraphim': 'card-art/Celestial/seraphim copy.png',
  'Thrones': 'card-art/Celestial/thrones copy.png',
  // Lycan
  'Alpha': 'card-art/Lycan/Alpha copy.png',
  'Beta': 'card-art/Lycan/beta copy.png',
  'Omega': 'card-art/Lycan/omega copy.png',
  'Sentinel': 'card-art/Lycan/sentinal copy.png',
  'Delta': 'card-art/Lycan/delta copy.png',
  'Luna': 'card-art/Lycan/luna copy.png',
  'Wild Wolf': 'card-art/Lycan/wild wolf copy.png',
  // Darkness
  'Death': 'card-art/Darkness/death copy.png',
  'Famine': 'card-art/Darkness/FAmine copy.png',
  'Pestilence': 'card-art/Darkness/Pestilence copy.png',
  'War': 'card-art/Darkness/War copy.png',
  'Lilith': 'card-art/Darkness/Lilith copy.png',
  'Hades': 'card-art/Darkness/Hades copy.png',
  'The Destroyer': 'card-art/Darkness/the destroyer copy 2.png',
  // Daemon
  'Wrath': 'card-art/Daemon/wrath copy.png',
  'Pride': 'card-art/Daemon/pride copy.png',
  'Greed': 'card-art/Daemon/greed copy.png',
  'Sloth': 'card-art/Daemon/sloth copy.png',
  'Envy': 'card-art/Daemon/envy copy.png',
  'Lust': 'card-art/Daemon/lust copy.png',
  'Gluttony': 'card-art/Daemon/gluttony copy.png',
  // Vampyre
  'Lord': 'card-art/Vampyre/lord copy.png',
  'Duke': 'card-art/Vampyre/duke copy.png',
  'Elder': 'card-art/Vampyre/elder copy.png',
  'Noble': 'card-art/Vampyre/noble copy.png',
  'Regent': 'card-art/Vampyre/regent copy.png',
  'Baron': 'card-art/Vampyre/baron copy.png',
  'Fledgeling': 'card-art/Vampyre/fledgeling copy.png',
};
