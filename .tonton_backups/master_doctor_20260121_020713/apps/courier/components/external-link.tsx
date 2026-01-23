import { Href, Link } from 'expo-router';
import type { ComponentProps } from 'react';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: Href & string;
};

/**
 * Version simplifiée sans expo-web-browser :
 * - sur web et mobile, on laisse <Link> gérer l'ouverture du lien.
 * - plus de module natif "ExpoWebBrowser" donc plus d'erreur.
 */
export function ExternalLink(props: Props) {
  return <Link target="_blank" {...props} />;
}
