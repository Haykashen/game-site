import type {Prisma} from '@prisma/client';
export function regionCode(value:string): string {
 const code=value.trim().toUpperCase();
 return ({'':'EUR','НЕ УКАЗАНО':'EUR','НЕ УКАЗАН':'EUR','НЕИЗВЕСТНО':'EUR','UNKNOWN':'EUR','N/A':'EUR','-':'EUR','PAL':'EUR','EU':'EUR','EUROPE':'EUR','ЕВРОПА':'EUR','NTSC-J':'JPN','JP':'JPN','JAPAN':'JPN','NTSC-U':'USA','NTSC-U/C':'USA','US':'USA','RU':'RUS'} as Record<string,string>)[code]??code;
}
export async function resolveRegion(tx:Prisma.TransactionClient,value:string) {
 const code=regionCode(value);
 return (await tx.region.findFirst({where:{OR:[{code:{equals:code,mode:'insensitive'}},{name:{equals:value.trim(),mode:'insensitive'}}]}})) ?? tx.region.findUniqueOrThrow({where:{code:'EUR'}});
}