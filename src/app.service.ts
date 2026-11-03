import { Injectable, Logger } from "@nestjs/common";
import { InjectDrizzle } from "@nestjs/drizzle";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    @InjectDrizzle()
    private readonly db: NodePgDatabase,
  ) {}

  async health() {
    this.logger.debug("Starts a app service");

    const beforeQuery = Date.now();

    await this.db.execute(sql`select 1`);

    const afterQuery = Date.now();

    const latency = afterQuery - beforeQuery;

    this.logger.debug("Ends a app service");

    return latency;
  }
}
