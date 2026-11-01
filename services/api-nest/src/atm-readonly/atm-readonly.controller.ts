import {
  Controller, Get, Header, Headers, HttpException,
} from '@nestjs/common';
import { AtmReadonlyService, ReadDenied } from './atm-readonly.service';

@Controller()
export class AtmReadonlyController {
  constructor(private readonly service: AtmReadonlyService) {}
  private async query(area: 'finance' | 'inventory' | 'suppliers',
    authorization: string | undefined, slug?: string) {
    try {
      return await this.service.read(area, authorization, slug);
    } catch (error) {
      if (error instanceof ReadDenied) {
        throw new HttpException({ok: false, code: error.code}, error.status);
      }
      throw new HttpException({ok: false, code: 'trusted_read_unavailable'}, 503);
    }
  }

  @Get('integrations/orchidpay/read-model/me')
  @Header('Cache-Control','private, no-store, max-age=0')
  @Header('Pragma','no-cache')
  finance(@Headers('authorization') authorization?: string,
          @Headers('x-da-partner-slug') slug?: string) {
    return this.query('finance', authorization, slug);
  }

  @Get('merchant/inventory/me')
  @Header('Cache-Control','private, no-store, max-age=0')
  @Header('Pragma','no-cache')
  inventory(@Headers('authorization') authorization?: string,
            @Headers('x-da-partner-slug') slug?: string) {
    return this.query('inventory', authorization, slug);
  }

  @Get('merchant/suppliers/me')
  @Header('Cache-Control','private, no-store, max-age=0')
  @Header('Pragma','no-cache')
  suppliers(@Headers('authorization') authorization?: string,
            @Headers('x-da-partner-slug') slug?: string) {
    return this.query('suppliers', authorization, slug);
  }
}
