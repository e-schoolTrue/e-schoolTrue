/**
 * Backfill références paiements profs → PAY-ENS-YYYY-XXXX.
 * Usage: npx tsx electron/tools/backfill-professor-refs.ts
 * Logique: délègue à accountingService.backfillProfessorReferences()
 * (SERIALIZABLE, compteur ProfessorPaymentCounter, preuve archivée en commentaire).
 * Idempotent : ne touche que les références NULL/vides/non PAY-ENS-%.
 */
import { AppDataSource } from "../data-source";
import { accountingService } from "../backend/services/accountingService";

async function main() {
  await AppDataSource.initialize(false);
  const r: any = await accountingService.backfillProfessorReferences();
  // eslint-disable-next-line no-console
  console.log(r.success ? `OK: ${r.message}` : `KO: ${r.message} (${r.error})`, r.data ?? "");
  process.exit(r.success ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
