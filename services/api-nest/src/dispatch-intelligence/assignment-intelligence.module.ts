import { Module } from '@nestjs/common';
import { AssignmentIntelligenceController } from './assignment-intelligence.controller';
import { AssignmentIntelligenceService } from './assignment-intelligence.service';

@Module({
controllers: [AssignmentIntelligenceController],
providers: [AssignmentIntelligenceService],
exports: [AssignmentIntelligenceService],
})
export class AssignmentIntelligenceModule {}
