import { Href, Link } from 'expo-router';
import type { ComponentProps } from 'react';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: Href & string;
};

export function ExternalLink({ href, ...rest }: Props) {
  // Simple lien via expo-router, sans module natif supplémentaire
  return <Link href={href} {...rest} />;
}
