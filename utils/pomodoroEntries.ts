import { SubCategoryKey } from '../constants/categories';

export type PomodoroEntryType = 'pomodoro' | 'pomodoro-stop';

interface BuildPomodoroEntryOptions {
  durationSeconds: number;
  categorie: string;
  subCategory: SubCategoryKey;
  description: string;
  stageId: string;
  type: PomodoroEntryType;
  taskCardId?: string;
  date?: Date;
}

export const buildPomodoroEntry = ({
  durationSeconds,
  categorie,
  subCategory,
  description,
  stageId,
  type,
  taskCardId,
  date = new Date(),
}: BuildPomodoroEntryOptions) => ({
  dureeSecondes: durationSeconds,
  categorie,
  subCategorie: subCategory,
  description,
  date,
  stageId,
  type,
  ...(taskCardId ? { taskCardId } : {}),
});
