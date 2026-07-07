export type WeightUnit = "kg" | "lbs";

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  weight_unit: WeightUnit;
  target_weight_kg: number | null;
  created_at: string;
}

export interface WeighIn {
  id: string;
  user_id: string;
  weight_kg: number;
  measured_on: string; // YYYY-MM-DD
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  captain_id: string;
  created_at: string;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  joined_at: string;
}

export type CompetitionType = "solo" | "team";
export type WeighInInterval = "daily" | "weekly" | "monthly";

export interface Competition {
  id: string;
  name: string;
  type: CompetitionType;
  weigh_in_interval: WeighInInterval;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  creator_id: string;
  created_at: string;
}

export type ParticipantStatus = "pending" | "accepted" | "declined";

export interface CompetitionParticipant {
  id: string;
  competition_id: string;
  user_id: string | null;
  team_id: string | null;
  status: ParticipantStatus;
  created_at: string;
}

export interface Invite {
  id: string;
  kind: "team" | "competition";
  team_id: string | null;
  competition_id: string | null;
  email: string;
  token: string;
  invited_by: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
}
