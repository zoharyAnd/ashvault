"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { abuseReports } from "@/db/schema";

export async function resolveReportAction(formData: FormData) {
  const session = await auth();
  // Defence in depth: the middleware already gates /admin, but server actions
  // are their own entry point, so re-check the role here.
  if (session?.user?.role !== "admin") {
    throw new Error("Forbidden");
  }

  const id = formData.get("id");
  if (typeof id !== "string") return;

  await db
    .update(abuseReports)
    .set({ resolved: true })
    .where(eq(abuseReports.id, id));

  revalidatePath("/admin");
}
