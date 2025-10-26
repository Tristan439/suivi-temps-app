export type CategoryKey =
  | 'supervision_individuelle_seul'
  | 'supervision_individuelle_groupe'
  | 'supervision_groupe'
  | 'contact_direct'
  | 'contact_indirect'
  | 'autres_autres'
  | 'autres_pomodoro';

export interface CategoryRow {
  key: CategoryKey;
  label: string;
}

export interface CategorySection {
  id: 'supervision' | 'client' | 'autres';
  title: string;
  accent: string;
  rows: CategoryRow[];
}

export interface CategoryOption {
  label: string;
  value: CategoryKey;
}

export type SubCategoryKey = 'intervention' | 'evaluation';

export interface SubCategoryOption {
  label: string;
  value: SubCategoryKey;
}

export const CATEGORY_SECTIONS: CategorySection[] = [
  {
    id: 'supervision',
    title: 'Supervision',
    accent: '#4C6EF5',
    rows: [
      { key: 'supervision_individuelle_seul', label: 'Individuelle (seul)' },
      { key: 'supervision_individuelle_groupe', label: 'Individuelle (de groupe)' },
      { key: 'supervision_groupe', label: 'Groupe' },
    ],
  },
  {
    id: 'client',
    title: 'Contact client',
    accent: '#2F9E44',
    rows: [
      { key: 'contact_direct', label: 'Direct' },
      { key: 'contact_indirect', label: 'Indirect' },
    ],
  },
  {
    id: 'autres',
    title: 'Autres activités',
    accent: '#F59F00',
    rows: [
      { key: 'autres_autres', label: 'Autres' },
    ],
  },
];

const HIDDEN_CATEGORY_OPTIONS: CategoryOption[] = [{ label: 'Pomodoro', value: 'autres_pomodoro' }];

export const CATEGORY_OPTIONS: CategoryOption[] = [
  ...CATEGORY_SECTIONS.flatMap((section) =>
    section.rows.map((row) => ({ label: row.label, value: row.key })),
  ),
  ...HIDDEN_CATEGORY_OPTIONS,
];

export const CATEGORY_LABEL_MAP: Record<string, string> = CATEGORY_OPTIONS.reduce(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<string, string>,
);

export const CATEGORY_KEYS = new Set<string>(CATEGORY_OPTIONS.map((option) => option.value));

const SECTION_EXTRA_KEYS: Record<string, CategoryKey[]> = {
  autres: ['autres_pomodoro'],
};

export const SUB_CATEGORY_OPTIONS: SubCategoryOption[] = [
  { label: 'Intervention', value: 'intervention' },
  { label: 'Évaluation', value: 'evaluation' },
];

export const SUB_CATEGORY_LABEL_MAP: Record<SubCategoryKey, string> = SUB_CATEGORY_OPTIONS.reduce(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {} as Record<SubCategoryKey, string>,
);

export const SUB_CATEGORY_KEYS = new Set<SubCategoryKey>(
  SUB_CATEGORY_OPTIONS.map((option) => option.value),
);

export const getSectionForCategory = (category?: string) =>
  CATEGORY_SECTIONS.find(
    (section) =>
      section.rows.some((row) => row.key === category) ||
      (category && SECTION_EXTRA_KEYS[section.id]?.includes(category as CategoryKey)),
  );

export const getCategoryLabel = (category?: string) =>
  (category && CATEGORY_LABEL_MAP[category]) || category || 'Non défini';

export const getAdditionalKeysForSection = (sectionId: CategorySection['id']) =>
  SECTION_EXTRA_KEYS[sectionId] ?? [];

export const getSubCategoryLabel = (subCategory?: string) =>
  (subCategory && SUB_CATEGORY_LABEL_MAP[subCategory as SubCategoryKey]) || 'Intervention';
