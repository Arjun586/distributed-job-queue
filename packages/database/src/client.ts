import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });


export const prisma = new PrismaClient({ adapter });

export async function connectDatabase() {
    await prisma.$connect();
    console.log("Postgres connected");
}