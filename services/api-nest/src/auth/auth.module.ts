import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ExternalJwksVerifierService } from './external-jwks-verifier.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, ExternalJwksVerifierService],
  exports: [AuthService, ExternalJwksVerifierService],
})
export class AuthModule {}
