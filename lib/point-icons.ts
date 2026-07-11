export type IconCategory =
  | "geometric" | "transport" | "nature" | "infrastructure"
  | "healthcare" | "food" | "commerce" | "recreation"
  | "civic" | "agriculture" | "hazard" | "energy" | "facility";

export interface PointIconDef {
  id: string;
  label: string;
  category: IconCategory;
  /** Returns SVG child content for a 64×64 viewBox with the given color. */
  svg: (color: string) => string;
}

// ── Geometric ──────────────────────────────────────────────────────────────────
export const GEOMETRIC_ICONS: PointIconDef[] = [
  { id: "circle",   label: "Circle",   category: "geometric", svg: (c) => `<circle cx="32" cy="32" r="28" fill="${c}"/>` },
  { id: "square",   label: "Square",   category: "geometric", svg: (c) => `<rect x="4" y="4" width="56" height="56" rx="2" fill="${c}"/>` },
  { id: "triangle", label: "Triangle", category: "geometric", svg: (c) => `<polygon points="32,3 61,61 3,61" fill="${c}"/>` },
  { id: "diamond",  label: "Diamond",  category: "geometric", svg: (c) => `<polygon points="32,2 62,32 32,62 2,32" fill="${c}"/>` },
  { id: "star",     label: "Star",     category: "geometric", svg: (c) => `<polygon points="32,4 39,23 59,23 43,35 49,55 32,43 15,55 21,35 5,23 25,23" fill="${c}"/>` },
  { id: "cross",    label: "Cross",    category: "geometric", svg: (c) => `<path d="M22,4H42V22H60V42H42V60H22V42H4V22H22Z" fill="${c}"/>` },
  { id: "hexagon",  label: "Hexagon",  category: "geometric", svg: (c) => `<polygon points="60,32 46,56 18,56 4,32 18,8 46,8" fill="${c}"/>` },
  { id: "pentagon", label: "Pentagon", category: "geometric", svg: (c) => `<polygon points="32,3 62,24 50,58 14,58 2,24" fill="${c}"/>` },
  { id: "octagon",  label: "Octagon",  category: "geometric", svg: (c) => `<polygon points="20,4 44,4 60,20 60,44 44,60 20,60 4,44 4,20" fill="${c}"/>` },
  { id: "pin",      label: "Pin",      category: "geometric", svg: (c) => `<path d="M32 4C20 4 12 13 12 25C12 39 32 60 32 60C32 60 52 39 52 25C52 13 44 4 32 4Z" fill="${c}"/>` },
  { id: "arrow",    label: "Arrow",    category: "geometric", svg: (c) => `<path d="M32 4L58 34H42V60H22V34H6Z" fill="${c}"/>` },
  { id: "ring",     label: "Ring",     category: "geometric", svg: (c) => `<path d="M32 4C16 4 4 16 4 32C4 48 16 60 32 60C48 60 60 48 60 32C60 16 48 4 32 4ZM32 16C42 16 48 23 48 32C48 41 42 48 32 48C22 48 16 41 16 32C16 23 22 16 32 16Z" fill="${c}" fill-rule="evenodd"/>` },
];

// ── Transport ──────────────────────────────────────────────────────────────────
export const TRANSPORT_ICONS: PointIconDef[] = [
  {
    id: "car", label: "Car", category: "transport",
    svg: (c) => `<path d="M8 36C8 36 14 18 22 16H42C50 16 56 36 56 36H8Z" fill="${c}"/><rect x="6" y="34" width="52" height="14" rx="3" fill="${c}"/><circle cx="18" cy="50" r="9" fill="${c}"/><circle cx="46" cy="50" r="9" fill="${c}"/>`,
  },
  {
    id: "bus", label: "Bus", category: "transport",
    svg: (c) => `<rect x="8" y="8" width="48" height="44" rx="4" fill="${c}"/><circle cx="20" cy="56" r="7" fill="${c}"/><circle cx="44" cy="56" r="7" fill="${c}"/>`,
  },
  {
    id: "train", label: "Train", category: "transport",
    svg: (c) => `<rect x="4" y="18" width="44" height="30" rx="4" fill="${c}"/><rect x="4" y="10" width="18" height="16" rx="2" fill="${c}"/><circle cx="14" cy="52" r="8" fill="${c}"/><circle cx="36" cy="52" r="8" fill="${c}"/><rect x="48" y="24" width="12" height="8" rx="2" fill="${c}"/>`,
  },
  {
    id: "airplane", label: "Airplane", category: "transport",
    svg: (c) => `<path d="M32 4C30 4 28 6 28 16V26L4 36V42L28 37V50L20 52V58L32 54L44 58V52L36 50V37L60 42V36L36 26V16C36 6 34 4 32 4Z" fill="${c}"/>`,
  },
  {
    id: "ship", label: "Ship", category: "transport",
    svg: (c) => `<path d="M6 42C8 50 18 56 32 56C46 56 56 50 58 42H6Z" fill="${c}"/><rect x="16" y="22" width="32" height="22" rx="2" fill="${c}"/><rect x="24" y="12" width="16" height="12" rx="2" fill="${c}"/>`,
  },
  {
    id: "bicycle", label: "Bicycle", category: "transport",
    svg: (c) => `<circle cx="16" cy="42" r="14" fill="none" stroke="${c}" stroke-width="6"/><circle cx="48" cy="42" r="14" fill="none" stroke="${c}" stroke-width="6"/><path d="M16 42L28 18H48M28 18L48 42" stroke="${c}" stroke-width="5" stroke-linejoin="round" fill="none"/><circle cx="28" cy="12" r="6" fill="${c}"/>`,
  },
  {
    id: "truck", label: "Truck", category: "transport",
    svg: (c) => `<rect x="4" y="22" width="30" height="32" rx="3" fill="${c}"/><rect x="34" y="14" width="26" height="40" rx="2" fill="${c}"/><circle cx="16" cy="56" r="7" fill="${c}"/><circle cx="46" cy="56" r="7" fill="${c}"/>`,
  },
  {
    id: "parking", label: "Parking", category: "transport",
    svg: (c) => `<path d="M14 8H40C50 8 56 16 56 26C56 36 50 44 40 44H28V56H14ZM28 20V32H40C44 32 44 20 40 20Z" fill="${c}" fill-rule="evenodd"/>`,
  },
  {
    id: "anchor", label: "Anchor", category: "transport",
    svg: (c) => `<circle cx="32" cy="12" r="8" fill="none" stroke="${c}" stroke-width="6"/><rect x="30" y="18" width="4" height="34" fill="${c}"/><path d="M20 8H44M14 52C14 52 20 58 32 58C44 58 50 52 50 52M14 36H50" stroke="${c}" stroke-width="5" stroke-linecap="round" fill="none"/>`,
  },
  {
    id: "helicopter", label: "Helicopter", category: "transport",
    svg: (c) => `<rect x="14" y="26" width="36" height="16" rx="8" fill="${c}"/><rect x="4" y="14" width="56" height="5" rx="2.5" fill="${c}"/><rect x="30" y="18" width="4" height="10" fill="${c}"/><path d="M44 34L58 46M44 34L54 50" stroke="${c}" stroke-width="5" stroke-linecap="round" fill="none"/><rect x="16" y="42" width="20" height="16" rx="3" fill="${c}"/>`,
  },
];

// ── Nature ─────────────────────────────────────────────────────────────────────
export const NATURE_ICONS: PointIconDef[] = [
  {
    id: "tree", label: "Tree", category: "nature",
    svg: (c) => `<circle cx="32" cy="24" r="20" fill="${c}"/><rect x="27" y="42" width="10" height="16" fill="${c}"/>`,
  },
  {
    id: "pine", label: "Pine", category: "nature",
    svg: (c) => `<polygon points="32,4 56,42 8,42" fill="${c}"/><rect x="27" y="42" width="10" height="16" fill="${c}"/>`,
  },
  {
    id: "mountain", label: "Mountain", category: "nature",
    svg: (c) => `<path d="M4 58L22 18L32 34L40 18L60 58Z" fill="${c}"/>`,
  },
  {
    id: "wave", label: "Water", category: "nature",
    svg: (c) => `<path d="M4 30C12 18 20 38 28 28C36 18 44 38 52 28L60 28V58H4Z" fill="${c}"/>`,
  },
  {
    id: "flower", label: "Flower", category: "nature",
    svg: (c) => `<circle cx="32" cy="32" r="9" fill="${c}"/><circle cx="32" cy="10" r="8" fill="${c}"/><circle cx="50" cy="21" r="8" fill="${c}"/><circle cx="50" cy="43" r="8" fill="${c}"/><circle cx="32" cy="54" r="8" fill="${c}"/><circle cx="14" cy="43" r="8" fill="${c}"/><circle cx="14" cy="21" r="8" fill="${c}"/>`,
  },
  {
    id: "tent", label: "Campsite", category: "nature",
    svg: (c) => `<path d="M32 6L62 58H2ZM32 6L48 58H16Z" fill="${c}" fill-rule="evenodd"/>`,
  },
  {
    id: "snowflake", label: "Snowflake", category: "nature",
    svg: (c) => `<path d="M32 4V60M4 32H60M12 12L52 52M52 12L12 52" stroke="${c}" stroke-width="7" stroke-linecap="round" fill="none"/>`,
  },
  {
    id: "sun", label: "Sun", category: "nature",
    svg: (c) => `<circle cx="32" cy="32" r="14" fill="${c}"/><path d="M32 4V14M32 50V60M4 32H14M50 32H60M11 11L18 18M46 46L53 53M53 11L46 18M18 46L11 53" stroke="${c}" stroke-width="6" stroke-linecap="round" fill="none"/>`,
  },
  {
    id: "leaf", label: "Leaf", category: "nature",
    svg: (c) => `<path d="M8 58C8 58 10 24 28 14C44 6 60 4 60 4C60 4 58 20 48 34C36 50 8 58 8 58Z" fill="${c}"/><path d="M8 58C24 46 42 30 58 8" stroke="${c}" stroke-width="4.5" stroke-linecap="round" fill="none"/>`,
  },
  {
    id: "cave", label: "Cave", category: "nature",
    svg: (c) => `<path d="M4 56C4 56 4 30 16 20C22 14 28 14 32 18C36 14 42 14 48 20C60 30 60 56 60 56Z" fill="${c}"/><path d="M16 56C16 56 18 38 24 32C27 28 30 30 32 34C34 30 37 28 40 32C46 38 48 56 48 56Z" fill="${c}" fill-rule="evenodd"/>`,
  },
];

// ── Infrastructure ─────────────────────────────────────────────────────────────
export const INFRASTRUCTURE_ICONS: PointIconDef[] = [
  {
    id: "tower", label: "Cell Tower", category: "infrastructure",
    svg: (c) => `<polygon points="20,60 44,60 40,28 24,28" fill="${c}"/><rect x="30" y="4" width="4" height="26" fill="${c}"/><rect x="18" y="28" width="28" height="5" fill="${c}"/>`,
  },
  {
    id: "bridge", label: "Bridge", category: "infrastructure",
    svg: (c) => `<rect x="4" y="40" width="56" height="8" fill="${c}"/><path d="M4 40C4 22 60 22 60 40" fill="none" stroke="${c}" stroke-width="6"/><rect x="4" y="38" width="8" height="20" fill="${c}"/><rect x="52" y="38" width="8" height="20" fill="${c}"/>`,
  },
  {
    id: "dam", label: "Dam", category: "infrastructure",
    svg: (c) => `<path d="M14 8H50L44 56H20Z" fill="${c}"/>`,
  },
  {
    id: "pylon", label: "Power Pylon", category: "infrastructure",
    svg: (c) => `<path d="M24 60H40L42 38L52 32L42 26L40 8H24L22 26L12 32L22 38Z" fill="${c}"/><path d="M8 28H56M8 36H56" stroke="${c}" stroke-width="4" fill="none"/>`,
  },
  {
    id: "pipeline", label: "Pipeline", category: "infrastructure",
    svg: (c) => `<rect x="4" y="26" width="56" height="12" rx="6" fill="${c}"/><rect x="26" y="14" width="12" height="36" rx="3" fill="${c}"/>`,
  },
  {
    id: "antenna", label: "Antenna", category: "infrastructure",
    svg: (c) => `<rect x="30" y="28" width="4" height="28" fill="${c}"/><path d="M16 22C20 12 44 12 48 22M10 30C14 14 50 14 54 30" stroke="${c}" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="32" cy="32" r="5" fill="${c}"/>`,
  },
  {
    id: "substation", label: "Substation", category: "infrastructure",
    svg: (c) => `<rect x="6" y="20" width="52" height="36" rx="2" fill="${c}"/><rect x="4" y="52" width="56" height="6" fill="${c}"/><rect x="22" y="8" width="6" height="14" fill="${c}"/><rect x="36" y="8" width="6" height="14" fill="${c}"/>`,
  },
  {
    id: "crane", label: "Crane", category: "infrastructure",
    svg: (c) => `<rect x="28" y="4" width="6" height="56" fill="${c}"/><rect x="28" y="4" width="30" height="6" fill="${c}"/><path d="M28 28L8 60" stroke="${c}" stroke-width="5" stroke-linecap="round" fill="none"/><rect x="52" y="8" width="4" height="20" fill="${c}"/>`,
  },
];

// ── Healthcare ─────────────────────────────────────────────────────────────────
export const HEALTHCARE_ICONS: PointIconDef[] = [
  {
    id: "hospital", label: "Hospital", category: "healthcare",
    svg: (c) => `<path d="M4 58V26L32 6L60 26V58ZM24 28V38H18V44H24V54H40V44H46V38H40V28Z" fill="${c}" fill-rule="evenodd"/>`,
  },
  {
    id: "heart", label: "Heart", category: "healthcare",
    svg: (c) => `<path d="M32 56C32 56 6 40 6 22C6 13 13 7 21 7C27 7 31 11 32 15C33 11 37 7 43 7C51 7 58 13 58 22C58 40 32 56 32 56Z" fill="${c}"/>`,
  },
  {
    id: "ambulance", label: "Ambulance", category: "healthcare",
    svg: (c) => `<rect x="4" y="20" width="36" height="36" rx="3" fill="${c}"/><path d="M40 28H52C56 28 60 32 60 38V56H40Z" fill="${c}"/><circle cx="16" cy="58" r="6" fill="${c}"/><circle cx="48" cy="58" r="6" fill="${c}"/>`,
  },
  {
    id: "pharmacy", label: "Pharmacy", category: "healthcare",
    svg: (c) => `<rect x="4" y="4" width="56" height="56" rx="8" fill="${c}"/><path d="M14 26H26V14H38V26H50V38H38V50H26V38H14Z" fill="${c}" fill-rule="evenodd"/>`,
  },
  {
    id: "pill", label: "Pill", category: "healthcare",
    svg: (c) => `<path d="M14 44C6 36 6 22 14 14C22 6 36 6 44 14L14 44ZM50 20C58 28 58 42 50 50C42 58 28 58 20 50L50 20Z" fill="${c}"/>`,
  },
  {
    id: "stethoscope", label: "Stethoscope", category: "healthcare",
    svg: (c) => `<path d="M12 10V32C12 44 22 52 32 52C42 52 52 44 52 32V26" stroke="${c}" stroke-width="7" stroke-linecap="round" fill="none"/><circle cx="52" cy="20" r="8" fill="${c}"/><circle cx="52" cy="20" r="3" fill="${c}" fill-rule="evenodd"/>`,
  },
];

// ── Food & Drink ───────────────────────────────────────────────────────────────
export const FOOD_ICONS: PointIconDef[] = [
  {
    id: "restaurant", label: "Restaurant", category: "food",
    svg: (c) => `<path d="M14 4V22C14 26 17 30 22 30V60H26V30C29 30 34 26 34 22V4H30V18H26V4H22V18H18V4ZM44 4C40 4 36 12 36 22V32H40V60H44V4Z" fill="${c}"/>`,
  },
  {
    id: "cafe", label: "Cafe", category: "food",
    svg: (c) => `<path d="M12 30H52L48 58H16Z" fill="${c}"/><rect x="10" y="24" width="44" height="8" rx="2" fill="${c}"/><path d="M36 24C36 22 44 18 36 14M26 24C26 22 34 18 26 14" stroke="${c}" stroke-width="4" stroke-linecap="round" fill="none"/>`,
  },
  {
    id: "wineglass", label: "Bar", category: "food",
    svg: (c) => `<path d="M14 6H50C46 20 38 32 38 40V56H42V60H22V56H26V40C26 32 18 20 14 6Z" fill="${c}"/>`,
  },
  {
    id: "shopping-cart", label: "Market", category: "food",
    svg: (c) => `<path d="M4 10H14L22 46H50L56 20H18" stroke="${c}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="24" cy="56" r="6" fill="${c}"/><circle cx="46" cy="56" r="6" fill="${c}"/>`,
  },
  {
    id: "pizza", label: "Pizza", category: "food",
    svg: (c) => `<path d="M32 4L60 58H4Z" fill="${c}"/><path d="M32 4L52 46H12Z" fill="${c}" fill-rule="evenodd"/>`,
  },
  {
    id: "beer", label: "Brewery", category: "food",
    svg: (c) => `<rect x="14" y="22" width="30" height="38" rx="4" fill="${c}"/><rect x="44" y="28" width="14" height="22" rx="7" fill="${c}"/><rect x="14" y="10" width="30" height="14" rx="3" fill="${c}"/>`,
  },
];

// ── Commerce ───────────────────────────────────────────────────────────────────
export const COMMERCE_ICONS: PointIconDef[] = [
  {
    id: "store", label: "Store", category: "commerce",
    svg: (c) => `<rect x="6" y="28" width="52" height="32" rx="2" fill="${c}"/><path d="M4 16H60L56 28H8Z" fill="${c}"/><rect x="4" y="12" width="56" height="6" fill="${c}"/>`,
  },
  {
    id: "bank", label: "Bank", category: "commerce",
    svg: (c) => `<polygon points="32,4 62,20 2,20" fill="${c}"/><rect x="2" y="52" width="60" height="8" fill="${c}"/><rect x="4" y="22" width="8" height="30" fill="${c}"/><rect x="18" y="22" width="8" height="30" fill="${c}"/><rect x="32" y="22" width="8" height="30" fill="${c}"/><rect x="46" y="22" width="8" height="30" fill="${c}"/>`,
  },
  {
    id: "hotel", label: "Hotel", category: "commerce",
    svg: (c) => `<rect x="12" y="10" width="40" height="50" rx="2" fill="${c}"/><rect x="6" y="56" width="52" height="6" fill="${c}"/>`,
  },
  {
    id: "office", label: "Office Building", category: "commerce",
    svg: (c) => `<rect x="18" y="4" width="28" height="56" rx="2" fill="${c}"/><rect x="8" y="54" width="48" height="6" fill="${c}"/>`,
  },
  {
    id: "atm", label: "ATM", category: "commerce",
    svg: (c) => `<rect x="8" y="6" width="48" height="52" rx="4" fill="${c}"/><path d="M16 24H48V36H16ZM20 42H28M36 42H44" stroke="${c}" stroke-width="4" stroke-linecap="round" fill="none" stroke-rule="evenodd"/><path d="M16 24H48V36H16Z" fill="${c}" fill-rule="evenodd"/>`,
  },
  {
    id: "gas-station", label: "Gas Station", category: "commerce",
    svg: (c) => `<rect x="6" y="22" width="36" height="38" rx="3" fill="${c}"/><rect x="42" y="18" width="14" height="28" rx="3" fill="${c}"/><rect x="6" y="10" width="36" height="14" rx="2" fill="${c}"/>`,
  },
];

// ── Recreation ─────────────────────────────────────────────────────────────────
export const RECREATION_ICONS: PointIconDef[] = [
  {
    id: "stadium", label: "Stadium", category: "recreation",
    svg: (c) => `<path d="M32 6C14 6 4 18 4 32C4 46 14 58 32 58C50 58 60 46 60 32C60 18 50 6 32 6ZM32 16C44 16 50 23 50 32C50 41 44 48 32 48C20 48 14 41 14 32C14 23 20 16 32 16Z" fill="${c}" fill-rule="evenodd"/>`,
  },
  {
    id: "playground", label: "Playground", category: "recreation",
    svg: (c) => `<path d="M8 60L32 8L56 60" stroke="${c}" stroke-width="7" stroke-linejoin="round" fill="none"/><rect x="18" y="36" width="28" height="8" rx="4" fill="${c}"/><path d="M22 32V46M42 32V46" stroke="${c}" stroke-width="4" stroke-linecap="round" fill="none"/>`,
  },
  {
    id: "swimming", label: "Swimming", category: "recreation",
    svg: (c) => `<circle cx="50" cy="10" r="8" fill="${c}"/><path d="M4 30C8 22 16 26 20 30L38 18C42 14 50 18 44 26L36 34" stroke="${c}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M4 46C12 38 24 54 32 46C40 38 52 54 60 46" stroke="${c}" stroke-width="6" stroke-linecap="round" fill="none"/>`,
  },
  {
    id: "hiking", label: "Hiking", category: "recreation",
    svg: (c) => `<circle cx="38" cy="8" r="7" fill="${c}"/><path d="M38 16L34 32L24 28L18 48M34 32L42 52M18 48L10 60M18 48L28 60" stroke="${c}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  },
  {
    id: "golf", label: "Golf", category: "recreation",
    svg: (c) => `<rect x="28" y="8" width="5" height="40" fill="${c}"/><polygon points="33,8 56,20 33,32" fill="${c}"/><ellipse cx="22" cy="56" rx="18" ry="5" fill="${c}"/><circle cx="22" cy="52" r="5" fill="${c}"/>`,
  },
  {
    id: "tennis", label: "Tennis", category: "recreation",
    svg: (c) => `<circle cx="32" cy="32" r="28" fill="${c}"/><path d="M8 20C18 28 18 36 8 44M56 20C46 28 46 36 56 44" stroke="${c}" stroke-width="0" fill="none"/><path d="M4 24C4 24 10 20 10 32C10 44 4 40 4 40M60 24C60 24 54 20 54 32C54 44 60 40 60 40" fill="${c}" fill-rule="evenodd"/>`,
  },
  {
    id: "ski", label: "Ski Resort", category: "recreation",
    svg: (c) => `<circle cx="40" cy="8" r="7" fill="${c}"/><path d="M40 16L30 52L10 58M30 30L52 60" stroke="${c}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  },
  {
    id: "picnic", label: "Park / Picnic", category: "recreation",
    svg: (c) => `<rect x="4" y="34" width="56" height="6" rx="3" fill="${c}"/><rect x="8" y="34" width="6" height="18" rx="3" fill="${c}"/><rect x="50" y="34" width="6" height="18" rx="3" fill="${c}"/><circle cx="20" cy="22" r="14" fill="${c}"/><rect x="16" y="34" width="8" height="12" fill="${c}"/>`,
  },
];

// ── Civic ──────────────────────────────────────────────────────────────────────
export const CIVIC_ICONS: PointIconDef[] = [
  {
    id: "library", label: "Library", category: "civic",
    svg: (c) => `<path d="M6 56V24L32 6L58 24V56ZM14 56V28H22V56M28 56V24H36V56M42 56V28H50V56" fill="${c}" fill-rule="evenodd"/>`,
  },
  {
    id: "museum", label: "Museum", category: "civic",
    svg: (c) => `<polygon points="32,4 62,20 2,20" fill="${c}"/><rect x="2" y="52" width="60" height="8" fill="${c}"/><rect x="6" y="22" width="10" height="30" fill="${c}"/><rect x="22" y="22" width="20" height="30" fill="${c}"/><rect x="48" y="22" width="10" height="30" fill="${c}"/>`,
  },
  {
    id: "envelope", label: "Post Office", category: "civic",
    svg: (c) => `<rect x="4" y="14" width="56" height="40" rx="3" fill="${c}"/><path d="M4 14L32 38L60 14" stroke="${c}" stroke-width="5" stroke-linejoin="round" fill="none"/>`,
  },
  {
    id: "scales", label: "Courthouse", category: "civic",
    svg: (c) => `<rect x="30" y="4" width="4" height="52" fill="${c}"/><rect x="10" y="56" width="44" height="5" fill="${c}"/><rect x="14" y="12" width="36" height="5" fill="${c}"/><path d="M14 14L22 36H6ZM50 14L58 36H42Z" fill="${c}"/>`,
  },
  {
    id: "capitol", label: "Government", category: "civic",
    svg: (c) => `<rect x="6" y="52" width="52" height="8" fill="${c}"/><rect x="12" y="34" width="40" height="20" fill="${c}"/><path d="M32 6C28 6 24 12 24 22V34H40V22C40 12 36 6 32 6Z" fill="${c}"/><rect x="8" y="30" width="48" height="6" fill="${c}"/>`,
  },
  {
    id: "megaphone", label: "Public Notice", category: "civic",
    svg: (c) => `<path d="M8 24V40H18L40 52V12L18 24Z" fill="${c}"/><path d="M18 26V38M50 16C54 20 56 26 56 32C56 38 54 44 50 48" stroke="${c}" stroke-width="5" stroke-linecap="round" fill="none"/>`,
  },
];

// ── Agriculture ────────────────────────────────────────────────────────────────
export const AGRICULTURE_ICONS: PointIconDef[] = [
  {
    id: "barn", label: "Barn", category: "agriculture",
    svg: (c) => `<path d="M4 30L32 8L60 30V58H4ZM14 58V38H28V58M36 58V38H50V58" fill="${c}" fill-rule="evenodd"/>`,
  },
  {
    id: "silo", label: "Silo", category: "agriculture",
    svg: (c) => `<rect x="18" y="28" width="28" height="32" fill="${c}"/><path d="M18 28C18 16 46 16 46 28" fill="${c}"/><rect x="14" y="56" width="36" height="6" rx="2" fill="${c}"/>`,
  },
  {
    id: "tractor", label: "Tractor", category: "agriculture",
    svg: (c) => `<path d="M8 34C8 26 14 20 22 20C30 20 36 26 36 34C36 42 30 48 22 48C14 48 8 42 8 34Z" fill="${c}"/><circle cx="48" cy="40" r="14" fill="${c}"/><rect x="36" y="16" width="24" height="16" rx="3" fill="${c}"/>`,
  },
  {
    id: "wheat", label: "Crops", category: "agriculture",
    svg: (c) => `<path d="M32 60V10M32 10C32 10 26 6 22 10C26 14 32 10 32 10ZM32 10C32 10 38 6 42 10C38 14 32 10 32 10ZM32 22C32 22 26 18 22 22C26 26 32 22 32 22ZM32 22C32 22 38 18 42 22C38 26 32 22 32 22ZM32 34C32 34 26 30 22 34C26 38 32 34 32 34ZM32 34C32 34 38 30 42 34C38 38 32 34 32 34Z" stroke="${c}" stroke-width="4" stroke-linecap="round" fill="none"/>`,
  },
  {
    id: "irrigation", label: "Irrigation", category: "agriculture",
    svg: (c) => `<rect x="28" y="14" width="8" height="46" fill="${c}"/><rect x="10" y="14" width="44" height="8" rx="4" fill="${c}"/><path d="M14 22L10 32M20 22L16 36M26 22L24 38M38 22L40 38M44 22L48 36M50 22L54 32" stroke="${c}" stroke-width="4" stroke-linecap="round" fill="none"/>`,
  },
  {
    id: "greenhouse", label: "Greenhouse", category: "agriculture",
    svg: (c) => `<path d="M4 36C4 20 60 20 60 36V56H4Z" fill="${c}"/><rect x="4" y="52" width="56" height="6" fill="${c}"/><rect x="28" y="22" width="8" height="34" fill="${c}" fill-rule="evenodd"/>`,
  },
];

// ── Hazard ─────────────────────────────────────────────────────────────────────
export const HAZARD_ICONS: PointIconDef[] = [
  {
    id: "warning", label: "Warning", category: "hazard",
    svg: (c) => `<path d="M32 4L62 56H2ZM29 26V42H35V26ZM29 46V52H35V46Z" fill="${c}" fill-rule="evenodd"/>`,
  },
  {
    id: "radioactive", label: "Radioactive", category: "hazard",
    svg: (c) => `<circle cx="32" cy="32" r="8" fill="${c}"/><path d="M32 24C28 16 18 12 10 16L16 26C20 23 26 24 32 24ZM32 24C36 16 46 12 54 16L48 26C44 23 38 24 32 24ZM32 40C32 50 26 58 18 60L20 48C24 48 28 45 32 40Z" fill="${c}"/>`,
  },
  {
    id: "biohazard", label: "Biohazard", category: "hazard",
    svg: (c) => `<circle cx="32" cy="32" r="6" fill="${c}"/><path d="M32 20C24 20 18 26 18 32C14 32 10 28 10 22C10 14 18 8 28 8L30 18ZM32 20C40 20 46 26 46 32C50 32 54 28 54 22C54 14 46 8 36 8L34 18ZM32 44C26 44 22 40 20 36C16 38 14 44 16 50C18 56 24 60 32 60C40 60 46 56 48 50C50 44 48 38 44 36C42 40 38 44 32 44Z" fill="${c}"/>`,
  },
  {
    id: "flood", label: "Flood", category: "hazard",
    svg: (c) => `<path d="M4 58C4 58 4 38 14 30C22 24 26 28 32 28C38 28 42 24 50 30C60 38 60 58 60 58ZM4 42C12 34 20 50 28 42C36 34 44 50 52 42L60 34V58H4Z" fill="${c}" fill-rule="evenodd"/>`,
  },
  {
    id: "fire-hazard", label: "Fire Hazard", category: "hazard",
    svg: (c) => `<path d="M32 4C22 18 14 30 14 42C14 54 22 62 32 62C42 62 50 54 50 42C50 30 42 18 32 4ZM32 52C27 52 23 48 23 44C23 38 27 32 32 26C37 32 41 38 41 44C41 48 37 52 32 52Z" fill="${c}" fill-rule="evenodd"/>`,
  },
  {
    id: "construction", label: "Construction", category: "hazard",
    svg: (c) => `<path d="M6 58L16 34L26 46L36 16L46 36L52 24L62 58Z" fill="${c}"/>`,
  },
  {
    id: "skull", label: "Danger", category: "hazard",
    svg: (c) => `<path d="M32 6C18 6 10 16 10 28C10 38 16 44 20 48V56H26V48H38V56H44V48C48 44 54 38 54 28C54 16 46 6 32 6ZM24 30C22 30 20 28 20 26C20 24 22 22 24 22C26 22 28 24 28 26C28 28 26 30 24 30ZM40 30C38 30 36 28 36 26C36 24 38 22 40 22C42 22 44 24 44 26C44 28 42 30 40 30Z" fill="${c}" fill-rule="evenodd"/>`,
  },
  {
    id: "no-entry", label: "No Entry", category: "hazard",
    svg: (c) => `<circle cx="32" cy="32" r="28" fill="${c}"/><rect x="10" y="26" width="44" height="12" rx="3" fill="${c}" fill-rule="evenodd"/>`,
  },
];

// ── Energy (existing) ──────────────────────────────────────────────────────────
export const ENERGY_ICONS: PointIconDef[] = [
  {
    id: "solar", label: "Solar", category: "energy",
    svg: (c) => `<circle cx="32" cy="32" r="13" fill="${c}"/><path d="M32 2v16M32 46v16M2 32h16M46 32h16M10.2 10.2l11.3 11.3M42.5 42.5l11.3 11.3M53.8 10.2l-11.3 11.3M21.5 42.5l-11.3 11.3" stroke="${c}" stroke-width="7" stroke-linecap="round" fill="none"/>`,
  },
  {
    id: "wind", label: "Wind", category: "energy",
    svg: (c) => `<rect x="29" y="30" width="6" height="28" fill="${c}"/><circle cx="32" cy="30" r="6" fill="${c}"/><ellipse cx="32" cy="13" rx="5.5" ry="16" fill="${c}"/><ellipse cx="32" cy="13" rx="5.5" ry="16" transform="rotate(120 32 30)" fill="${c}"/><ellipse cx="32" cy="13" rx="5.5" ry="16" transform="rotate(240 32 30)" fill="${c}"/>`,
  },
  {
    id: "coal", label: "Coal", category: "energy",
    svg: (c) => `<rect x="8" y="40" width="48" height="18" fill="${c}"/><rect x="12" y="14" width="14" height="28" fill="${c}"/><rect x="38" y="22" width="14" height="20" fill="${c}"/>`,
  },
  {
    id: "ng", label: "Nat. Gas", category: "energy",
    svg: (c) => `<path d="M32 4C22 18 14 30 14 42C14 54 22 62 32 62C42 62 50 54 50 42C50 30 42 18 32 4ZM32 52C27 52 23 48 23 44C23 38 27 32 32 26C37 32 41 38 41 44C41 48 37 52 32 52Z" fill="${c}" fill-rule="evenodd"/>`,
  },
  {
    id: "nuclear", label: "Nuclear", category: "energy",
    svg: (c) => `<circle cx="32" cy="32" r="10" fill="${c}"/><ellipse cx="32" cy="32" rx="28" ry="11" fill="none" stroke="${c}" stroke-width="6"/><ellipse cx="32" cy="32" rx="28" ry="11" transform="rotate(60 32 32)" fill="none" stroke="${c}" stroke-width="6"/><ellipse cx="32" cy="32" rx="28" ry="11" transform="rotate(120 32 32)" fill="none" stroke="${c}" stroke-width="6"/>`,
  },
  {
    id: "hydro", label: "Hydro", category: "energy",
    svg: (c) => `<path d="M32 2C32 2 10 30 10 44C10 56 20 62 32 62C44 62 54 56 54 44C54 30 32 2 32 2Z" fill="${c}"/>`,
  },
  {
    id: "geo", label: "Geothermal", category: "energy",
    svg: (c) => `<polygon points="32,22 60,60 4,60" fill="${c}"/><path d="M18 18C19 14 17 10 18 6M32 16C33 12 31 8 32 4M46 18C47 14 45 10 46 6" stroke="${c}" stroke-width="5" stroke-linecap="round" fill="none"/>`,
  },
  {
    id: "bio", label: "Biomass", category: "energy",
    svg: (c) => `<path d="M8 58C8 58 10 24 28 14C44 6 60 4 60 4C60 4 58 20 48 34C36 50 8 58 8 58Z" fill="${c}"/><path d="M8 58C24 46 42 30 58 8" stroke="${c}" stroke-width="4.5" stroke-linecap="round" fill="none"/>`,
  },
  {
    id: "oil", label: "Oil", category: "energy",
    svg: (c) => `<ellipse cx="32" cy="12" rx="22" ry="8" fill="${c}"/><rect x="10" y="12" width="44" height="40" fill="${c}"/><ellipse cx="32" cy="52" rx="22" ry="8" fill="${c}"/>`,
  },
];

// ── Facility (existing) ────────────────────────────────────────────────────────
export const FACILITY_ICONS: PointIconDef[] = [
  {
    id: "school", label: "School", category: "facility",
    svg: (c) => `<polygon points="32,6 62,21 32,36 2,21" fill="${c}"/><path d="M15 28 L32 36 L49 28 V40 C49 49 15 49 15 40 Z" fill="${c}"/><path d="M60 21 V41" stroke="${c}" stroke-width="4" fill="none"/><circle cx="60" cy="44" r="4.5" fill="${c}"/>`,
  },
  {
    id: "nursing", label: "Nursing Home", category: "facility",
    svg: (c) => `<path d="M4 31 L32 5 L60 31 L52 31 L52 59 L12 59 L12 31 Z M28 35 H36 V41 H42 V49 H36 V55 H28 V49 H22 V41 H28 Z" fill="${c}" fill-rule="evenodd"/>`,
  },
  {
    id: "shelter", label: "Shelter", category: "facility",
    svg: (c) => `<path d="M32 5 L63 33 L51 33 L32 16 L13 33 L1 33 Z" fill="${c}"/><circle cx="32" cy="40" r="8" fill="${c}"/><path d="M18 61 C18 47 46 47 46 61 Z" fill="${c}"/>`,
  },
  {
    id: "police", label: "Police", category: "facility",
    svg: (c) => `<path d="M32 3 L57 11 V32 C57 49 45 59 32 63 C19 59 7 49 7 32 V11 Z M32 18 L36 30 L49 30 L38 38 L42 50 L32 42 L22 50 L26 38 L15 30 L28 30 Z" fill="${c}" fill-rule="evenodd"/>`,
  },
  {
    id: "community", label: "Community Center", category: "facility",
    svg: (c) => `<polygon points="32,5 61,23 3,23" fill="${c}"/><rect x="6" y="50" width="52" height="9" rx="1.5" fill="${c}"/><rect x="9" y="26" width="7" height="22" fill="${c}"/><rect x="22" y="26" width="7" height="22" fill="${c}"/><rect x="35" y="26" width="7" height="22" fill="${c}"/><rect x="48" y="26" width="7" height="22" fill="${c}"/>`,
  },
  {
    id: "fire", label: "Fire Station", category: "facility",
    svg: (c) => `<rect x="25" y="8" width="14" height="8" rx="4" fill="${c}"/><rect x="21" y="16" width="22" height="32" rx="7" fill="${c}"/><rect x="10" y="25" width="13" height="11" rx="3" fill="${c}"/><rect x="41" y="25" width="13" height="11" rx="3" fill="${c}"/><rect x="14" y="50" width="36" height="10" rx="3" fill="${c}"/>`,
  },
  {
    id: "wastewater", label: "Wastewater Plant", category: "facility",
    svg: (c) => `<path d="M32 4 C32 4 11 28 11 44 C11 55 20 62 32 62 C44 62 53 55 53 44 C53 28 32 4 32 4 Z M17 39 C22 33 27 45 32 39 C37 33 42 45 47 39 L47 47 C42 53 37 41 32 47 C27 53 22 41 17 47 Z" fill="${c}" fill-rule="evenodd"/>`,
  },
];

// ── Aggregate exports ──────────────────────────────────────────────────────────
export const ICON_CATEGORIES: { label: string; icons: PointIconDef[] }[] = [
  { label: "Geometric",      icons: GEOMETRIC_ICONS },
  { label: "Transport",      icons: TRANSPORT_ICONS },
  { label: "Nature",         icons: NATURE_ICONS },
  { label: "Infrastructure", icons: INFRASTRUCTURE_ICONS },
  { label: "Healthcare",     icons: HEALTHCARE_ICONS },
  { label: "Food & Drink",   icons: FOOD_ICONS },
  { label: "Commerce",       icons: COMMERCE_ICONS },
  { label: "Recreation",     icons: RECREATION_ICONS },
  { label: "Civic",          icons: CIVIC_ICONS },
  { label: "Agriculture",    icons: AGRICULTURE_ICONS },
  { label: "Hazard",         icons: HAZARD_ICONS },
  { label: "Energy",         icons: ENERGY_ICONS },
  { label: "Facilities",     icons: FACILITY_ICONS },
];

export const ALL_ICONS: PointIconDef[] = ICON_CATEGORIES.flatMap(c => c.icons);

export function findIcon(id: string): PointIconDef {
  return ALL_ICONS.find(i => i.id === id) ?? GEOMETRIC_ICONS[0];
}

export function iconDataUri(icon: PointIconDef, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${icon.svg(color)}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
