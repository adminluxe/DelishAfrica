import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoutesPreviewController } from './routes-preview.controller';
import { MissionRoutesController } from './mission-routes.controller';
import { RoutesPreviewService } from './routes-preview.service';

@Module({ imports: [AuthModule], controllers: [RoutesPreviewController, MissionRoutesController], providers: [RoutesPreviewService], exports: [RoutesPreviewService] })
export class RoutesPreviewModule {}
