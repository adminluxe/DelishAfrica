import { Controller, Post, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MenuImportService } from './menu-import.service';

@Controller('menu-import')
export class MenuImportController {
  constructor(private readonly service: MenuImportService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async importMenu(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Champ fichier manquant. Utilisez field name "file".');
    return this.service.importCsv(file.buffer);
  }
}
