export interface Dataset {
  id: string;
  title: string;
  provider: string;
  description: string;
  tags: string[];
  updated: string;
  records: string;
  topics: number;
}

export interface DatasetVariable {
  name: string;
  type: "Integer" | "Float" | "String" | "Boolean" | "Date";
  descKey: string;
}

export interface DatasetPreviewRow {
  muni: string;
  year: number;
  pop: number;
  income: number;
  woz: number;
}

export interface SuggestedJoin {
  name: string;
  provider: string;
  join: string;
}
