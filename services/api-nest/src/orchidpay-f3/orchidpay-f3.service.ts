import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { request as httpRequest } from 'node:http';

export type OrchidpayF3VerifyInput = {
  requestId: string;
  nonce: string;
  evidenceRef: string;
};

export type OrchidpayF3VerifyResult = {
  ok: true;
  assertion: unknown;
};

const SOCKET_PATH = '/app/.runtime/orchidpay-f3.sock';
const MAX_BODY_BYTES = 16_384;
const MAX_ASSERTION_JSON_BYTES = 8_192;
const TIMEOUT_MS = 3_000;

const validText = (value: unknown, min: number, max: number): value is string =>
  typeof value === 'string' && value.length >= min && value.length <= max;

function validateInput(input: OrchidpayF3VerifyInput): void {
  if (!input || typeof input !== 'object') {
    throw new BadRequestException({ code: 'orchidpay_f3_invalid_input' });
  }
  const keys = Object.keys(input).sort();
  if (keys.join(',') !== 'evidenceRef,nonce,requestId') {
    throw new BadRequestException({ code: 'orchidpay_f3_invalid_shape' });
  }
  if (!validText(input.requestId, 8, 128)) {
    throw new BadRequestException({ code: 'orchidpay_f3_request_id_invalid' });
  }
  if (!validText(input.nonce, 32, 1024)) {
    throw new BadRequestException({ code: 'orchidpay_f3_nonce_invalid' });
  }
  if (!validText(input.evidenceRef, 8, 1024)) {
    throw new BadRequestException({ code: 'orchidpay_f3_evidence_ref_invalid' });
  }
}

@Injectable()
export class OrchidpayF3Service {
  async health(): Promise<{ ok: true }> {
    return await new Promise<{ ok: true }>((resolve, reject) => {
      const req = httpRequest(
        {
          socketPath: SOCKET_PATH,
          path: '/healthz',
          method: 'GET',
          timeout: 1_500,
        },
        (res) => {
          const chunks: Buffer[] = [];
          let total = 0;

          res.on('data', (chunk: Buffer) => {
            total += chunk.length;
            if (total > 2_048) {
              req.destroy(new Error('orchidpay_f3_health_response_too_large'));
              return;
            }
            chunks.push(Buffer.from(chunk));
          });

          res.on('end', () => {
            try {
              const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              if (res.statusCode === 200 && parsed?.ok === true) {
                resolve({ ok: true });
                return;
              }
            } catch {}

            reject(
              new ServiceUnavailableException({
                code: 'orchidpay_f3_health_unavailable',
              }),
            );
          });
        },
      );

      req.on('timeout', () => req.destroy(new Error('orchidpay_f3_health_timeout')));
      req.on('error', () =>
        reject(
          new ServiceUnavailableException({
            code: 'orchidpay_f3_health_unavailable',
          }),
        ),
      );
      req.end();
    });
  }

  async verify(input: OrchidpayF3VerifyInput): Promise<OrchidpayF3VerifyResult> {
    validateInput(input);

    const payload = Buffer.from(JSON.stringify(input), 'utf8');
    if (payload.length > MAX_BODY_BYTES) {
      throw new BadRequestException({ code: 'orchidpay_f3_payload_too_large' });
    }

    return await new Promise<OrchidpayF3VerifyResult>((resolve, reject) => {
      const req = httpRequest(
        {
          socketPath: SOCKET_PATH,
          path: '/internal/f3/verify',
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'content-length': String(payload.length),
          },
          timeout: TIMEOUT_MS,
        },
        (res) => {
          const chunks: Buffer[] = [];
          let total = 0;

          res.on('data', (chunk: Buffer) => {
            total += chunk.length;
            if (total > MAX_BODY_BYTES) {
              req.destroy(new Error('orchidpay_f3_response_too_large'));
              return;
            }
            chunks.push(Buffer.from(chunk));
          });

          res.on('end', () => {
            let parsed: any;
            try {
              parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            } catch {
              reject(new ServiceUnavailableException({ code: 'orchidpay_f3_invalid_json' }));
              return;
            }

            if (res.statusCode !== 200 || parsed?.ok !== true || !Object.prototype.hasOwnProperty.call(parsed, 'assertion')) {
              reject(new ServiceUnavailableException({ code: 'orchidpay_f3_rejected' }));
              return;
            }

            let assertionBytes = 0;
            try {
              assertionBytes = Buffer.byteLength(JSON.stringify(parsed.assertion), 'utf8');
            } catch {
              reject(new ServiceUnavailableException({ code: 'orchidpay_f3_assertion_invalid' }));
              return;
            }

            if (assertionBytes < 1 || assertionBytes > MAX_ASSERTION_JSON_BYTES) {
              reject(new ServiceUnavailableException({ code: 'orchidpay_f3_assertion_invalid' }));
              return;
            }

            resolve({ ok: true, assertion: parsed.assertion });
          });
        },
      );

      req.on('timeout', () => req.destroy(new Error('orchidpay_f3_timeout')));
      req.on('error', () => reject(new ServiceUnavailableException({ code: 'orchidpay_f3_unavailable' })));
      req.end(payload);
    });
  }
}
