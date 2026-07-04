import { Body, Controller, Post } from '@nestjs/common';
import { AssignmentIntelligenceService } from './assignment-intelligence.service';
import { AssignmentAcceptInput, AssignmentPreviewInput, AssignmentProposeInput } from './assignment-intelligence.types';

@Controller('dispatch/assignment')
export class AssignmentIntelligenceController {
constructor(private readonly assignmentIntelligence: AssignmentIntelligenceService) {}

@Post('preview')
preview(@Body() body: AssignmentPreviewInput = {}) {
return this.assignmentIntelligence.preview(body || {});
}




@Post('accept')
accept(@Body() body: AssignmentAcceptInput = {}) {
return this.assignmentIntelligence.accept(body);
}

@Post('propose')
propose(@Body() body: AssignmentProposeInput = {}) {
return this.assignmentIntelligence.propose(body || {});
}
}
