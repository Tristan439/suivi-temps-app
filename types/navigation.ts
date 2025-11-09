import { SubCategoryKey } from '../constants/categories';

export type PomodoroRouteParams = {
  preselectedStage?: string;
  preselectedCategory?: string;
  autoStart?: boolean;
  initialDescription?: string;
  taskCardId?: string;
  preselectedSubCategory?: SubCategoryKey;
};

export type TimerRouteParams = {
  preselectedCategory?: string;
  preselectedStage?: string;
  autoStart?: boolean;
  preselectedSubCategory?: SubCategoryKey;
};

export type MainTabParamList = {
  Accueil: undefined;
  Minuteur: TimerRouteParams | undefined;
  Pomodoro: PomodoroRouteParams | undefined;
  'Tâches': undefined;
  'Paramètres': undefined;
};
