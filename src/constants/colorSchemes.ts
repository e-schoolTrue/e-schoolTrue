import type { ColorScheme } from '@/types/card';

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    name: 'Classique',
    primary: '#1976D2',
    secondary: '#64B5F6',
    text: '#333333',
    background: '#FFFFFF'
  },
  {
    name: 'Moderne',
    primary: '#2196F3',
    secondary: '#FF4081',
    text: '#212121',
    background: '#FAFAFA'
  },
  {
    name: 'Élégant',
    primary: '#424242',
    secondary: '#9E9E9E',
    text: '#212121',
    background: '#FFFFFF'
  },
  {
    name: 'Nature',
    primary: '#4CAF50',
    secondary: '#81C784',
    text: '#1B5E20',
    background: '#F1F8E9'
  },
  {
    name: 'Royal',
    primary: '#673AB7',
    secondary: '#9575CD',
    text: '#311B92',
    background: '#EDE7F6'
  }
];

export const DEFAULT_COLOR_SCHEME: ColorScheme = {
  name: 'Défaut',
  primary: '#1976D2',
  secondary: '#64B5F6',
  text: '#333333',
  background: '#FFFFFF'
}; 