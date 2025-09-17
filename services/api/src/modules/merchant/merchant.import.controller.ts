import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { MerchantService } from "./merchant.service";
import csv from "csv-parser";
import { Readable } from "stream";
import multer from "multer";

@Controller("merchants")
export class MerchantImportController {
  constructor(private readonly merchantService: MerchantService) {}

  @Post("import-menu")
  @UseInterceptors(FileInterceptor("file", {
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
  }))
  async importMenu(@UploadedFile() file: Express.Multer.File) {
    try {
      if (!file) throw new BadRequestException("Aucun fichier reçu (champ 'file').");
      const rows: Record<string, string>[] = [];
      const stream = Readable.from(file.buffer);
      await new Promise<void>((resolve, reject) => {
        stream
          .pipe(csv({ separator: ",", mapHeaders: ({ header }) => String(header).trim() }))
          .on("data", (d) => rows.push(d))
          .on("error", (e) => reject(e))
          .on("end", () => resolve());
      });
      const items = await this.merchantService.createMenuItemsFromCSV(rows);
      return { count: items.length, items };
    } catch (e: any) {
      console.error("CSV import error:", e?.message || e, e?.stack);
      throw e;
    }
  }
}
