import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: unknown[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const body = exceptionResponse as Record<string, unknown>;
        message = (body.message as string) ?? message;
        // class-validator returns an array of messages for 400 errors
        if (Array.isArray(body.message)) {
          details = body.message as unknown[];
          message = 'Validation failed';
        }
        code = (body.error as string) ?? code;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Map HTTP status to error code if not already set
    const statusCodeMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      503: 'SERVICE_UNAVAILABLE',
    };

    if (code === 'INTERNAL_ERROR' || code === 'Bad Request' || code === 'Not Found') {
      code = statusCodeMap[status] ?? 'INTERNAL_ERROR';
    }

    response.status(status).json({
      data: null,
      error: {
        message,
        code,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
        path: request.url,
      },
    });
  }
}
