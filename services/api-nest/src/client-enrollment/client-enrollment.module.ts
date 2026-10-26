import { Module } from '@nestjs/common';
import { IdentityProofModule } from '../identity-proof/identity-proof.module';
import { ClientEnrollmentController } from './client-enrollment.controller';
import { ClientEnrollmentService } from './client-enrollment.service';
import { ClientEnrollmentKeycloak } from './client-enrollment.keycloak';
import { ClientEnrollmentRepository } from './client-enrollment.repository';

@Module({
  imports: [IdentityProofModule],
  controllers: [ClientEnrollmentController],
  providers: [
    ClientEnrollmentService,
    ClientEnrollmentKeycloak,
    ClientEnrollmentRepository,
  ],
})
export class ClientEnrollmentModule {}
