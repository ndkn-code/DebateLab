"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const displayName = formData.get("display_name") as string;
  const avatarUrl = formData.get("avatar_url") as string;

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName?.trim() || null,
      avatar_url: avatarUrl?.trim() || null,
    })
    .eq("id", user.id);

  if (error) throw new Error("Failed to update profile");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function updatePreferences(preferences: Record<string, unknown>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({ preferences })
    .eq("id", user.id);

  if (error) throw new Error("Failed to update preferences");
  revalidatePath("/settings");
}

export async function changePassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const newPassword = formData.get("new_password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
  if (newPassword !== confirmPassword) {
    throw new Error("Passwords do not match");
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw new Error(error.message);
}
