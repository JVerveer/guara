/**
 * Bronze Schema — Kadaster (Dutch Land Registry)
 *
 * Reflects the exact field names and types returned by the Kadaster
 * open data API and BAG (Basisregistraties Adressen en Gebouwen) API.
 *
 * Kadaster API: https://www.kadaster.nl/zakelijk/producten/adressen-en-gebouwen
 * BAG viewer: https://bagviewer.kadaster.nl
 */

// ── WOZ waardepeildatum records ───────────────────────────────────────────────

/**
 * Raw WOZ (Waardering Onroerende Zaken) record from Kadaster.
 * Field names are camelCase as returned by the Kadaster REST API.
 */
export interface KadasterWozRecord {
  /** Unique property identifier (BAG verblijfsobject ID) */
  identificatienummer: string;
  /** Property type: residential ("woning") or commercial ("bedrijfspand") */
  vastgoedtype: "woning" | "bedrijfspand" | "overig";
  /** WOZ assessed value in EUR */
  wozWaarde: number;
  /** Assessment reference date (ISO 8601: "YYYY-01-01") */
  peildatum: string;
  /** 4-digit municipality code (without "GM" prefix, unlike CBS) */
  gemeenteCode: string;
  /** Municipality name */
  gemeenteNaam: string;
  /** Postal code (4 digits + 2 letters) */
  postcode: string;
  /** Street name */
  openbareRuimteNaam: string;
  /** Building construction year */
  bouwjaar: number | null;
  /** Total surface area (m²) */
  oppervlakte: number | null;
}

/** Kadaster API pagination envelope */
export interface KadasterApiResponse<TRecord> {
  _embedded: { results: TRecord[] };
  _links: {
    self: { href: string };
    next?: { href: string };
  };
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}

// ── Transactieprijs records ───────────────────────────────────────────────────

/**
 * Raw transaction price record from Kadaster transacties dataset.
 * Represents an actual completed property sale.
 */
export interface KadasterTransactieRecord {
  /** Transaction identifier */
  transactieId: string;
  /** Transaction date (ISO 8601) */
  transactieDatum: string;
  /** Agreed sale price in EUR */
  koopsom: number;
  /** Property type */
  soortObject: "bestaande bouw" | "nieuwbouw";
  /** Municipality code (4 digits) */
  gemeenteCode: string;
  /** Postal code */
  postcode: string;
}
