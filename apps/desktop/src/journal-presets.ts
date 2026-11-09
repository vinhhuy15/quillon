/** Figure widths from journal author guidelines (mm). */
export interface JournalPreset {
  id: string;
  journal: string;
  size: string;
  widthMm: number;
}

export const JOURNAL_PRESETS: JournalPreset[] = [
  { id: 'nature-1', journal: 'Nature', size: '1 column', widthMm: 89 },
  { id: 'nature-2', journal: 'Nature', size: '2 columns', widthMm: 183 },
  { id: 'science-1', journal: 'Science', size: '1 column', widthMm: 55 },
  { id: 'science-2', journal: 'Science', size: '2 columns', widthMm: 120 },
  { id: 'science-3', journal: 'Science', size: '3 columns', widthMm: 183 },
  { id: 'cell-1', journal: 'Cell Press', size: '1 column', widthMm: 85 },
  { id: 'cell-15', journal: 'Cell Press', size: '1.5 columns', widthMm: 114 },
  { id: 'cell-2', journal: 'Cell Press', size: '2 columns', widthMm: 174 },
  { id: 'pnas-1', journal: 'PNAS', size: '1 column', widthMm: 87 },
  { id: 'pnas-2', journal: 'PNAS', size: '2 columns', widthMm: 178 },
  { id: 'elsevier-1', journal: 'Elsevier', size: '1 column', widthMm: 90 },
  { id: 'elsevier-15', journal: 'Elsevier', size: '1.5 columns', widthMm: 140 },
  { id: 'elsevier-2', journal: 'Elsevier', size: '2 columns', widthMm: 190 },
  { id: 'ieee-1', journal: 'IEEE', size: '1 column', widthMm: 88.9 },
  { id: 'ieee-2', journal: 'IEEE', size: '2 columns', widthMm: 181.6 },
  { id: 'acs-1', journal: 'ACS', size: '1 column', widthMm: 82.5 },
  { id: 'acs-2', journal: 'ACS', size: '2 columns', widthMm: 177.8 },
  { id: 'aps-1', journal: 'APS (Phys. Rev.)', size: '1 column', widthMm: 86 },
  { id: 'aps-2', journal: 'APS (Phys. Rev.)', size: '2 columns', widthMm: 178 },
  { id: 'a4', journal: 'Page', size: 'A4 text width', widthMm: 160 },
];

/** Journals require text of at least this size in the printed figure (points). */
export const MIN_FONT_PT = 5;
