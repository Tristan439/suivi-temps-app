import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontSizes, spacing } from '../styles/global';

const TasksScreen = () => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Tâches</Text>
        <Text style={styles.subtitle}>Aucune tâche pour le moment. Configurez-les bientôt.</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    padding: spacing.large,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.medium,
  },
  title: {
    fontSize: fontSizes.title + 4,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSizes.body,
    color: colors.secondary,
    textAlign: 'center',
  },
});

export default TasksScreen;
