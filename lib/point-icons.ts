export interface PointIconDef {
  id: string;
  label: string;
  category: "geometric" | "energy";
  /** Returns SVG child content for a 64×64 viewBox with the given color. */
  svg: (color: string) => string;
}

export const GEOMETRIC_ICONS: PointIconDef[] = [
  { id: "circle",   label: "Circle",   category: "geometric", svg: (c) => `<circle cx="32" cy="32" r="28" fill="${c}"/>` },
  { id: "square",   label: "Square",   category: "geometric", svg: (c) => `<rect x="4" y="4" width="56" height="56" rx="2" fill="${c}"/>` },
  { id: "triangle", label: "Triangle", category: "geometric", svg: (c) => `<polygon points="32,3 61,61 3,61" fill="${c}"/>` },
  { id: "diamond",  label: "Diamond",  category: "geometric", svg: (c) => `<polygon points="32,2 62,32 32,62 2,32" fill="${c}"/>` },
  { id: "star",     label: "Star",     category: "geometric", svg: (c) => `<polygon points="32,4 39,23 59,23 43,35 49,55 32,43 15,55 21,35 5,23 25,23" fill="${c}"/>` },
  { id: "cross",    label: "Cross",    category: "geometric", svg: (c) => `<path d="M22,4H42V22H60V42H42V60H22V42H4V22H22Z" fill="${c}"/>` },
  { id: "hexagon",  label: "Hexagon",  category: "geometric", svg: (c) => `<polygon points="60,32 46,56 18,56 4,32 18,8 46,8" fill="${c}"/>` },
];

export const ENERGY_ICONS: PointIconDef[] = [
  {
    // Sun: large central disc + 8 thick rays
    id: "solar", label: "Solar", category: "energy",
    svg: (c) => `<circle cx="32" cy="32" r="13" fill="${c}"/><path d="M32 2v16M32 46v16M2 32h16M46 32h16M10.2 10.2l11.3 11.3M42.5 42.5l11.3 11.3M53.8 10.2l-11.3 11.3M21.5 42.5l-11.3 11.3" stroke="${c}" stroke-width="7" stroke-linecap="round" fill="none"/>`,
  },
  {
    // 3-blade turbine with mast — blades as rotated ellipses around the hub
    id: "wind", label: "Wind", category: "energy",
    svg: (c) => `<rect x="29" y="30" width="6" height="28" fill="${c}"/><circle cx="32" cy="30" r="6" fill="${c}"/><ellipse cx="32" cy="13" rx="5.5" ry="16" fill="${c}"/><ellipse cx="32" cy="13" rx="5.5" ry="16" transform="rotate(120 32 30)" fill="${c}"/><ellipse cx="32" cy="13" rx="5.5" ry="16" transform="rotate(240 32 30)" fill="${c}"/>`,
  },
  {
    // Factory: purely rectangular — wide base + two chimney stacks, no circles so it can't be confused with a water drop
    id: "coal", label: "Coal", category: "energy",
    svg: (c) => `<rect x="8" y="40" width="48" height="18" fill="${c}"/><rect x="12" y="14" width="14" height="28" fill="${c}"/><rect x="38" y="22" width="14" height="20" fill="${c}"/>`,
  },
  {
    // Flame with inner evenodd cutout for depth
    id: "ng", label: "Nat. Gas", category: "energy",
    svg: (c) => `<path d="M32 4C22 18 14 30 14 42C14 54 22 62 32 62C42 62 50 54 50 42C50 30 42 18 32 4ZM32 52C27 52 23 48 23 44C23 38 27 32 32 26C37 32 41 38 41 44C41 48 37 52 32 52Z" fill="${c}" fill-rule="evenodd"/>`,
  },
  {
    // Atom: large nucleus + 3 thick orbital ellipses
    id: "nuclear", label: "Nuclear", category: "energy",
    svg: (c) => `<circle cx="32" cy="32" r="10" fill="${c}"/><ellipse cx="32" cy="32" rx="28" ry="11" fill="none" stroke="${c}" stroke-width="6"/><ellipse cx="32" cy="32" rx="28" ry="11" transform="rotate(60 32 32)" fill="none" stroke="${c}" stroke-width="6"/><ellipse cx="32" cy="32" rx="28" ry="11" transform="rotate(120 32 32)" fill="none" stroke="${c}" stroke-width="6"/>`,
  },
  {
    // Water drop: tall teardrop pointed at top — clearly different from the wide flat coal factory
    id: "hydro", label: "Hydro", category: "energy",
    svg: (c) => `<path d="M32 2C32 2 10 30 10 44C10 56 20 62 32 62C44 62 54 56 54 44C54 30 32 2 32 2Z" fill="${c}"/>`,
  },
  {
    // Mountain triangle + 3 wavy steam columns above
    id: "geo", label: "Geothermal", category: "energy",
    svg: (c) => `<polygon points="32,22 60,60 4,60" fill="${c}"/><path d="M18 18C19 14 17 10 18 6M32 16C33 12 31 8 32 4M46 18C47 14 45 10 46 6" stroke="${c}" stroke-width="5" stroke-linecap="round" fill="none"/>`,
  },
  {
    // Diagonal leaf with center vein
    id: "bio", label: "Biomass", category: "energy",
    svg: (c) => `<path d="M8 58C8 58 10 24 28 14C44 6 60 4 60 4C60 4 58 20 48 34C36 50 8 58 8 58Z" fill="${c}"/><path d="M8 58C24 46 42 30 58 8" stroke="${c}" stroke-width="4.5" stroke-linecap="round" fill="none"/>`,
  },
  {
    // Barrel: two elliptical caps + rectangular body — wide and squat, clearly different from the tall hydro drop
    id: "oil", label: "Oil", category: "energy",
    svg: (c) => `<ellipse cx="32" cy="12" rx="22" ry="8" fill="${c}"/><rect x="10" y="12" width="44" height="40" fill="${c}"/><ellipse cx="32" cy="52" rx="22" ry="8" fill="${c}"/>`,
  },
];

export const ALL_ICONS: PointIconDef[] = [...GEOMETRIC_ICONS, ...ENERGY_ICONS];

export function findIcon(id: string): PointIconDef {
  return ALL_ICONS.find(i => i.id === id) ?? GEOMETRIC_ICONS[0];
}

export function iconDataUri(icon: PointIconDef, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${icon.svg(color)}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
