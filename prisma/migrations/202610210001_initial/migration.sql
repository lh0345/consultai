-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Subject" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "icon" VARCHAR(20) NOT NULL DEFAULT 'database',
    "classroomId" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slot" (
    "id" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Slot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "slotId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "question" VARCHAR(2000) NOT NULL DEFAULT '',
    "requestKey" UUID NOT NULL,
    "calendarStatus" VARCHAR(20) NOT NULL DEFAULT 'not_connected',
    "calendarEventId" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "driveId" VARCHAR(150),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" VARCHAR(20) NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_key" ON "Subject"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_classroomId_key" ON "Subject"("classroomId");

-- CreateIndex
CREATE INDEX "Slot_startsAt_idx" ON "Slot"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_slotId_key" ON "Booking"("slotId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_requestKey_key" ON "Booking"("requestKey");

-- CreateIndex
CREATE INDEX "Booking_subjectId_idx" ON "Booking"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Material_driveId_key" ON "Material"("driveId");

-- CreateIndex
CREATE INDEX "Material_subjectId_approved_idx" ON "Material"("subjectId", "approved");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "Slot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
