import { Module } from '@nestjs/common';
import { RoutesPreviewController } from './routes-preview.controller';
import { RoutesPreviewService } from './routes-preview.service';

@Module({
controllers: [RoutesPreviewController],
providers: [RoutesPreviewService],
exports: [RoutesPreviewService],
})
export class RoutesPreviewModule {}
