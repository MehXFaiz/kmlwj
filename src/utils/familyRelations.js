// Shared family-relationship vocabulary for the Family Tree feature.
// Kept dependency-free (no Prisma types) so it can be imported by plain
// frontend components as well as re-used (as a reference) server-side.

export const RELATIONSHIP_TYPES = [
  { value: 'FATHER', label: 'Father' },
  { value: 'MOTHER', label: 'Mother' },
  { value: 'HUSBAND', label: 'Husband' },
  { value: 'WIFE', label: 'Wife' },
  { value: 'SON', label: 'Son' },
  { value: 'DAUGHTER', label: 'Daughter' },
  { value: 'BROTHER', label: 'Brother' },
  { value: 'SISTER', label: 'Sister' },
  { value: 'GRANDFATHER', label: 'Grandfather' },
  { value: 'GRANDMOTHER', label: 'Grandmother' },
  { value: 'GRANDSON', label: 'Grandson' },
  { value: 'GRANDDAUGHTER', label: 'Granddaughter' },
  { value: 'UNCLE', label: 'Uncle' },
  { value: 'AUNT', label: 'Aunt' },
  { value: 'NEPHEW', label: 'Nephew' },
  { value: 'NIECE', label: 'Niece' },
  { value: 'COUSIN', label: 'Cousin' },
  { value: 'GUARDIAN', label: 'Guardian' },
  { value: 'OTHER', label: 'Other (Custom)' },
];

export const relationshipLabel = (type, customLabel) => {
  if (type === 'OTHER' && customLabel) return customLabel;
  return RELATIONSHIP_TYPES.find((r) => r.value === type)?.label || type;
};

// Best-effort default for "the other side" of a link. Gender-ambiguous types
// (e.g. Brother could reciprocate as Brother or Sister) default to the most
// common case but stay a plain <select> in the UI so the user can correct it
// before saving — we intentionally do not store/require a gender field.
export const RECIPROCAL_DEFAULTS = {
  FATHER: 'SON',
  MOTHER: 'SON',
  HUSBAND: 'WIFE',
  WIFE: 'HUSBAND',
  SON: 'FATHER',
  DAUGHTER: 'FATHER',
  BROTHER: 'BROTHER',
  SISTER: 'SISTER',
  GRANDFATHER: 'GRANDSON',
  GRANDMOTHER: 'GRANDSON',
  GRANDSON: 'GRANDFATHER',
  GRANDDAUGHTER: 'GRANDFATHER',
  UNCLE: 'NEPHEW',
  AUNT: 'NEPHEW',
  NEPHEW: 'UNCLE',
  NIECE: 'UNCLE',
  COUSIN: 'COUSIN',
  GUARDIAN: 'OTHER',
  OTHER: 'OTHER',
};

// Which "generation band" a relation belongs to, relative to the selected
// member, for laying out the visual tree.
export const RELATION_GENERATION = {
  GRANDFATHER: -2,
  GRANDMOTHER: -2,
  FATHER: -1,
  MOTHER: -1,
  UNCLE: -1,
  AUNT: -1,
  BROTHER: 0,
  SISTER: 0,
  HUSBAND: 0,
  WIFE: 0,
  COUSIN: 0,
  SON: 1,
  DAUGHTER: 1,
  NEPHEW: 1,
  NIECE: 1,
  GRANDSON: 2,
  GRANDDAUGHTER: 2,
  GUARDIAN: 0,
  OTHER: 0,
};

/**
 * Groups a flat list of relations (each shaped like the API's
 * { relationshipType, customLabel, relatedMember }) into generation bands
 * for the FamilyTreeDiagram to render as rows around the selected member.
 */
export function groupByGeneration(relations) {
  const bands = { '-2': [], '-1': [], '0': [], '1': [], '2': [] };
  for (const rel of relations) {
    const gen = RELATION_GENERATION[rel.relationshipType] ?? 0;
    const key = String(gen);
    if (!bands[key]) bands[key] = [];
    bands[key].push(rel);
  }
  return bands;
}
