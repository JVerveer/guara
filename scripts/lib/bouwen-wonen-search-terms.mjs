export const BOUWEN_WONEN_DOMAIN_SYNONYMS = [
  ["bouwen en wonen", "housing building construction wonen bouwen"],
  ["woningvoorraad", "housing stock dwellings homes voorraad woningen"],
  ["nieuwbouw", "new construction newly built dwellings building completions"],
  ["bouwvergunning", "building permit construction permit omgevingsvergunning vergunningen"],
  ["huizenprijs", "house price housing price woningprijs koopprijs"],
  ["woningwaarde", "house value property value vastgoed waarde"],
  ["huur", "rent rental huurwoning huurprijs"],
  ["koopwoning", "owner occupied home koopwoningen eigendom"],
  ["leegstand", "vacancy empty dwellings vacant homes"],
  ["verhuizing", "moves migration residential mobility"],
  ["woonoppervlak", "living area floor area oppervlakte"],
  ["woningtype", "dwelling type apartment terraced detached housing type"],
  ["energielabel", "energy label housing sustainability"],
  ["gemeentelijke woningbouw", "municipal housing construction municipality homes"],
];

export function bouwenWonenMeasureSynonyms(row) {
  const text = `${row.measure_code ?? ""} ${row.measure_name ?? ""} ${row.measure_description ?? ""}`.toLowerCase();
  const synonyms = new Set([row.measure_code, row.measure_name]);

  for (const [phrase, expansion] of BOUWEN_WONEN_DOMAIN_SYNONYMS) {
    const parts = [phrase, ...expansion.split(/\s+/)];
    if (parts.some((part) => part && text.includes(part.toLowerCase()))) {
      synonyms.add(phrase);
      synonyms.add(expansion);
    }
  }

  if (/voorraad|stock|woning/.test(text)) synonyms.add("housing stock woningen woningvoorraad");
  if (/nieuwbouw|gebouwd|oplever/.test(text)) synonyms.add("newly built dwellings nieuwbouw woningen");
  if (/prijs|waarde|woz|koop/.test(text)) synonyms.add("house prices property value huizenprijzen woningwaarde");
  if (/huur|rental/.test(text)) synonyms.add("rent rental housing huur huurwoningen");
  if (/vergunning|permit/.test(text)) synonyms.add("building permits bouwvergunningen");
  if (/oppervlak|surface|area/.test(text)) synonyms.add("floor area woonoppervlak oppervlakte");

  return [...synonyms].filter(Boolean);
}

export function bouwenWonenDatasetSynonyms(row) {
  const text = `${row.dataset_code ?? ""} ${row.dataset_title ?? row.title ?? ""} ${row.dataset_description ?? row.short_description ?? ""}`.toLowerCase();
  const synonyms = new Set([row.dataset_code, row.dataset_title, row.title, "Bouwen en wonen"]);

  for (const [phrase, expansion] of BOUWEN_WONEN_DOMAIN_SYNONYMS) {
    if (text.includes(phrase) || expansion.split(/\s+/).some((part) => part && text.includes(part))) {
      synonyms.add(phrase);
      synonyms.add(expansion);
    }
  }

  return [...synonyms].filter(Boolean);
}
