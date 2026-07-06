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
  title?: string;
  unit?: string;
  role?: string;
}

export interface DatasetPreviewColumn {
  key: string;
  title: string;
  type: string;
  unit?: string;
}

export interface DatasetPreview {
  columns: DatasetPreviewColumn[];
  rows: Array<Record<string, string | number | boolean | null>>;
}

export interface SuggestedJoin {
  name: string;
  provider: string;
  join: string;
}
