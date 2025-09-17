#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"; cd "$ROOT"

# --- PrismaExceptionFilter: ajoute P2003 (FK) ---
FILTER=backend/src/common/prisma-exception.filter.ts
if [[ -f "$FILTER" ]]; then
  if ! grep -q "case 'P2003'" "$FILTER"; then
    awk '
    /switch \(exception.code\) {/ && !done {
      print; 
      print "      case '\''P2003'\'':";
      print "        status = HttpStatus.BAD_REQUEST;";
      print "        message = `Foreign key violation: ${exception.meta?.field_name ?? \"unknown FK\"}`;";
      print "        break;";
      done=1; next
    }1' "$FILTER" > /tmp/filter.ts && mv /tmp/filter.ts "$FILTER"
  fi
fi

# --- Users module (list + filter par email) ---
mkdir -p backend/src/users

cat > backend/src/users/users.service.ts <<'TS'
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto, toSkipTake } from '../common/pagination.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(q: PaginationQueryDto, email?: string) {
    const { skip, take } = toSkipTake(q);
    const where = email ? { email: { equals: email, mode: 'insensitive' as const } } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, skip, take, orderBy: { email: 'asc' } }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: Math.floor(skip / take) + 1, pageSize: take };
  }
}
TS

cat > backend/src/users/users.controller.ts <<'TS'
import { Controller, Get, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { PaginationQueryDto } from '../common/pagination.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}
  @Get()
  list(@Query() q: PaginationQueryDto, @Query('email') email?: string) {
    return this.service.findAll(q, email);
  }
}
TS

cat > backend/src/users/users.module.ts <<'TS'
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
TS

# --- AppModule imports UsersModule une seule fois ---
APP="backend/src/app.module.ts"
if [[ -f "$APP" ]]; then
  grep -q "from './users/users.module'" "$APP" || sed -i "1i import { UsersModule } from './users/users.module';" "$APP"
  if grep -q "imports:\\s*\\[" "$APP"; then
    sed -i '0,/imports:\s*\[/s//imports: [UsersModule, /' "$APP"
  else
    sed -i "/@Module({/a \  imports: [UsersModule]," "$APP"
  fi
else
  echo "⚠ backend/src/app.module.ts introuvable — ajoute UsersModule manuellement."
fi

echo "✓ UsersModule câblé (+ filtre Prisma P2003). Endpoint: GET /users?email=..."
