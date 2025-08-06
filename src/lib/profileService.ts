// src/lib/profileService.ts
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  updated_at: string;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = createClientComponentClient();

  const { data, error } = await supabase
    .from("hestia_user_profiles_new")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching profile:", error);
    return null;
  }

  return data;
}

export async function updateProfile(
  profile: Partial<Profile> & { id: string }
): Promise<Profile | null> {
  const supabase = createClientComponentClient();

  const { id, ...updatableFields } = profile;

  const { data, error } = await supabase
    .from("hestia_user_profiles_new")
    .update({
      ...updatableFields,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating profile:", error);
    return null;
  }

  return data;
}
