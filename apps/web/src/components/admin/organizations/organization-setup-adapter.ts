"use client";

import {
  activateOrganization,
  assignOrganizationCourse,
  assignOrganizationMaterial,
  assignOrganizationTeacher,
  createOrganizationDraft,
  createOrganizationFirstClass,
  inviteOrganizationMember,
  updateOrganization,
} from "@/app/actions/admin-clubs";
import type {
  OrganizationRole,
  OrganizationType,
} from "@/lib/organizations/contracts";

export type OrganizationIdentityInput = {
  requestId: string;
  organizationId?: string;
  organizationType: OrganizationType;
  name: string;
  country: string;
  city: string;
  timezone: string;
  logoUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  threadsUrl: string;
};

export type OrganizationPeopleInput = {
  requestId: string;
  organizationId: string;
  email?: string;
  role: OrganizationRole;
};

export type OrganizationClassInput = {
  requestId: string;
  organizationId: string;
  title: string;
  programType: "debate" | "ielts" | "public_speaking";
  teacherId?: string;
};

export type OrganizationResourcesInput = {
  requestId: string;
  organizationId: string;
  classId?: string;
  courseId?: string;
  materialId?: string;
};

export type OrganizationSetupOperations = {
  saveIdentity: (
    input: OrganizationIdentityInput,
  ) => Promise<{ organizationId: string }>;
  savePeople: (input: OrganizationPeopleInput) => Promise<void>;
  saveFirstClass: (
    input: OrganizationClassInput,
  ) => Promise<{ classId: string }>;
  saveResources: (input: OrganizationResourcesInput) => Promise<void>;
  activate: (organizationId: string) => Promise<void>;
  saveSetupVersion: (
    organizationId: string,
    setupVersion: number,
  ) => Promise<void>;
};

function key(...parts: Array<string | number | undefined>) {
  return parts
    .filter((part): part is string | number => part !== undefined)
    .join(":")
    .slice(0, 128);
}

export const organizationSetupOperations: OrganizationSetupOperations = {
  async saveIdentity(input) {
    if (!input.organizationId) {
      const result = await createOrganizationDraft({
        name: input.name,
        organizationType: input.organizationType,
        country: input.country,
        city: input.city,
        timezone: input.timezone,
        idempotencyKey: key(input.requestId, "organization"),
      });
      await updateOrganization({
        organizationId: result.organizationId,
        logoUrl: input.logoUrl || null,
        facebookUrl: input.facebookUrl || null,
        instagramUrl: input.instagramUrl || null,
        threadsUrl: input.threadsUrl || null,
        setupVersion: 2,
        idempotencyKey: key(input.requestId, "identity", 2),
      });
      return { organizationId: result.organizationId };
    }

    await updateOrganization({
      organizationId: input.organizationId,
      name: input.name,
      organizationType: input.organizationType,
      country: input.country,
      city: input.city,
      timezone: input.timezone,
      logoUrl: input.logoUrl || null,
      facebookUrl: input.facebookUrl || null,
      instagramUrl: input.instagramUrl || null,
      threadsUrl: input.threadsUrl || null,
      setupVersion: 2,
      idempotencyKey: key(input.requestId, "identity", 2),
    });
    return { organizationId: input.organizationId };
  },

  async savePeople(input) {
    if (input.email) {
      await inviteOrganizationMember({
        organizationId: input.organizationId,
        email: input.email,
        role: input.role,
        idempotencyKey: key(input.requestId, "invite"),
      });
    }
    await updateOrganization({
      organizationId: input.organizationId,
      setupVersion: 3,
      idempotencyKey: key(input.requestId, "people", 3),
    });
  },

  async saveFirstClass(input) {
    const result = await createOrganizationFirstClass({
      organizationId: input.organizationId,
      title: input.title,
      programType: input.programType,
      status: "draft",
      idempotencyKey: key(input.requestId, "class"),
    });
    if (input.teacherId) {
      await assignOrganizationTeacher({
        organizationId: input.organizationId,
        classId: result.classId,
        teacherId: input.teacherId,
        idempotencyKey: key(input.requestId, "teacher"),
      });
    }
    await updateOrganization({
      organizationId: input.organizationId,
      setupVersion: 4,
      idempotencyKey: key(input.requestId, "class-step", 4),
    });
    return { classId: result.classId };
  },

  async saveResources(input) {
    if (input.classId && input.courseId) {
      await assignOrganizationCourse({
        organizationId: input.organizationId,
        classId: input.classId,
        resourceId: input.courseId,
        idempotencyKey: key(input.requestId, "course"),
      });
    }
    if (input.classId && input.materialId) {
      await assignOrganizationMaterial({
        organizationId: input.organizationId,
        classId: input.classId,
        resourceId: input.materialId,
        idempotencyKey: key(input.requestId, "material"),
      });
    }
  },

  async activate(organizationId) {
    await activateOrganization({
      organizationId,
      idempotencyKey: key(organizationId, "activate", 1),
    });
  },

  async saveSetupVersion(organizationId, setupVersion) {
    await updateOrganization({
      organizationId,
      setupVersion,
      idempotencyKey: key(organizationId, "setup", setupVersion),
    });
  },
};
