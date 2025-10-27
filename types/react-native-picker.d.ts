import type { ItemValue } from '@react-native-picker/picker/typings/Picker';

declare module '@react-native-picker/picker' {
  interface PickerProps<T = ItemValue> {
    themeVariant?: 'light' | 'dark';
  }
}
