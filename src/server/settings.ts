import { prisma, type Tx } from "@/lib/db";
import { mergeRules, type Rules } from "@/lib/rules";

export async function getRules(tx: Tx = prisma): Promise<Rules> {
  const row = await tx.setting.findUnique({ where: { key: "rules" } });
  return mergeRules(row?.value);
}

export async function saveRules(rules: Rules) {
  await prisma.setting.upsert({
    where: { key: "rules" },
    create: { key: "rules", value: rules },
    update: { value: rules },
  });
}
