/**
 * Egypt's 27 governorates, named in both languages, keyed by the code the API
 * emits.
 *
 * NOT in the message catalogue, and deliberately. A governorate is a fact
 * about the country rather than copy about the product: the same 27 names
 * appear in every console, nobody rewrites them per screen, and the catalogue
 * is where a product decides how to say something. The status maps in
 * `status-pill.tsx` are here for the same reason and set the precedent.
 *
 * The English column is byte-identical to `properties.name` in
 * `egypt-governorates.json` and to the `en` column of the API's own
 * `common/geo/governorates.ts`. A tidier spelling on any of the three
 * uncolours a governorate and reports nothing where there were orders,
 * silently.
 */
import type { Locale } from "@/lib/locale";

export const GOVERNORATE_NAMES: Readonly<
  Record<string, { en: string; ar: string }>
> = {
  ALX: { en: "Alexandria", ar: "الإسكندرية" },
  ASN: { en: "Aswan", ar: "أسوان" },
  AST: { en: "Asyut", ar: "أسيوط" },
  BEH: { en: "Beheira", ar: "البحيرة" },
  BNS: { en: "Beni Suef", ar: "بني سويف" },
  CAI: { en: "Cairo", ar: "القاهرة" },
  DAK: { en: "Dakahlia", ar: "الدقهلية" },
  DAM: { en: "Damietta", ar: "دمياط" },
  FYM: { en: "Faiyum", ar: "الفيوم" },
  GHR: { en: "Gharbiyya", ar: "الغربية" },
  GIZ: { en: "Giza", ar: "الجيزة" },
  ISM: { en: "Ismailia", ar: "الإسماعيلية" },
  KFS: { en: "Kafr el-Sheikh", ar: "كفر الشيخ" },
  LUX: { en: "Luxor", ar: "الأقصر" },
  MAT: { en: "Matrouh", ar: "مطروح" },
  MIN: { en: "Minya", ar: "المنيا" },
  MNF: { en: "Monufia", ar: "المنوفية" },
  NSI: { en: "North Sinai", ar: "شمال سيناء" },
  PTS: { en: "Port Said", ar: "بورسعيد" },
  QAL: { en: "Qalyubia", ar: "القليوبية" },
  QEN: { en: "Qena", ar: "قنا" },
  RED: { en: "Red Sea", ar: "البحر الأحمر" },
  SHG: { en: "Sohag", ar: "سوهاج" },
  SHR: { en: "Al Sharqia", ar: "الشرقية" },
  SSI: { en: "South Sinai", ar: "جنوب سيناء" },
  SUZ: { en: "Suez", ar: "السويس" },
  WAD: { en: "New Valley", ar: "الوادي الجديد" },
};

/**
 * The code itself when it is unknown — never a blank label. A code shipped by
 * a backend this build has not caught up with is still readable, and it is
 * obvious which one needs adding.
 */
export const governorateName = (code: string, locale: Locale): string =>
  GOVERNORATE_NAMES[code]?.[locale] ?? code;
