import { Controller, Get, Param, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

@Controller("merchants")
export class MerchantReadController {
  @Get(":id/menu")
  async getMenu(@Param("id") id: string) {
    const merchant = await prisma.merchant.findUnique({ where: { id } });
    if (!merchant) throw new NotFoundException(`Merchant ${id} introuvable`);
    const items = await prisma.menuItem.findMany({
      where: { merchantId: id },
      orderBy: { name: "asc" }
    });
    return { merchant: { id: merchant.id, name: merchant.name }, items };
  }
}
