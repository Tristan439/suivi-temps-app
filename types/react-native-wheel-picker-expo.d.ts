declare module 'react-native-wheel-picker-expo' {
  import { ComponentType } from 'react';
  import { ViewStyle } from 'react-native';

  export interface WheelPickerItem<TValue = number | string> {
    label: string;
    value: TValue;
  }

  export interface WheelPickerChangeEvent<TValue = number | string> {
    item: WheelPickerItem<TValue>;
    itemIndex: number;
  }

  export interface WheelPickerExpoProps<TValue = number | string> {
    items: WheelPickerItem<TValue>[];
    selectedIndex?: number;
    renderItem?: ComponentType<WheelPickerItem<TValue>>;
    height?: number;
    width?: number;
    backgroundColor?: string;
    style?: ViewStyle;
    onChange?: (event: WheelPickerChangeEvent<TValue>) => void;
  }

    const WheelPickerExpo: ComponentType<WheelPickerExpoProps>;
  export default WheelPickerExpo;

}
