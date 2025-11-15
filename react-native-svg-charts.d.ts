declare module 'react-native-svg-charts' {
  import { Component } from 'react';
  import { ViewStyle } from 'react-native';

  export interface ChartProps {
    data: number[];
    style?: ViewStyle;
    svg?: any;
    contentInset?: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };
    curve?: any;
  }

  export class LineChart extends Component<ChartProps> {}
  export class BarChart extends Component<ChartProps> {}
  export class AreaChart extends Component<ChartProps> {}
}

declare module 'd3-shape' {
  export const curveNatural: any;
  export const curveLinear: any;
  export const curveMonotoneX: any;
  export const curveStep: any;
}
