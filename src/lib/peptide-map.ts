const SLUG_TO_TAGS: Record<string, string[]> = {
  "bpc-157": ["bpc-157"],
  "body-protective-compound-157": ["bpc-157"],
  "tb-500": ["tb-500"],
  "thymosin-beta-4": ["tb-500"],
  "epitalon": ["epitalon"],
  "epithalon": ["epitalon"],
  "ipamorelin": ["ipamorelin"],
  "cjc-1295": ["cjc-1295"],
  "tesamorelin": ["tesamorelin"],
  "semax": ["semax"],
  "selank": ["selank"],
  "ghk-cu": ["ghk-cu"],
  "copper-peptide": ["ghk-cu"],
  "mots-c": ["mots-c"],
  "ss-31": ["ss-31"],
  "elamipretide": ["ss-31"],
  "hexarelin": ["hexarelin"],
  "retatrutide": ["retatrutide"],
  "tirzepatide": ["tirzepatide"],
  "aod-9604": ["aod-9604"],
  "pt-141": ["pt-141"],
  "bremelanotide": ["pt-141"],
  "melanotan-2": ["melanotan-2"],
  "kpv": ["kpv"],
};

export function slugToPeptideTags(slug: string): string[] {
  return SLUG_TO_TAGS[slug.toLowerCase()] ?? [];
}
