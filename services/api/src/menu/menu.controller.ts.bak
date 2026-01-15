import { Controller, Get } from '@nestjs/common';

export type MenuItem = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  priceCents: number;
  isAvailable: boolean;
  imageUrl?: string;
  tags?: string[];
};

export type ThieypMenuResponse = {
  partnerId: 'thieyp';
  name: string;
  currency: 'EUR';
  items: MenuItem[];
};

const THIEYP_MENU: ThieypMenuResponse = {
  partnerId: 'thieyp',
  name: 'Thieyp',
  currency: 'EUR',
  items: [
    {
      id: 'thieyp-tieboudienne',
      name: 'Tiebou Dienn (riz au poisson)',
      description:
        'Plat sénégalais emblématique, poisson, riz et légumes mijotés.',
      category: 'Plats signatures',
      priceCents: 1790,
      isAvailable: true,
      imageUrl: 'https://cdn.delishafrica.me/thieyp/tieboudienne.jpg',
      tags: ['signature', 'poisson'],
    },
    {
      id: 'thieyp-poulet-yassa',
      name: 'Poulet Yassa',
      description:
        'Poulet mariné aux oignons et citron, servi avec du riz parfumé.',
      category: 'Plats signatures',
      priceCents: 1590,
      isAvailable: true,
      imageUrl: 'https://cdn.delishafrica.me/thieyp/yassa.jpg',
      tags: ['volaille'],
    },
    {
      id: 'thieyp-pastels-thon',
      name: 'Pastels au thon',
      description:
        'Beignets salés au thon, servis avec une sauce tomate légèrement piquante.',
      category: 'Entrées',
      priceCents: 890,
      isAvailable: true,
      imageUrl: 'https://cdn.delishafrica.me/thieyp/pastels.jpg',
      tags: ['entrée', 'snack'],
    },
  ],
};

@Controller('menu')
export class MenuController {
  @Get('thieyp')
  getThieypMenu(): ThieypMenuResponse {
    return THIEYP_MENU;
  }
}
