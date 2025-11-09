import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { SelectOption } from '../components/SelectInput';
import { getStages } from '../services/firebase';
import { Stage } from '../types/stage';

interface UsePomodoroStagesArgs {
  routeStageId?: string;
  preferredStageId?: string;
}

interface UsePomodoroStagesResult {
  stages: Stage[];
  selectedStage?: string;
  setSelectedStage: Dispatch<SetStateAction<string | undefined>>;
  refreshStages: () => Promise<void>;
  stageOptions: SelectOption[];
  hasStages: boolean;
}

const usePomodoroStages = ({
  routeStageId,
  preferredStageId,
}: UsePomodoroStagesArgs = {}): UsePomodoroStagesResult => {
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedStage, setSelectedStage] = useState<string | undefined>();

  const stageOptions = useMemo<SelectOption[]>(() => stages.map((stage) => ({
    label: stage.nom,
    value: stage.id,
  })), [stages]);
  const hasStages = stageOptions.length > 0;

  const applyStageSelection = useCallback(
    (availableStages: Stage[]) => {
      if (availableStages.length === 0) {
        return;
      }

      if (routeStageId && availableStages.some((stage) => stage.id === routeStageId)) {
        setSelectedStage(routeStageId);
        return;
      }

      if (preferredStageId && availableStages.some((stage) => stage.id === preferredStageId)) {
        setSelectedStage((current) => {
          if (current && availableStages.some((stage) => stage.id === current)) {
            return current;
          }
          return preferredStageId;
        });
        return;
      }

      setSelectedStage((current) => {
        if (current && availableStages.some((stage) => stage.id === current)) {
          return current;
        }
        return availableStages[0].id;
      });
    },
    [preferredStageId, routeStageId],
  );

  const refreshStages = useCallback(async () => {
    try {
      const fetchedStages = await getStages();
      const typedStages = (Array.isArray(fetchedStages) ? fetchedStages : []) as Stage[];
      setStages(typedStages);
      applyStageSelection(typedStages);
    } catch (error) {
      console.error('Error fetching stages:', error);
      Alert.alert('Erreur', 'Impossible de charger les stages.');
    }
  }, [applyStageSelection]);

  useEffect(() => {
    if (stages.length > 0) {
      applyStageSelection(stages);
    }
  }, [applyStageSelection, stages]);

  return {
    stages,
    stageOptions,
    hasStages,
    selectedStage,
    setSelectedStage,
    refreshStages,
  };
};

export default usePomodoroStages;
