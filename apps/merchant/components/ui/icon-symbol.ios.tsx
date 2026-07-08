import { Text, StyleProp, TextStyle } from 'react-native';

type IconSymbolProps = {
  name?: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
};

/**
 * Fallback sans expo-symbols :
 * - plus aucun import de 'expo-symbols'
 * - on affiche simplement un caractère (par défaut "●")
 * - pour la aperçu, c'est largement suffisant et totalement stable.
 */
export function IconSymbol({
  name = '●',
  size = 17,
  color = '#ffffff',
  style,
}: IconSymbolProps) {
  return (
    <Text
      style={[
        {
          fontSize: size,
          color,
        },
        style,
      ]}
    >
      {name}
    </Text>
  );
}
