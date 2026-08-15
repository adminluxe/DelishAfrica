import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';

type RateEntry = { count: number; resetAt: number };
type LatLng = { latitude: number; longitude: number };
type ProviderState = {
  status: 'unprobed' | 'ready' | 'blocked' | 'unavailable' | 'not_configured';
  code?: string;
  providerStatus?: number;
  checkedAt?: string;
};
type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

const TARGET_COUNTRIES = new Set([
  'BE', 'LU', 'FR', 'DE', 'GB', 'CM', 'SN', 'CI', 'GN', 'RW', 'NG',
]);

function text(value: unknown, max = 220): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function numeric(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

function component(
  components: GoogleAddressComponent[],
  ...types: string[]
): GoogleAddressComponent | undefined {
  return components.find((item) =>
    Array.isArray(item.types) && item.types.some((type) => types.includes(type)),
  );
}

@Injectable()
export class LocationTrustService {
  private readonly rate = new Map<string, RateEntry>();
  private providerState: ProviderState = { status: 'unprobed' };

  private googleLocationFileConfig(): { placesApiKey: string; geocodingApiKey: string; source: string } {
    const path = text(process.env.DA_GOOGLE_LOCATION_CONFIG_FILE, 500);
    if (!path) return { placesApiKey: '', geocodingApiKey: '', source: 'none' };
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
      return {
        placesApiKey: text(parsed.placesApiKey || parsed.places_api_key, 300),
        geocodingApiKey: text(parsed.geocodingApiKey || parsed.geocoding_api_key, 300),
        source: 'DA_GOOGLE_LOCATION_CONFIG_FILE',
      };
    } catch {
      return { placesApiKey: '', geocodingApiKey: '', source: 'invalid_secret_file' };
    }
  }

  private googleKeyInfo(kind: 'places' | 'geocoding'): { key: string; source: string } {
    const file = this.googleLocationFileConfig();
    const fileKey = kind === 'places' ? file.placesApiKey : file.geocodingApiKey;
    if (fileKey) return { key: fileKey, source: `${file.source}:${kind}` };

    const candidates = kind === 'places'
      ? [
          ['GOOGLE_PLACES_API_KEY', process.env.GOOGLE_PLACES_API_KEY],
          ['GOOGLE_PLACES_SERVER_API_KEY', process.env.GOOGLE_PLACES_SERVER_API_KEY],
          ['GOOGLE_MAPS_SERVER_API_KEY', process.env.GOOGLE_MAPS_SERVER_API_KEY],
          ['GOOGLE_MAPS_API_KEY', process.env.GOOGLE_MAPS_API_KEY],
        ] as const
      : [
          ['GOOGLE_GEOCODING_API_KEY', process.env.GOOGLE_GEOCODING_API_KEY],
          ['GOOGLE_GEOCODING_SERVER_API_KEY', process.env.GOOGLE_GEOCODING_SERVER_API_KEY],
          ['GOOGLE_MAPS_SERVER_API_KEY', process.env.GOOGLE_MAPS_SERVER_API_KEY],
          ['GOOGLE_MAPS_API_KEY', process.env.GOOGLE_MAPS_API_KEY],
          ['GOOGLE_PLACES_SERVER_API_KEY', process.env.GOOGLE_PLACES_SERVER_API_KEY],
          ['GOOGLE_PLACES_API_KEY', process.env.GOOGLE_PLACES_API_KEY],
        ] as const;
    for (const [source, raw] of candidates) {
      const key = text(raw, 300);
      if (key) return { key, source };
    }
    return { key: '', source: 'none' };
  }

  health() {
    const places = this.googleKeyInfo('places');
    const geocoding = this.googleKeyInfo('geocoding');
    const placesConfigured = Boolean(places.key);
    const geocodingConfigured = Boolean(geocoding.key);
    const configured = placesConfigured && geocodingConfigured;
    const ready = configured && this.providerState.status === 'ready';
    return {
      ok: true,
      service: 'location-trust',
      provider: 'google_places_new_plus_geocoding',
      configured,
      ready,
      status: configured ? this.providerState.status : 'not_configured',
      placesConfigured,
      geocodingConfigured,
      placesKeySource: placesConfigured ? places.source : null,
      geocodingKeySource: geocodingConfigured ? geocoding.source : null,
      autocomplete: placesConfigured,
      placeResolution: placesConfigured,
      reverseGeocoding: geocodingConfigured,
      routesKeyIgnoredForPlaces: Boolean(process.env.GOOGLE_ROUTES_API_KEY) && !placesConfigured,
      lastProviderCode: this.providerState.code || null,
      lastProviderStatus: this.providerState.providerStatus || null,
      checkedAt: this.providerState.checkedAt || null,
      orderGuard: 'confirmed_place_required',
      targetCountries: Array.from(TARGET_COUNTRIES),
      persistence: false,
      secretValuesExposed: false,
    };
  }

  private consume(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const current = this.rate.get(key);
    if (!current || current.resetAt <= now) {
      this.rate.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }
    if (current.count >= limit) {
      throw new HttpException(
        'Trop de recherches rapprochées. Patientez un instant.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    current.count += 1;
  }

  private requireProvider(kind: 'places' | 'geocoding'): string {
    const keyInfo = this.googleKeyInfo(kind);
    if (!keyInfo.key) {
      this.providerState = {
        status: 'not_configured',
        code: kind === 'places' ? 'location_places_not_configured' : 'location_geocoding_not_configured',
        checkedAt: new Date().toISOString(),
      };
      throw new ServiceUnavailableException({
        code: this.providerState.code,
        message: kind === 'places'
          ? 'La clé serveur Google Places doit encore être configurée.'
          : 'La clé serveur Google Geocoding doit encore être configurée.',
        retryable: false,
      });
    }
    return keyInfo.key;
  }

  private async googleJson(
    url: string,
    options: RequestInit,
    context: string,
  ): Promise<any> {
    const target = new URL(url);
    const method = options.method || 'GET';
    const body = typeof options.body === 'string' ? options.body : undefined;
    const headers = new Headers(options.headers || {});
    if (body && !headers.has('content-length')) {
      headers.set('content-length', String(Buffer.byteLength(body)));
    }

    let providerStatus = 0;
    let responseBody: any = null;
    try {
      const result = await new Promise<{ status: number; body: any }>((resolve, reject) => {
        const headerRecord: Record<string, string> = {};
        headers.forEach((value, key) => {
          headerRecord[key] = value;
        });

        const request = httpsRequest(
          {
            protocol: target.protocol,
            hostname: target.hostname,
            port: target.port ? Number(target.port) : 443,
            path: `${target.pathname}${target.search}`,
            method,
            headers: headerRecord,
            family: 4,
            timeout: 20_000,
          },
          (response) => {
            const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer | string) => {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            response.on('end', () => {
              const raw = Buffer.concat(chunks).toString('utf8');
              let parsed: any = null;
              try {
                parsed = raw ? JSON.parse(raw) : null;
              } catch {
                parsed = null;
              }
              resolve({ status: response.statusCode || 0, body: parsed });
            });
          },
        );

        request.on('timeout', () => {
          request.destroy(new Error('google_location_timeout'));
        });
        request.on('error', reject);
        if (body) request.write(body);
        request.end();
      });
      providerStatus = result.status;
      responseBody = result.body;
    } catch {
      this.providerState = {
        status: 'unavailable',
        code: 'location_provider_unreachable',
        checkedAt: new Date().toISOString(),
      };
      throw new ServiceUnavailableException({
        code: 'location_provider_unreachable',
        message: 'Le service géographique ne répond pas pour le moment.',
        retryable: true,
      });
    }

    if (providerStatus < 200 || providerStatus >= 300 || !responseBody) {
      const providerMessage = text(
        responseBody?.error?.message || responseBody?.status || `HTTP ${providerStatus}`,
        180,
      );
      if (providerStatus === 403) {
        this.providerState = {
          status: 'blocked',
          code: 'location_provider_blocked',
          providerStatus,
          checkedAt: new Date().toISOString(),
        };
        throw new ServiceUnavailableException({
          code: 'location_provider_blocked',
          message: 'Google Places est configuré mais son API ou les restrictions de clé bloquent cette opération.',
          providerStatus,
          providerMessage,
          retryable: false,
        });
      }

      this.providerState = {
        status: 'unavailable',
        code: `google_${context}_failed`,
        providerStatus,
        checkedAt: new Date().toISOString(),
      };
      throw new ServiceUnavailableException({
        code: `google_${context}_failed`,
        message: 'La vérification géographique est momentanément indisponible.',
        providerStatus,
        providerMessage,
        retryable: providerStatus >= 500 || providerStatus === 429,
      });
    }

    this.providerState = {
      status: 'ready',
      code: `google_${context}_ready_ipv4`,
      providerStatus,
      checkedAt: new Date().toISOString(),
    };
    return responseBody;
  }

  async autocomplete(input: any, requesterKey: string) {
    this.consume(`autocomplete:${requesterKey}`, 40, 60_000);
    const key = this.requireProvider('places');
    const query = text(input?.input, 180);
    if (query.length < 3) {
      throw new BadRequestException('Saisissez au moins trois caractères.');
    }

    const countryCodes = Array.isArray(input?.countryCodes)
      ? input.countryCodes
          .map((value: unknown) => text(value, 2).toUpperCase())
          .filter((value: string) => /^[A-Z]{2}$/.test(value))
          .slice(0, 15)
      : [];
    const latitude = numeric(input?.latitude);
    const longitude = numeric(input?.longitude);
    const sessionToken = text(input?.sessionToken, 120) || randomUUID();

    const requestBody: Record<string, unknown> = {
      input: query,
      languageCode: 'fr',
      includeQueryPredictions: false,
      sessionToken,
    };

    if (countryCodes.length > 0) {
      requestBody.includedRegionCodes = countryCodes;
      requestBody.regionCode = countryCodes[0];
    }
    if (
      latitude !== null &&
      longitude !== null &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    ) {
      requestBody.locationBias = {
        circle: {
          center: { latitude, longitude },
          radius: 35_000,
        },
      };
    }

    const body = await this.googleJson(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': [
            'suggestions.placePrediction.placeId',
            'suggestions.placePrediction.text.text',
            'suggestions.placePrediction.structuredFormat.mainText.text',
            'suggestions.placePrediction.structuredFormat.secondaryText.text',
            'suggestions.placePrediction.types',
          ].join(','),
        },
        body: JSON.stringify(requestBody),
      },
      'autocomplete',
    );

    const suggestions = (Array.isArray(body.suggestions) ? body.suggestions : [])
      .map((entry: any) => entry?.placePrediction)
      .filter((entry: any) => entry?.placeId)
      .slice(0, 7)
      .map((prediction: any) => ({
        placeId: text(prediction.placeId, 180),
        fullText: text(prediction?.text?.text, 240),
        primaryText: text(
          prediction?.structuredFormat?.mainText?.text || prediction?.text?.text,
          140,
        ),
        secondaryText: text(
          prediction?.structuredFormat?.secondaryText?.text,
          180,
        ),
        types: Array.isArray(prediction?.types)
          ? prediction.types.map((value: unknown) => text(value, 60)).slice(0, 12)
          : [],
      }));

    return {
      ok: true,
      sessionToken,
      query,
      restrictedCountries: countryCodes,
      suggestions,
      source: 'google_places_new',
      notice: 'Une adresse doit être sélectionnée puis résolue avant utilisation.',
    };
  }

  async resolve(input: any, requesterKey: string) {
    this.consume(`resolve:${requesterKey}`, 24, 60_000);
    const key = this.requireProvider('places');
    const placeId = text(input?.placeId, 220);
    const sessionToken = text(input?.sessionToken, 120);
    if (!placeId || !/^[A-Za-z0-9_-]{8,}$/.test(placeId)) {
      throw new BadRequestException('Identifiant de lieu invalide.');
    }

    const query = new URLSearchParams({ languageCode: 'fr' });
    if (sessionToken) query.set('sessionToken', sessionToken);
    const body = await this.googleJson(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${query.toString()}`,
      {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': [
            'id',
            'formattedAddress',
            'addressComponents',
            'location',
            'types',
            'plusCode',
          ].join(','),
        },
      },
      'place_details',
    );

    const components: GoogleAddressComponent[] = Array.isArray(body.addressComponents)
      ? body.addressComponents
      : [];
    const countryComponent = component(components, 'country');
    const cityComponent = component(
      components,
      'locality',
      'postal_town',
      'administrative_area_level_2',
      'administrative_area_level_1',
    );
    const adminComponent = component(
      components,
      'administrative_area_level_1',
      'administrative_area_level_2',
    );
    const postalComponent = component(components, 'postal_code');
    const streetNumber = text(component(components, 'street_number')?.longText, 40);
    const route = text(component(components, 'route')?.longText, 140);
    const premise = text(
      component(components, 'premise', 'subpremise', 'establishment')?.longText,
      140,
    );
    const countryCode = text(countryComponent?.shortText, 2).toUpperCase();
    const country = text(countryComponent?.longText, 100);
    const city = text(cityComponent?.longText, 100);
    const adminArea = text(adminComponent?.longText, 100);
    const postalCode = text(postalComponent?.longText, 30);
    const latitude = numeric(body?.location?.latitude);
    const longitude = numeric(body?.location?.longitude);
    const formattedAddress = text(body?.formattedAddress, 260);
    const types = Array.isArray(body?.types)
      ? body.types.map((value: unknown) => text(value, 60))
      : [];
    const plusCode = text(body?.plusCode?.globalCode, 80);

    const hasCoordinates =
      latitude !== null &&
      longitude !== null &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180;
    const hasPremiseEvidence = Boolean(
      (streetNumber && route) || premise || plusCode || types.includes('street_address'),
    );
    const deliverable = Boolean(
      formattedAddress && countryCode && city && hasCoordinates && hasPremiseEvidence,
    );
    const precision = streetNumber && route
      ? 'street_number'
      : premise
        ? 'premise'
        : plusCode
          ? 'plus_code'
          : route
            ? 'street'
            : 'approximate';

    return {
      ok: true,
      status: deliverable ? 'confirmed' : 'review',
      address: {
        placeId: text(body?.id || placeId, 220),
        formattedAddress,
        latitude,
        longitude,
        precision,
        deliverable,
        evidence: 'google_places_new',
        resolvedAt: new Date().toISOString(),
      },
      territory: {
        key: `${countryCode.toLowerCase() || 'xx'}:${slug(city || adminArea)}`,
        countryCode,
        country,
        city,
        adminArea,
        postalCode,
        launchTarget: TARGET_COUNTRIES.has(countryCode),
      },
      message: deliverable
        ? 'Adresse réelle confirmée et géolocalisée.'
        : 'Sélectionnez une adresse plus précise, un bâtiment ou un Plus Code.',
      notice:
        'La confirmation de lieu n’équivaut pas encore à une garantie de desserte commerciale.',
    };
  }

  async context(input: any, requesterKey: string) {
    this.consume(`context:${requesterKey}`, 12, 60_000);
    const latitude = numeric(input?.latitude);
    const longitude = numeric(input?.longitude);
    if (
      latitude === null ||
      longitude === null ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      throw new BadRequestException('Coordonnées invalides.');
    }

    const normalizeComponents = (raw: any): GoogleAddressComponent[] => {
      const items = Array.isArray(raw) ? raw : [];
      return items.map((item: any) => ({
        longText: item?.longText ?? item?.long_name,
        shortText: item?.shortText ?? item?.short_name,
        types: Array.isArray(item?.types) ? item.types : [],
      }));
    };

    const territoryFromComponents = (components: GoogleAddressComponent[]) => {
      const countryComponent = component(components, 'country');
      const cityComponent = component(
        components,
        'locality',
        'postal_town',
        'administrative_area_level_2',
        'administrative_area_level_1',
      );
      const adminComponent = component(
        components,
        'administrative_area_level_1',
        'administrative_area_level_2',
      );
      const countryCode = text(countryComponent?.shortText, 2).toUpperCase();
      const country = text(countryComponent?.longText, 100);
      const city = text(cityComponent?.longText, 100);
      const adminArea = text(adminComponent?.longText, 100);
      return {
        key: `${countryCode.toLowerCase() || 'xx'}:${slug(city || adminArea)}`,
        countryCode,
        country,
        city: city || adminArea,
        adminArea,
        launchTarget: TARGET_COUNTRIES.has(countryCode),
      };
    };

    const validTerritory = (territory: any) => Boolean(
      text(territory?.countryCode, 2) &&
      (text(territory?.city, 100) || text(territory?.adminArea, 100)),
    );

    const responseFromResolved = (resolved: any, source: string) => {
      if (!validTerritory(resolved?.territory)) return null;
      return {
        ok: true,
        detected: true,
        coordinates: { latitude, longitude },
        territory: {
          key: text(resolved.territory.key, 180),
          countryCode: text(resolved.territory.countryCode, 2).toUpperCase(),
          country: text(resolved.territory.country, 100),
          city: text(resolved.territory.city, 100),
          adminArea: text(resolved.territory.adminArea, 100),
          launchTarget: Boolean(resolved.territory.launchTarget),
        },
        formattedAddress: text(resolved?.address?.formattedAddress, 260),
        source,
        notice:
          'Le territoire détecté sert à proposer des choix locaux. Il peut être changé pour livrer un proche ailleurs.',
      };
    };

    const resolvePlaceId = async (placeIdValue: unknown, source: string) => {
      const placeId = text(placeIdValue, 220);
      if (!placeId || !/^[A-Za-z0-9_-]{8,}$/.test(placeId)) return null;
      try {
        const resolved = await this.resolve(
          { placeId },
          `${requesterKey}:territory-fallback`,
        );
        return responseFromResolved(resolved, source);
      } catch {
        return null;
      }
    };

    let failureCode = '';

    try {
      const geocodingKey = this.requireProvider('geocoding');
      const query = new URLSearchParams({
        latlng: `${latitude},${longitude}`,
        key: geocodingKey,
        language: 'fr',
        result_type: 'street_address|premise|route|locality|administrative_area_level_1',
      });
      const body = await this.googleJson(
        `https://maps.googleapis.com/maps/api/geocode/json?${query.toString()}`,
        { method: 'GET' },
        'reverse_geocoding',
      );
      const providerStatus = text(body?.status, 40).toUpperCase();
      const results = Array.isArray(body?.results) ? body.results : [];

      if (!providerStatus || providerStatus === 'OK') {
        for (const result of results) {
          const components = normalizeComponents(
            result?.address_components ?? result?.addressComponents,
          );
          const territory = territoryFromComponents(components);
          if (validTerritory(territory)) {
            return {
              ok: true,
              detected: true,
              coordinates: { latitude, longitude },
              territory,
              formattedAddress: text(
                result?.formatted_address ?? result?.formattedAddress,
                260,
              ),
              source: 'google_geocoding',
              notice:
                'Le territoire détecté sert à proposer des choix locaux. Il peut être changé pour livrer un proche ailleurs.',
            };
          }
        }

        for (const result of results) {
          const viaPlace = await resolvePlaceId(
            result?.place_id ?? result?.placeId,
            'google_geocoding_place_details_fallback',
          );
          if (viaPlace) return viaPlace;
        }
      } else {
        failureCode = `google_geocoding_${providerStatus.toLowerCase()}`;
      }
    } catch (error: any) {
      failureCode = text(
        error?.response?.code || error?.code || 'google_geocoding_unavailable',
        100,
      );
    }

    try {
      const placesKey = this.requireProvider('places');
      const nearby = await this.googleJson(
        'https://places.googleapis.com/v1/places:searchNearby',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-Goog-Api-Key': placesKey,
            'X-Goog-FieldMask': [
              'places.id',
              'places.formattedAddress',
              'places.addressComponents',
              'places.location',
              'places.types',
            ].join(','),
          },
          body: JSON.stringify({
            maxResultCount: 10,
            rankPreference: 'DISTANCE',
            locationRestriction: {
              circle: {
                center: { latitude, longitude },
                radius: 5_000,
              },
            },
          }),
        },
        'nearby_territory',
      );

      const places = Array.isArray(nearby?.places) ? nearby.places : [];
      for (const place of places) {
        const viaPlace = await resolvePlaceId(
          place?.id,
          'google_places_nearby_fallback',
        );
        if (viaPlace) return viaPlace;

        const territory = territoryFromComponents(
          normalizeComponents(place?.addressComponents),
        );
        if (validTerritory(territory)) {
          return {
            ok: true,
            detected: true,
            coordinates: { latitude, longitude },
            territory,
            formattedAddress: text(place?.formattedAddress, 260),
            source: 'google_places_nearby_fallback',
            notice:
              'Le territoire détecté sert à proposer des choix locaux. Il peut être changé pour livrer un proche ailleurs.',
          };
        }
      }
    } catch (error: any) {
      if (!failureCode) {
        failureCode = text(
          error?.response?.code || error?.code || 'google_places_nearby_unavailable',
          100,
        );
      }
    }

    return {
      ok: true,
      detected: false,
      coordinates: { latitude, longitude },
      territory: {
        key: 'xx:unknown',
        countryCode: '',
        country: '',
        city: '',
        adminArea: '',
        launchTarget: false,
      },
      formattedAddress: '',
      source: failureCode || 'territory_unresolved',
      notice:
        'Le territoire n’a pas pu être confirmé par les fournisseurs serveur. Réessayez sans modifier le profil.',
    };
  }
}
