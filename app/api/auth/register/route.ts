import { NextRequest } from "next/server";
import { registerSchema } from "@/lib/validations";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { hashPassword, savePasswordToHistory } from "@/lib/password";
import { primaryDrizzleDb } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq, or } from "drizzle-orm";
import { logAuthEvent } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = registerSchema.safeParse(body);

    if (!parseResult.success) {
      const details = parseResult.error.issues.reduce(
        (acc, err) => {
          const path = err.path.join(".");
          acc[path] = err.message;
          return acc;
        },
        {} as Record<string, string>,
      );
      return apiError("Validation failed", 400, details);
    }

    const { name, email, phoneNumber, password } = parseResult.data;

    const conditions = [eq(users.email, email)];
    if (phoneNumber) {
      conditions.push(eq(users.phoneNumber, phoneNumber));
    }

    const existingUser = await primaryDrizzleDb.query.users.findFirst({
      where: or(...conditions),
    });

    if (existingUser) {
      const field = existingUser.email === email ? "email" : "phone number";
      return apiError(`A user with this ${field} already exists`, 409);
    }

    const passwordHash = await hashPassword(password);

    const [newUser] = await primaryDrizzleDb
      .insert(users)
      .values({
        name,
        email,
        phoneNumber: phoneNumber || null,
        passwordHash,
      })
      .returning({ id: users.id });

    await savePasswordToHistory(newUser.id, passwordHash);

    logAuthEvent({
      event: "register",
      userId: newUser.id,
      email,
      success: true,
    });

    return apiSuccess({ userId: newUser.id }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
