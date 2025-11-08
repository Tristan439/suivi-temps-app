import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, fontSizes, spacing } from '../styles/global';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectInputProps {
  value?: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SelectInput: React.FC<SelectInputProps> = ({
  value,
  options,
  onValueChange,
  placeholder = 'Sélectionner...',
  disabled = false,
  style,
}) => {
  const [visible, setVisible] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const modalWidth = Math.min(windowWidth - spacing.large * 2, 420);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const handleOpen = () => {
    if (disabled || options.length === 0) {
      return;
    }
    setVisible(true);
  };

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.trigger,
          disabled && styles.triggerDisabled,
          style,
        ]}
        activeOpacity={0.7}
        onPress={handleOpen}
      >
        <Text
          style={[
            styles.triggerText,
            !selectedOption && styles.placeholder,
            disabled && styles.disabledText,
          ]}
          numberOfLines={1}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={disabled ? colors.secondary : colors.darkGray}
        />
      </TouchableOpacity>

      <Modal
        transparent
        animationType="fade"
        visible={visible}
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalWrapper}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)} />
          <View style={[styles.modalCard, { width: modalWidth }]}>
            <ScrollView
              contentContainerStyle={styles.optionsContainer}
              keyboardShouldPersistTaps="handled"
            >
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.option}
                  onPress={() => handleSelect(option.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.optionLabel}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  triggerDisabled: {
    backgroundColor: colors.lightGray,
  },
  triggerText: {
    flex: 1,
    marginRight: spacing.small,
    fontSize: fontSizes.body,
    color: colors.text,
    fontWeight: '500',
  },
  disabledText: {
    color: colors.secondary,
  },
  placeholder: {
    color: colors.secondary,
    fontWeight: '400',
  },
  modalWrapper: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.large,
  },
  modalCard: {
    alignSelf: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: spacing.small,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    maxWidth: 420,
    maxHeight: 320,
  },
  optionsContainer: {
    paddingVertical: spacing.small,
  },
  option: {
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.large,
  },
  optionLabel: {
    fontSize: fontSizes.subtitle,
    color: colors.text,
  },
});

export default SelectInput;
