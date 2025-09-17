import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MerchantService } from '../services/merchant.service';
import * as csvParser from 'csv-parser';
import { Readable } from 'stream';

/**
 * Controller providing an endpoint to import menu items from a CSV file.
 *
 * This endpoint accepts multipart/form‑data with a single file field named `file`.
 * It parses the CSV into JSON objects and delegates creation/update of menu
 * items to the MerchantService. Rows that cannot be processed will throw
 * an exception causing an HTTP 400 response.
 */
@Controller('merchants')
export class MerchantImportController {
  constructor(private readonly merchantService: MerchantService) {}

  /**
   * Import a CSV file of menu items. The CSV must include headers matching the
   * `CreateMenuItemDto` fields (e.g. name, description, price, categoryId, imageUrl).
   * Example usage with cURL:
   *   curl -F "file=@menu.csv" http://localhost:4000/merchants/import-menu
   */
  @Post('import-menu')
  @UseInterceptors(FileInterceptor('file'))
  async importMenu(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const records: Record<string, string>[] = [];
    // Convert the buffer to a readable stream for csv-parser
    const stream = Readable.from(file.buffer);
    return new Promise<{ count: number; items: any[] }>((resolve, reject) => {
      stream
        .pipe(
          csvParser({
            separator: ',',
            strict: true,
            mapHeaders: ({ header }) => header.trim(),
          }),
        )
        .on('data', (data) => {
          records.push(data);
        })
        .on('error', (err: Error) => {
          reject(new BadRequestException(`Failed to parse CSV: ${err.message}`));
        })
        .on('end', async () => {
          try {
            const items = await this.merchantService.createMenuItemsFromCSV(records);
            resolve({ count: items.length, items });
          } catch (err) {
            reject(err);
          }
        });
    });
  }
}