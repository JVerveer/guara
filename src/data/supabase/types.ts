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
      silver_dataset_catalog: {
        Row: {
          dataset_id: string;
          provider: string;
          title: string;
          short_title: string | null;
          description: string | null;
          language: string | null;
          catalog: string | null;
          period: string | null;
          cbs_updated_at: string | null;
          source_version: string | null;
          source_url: string | null;
          bronze_ingested_at: string | null;
          silver_loaded_at: string | null;
          load_status: string | null;
          observations_loaded: number | null;
          dimensions_loaded: number | null;
          measures_loaded: number | null;
          rejected_rows: number | null;
          published_at: string;
        };
        Insert: {
          dataset_id: string;
          provider?: string;
          title: string;
          short_title?: string | null;
          description?: string | null;
          language?: string | null;
          catalog?: string | null;
          period?: string | null;
          cbs_updated_at?: string | null;
          source_version?: string | null;
          source_url?: string | null;
          bronze_ingested_at?: string | null;
          silver_loaded_at?: string | null;
          load_status?: string | null;
          observations_loaded?: number | null;
          dimensions_loaded?: number | null;
          measures_loaded?: number | null;
          rejected_rows?: number | null;
          published_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["silver_dataset_catalog"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "silver_dataset_catalog_dataset_id_fkey";
            columns: ["dataset_id"];
            referencedRelation: "dataset_catalog";
            referencedColumns: ["id"];
          },
        ];
      };
      source_layer_summary: {
        Row: {
          provider: string;
          layer: string;
          status: string;
          datasets_total: number;
          datasets_complete: number;
          datasets_partial: number;
          datasets_failed: number;
          records_expected: number | null;
          records_loaded: number | null;
          completeness_pct: number | null;
          rejected_rows: number;
          last_loaded_at: string | null;
          metadata: Record<string, unknown>;
          updated_at: string;
        };
        Insert: {
          provider: string;
          layer: string;
          status?: string;
          datasets_total?: number;
          datasets_complete?: number;
          datasets_partial?: number;
          datasets_failed?: number;
          records_expected?: number | null;
          records_loaded?: number | null;
          completeness_pct?: number | null;
          rejected_rows?: number;
          last_loaded_at?: string | null;
          metadata?: Record<string, unknown>;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["source_layer_summary"]["Insert"]>;
        Relationships: [];
      };
      dataset_quality_checks: {
        Row: {
          dataset_id: string;
          layer: string;
          check_name: string;
          status: string;
          expected_value: string | null;
          actual_value: string | null;
          message: string | null;
          checked_at: string;
        };
        Insert: {
          dataset_id: string;
          layer: string;
          check_name: string;
          status: string;
          expected_value?: string | null;
          actual_value?: string | null;
          message?: string | null;
          checked_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["dataset_quality_checks"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
