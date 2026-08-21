export type WhopEntitlementStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "completed"
  | "canceled"
  | "expired"
  | "unresolved"
  | "drafted"
  | "canceling";

export type Database = {
  public: {
    Tables: {
      whop_entitlements: {
        Row: {
          id: number;
          user_id: string;
          whop_membership_id: string;
          whop_plan_id: string;
          status: WhopEntitlementStatus;
          last_event_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          whop_membership_id: string;
          whop_plan_id: string;
          status: WhopEntitlementStatus;
          last_event_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          whop_membership_id?: string;
          whop_plan_id?: string;
          status?: WhopEntitlementStatus;
          last_event_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

