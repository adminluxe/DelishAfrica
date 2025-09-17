import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    let status = HttpStatus.BAD_REQUEST;
    let message = exception.message;

    switch (exception.code) {
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = `Foreign key violation: ${exception.meta?.field_name ?? "unknown FK"}`;
        break;
      case 'P2002':
        status = HttpStatus.CONFLICT;
        message = `Unique constraint failed on: ${exception.meta?.target ?? 'unknown'}`;
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found';
        break;
      default:
        status = HttpStatus.BAD_REQUEST;
        break;
    }

    res.status(status).json({
      statusCode: status,
      message,
      code: exception.code,
      path: req?.url,
    });
  }
}
