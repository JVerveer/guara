export interface Database {
  bronze: {
    Tables: {
      cbs_catalog_tables: {
        Row: {
          identifier: string;
          title: string;
          short_title: string | null;
          short_description: string | null;
          language: string | null;
          catalog: string | null;
          period: string | null;
          updated_at: string | null;
          raw: Record<string, unknown>;
          ingested_at: string;
        };
        Insert: {
          identifier: string;
          title: string;
          short_title?: string | null;
          short_description?: string | null;
          language?: string | null;
          catalog?: string | null;
          period?: string | null;
          updated_at?: string | null;
          raw: Record<string, unknown>;
          ingested_at?: string;
        };
        Update: Partial<Database["bronze"]["Tables"]["cbs_catalog_tables"]["Insert"]>;
        Relationships: [];
      };
      cbs_data_properties: {
        Row: {
          dataset_id: string;
          property_id: number;
          key: string | null;
          title: string | null;
          type: string | null;
          parent_id: number | null;
          position: number | null;
          raw: Record<string, unknown>;
          ingested_at: string;
        };
        Insert: {
          dataset_id: string;
          property_id: number;
          key?: string | null;
          title?: string | null;
          type?: string | null;
          parent_id?: number | null;
          position?: number | null;
          raw: Record<string, unknown>;
          ingested_at?: string;
        };
        Update: Partial<Database["bronze"]["Tables"]["cbs_data_properties"]["Insert"]>;
        Relationships: [];
      };
      cbs_dimension_values: {
        Row: {
          dataset_id: string;
          dimension_key: string;
          key: string;
          title: string | null;
          description: string | null;
          raw: Record<string, unknown>;
          ingested_at: string;
        };
        Insert: {
          dataset_id: string;
          dimension_key: string;
          key: string;
          title?: string | null;
          description?: string | null;
          raw: Record<string, unknown>;
          ingested_at?: string;
        };
        Update: Partial<Database["bronze"]["Tables"]["cbs_dimension_values"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
  public: {
    Tables: {
      dataset_catalog: {
        Row: {
          id: string;
          provider: string;
          title: string;
          description: string | null;
          updated_at: string | null;
          record_count: number | null;
          year_start: number | null;
          year_end: number | null;
          years: number[];
          geographic_levels: string[];
          spatial_coverage: string | null;
          period_source: string | null;
          qualification_confidence: string;
          qualification_evidence: string[];
          source_url: string | null;
          ingested_at: string;
        };
        Insert: {
          id: string;
          provider: string;
          title: string;
          description?: string | null;
          updated_at?: string | null;
          record_count?: number | null;
          year_start?: number | null;
          year_end?: number | null;
          years?: number[];
          geographic_levels?: string[];
          spatial_coverage?: string | null;
          period_source?: string | null;
          qualification_confidence?: string;
          qualification_evidence?: string[];
          source_url?: string | null;
          ingested_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["dataset_catalog"]["Insert"]>;
        Relationships: [];
      };
      dataset_dimensions: {
        Row: {
          id: string;
          dataset_id: string;
          key: string;
          title: string;
          type: string;
          values_count: number | null;
          ingested_at: string;
        };
        Insert: {
          id?: string;
          dataset_id: string;
          key: string;
          title: string;
          type: string;
          values_count?: number | null;
          ingested_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["dataset_dimensions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "dataset_dimensions_dataset_id_fkey";
            columns: ["dataset_id"];
            referencedRelation: "dataset_catalog";
            referencedColumns: ["id"];
          },
        ];
      };
      dataset_preview_rows: {
        Row: {
          dataset_id: string;
          row_id: string;
          row_index: number | null;
          raw: Record<string, unknown>;
          ingested_at: string;
        };
        Insert: {
          dataset_id: string;
          row_id: string;
          row_index?: number | null;
          raw: Record<string, unknown>;
          ingested_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["dataset_preview_rows"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "dataset_preview_rows_dataset_id_fkey";
            columns: ["dataset_id"];
            referencedRelation: "dataset_catalog";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
