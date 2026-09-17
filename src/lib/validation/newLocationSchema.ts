import { z } from "zod";

export const newLocationSchema = z.object({
  name: z.string().trim().min(2).max(200),
  type: z.enum(["creade", "police_station"]),
  region: z.string().trim().min(1).max(200),
  province: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(200),
  address: z.string().trim().max(300).nullable().optional(),
  postal_code: z.string().trim().max(20).nullable().optional(),
  phone: z.string().trim().max(200).nullable().optional(),
  appointment_method: z.enum(["phone", "email", "phone_or_email", "icp_online"]),
  appointment_url: z.string().trim().url().max(500).nullable().optional(),
});

export type NewLocationInput = z.infer<typeof newLocationSchema>;
