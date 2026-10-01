import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client'; // Import standard package
import * as bcrypt from 'bcryptjs'; // Required import for bcrypt

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Fixed UUIDs keep the seed idempotent (ON CONFLICT DO NOTHING).
const OFFICERS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'officer.utkarsh@dosje.gov.in',
    firstName: 'Utkarsh',
    lastName: 'Singh',
    state: 'Delhi',
    district: 'Dwarka',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'officer.karthik@dosje.gov.in',
    firstName: 'Karthik',
    lastName: 'Subramaniam',
    state: 'Tamil Nadu',
    district: 'Coimbatore',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'officer.debashish@dosje.gov.in',
    firstName: 'Debashish',
    lastName: 'Roy',
    state: 'West Bengal',
    district: 'Kolkata',
  },
];

const INSTITUTES = [
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Rukmini Shelter Home for Women',
    registrationNo: 'MSJE/DL/00231',
    type: 'Shelter_Home',
    contactEmail: 'contact@rukmini-shelter.in',
    contactPhone: '+911140001001',
    addressLine1: 'Plot 12, Sector 6, Dwarka',
    state: 'Delhi',
    district: 'Dwarka',
    pinCode: '110075',
    lng: 77.0424,
    lat: 28.5975,
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    name: 'Nambikkai De-addiction Centre',
    registrationNo: 'MSJE/TN/00456',
    type: 'De-addiction Centre',
    contactEmail: 'contact@nambikkai.in',
    contactPhone: '+914420002002',
    addressLine1: '45, Avinashi Road, Coimbatore',
    state: 'Tamil Nadu',
    district: 'Coimbatore',
    pinCode: '641001',
    lng: 76.9558,
    lat: 11.0168,
  },
  {
    id: '66666666-6666-4666-8666-666666666666',
    name: 'Nirmal Jyoti Disability Rehab Centre',
    registrationNo: 'MSJE/WB/00902',
    type: 'Rehab_Centre',
    contactEmail: 'contact@nirmaljyoti.in',
    contactPhone: '+913330003003',
    addressLine1: '22, Park Street, Kolkata',
    state: 'West Bengal',
    district: 'Kolkata',
    pinCode: '700001',
    lng: 88.3639,
    lat: 22.5726,
  },
];

const PROJECTS = [
  {
    id: '77777777-7777-4777-8777-777777777777',
    title: 'Rukmini Shelter Upkeep 2026',
    schemeCode: 'SCH/DL/2026/01',
    instituteNgoId: '44444444-4444-4444-8444-444444444444',
    lng: 77.0424,
    lat: 28.5975,
    beneficiaryCount: 120,
  },
  {
    id: '88888888-8888-4888-8888-888888888888',
    title: 'Nambikkai Care Program 2026',
    schemeCode: 'SCH/TN/2026/02',
    instituteNgoId: '55555555-5555-4555-8555-555555555555',
    lng: 76.9558,
    lat: 11.0168,
    beneficiaryCount: 85,
  },
  {
    id: '99999999-9999-4999-8999-999999999999',
    title: 'Nirmal Jyoti Rehab Support 2026',
    schemeCode: 'SCH/WB/2026/03',
    instituteNgoId: '66666666-6666-4666-8666-666666666666',
    lng: 88.3639,
    lat: 22.5726,
    beneficiaryCount: 64,
  },
];

const INSPECTIONS = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    projectId: '77777777-7777-4777-8777-777777777777',
    scheduledDate: '2026-10-07T09:00:00Z',
    notes: 'Routine quarterly verification visit.',
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    projectId: '88888888-8888-4888-8888-888888888888',
    scheduledDate: '2026-10-03T09:00:00Z',
    notes: 'Follow-up on beneficiary headcount records.',
  },
  {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    projectId: '99999999-9999-4999-8999-999999999999',
    scheduledDate: '2026-10-10T09:00:00Z',
    notes: 'Rehabilitation facility standards review.',
  },
];

async function main() {
  const passwordHash = await bcrypt.hash('Admin@123', 12);

  // Upsert (not create) so re-running the seed on every deploy never fails
  // with a unique-constraint error once the admin already exists.
  await prisma.user.upsert({
    where: { email: 'superadmin@dosje.gov.in' },
    update: {},
    create: {
      email: 'superadmin@dosje.gov.in',
      passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      role: Role.DOSJE_SUPER_ADMIN,
      status: 'ACTIVE',
      jurisdictionState: 'All India',
    },
  });

  // Demo field officers (login password for all three: Officer@123).
  const officerHash = await bcrypt.hash('Officer@123', 10);
  for (const o of OFFICERS) {
    await prisma.$executeRaw`
      INSERT INTO users (id, email, "passwordHash", "firstName", "lastName", role, status, "jurisdictionState", "jurisdictionDist", "createdAt", "updatedAt")
      VALUES (${o.id}::uuid, ${o.email}, ${officerHash}, ${o.firstName}, ${o.lastName}, 'PMU_OFFICER', 'ACTIVE', ${o.state}, ${o.district}, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `;
  }

  // Demo institutes + projects + scheduled (unassigned) inspections.
  for (const i of INSTITUTES) {
    await prisma.$executeRaw`
      INSERT INTO institute_ngos (id, name, "registrationNo", type, "contactEmail", "contactPhone", "addressLine1", state, district, "pinCode", location, status, "createdAt", "updatedAt")
      VALUES (${i.id}::uuid, ${i.name}, ${i.registrationNo}, ${i.type}, ${i.contactEmail}, ${i.contactPhone}, ${i.addressLine1}, ${i.state}, ${i.district}, ${i.pinCode},
        ST_SetSRID(ST_MakePoint(${i.lng}, ${i.lat}), 4326), 'ACTIVE', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `;
  }
  for (const p of PROJECTS) {
    await prisma.$executeRaw`
      INSERT INTO projects (id, title, "schemeCode", "instituteNgoId", status, location, "beneficiaryCount", "createdAt", "updatedAt")
      VALUES (${p.id}::uuid, ${p.title}, ${p.schemeCode}, ${p.instituteNgoId}::uuid, 'IN_PROGRESS',
        ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326), ${p.beneficiaryCount}, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `;
  }
  for (const s of INSPECTIONS) {
    await prisma.$executeRaw`
      INSERT INTO inspections (id, "projectId", "assignedOfficerId", status, "scheduledDate", "isRandomAssignment", notes, "createdAt", "updatedAt")
      VALUES (${s.id}::uuid, ${s.projectId}::uuid, NULL, 'SCHEDULED', ${s.scheduledDate}::timestamptz, false, ${s.notes}, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `;
  }

  // Keep coordinates correct even if an older seed run stored wrong points.
  const COORD_FIX = [
    { regNo: 'MSJE/DL/00231', lng: 77.0424, lat: 28.5975 },
    { regNo: 'MSJE/TN/00456', lng: 76.9558, lat: 11.0168 },
    { regNo: 'MSJE/WB/00902', lng: 88.3639, lat: 22.5726 },
  ];
  for (const c of COORD_FIX) {
    await prisma.$executeRaw`
      UPDATE institute_ngos SET location = ST_SetSRID(ST_MakePoint(${c.lng}, ${c.lat}), 4326), "updatedAt" = NOW()
      WHERE "registrationNo" = ${c.regNo};
    `;
  }
  await prisma.$executeRaw`
    UPDATE projects SET location = ST_SetSRID(ST_MakePoint(77.0424, 28.5975), 4326), "updatedAt" = NOW()
    WHERE "schemeCode" = 'SCH/DL/2026/01';
  `;

  console.log('Seed complete: admin + 3 officers + 3 institutes + 3 projects + 3 inspections.');

  // Demo anomalies (drive the risk scores on the Assign page).
  await prisma.$executeRaw`
    INSERT INTO anomaly_alerts (id, "anomalyType", severity, status, title, description, source, "projectId", "detectedAt", "createdAt", "updatedAt")
    VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'CCTV_FEED_INTERRUPTED', 'HIGH', 'DETECTED',
      'CCTV feed interrupted at Rukmini Shelter Home', 'Camera 2 stopped responding during night hours.', 'CCTV',
      '77777777-7777-4777-8777-777777777777'::uuid, NOW(), NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `;
  await prisma.$executeRaw`
    INSERT INTO anomaly_alerts (id, "anomalyType", severity, status, title, description, source, "projectId", "detectedAt", "createdAt", "updatedAt")
    VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'BENEFICIARY_COUNT_MISMATCH', 'MEDIUM', 'DETECTED',
      'Headcount mismatch at Nirmal Jyoti', 'Registered beneficiaries differ from yesterday verified count.', 'AI_VISION',
      '99999999-9999-4999-8999-999999999999'::uuid, NOW(), NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `;

  // Asha Deepthi institute + project (so every seeded alert links to a real place).
  await prisma.$executeRaw`
    INSERT INTO institute_ngos (id, name, "registrationNo", type, "contactEmail", "contactPhone", "addressLine1", state, district, "pinCode", location, status, "createdAt", "updatedAt")
    VALUES ('10101010-1010-4101-8101-101010101010', 'Asha Deepthi Children''s Home', 'MSJE/DL/00234', 'Child Welfare',
      'contact@ashadeepthi.in', '+911140004004', 'Preet Vihar, New Delhi, 110092', 'Delhi', 'East Delhi', '110092',
      ST_SetSRID(ST_MakePoint(77.2695, 28.6381), 4326), 'ACTIVE', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `;
  await prisma.$executeRaw`
    INSERT INTO projects (id, title, "schemeCode", "instituteNgoId", status, location, "beneficiaryCount", "createdAt", "updatedAt")
    VALUES ('20202020-2020-4202-8202-202020202020', 'Asha Deepthi Care Program 2026', 'SCH/DL/2026/04',
      '10101010-1010-4101-8101-101010101010'::uuid, 'IN_PROGRESS',
      ST_SetSRID(ST_MakePoint(77.2695, 28.6381), 4326), 112, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `;

  // The five original alert cards, as real rows (escalation persists).
  const EXTRA_ANOMALIES = [
    {
      id: 'f1111111-1111-4111-8111-111111111111',
      type: 'CCTV_FEED_INTERRUPTED',
      severity: 'CRITICAL',
      title: 'CCTV feed offline for 6+ hours',
      description: 'Camera-03-DORM has reported no signal since 03:12 IST. No maintenance ticket was raised by the institute administrator.',
      source: 'CCTV',
      projectId: '99999999-9999-4999-8999-999999999999',
      confidenceScore: 0.96,
    },
    {
      id: 'f2222222-2222-4222-8222-222222222222',
      type: 'BENEFICIARY_COUNT_MISMATCH',
      severity: 'CRITICAL',
      title: 'Beneficiary headcount mismatch',
      description: 'CCTV person-count (31) is significantly lower than the declared attendance register (42) for three consecutive days.',
      source: 'AI_VISION',
      projectId: '77777777-7777-4777-8777-777777777777',
      confidenceScore: 0.91,
    },
    {
      id: 'f3333333-3333-4333-8333-333333333333',
      type: 'OTHER',
      severity: 'HIGH',
      title: 'Unregistered visitor after hours',
      description: 'Entrance camera detected movement at 01:40 IST with no matching entry in the visitor log.',
      source: 'CCTV',
      projectId: '88888888-8888-4888-8888-888888888888',
      confidenceScore: 0.87,
    },
    {
      id: 'f4444444-4444-4444-8444-444444444444',
      type: 'OTHER',
      severity: 'HIGH',
      title: 'Staff attendance below sanctioned ratio',
      description: 'Only 6 of 10 sanctioned staff have badged in this week, falling below the mandated caregiver ratio.',
      source: 'AI_VISION',
      projectId: '99999999-9999-4999-8999-999999999999',
      confidenceScore: 0.74,
    },
    {
      id: 'f5555555-5555-4555-8555-555555555555',
      type: 'GEO_FENCE_VIOLATION',
      severity: 'MEDIUM',
      title: 'Unusual movement detected',
      description: 'AI detected unusual movement in the restricted zone near the back gate.',
      source: 'AI_VISION',
      projectId: '20202020-2020-4202-8202-202020202020',
      confidenceScore: 0.68,
    },
  ];
  for (const a of EXTRA_ANOMALIES) {
    await prisma.$executeRaw`
      INSERT INTO anomaly_alerts (id, "anomalyType", severity, status, title, description, source, "projectId", "confidenceScore", "detectedAt", "createdAt", "updatedAt")
      VALUES (${a.id}::uuid, ${a.type}, ${a.severity}, 'DETECTED', ${a.title}, ${a.description}, ${a.source},
        ${a.projectId}::uuid, ${a.confidenceScore}, NOW(), NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
