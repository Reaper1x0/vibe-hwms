import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadDotEnv() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) {
    console.warn(`.env file not found at ${envPath}, relying on existing process.env`);
    return;
  }

  const contents = fs.readFileSync(envPath, "utf8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

async function ensureHospitalAndDepartments(supabase) {
  // Reuse the demo hospital created by 012_seed_demo_data or create if missing
  const demoCode = "DEMO";

  let { data: hospitals, error } = await supabase
    .from("hospitals")
    .select("*")
    .eq("code", demoCode)
    .limit(1);

  if (error) throw error;

  let hospital = hospitals?.[0];

  if (!hospital) {
    const { data, error: insertError } = await supabase
      .from("hospitals")
      .insert({
        name: "Demo Hospital",
        code: demoCode,
        address: "123 Demo Street",
        city: "Demo City",
        phone: "000-000-0000",
        email: "demo@hwms.local",
      })
      .select("*")
      .single();
    if (insertError) throw insertError;
    hospital = data;
  }

  const { data: departments, error: depError } = await supabase
    .from("departments")
    .select("*")
    .eq("hospital_id", hospital.id);
  if (depError) throw depError;

  let er = departments.find((d) => d.name === "Emergency");
  if (!er) {
    const { data: erDep, error: erError } = await supabase
      .from("departments")
      .insert({
        hospital_id: hospital.id,
        name: "Emergency",
        type: "ER",
      })
      .select("*")
      .single();
    if (erError) throw erError;
    er = erDep;
  }

  let cardio = departments.find((d) => d.name === "Cardiology");
  if (!cardio) {
    const { data: dep, error: depErr } = await supabase
      .from("departments")
      .insert({
        hospital_id: hospital.id,
        name: "Cardiology",
        type: "Clinical",
      })
      .select("*")
      .single();
    if (depErr) throw depErr;
    cardio = dep;
  }

  let radiology = departments.find((d) => d.name === "Radiology");
  if (!radiology) {
    const { data: dep, error: depErr } = await supabase
      .from("departments")
      .insert({
        hospital_id: hospital.id,
        name: "Radiology",
        type: "Diagnostics",
      })
      .select("*")
      .single();
    if (depErr) throw depErr;
    radiology = dep;
  }

  return { hospital, er, cardio, radiology };
}

async function ensureUserWithRole(supabase, { email, password, fullName, role, hospitalId, departmentId }) {
  console.log(`Ensuring ${role} user ${email} exists...`);

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    const msg = createError.message?.toLowerCase() ?? "";
    const code = createError.code?.toLowerCase() ?? "";
    const isEmailExists =
      msg.includes("already been registered") ||
      msg.includes("already registered") ||
      code === "email_exists";
    if (!isEmailExists) {
      throw createError;
    }
    console.log(`User ${email} already exists, continuing.`);
  } else if (created?.user) {
    console.log(`User created: ${created.user.id}`);
  }

  const { data: list, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    throw new Error(`Could not find user ${email} after creation`);
  }

  // Ensure password is what we expect
  const { error: pwdError } = await supabase.auth.admin.updateUserById(user.id, { password });
  if (pwdError) throw pwdError;

  // Update profile with role and org info
  const { error: profError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      role,
      hospital_id: hospitalId,
      department_id: departmentId ?? null,
      is_active: true,
    })
    .eq("id", user.id);
  if (profError) throw profError;

  console.log(`User ${email} ensured with role ${role}`);
  return user;
}

async function seedTasksAndShifts(supabase, { hospital, er }, { doctor, nurse }) {
  console.log("Seeding demo tasks and shifts...");

  // Ensure one patient for tasks
  const { data: patients, error: patError } = await supabase
    .from("patients")
    .select("*")
    .eq("hospital_id", hospital.id)
    .limit(1);
  if (patError) throw patError;

  const patientId = patients?.[0]?.id ?? null;

  // Seed a couple of tasks
  const { error: taskError } = await supabase.from("tasks").insert([
    {
      hospital_id: hospital.id,
      department_id: er.id,
      patient_id: patientId,
      created_by: doctor.id,
      assigned_to: nurse.id,
      title: "Initial assessment",
      description: "Perform initial triage and vitals.",
      status: "todo",
      priority: "high",
      due_at: new Date(new Date().getTime() + 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      hospital_id: hospital.id,
      department_id: er.id,
      patient_id: patientId,
      created_by: doctor.id,
      assigned_to: doctor.id,
      title: "Review lab results",
      description: "Check lab reports and update care plan.",
      status: "todo",
      priority: "medium",
      due_at: new Date(new Date().getTime() + 6 * 60 * 60 * 1000).toISOString(),
    },
  ]);
  if (taskError) throw taskError;

  // Seed a couple of shifts
  const now = new Date();
  const startDay = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 day
  const dayShiftStart = startDay.toISOString();
  const dayShiftEnd = new Date(startDay.getTime() + 8 * 60 * 60 * 1000).toISOString();
  const nightShiftStart = new Date(startDay.getTime() + 12 * 60 * 60 * 1000).toISOString();
  const nightShiftEnd = new Date(startDay.getTime() + 20 * 60 * 60 * 1000).toISOString();

  const { error: shiftError } = await supabase.from("shifts").insert([
    {
      hospital_id: hospital.id,
      department_id: er.id,
      assigned_user_id: nurse.id,
      shift_type: "Day",
      start_at: dayShiftStart,
      end_at: dayShiftEnd,
      notes: "Demo day shift for nurse",
    },
    {
      hospital_id: hospital.id,
      department_id: er.id,
      assigned_user_id: doctor.id,
      shift_type: "Night",
      start_at: nightShiftStart,
      end_at: nightShiftEnd,
      notes: "Demo night shift for doctor",
    },
  ]);
  if (shiftError) throw shiftError;

  console.log("Demo tasks and shifts seeded.");
}

async function seedMoreRealisticClinicalData(supabase, { hospital, er }, { admin, hod, doctor, nurse }) {
  console.log("Seeding additional real-world demo data (patients, leave, swaps, handovers)...");

  // --- Patients ---
  const patientDefinitions = [
    {
      mrn: "ER-2026-0001",
      full_name: "Muhammad Ali",
      date_of_birth: "1984-03-14",
      gender: "male",
      notes: "Chest pain, rule out acute coronary syndrome.",
    },
    {
      mrn: "ER-2026-0002",
      full_name: "Ayesha Khan",
      date_of_birth: "1992-11-02",
      gender: "female",
      notes: "High-grade fever and productive cough, likely pneumonia.",
    },
    {
      mrn: "ER-2026-0003",
      full_name: "Imran Hussain",
      date_of_birth: "1975-07-23",
      gender: "male",
      notes: "Road traffic accident, multiple fractures, admitted to ER observation.",
    },
  ];

  const patients = [];
  for (const def of patientDefinitions) {
    const { data: existing, error: findError } = await supabase
      .from("patients")
      .select("*")
      .eq("hospital_id", hospital.id)
      .eq("mrn", def.mrn)
      .limit(1);
    if (findError) throw findError;

    if (existing && existing.length > 0) {
      patients.push(existing[0]);
      continue;
    }

    const { data: created, error: createError } = await supabase
      .from("patients")
      .insert({
        hospital_id: hospital.id,
        department_id: er.id,
        mrn: def.mrn,
        full_name: def.full_name,
        date_of_birth: def.date_of_birth,
        gender: def.gender,
        notes: def.notes,
      })
      .select("*")
      .single();
    if (createError) throw createError;
    patients.push(created);
  }

  // --- Additional tasks for these patients ---
  const now = new Date();
  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
  const inSixHours = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const [ali, ayesha, imran] = patients;

  const { error: moreTasksError } = await supabase.from("tasks").insert([
    {
      hospital_id: hospital.id,
      department_id: er.id,
      patient_id: ali?.id ?? null,
      created_by: doctor.id,
      assigned_to: nurse.id,
      title: "Chest pain protocol - ECG and troponins",
      description: "Obtain ECG within 10 minutes and first set of cardiac enzymes.",
      status: "in_progress",
      priority: "critical",
      due_at: inTwoHours,
    },
    {
      hospital_id: hospital.id,
      department_id: er.id,
      patient_id: ayesha?.id ?? null,
      created_by: doctor.id,
      assigned_to: nurse.id,
      title: "Start IV antibiotics and fluids",
      description: "Administer first dose of broad-spectrum antibiotics and start IV fluids.",
      status: "todo",
      priority: "high",
      due_at: inSixHours,
    },
    {
      hospital_id: hospital.id,
      department_id: er.id,
      patient_id: imran?.id ?? null,
      created_by: doctor.id,
      assigned_to: doctor.id,
      title: "Coordinate urgent orthopedic consult",
      description: "Discuss CT findings with orthopedics and plan for OR.",
      status: "todo",
      priority: "high",
      due_at: tomorrow,
    },
  ]);
  if (moreTasksError) throw moreTasksError;

  // --- Leave requests (doctor + nurse) ---
  const today = new Date();
  const formatDate = (d) => d.toISOString().slice(0, 10);

  const nurseLeaveStart = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
  const nurseLeaveEnd = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000);

  const doctorLeaveStart = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000);
  const doctorLeaveEnd = new Date(today.getTime() + 12 * 24 * 60 * 60 * 1000);

  const { error: leaveError } = await supabase.from("leave_requests").insert([
    {
      user_id: nurse.id,
      hospital_id: hospital.id,
      department_id: er.id,
      start_date: formatDate(nurseLeaveStart),
      end_date: formatDate(nurseLeaveEnd),
      reason: "Annual leave - family event out of city.",
      status: "pending",
      is_active: true,
    },
    {
      user_id: doctor.id,
      hospital_id: hospital.id,
      department_id: er.id,
      start_date: formatDate(doctorLeaveStart),
      end_date: formatDate(doctorLeaveEnd),
      reason: "Planned conference and workshop.",
      status: "approved",
      reviewed_by: hod.id,
      reviewed_at: new Date().toISOString(),
      is_active: true,
    },
  ]);
  if (leaveError) throw leaveError;

  // --- Swap requests based on existing shifts ---
  const { data: erShifts, error: shiftsError } = await supabase
    .from("shifts")
    .select("*")
    .eq("hospital_id", hospital.id)
    .eq("department_id", er.id)
    .limit(5);
  if (shiftsError) throw shiftsError;

  const nurseShift = erShifts.find((s) => s.assigned_user_id === nurse.id) ?? erShifts[0];
  const doctorShift = erShifts.find((s) => s.assigned_user_id === doctor.id) ?? erShifts[1] ?? erShifts[0];

  if (nurseShift) {
    const { error: swapError } = await supabase.from("swap_requests").insert([
      {
        shift_id: nurseShift.id,
        requester_id: nurse.id,
        requested_with_user_id: doctor.id,
        status: "pending",
        reason: "Requesting to swap ER day shift due to childcare commitments.",
        is_active: true,
      },
      {
        shift_id: doctorShift.id,
        requester_id: doctor.id,
        requested_with_user_id: nurse.id,
        status: "approved",
        reason: "Swapped night shift to cover upcoming conference schedule.",
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
        is_active: true,
      },
    ]);
    if (swapError) throw swapError;
  }

  // --- Handovers between doctor and nurse for a sick patient ---
  const primaryPatient = ayesha ?? ali ?? patients[0];

  const { error: handoverError } = await supabase.from("handovers").insert([
    {
      hospital_id: hospital.id,
      department_id: er.id,
      patient_id: primaryPatient?.id ?? null,
      shift_id: nurseShift?.id ?? null,
      from_user_id: doctor.id,
      to_user_id: nurse.id,
      notes:
        "Patient admitted with severe pneumonia. Oxygen via nasal cannula at 3 L/min. Continue IV antibiotics and monitor vitals 4-hourly.",
      is_active: true,
    },
    {
      hospital_id: hospital.id,
      department_id: er.id,
      patient_id: primaryPatient?.id ?? null,
      shift_id: doctorShift?.id ?? null,
      from_user_id: nurse.id,
      to_user_id: doctor.id,
      notes:
        "Overnight saturation remained >94% on oxygen. Temperature trending down. Please review morning labs and consider stepping down.",
      is_active: true,
    },
  ]);
  if (handoverError) throw handoverError;

  console.log("Additional real-world demo data seeded.");

  // --- Bulk demo tasks to reach ~100+ rows overall ---
  console.log("Seeding extra bulk tasks for richer demo data...");
  const allPatientsRes = await supabase
    .from("patients")
    .select("id,full_name")
    .eq("hospital_id", hospital.id)
    .limit(50);
  if (allPatientsRes.error) throw allPatientsRes.error;
  const allPatients = allPatientsRes.data ?? patients;

  const statuses = ["todo", "in_progress", "done"];
  const priorities = ["low", "medium", "high", "critical"];

  const bulkTasks = [];
  const baseTime = Date.now();
  for (let i = 0; i < 80; i++) {
    const p = allPatients[i % allPatients.length] ?? primaryPatient;
    const status = statuses[i % statuses.length];
    const priority = priorities[i % priorities.length];
    const due = new Date(baseTime + (i + 1) * 60 * 60 * 1000).toISOString();

    bulkTasks.push({
      hospital_id: hospital.id,
      department_id: er.id,
      patient_id: p?.id ?? null,
      created_by: i % 2 === 0 ? doctor.id : nurse.id,
      assigned_to: i % 3 === 0 ? nurse.id : doctor.id,
      title: `Follow-up task #${i + 1} for ${p?.full_name ?? "patient"}`,
      description:
        "Automatically generated demo task to simulate a busy emergency department workload (vitals, meds, reviews, documentation).",
      status,
      priority,
      due_at: due,
    });
  }

  if (bulkTasks.length) {
    const { error: bulkError } = await supabase.from("tasks").insert(bulkTasks);
    if (bulkError) throw bulkError;
    console.log(`Seeded ${bulkTasks.length} additional demo tasks.`);
  }
}

async function main() {
  loadDotEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { hospital, er, cardio, radiology } = await ensureHospitalAndDepartments(supabase);

  const admin = await ensureUserWithRole(supabase, {
    email: "admin@hwms.local",
    password: "Password@123",
    fullName: "Demo Admin",
    role: "admin",
    hospitalId: hospital.id,
    departmentId: null,
  });

  const hod = await ensureUserWithRole(supabase, {
    email: "hod@hwms.local",
    password: "Password@123",
    fullName: "Head of Department",
    role: "hod",
    hospitalId: hospital.id,
    departmentId: cardio.id,
  });

  const doctor = await ensureUserWithRole(supabase, {
    email: "doctor@hwms.local",
    password: "Password@123",
    fullName: "Demo Doctor",
    role: "doctor",
    hospitalId: hospital.id,
    departmentId: er.id,
  });

  const nurse = await ensureUserWithRole(supabase, {
    email: "nurse@hwms.local",
    password: "Password@123",
    fullName: "Demo Nurse",
    role: "nurse",
    hospitalId: hospital.id,
    departmentId: er.id,
  });

  await seedTasksAndShifts(supabase, { hospital, er }, { doctor, nurse });
  await seedMoreRealisticClinicalData(supabase, { hospital, er }, { admin, hod, doctor, nurse });

  console.log("\nDemo users created:");
  console.log("  Admin:  admin@hwms.local / Password@123");
  console.log("  HOD:    hod@hwms.local / Password@123");
  console.log("  Doctor: doctor@hwms.local / Password@123");
  console.log("  Nurse:  nurse@hwms.local / Password@123");
  console.log("\nDemo tasks and shifts have been seeded.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

