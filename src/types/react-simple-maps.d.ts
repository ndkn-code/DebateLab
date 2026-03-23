declare module 'react-simple-maps' {
  import { ComponentType, ReactNode, SVGAttributes } from 'react';

  interface ComposableMapProps {
    projectionConfig?: { scale?: number; center?: [number, number]; rotation?: [number, number, number] };
    width?: number;
    height?: number;
    className?: string;
    children?: ReactNode;
  }
  export const ComposableMap: ComponentType<ComposableMapProps>;

  interface GeographiesProps {
    geography: string | object;
    children: (data: { geographies: GeographyType[] }) => ReactNode;
  }
  export const Geographies: ComponentType<GeographiesProps>;

  interface GeographyType {
    rsmKey: string;
    properties: Record<string, unknown>;
  }
  interface GeographyProps extends SVGAttributes<SVGPathElement> {
    geography: GeographyType;
    style?: { default?: Record<string, string>; hover?: Record<string, string>; pressed?: Record<string, string> };
  }
  export const Geography: ComponentType<GeographyProps>;

  interface MarkerProps {
    coordinates: [number, number];
    children?: ReactNode;
  }
  export const Marker: ComponentType<MarkerProps>;
}
