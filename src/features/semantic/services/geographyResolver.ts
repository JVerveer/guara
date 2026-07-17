import { normalizeSemanticText, uniqueStrings } from "./semanticUtils";

export interface GeographyResolution {
  input: string;
  resolved_name: string;
  geography_type: "municipality" | "province" | "country";
  confidence: number;
  ambiguity: string[];
}

const MUNICIPALITY_ALIASES: Record<string, string> = {
  "den haag": "'s-Gravenhage (gemeente)",
  "s gravenhage": "'s-Gravenhage (gemeente)",
  "utrecht": "Utrecht (gemeente)",
  "groningen": "Groningen (gemeente)",
};

const PROVINCES = [
  "Drenthe",
  "Flevoland",
  "Friesland",
  "Gelderland",
  "Groningen",
  "Limburg",
  "Noord-Brabant",
  "Noord-Holland",
  "Overijssel",
  "Utrecht",
  "Zeeland",
  "Zuid-Holland",
];

export function resolveGeographyMention(input: string, context = ""): GeographyResolution | null {
  const normalizedInput = normalizeSemanticText(input);
  const normalizedContext = normalizeSemanticText(context);
  const wantsProvince = /\b(province|provincie|pv)\b/.test(normalizedContext);
  const wantsMunicipality = /\b(municipality|gemeente|gm)\b/.test(normalizedContext);

  if (["nederland", "netherlands", "the netherlands"].includes(normalizedInput)) {
    return {
      input,
      resolved_name: "Nederland",
      geography_type: "country",
      confidence: 0.98,
      ambiguity: [],
    };
  }

  const province = PROVINCES.find((name) => normalizeSemanticText(name) === normalizedInput);
  if (province && wantsProvince) {
    return {
      input,
      resolved_name: `${province} (PV)`,
      geography_type: "province",
      confidence: 0.95,
      ambiguity: wantsMunicipality ? [`${province} municipality`, `${province} province`] : [],
    };
  }

  const municipalityAlias = MUNICIPALITY_ALIASES[normalizedInput];
  if (municipalityAlias && !wantsProvince) {
    return {
      input,
      resolved_name: municipalityAlias,
      geography_type: "municipality",
      confidence: province && !wantsMunicipality ? 0.78 : 0.94,
      ambiguity: province ? [`${input} municipality`, `${input} province`] : [],
    };
  }

  if (province) {
    return {
      input,
      resolved_name: wantsProvince ? `${province} (PV)` : `${province} (gemeente)`,
      geography_type: wantsProvince ? "province" : "municipality",
      confidence: wantsProvince || wantsMunicipality ? 0.9 : 0.72,
      ambiguity: [`${province} municipality`, `${province} province`],
    };
  }

  if (normalizedInput) {
    return {
      input,
      resolved_name: input,
      geography_type: wantsProvince ? "province" : "municipality",
      confidence: 0.64,
      ambiguity: [],
    };
  }

  return null;
}

export function resolveGeographiesFromQuestion(question: string, names: string[]): GeographyResolution[] {
  return uniqueStrings(names)
    .map((name) => resolveGeographyMention(name, question))
    .filter((resolution): resolution is GeographyResolution => Boolean(resolution));
}
