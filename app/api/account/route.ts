import { NextRequest } from "next/server";
import { updateProfileSchema } from "@/lib/validations";
import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { drizzleDb } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq, and, ne } from "drizzle-orm";
import { auth } from "@/lib/auth";

export const GET = async () => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("Authentication required", 401);
    }

    const user = await drizzleDb.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        image: true,
        role: true,
        passwordHash: true,
        currencyPreference: true,
        createdAt: true,
      },
    });

    if (!user) {
      return apiError("User not found", 404);
    }

    return apiSuccess({
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      image: user.image,
      role: user.role,
      hasPassword: !!user.passwordHash,
      currencyPreference: user.currencyPreference,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
};

export const PATCH = async (request: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("Authentication required", 401);
    }

    const body = await request.json();
    const parseResult = updateProfileSchema.safeParse(body);

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

    const { name, email, phoneNumber, currencyPreference } = parseResult.data;

    // Check for duplicate email if changing
    if (email) {
      const existingByEmail = await drizzleDb.query.users.findFirst({
        where: and(eq(users.email, email), ne(users.id, session.user.id)),
      });
      if (existingByEmail) {
        return apiError("A user with this email already exists", 409);
      }
    }

    // Check for duplicate phone if changing
    if (phoneNumber) {
      const existingByPhone = await drizzleDb.query.users.findFirst({
        where: and(
          eq(users.phoneNumber, phoneNumber),
          ne(users.id, session.user.id),
        ),
      });
      if (existingByPhone) {
        return apiError("A user with this phone number already exists", 409);
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name || null;
    if (email !== undefined) updateData.email = email;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber || null;
    if (currencyPreference !== undefined)
      updateData.currencyPreference = currencyPreference;

    await drizzleDb
      .update(users)
      .set(updateData)
      .where(eq(users.id, session.user.id));

    return apiSuccess({ message: "Profile updated successfully" });
  } catch (error) {
    return handleApiError(error);
  }
};
