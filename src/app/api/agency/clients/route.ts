import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import {
  listAgencyClients,
  createManagedClient,
  enableAgencyMode,
} from '@/core/agency/agency-service';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'agency:read');

    const orgCtx = await getUserActiveOrganization(auth.user.id);
    const clients = await listAgencyClients(orgCtx.organizationId);

    return NextResponse.json({
      success: true,
      data: {
        clients,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'agency:clients_manage');

    const orgCtx = await getUserActiveOrganization(auth.user.id);
    const body = await req.json();

    const { clientName, clientSlug, contactEmail, notes } = body;

    if (!clientName || typeof clientName !== 'string' || !clientName.trim()) {
      return NextResponse.json(
        { error: 'A valid clientName string is required (e.g. "Acme Corporation")' },
        { status: 400 }
      );
    }

    // Auto-enable agency mode if not already enabled
    await enableAgencyMode(orgCtx.organizationId, auth.user.id);

    const combinedNotes = [
      contactEmail ? `Contact: ${contactEmail.trim()}` : null,
      notes?.trim() || null,
    ]
      .filter(Boolean)
      .join(' | ');

    const client = await createManagedClient({
      agencyOrganizationId: orgCtx.organizationId,
      clientName: clientName.trim(),
      clientSlug: clientSlug?.trim() || undefined,
      notes: combinedNotes || undefined,
      actorUserId: auth.user.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          client,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleAuthError(error);
  }
}
