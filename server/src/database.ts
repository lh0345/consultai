import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class Database extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = new URL(process.env.DATABASE_URL!);
    const schema = url.searchParams.get('schema') || 'public';
    super({ adapter: new PrismaPg({ connectionString: url.toString(), connectionTimeoutMillis: 5000 }, { schema }) });
  }
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
