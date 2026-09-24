export type DianOutcome = 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'ERROR';

export interface ParsedDianResponse { outcome: DianOutcome; statusCode?: string | undefined; message: string; trackId?: string | undefined; errors: string[]; raw: string; }

export class DianResponseParser {
  parse(xml: string): ParsedDianResponse {
    const read = (name: string) => xml.match(new RegExp(`<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${name}>`, 'i'))?.[1]?.replace(/<[^>]+>/g, '').trim();
    const fault = read('Fault') || read('Reason');
    const statusCode = read('StatusCode');
    const message = read('StatusDescription') || read('StatusMessage') || read('Text') || fault || 'Respuesta DIAN sin descripción';
    const errors = [...xml.matchAll(/<(?:\w+:)?string[^>]*>([\s\S]*?)<\/(?:\w+:)?string>/gi)].map((m) => m[1]!.replace(/<[^>]+>/g, '').trim());
    const outcome: DianOutcome = fault ? 'ERROR' : statusCode === '00' ? 'ACCEPTED' : statusCode === '66' || statusCode === '90' ? 'PENDING' : statusCode ? 'REJECTED' : 'ERROR';
    return { outcome, statusCode, message, trackId: read('ZipKey') || read('DocumentKey'), errors, raw: xml };
  }
}
