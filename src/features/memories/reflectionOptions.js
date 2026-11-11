// Prompts for the monthly reflection, shared by validation (service) and the editor (UI).
// Wording is gentle and open: nothing here asks the user to grade or judge their month.
export const REFLECTION_FIELDS = [
  { key: 'wentWell', label: 'What went well', placeholder: 'Small wins, good days, things you enjoyed…' },
  { key: 'wasHard', label: 'What was hard', placeholder: 'Anything that felt heavy. You can be kind to yourself here.' },
  { key: 'gratefulFor', label: 'What I am grateful for', placeholder: 'People, moments, little comforts…' },
  { key: 'intention', label: 'An intention for next month', placeholder: 'Something gentle to carry forward…' },
];

export const MAX_REFLECTION_LENGTH = 2000;
