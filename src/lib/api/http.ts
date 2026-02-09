import { NextResponse } from "next/server";
import { z } from "zod";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export function jsonError(status: number, code: string, message: string) {
  return NextResponse.json<ApiErrorBody>(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

export function zodErrorToMessage(err: z.ZodError) {
  return err.issues.map((issue) => issue.message).join("; ");
}
