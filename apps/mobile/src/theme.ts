import { useColorScheme } from 'react-native';
import { THEMES } from '@exo/shared';

export const useTheme = () => THEMES[useColorScheme() === 'dark' ? 'dark' : 'light'];
