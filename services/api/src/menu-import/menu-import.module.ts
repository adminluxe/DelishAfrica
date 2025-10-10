import { Module } from '@nestjs/common';
import { MenuImportController } from './menu-import.controller';
import { MenuImportService } from './menu-import.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [MenuImportController],
  providers: [MenuImportService, PrismaService],
})
export class MenuImportModule {}
