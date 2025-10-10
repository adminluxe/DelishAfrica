import {
  Controller, Post, UploadedFile, UseInterceptors, Param, Body, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { MerchantImportService } from './merchant.import.service';

@ApiTags('merchants')
@Controller('merchants')
export class MerchantImportController {
  constructor(private readonly svc: MerchantImportService) {}

  @Post('import-menu')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        merchantId: { type: 'string', nullable: true },
      },
      required: ['file'],
    },
  })
  async importWithHeader(@UploadedFile() file: Express.Multer.File, @Body('merchantId') merchantId?: string) {
    if (!file) throw new BadRequestException('Missing file');
    return this.svc.importCsv(file.buffer, merchantId);
  }

  @Post(':merchantId/import-menu')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  async importForMerchant(@Param('merchantId') merchantId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Missing file');
    return this.svc.importCsv(file.buffer, merchantId);
  }
}
