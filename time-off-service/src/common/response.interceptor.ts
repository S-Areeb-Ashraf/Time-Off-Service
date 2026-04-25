import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

export interface ResponseEnvelope<T> {
  data: T;
  error: null;
  meta: {
    timestamp: string;
    requestId: string;
  };
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ResponseEnvelope<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseEnvelope<T>> {
    const requestId = uuidv4();
    return next.handle().pipe(
      map((data) => ({
        data,
        error: null,
        meta: {
          timestamp: new Date().toISOString(),
          requestId,
        },
      })),
    );
  }
}
